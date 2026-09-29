-- ============================================================================
-- Ayra Ponto — Fase 2D: escalas (12x36 e escala por calendário)
--
-- O que esta migração faz (tudo é ACRESCENTADO; nenhum dado existente é
-- alterado ou apagado — quem já usa jornada semanal continua igual):
--   1. Cria a tabela de turnos (Manhã, Tarde, Noite, Plantão 12h...): nome,
--      sigla, entrada, saída e intervalo.
--   2. Cada pessoa passa a ter um "tipo de escala": jornada semanal (como
--      sempre foi), 12x36 (turno + primeiro dia de trabalho) ou calendário.
--   3. Cria a tabela dos dias da escala por calendário: em que dia a pessoa
--      faz qual turno. Dia sem turno é folga.
--   4. Atualiza a função apurar_periodo (o espelho): o dia previsto passa a
--      vir da escala da pessoa. Folga da escala não vira falta. Na 12x36, o
--      feriado trabalhado NÃO vira hora extra (só avisa): a própria escala já
--      compensa o feriado (Súmula 444 do TST). Também passa a valer que todas
--      as marcações de um turno ficam no dia em que ele começou, mesmo que o
--      intervalo caia depois da meia-noite (turno da noite).
--
-- Um turno que já foi usado em dias que passaram não pode mudar de horário
-- (isso mudaria o espelho do passado): cria-se outro turno e desativa-se o velho.
--
-- Pode ser executada mais de uma vez sem problema.
-- Para desligar: 2026-09-30_fase-2d_escalas_DESFAZER.sql
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 0. Só roda se a Fase 2C já estiver no banco
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regprocedure('public.banco_horas(uuid,date)') is null
     or to_regclass('public.afastamentos') is null then
    raise exception 'Antes desta migração é preciso aplicar a Fase 2C.';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 1. Turnos
-- ---------------------------------------------------------------------------
create table if not exists public.turnos (
  id               uuid primary key default gen_random_uuid(),
  empresa_id       uuid not null references public.empresas(id) on delete cascade,
  nome             text not null check (char_length(nome) between 2 and 40),
  sigla            text not null check (sigla ~ '^[A-Z0-9]{1,3}$'),
  entrada          time not null,
  saida            time not null,
  intervalo_inicio time,
  intervalo_fim    time,
  ativo            boolean not null default true,
  criado_em        timestamptz not null default now(),
  constraint turno_horario check (entrada <> saida),
  constraint turno_intervalo_par check ((intervalo_inicio is null) = (intervalo_fim is null)),
  constraint turno_intervalo_valido check (
    intervalo_inicio is null or intervalo_inicio <> intervalo_fim),
  constraint turno_carga_positiva check (
    public.minutos_previstos_dia(entrada, saida, intervalo_inicio, intervalo_fim) > 0)
);
create unique index if not exists turnos_nome_unico  on public.turnos (empresa_id, lower(nome));
create unique index if not exists turnos_sigla_unica on public.turnos (empresa_id, sigla);

-- Padroniza o texto e impede mudar o horário de um turno que já foi usado no passado
create or replace function public.validar_turno()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.nome  := regexp_replace(btrim(new.nome), '\s+', ' ', 'g');
  new.sigla := upper(btrim(new.sigla));

  if tg_op = 'UPDATE'
     and current_user in ('authenticated', 'anon')
     and (new.entrada, new.saida, new.intervalo_inicio, new.intervalo_fim)
         is distinct from (old.entrada, old.saida, old.intervalo_inicio, old.intervalo_fim)
     and (exists (select 1 from escala_dias ed where ed.turno_id = old.id and ed.data <= current_date)
          or exists (select 1 from perfis p where p.escala_turno_id = old.id and p.escala_referencia <= current_date)) then
    raise exception 'Este turno já foi usado em dias que passaram, e o horário dele não pode mudar (isso mudaria o espelho do passado). Crie um turno novo com o horário certo e desative este.';
  end if;
  return new;
end;
$$;

drop trigger if exists validar_turno on public.turnos;
-- (o gatilho é criado depois, junto com as colunas de perfis, porque olha para elas)

create or replace function public.bloquear_exclusao_turno()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if pg_trigger_depth() > 1 then
    return old;
  end if;
  if exists (select 1 from escala_dias ed where ed.turno_id = old.id)
     or exists (select 1 from perfis p where p.escala_turno_id = old.id) then
    raise exception 'Este turno está em uso numa escala. Desative-o em vez de excluir.';
  end if;
  return old;
end;
$$;

drop trigger if exists bloquear_exclusao_turno on public.turnos;

alter table public.turnos enable row level security;
drop policy if exists "turnos: ver da empresa" on public.turnos;
drop policy if exists "turnos: admin/rh criam" on public.turnos;
drop policy if exists "turnos: admin/rh alteram" on public.turnos;
drop policy if exists "turnos: admin/rh excluem" on public.turnos;
create policy "turnos: ver da empresa" on public.turnos
  for select to authenticated
  using (empresa_id = (select public.empresa_do_usuario()));
create policy "turnos: admin/rh criam" on public.turnos
  for insert to authenticated
  with check (empresa_id = (select public.empresa_do_usuario())
              and (select public.tipo_do_usuario()) in ('administrador', 'rh'));
create policy "turnos: admin/rh alteram" on public.turnos
  for update to authenticated
  using (empresa_id = (select public.empresa_do_usuario())
         and (select public.tipo_do_usuario()) in ('administrador', 'rh'))
  with check (empresa_id = (select public.empresa_do_usuario())
              and (select public.tipo_do_usuario()) in ('administrador', 'rh'));
create policy "turnos: admin/rh excluem" on public.turnos
  for delete to authenticated
  using (empresa_id = (select public.empresa_do_usuario())
         and (select public.tipo_do_usuario()) in ('administrador', 'rh'));
revoke all on public.turnos from anon;

-- ---------------------------------------------------------------------------
-- 2. Pessoas: tipo de escala
-- ---------------------------------------------------------------------------
alter table public.perfis
  add column if not exists tipo_escala       text not null default 'semanal',
  add column if not exists escala_turno_id   uuid references public.turnos(id) on delete restrict,
  add column if not exists escala_referencia date;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'perfis_tipo_escala_check') then
    alter table public.perfis
      add constraint perfis_tipo_escala_check check (tipo_escala in ('semanal', '12x36', 'calendario'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'perfis_escala_12x36_check') then
    alter table public.perfis
      add constraint perfis_escala_12x36_check
      check (tipo_escala <> '12x36' or (escala_turno_id is not null and escala_referencia is not null));
  end if;
end $$;
create index if not exists perfis_escala_turno_idx on public.perfis (escala_turno_id) where escala_turno_id is not null;

-- 12x36 precisa de turno (da mesma empresa) e primeiro dia; nos outros tipos os dois ficam vazios
create or replace function public.validar_escala_perfil()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.tipo_escala = '12x36' then
    if new.escala_turno_id is null or new.escala_referencia is null then
      raise exception 'Na escala 12x36, escolha o turno e o primeiro dia de trabalho.';
    end if;
    if tg_op = 'INSERT' or new.escala_turno_id is distinct from old.escala_turno_id then
      if not exists (select 1 from turnos t
                      where t.id = new.escala_turno_id and t.empresa_id = new.empresa_id and t.ativo) then
        raise exception 'O turno escolhido não pertence a esta empresa ou está desativado.';
      end if;
    end if;
  else
    new.escala_turno_id := null;
    new.escala_referencia := null;
  end if;
  return new;
end;
$$;

drop trigger if exists validar_escala_perfil on public.perfis;
create trigger validar_escala_perfil before insert or update on public.perfis
  for each row execute function public.validar_escala_perfil();

-- Colaborador não altera a própria escala
create or replace function public.proteger_escala_perfil()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  if old.id = auth.uid() and tipo_do_usuario() is distinct from 'administrador'
     and (new.tipo_escala, new.escala_turno_id, new.escala_referencia)
         is distinct from (old.tipo_escala, old.escala_turno_id, old.escala_referencia) then
    raise exception 'A escala só pode ser alterada pelo RH ou pelo administrador.';
  end if;
  return new;
end;
$$;

drop trigger if exists proteger_escala_perfil on public.perfis;
create trigger proteger_escala_perfil before update on public.perfis
  for each row execute function public.proteger_escala_perfil();

-- gatilhos dos turnos (agora que as colunas de perfis existem)
create trigger validar_turno before insert or update on public.turnos
  for each row execute function public.validar_turno();
create trigger bloquear_exclusao_turno before delete on public.turnos
  for each row execute function public.bloquear_exclusao_turno();

-- ---------------------------------------------------------------------------
-- 3. Dias da escala por calendário (dia sem linha = folga)
-- ---------------------------------------------------------------------------
create table if not exists public.escala_dias (
  id             uuid primary key default gen_random_uuid(),
  empresa_id     uuid not null references public.empresas(id) on delete cascade,
  perfil_id      uuid not null references public.perfis(id) on delete cascade,
  data           date not null,
  turno_id       uuid not null references public.turnos(id) on delete restrict,
  atualizado_por uuid references public.perfis(id) on delete set null,
  atualizado_em  timestamptz not null default now(),
  constraint escala_dias_unico unique (perfil_id, data)
);
create index if not exists escala_dias_empresa_data_idx on public.escala_dias (empresa_id, data);
create index if not exists escala_dias_turno_idx on public.escala_dias (turno_id);

create or replace function public.validar_escala_dia()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_empresa uuid;
  v_tipo    text;
begin
  if tg_op = 'UPDATE' and (new.perfil_id, new.data) is distinct from (old.perfil_id, old.data) then
    raise exception 'Para mudar a pessoa ou o dia, apague este dia e crie outro.';
  end if;

  select p.empresa_id, p.tipo_escala into v_empresa, v_tipo from perfis p where p.id = new.perfil_id;
  if v_empresa is null then
    raise exception 'Pessoa não encontrada.';
  end if;
  new.empresa_id := v_empresa;

  if tg_op = 'INSERT' and v_tipo <> 'calendario' then
    raise exception 'Esta pessoa não usa escala por calendário. Mude o tipo de escala na ficha dela.';
  end if;
  if new.data < date '2020-01-01' or new.data > current_date + 730 then
    raise exception 'Escolha um dia entre 2020 e os próximos 2 anos.';
  end if;

  if tg_op = 'INSERT' or new.turno_id is distinct from old.turno_id then
    if not exists (select 1 from turnos t
                    where t.id = new.turno_id and t.empresa_id = v_empresa and t.ativo) then
      raise exception 'O turno escolhido não pertence a esta empresa ou está desativado.';
    end if;
  end if;

  new.atualizado_em := now();
  if current_user in ('authenticated', 'anon') then
    new.atualizado_por := (select auth.uid());
  end if;
  return new;
end;
$$;

drop trigger if exists validar_escala_dia on public.escala_dias;
create trigger validar_escala_dia before insert or update on public.escala_dias
  for each row execute function public.validar_escala_dia();

alter table public.escala_dias enable row level security;
drop policy if exists "escala: ver a própria ou da empresa (admin/rh)" on public.escala_dias;
drop policy if exists "escala: admin/rh criam" on public.escala_dias;
drop policy if exists "escala: admin/rh alteram" on public.escala_dias;
drop policy if exists "escala: admin/rh apagam" on public.escala_dias;
create policy "escala: ver a própria ou da empresa (admin/rh)" on public.escala_dias
  for select to authenticated
  using (perfil_id = (select auth.uid())
         or (empresa_id = (select public.empresa_do_usuario())
             and (select public.tipo_do_usuario()) in ('administrador', 'rh')));
create policy "escala: admin/rh criam" on public.escala_dias
  for insert to authenticated
  with check (empresa_id = (select public.empresa_do_usuario())
              and (select public.tipo_do_usuario()) in ('administrador', 'rh'));
create policy "escala: admin/rh alteram" on public.escala_dias
  for update to authenticated
  using (empresa_id = (select public.empresa_do_usuario())
         and (select public.tipo_do_usuario()) in ('administrador', 'rh'))
  with check (empresa_id = (select public.empresa_do_usuario())
              and (select public.tipo_do_usuario()) in ('administrador', 'rh'));
create policy "escala: admin/rh apagam" on public.escala_dias
  for delete to authenticated
  using (empresa_id = (select public.empresa_do_usuario())
         and (select public.tipo_do_usuario()) in ('administrador', 'rh'));
revoke all on public.escala_dias from anon;

-- ---------------------------------------------------------------------------
-- 4. apurar_periodo, versão 2D
--    Igual à da 2C, mais: o dia previsto vem da escala da pessoa (jornada
--    semanal, 12x36 ou calendário). Folga da escala não vira falta. Na 12x36
--    o feriado trabalhado só avisa. A função devolve uma coluna a mais (turno),
--    por isso é recriada.
-- ---------------------------------------------------------------------------
drop function if exists public.apurar_periodo(uuid, date, date);

create function public.apurar_periodo(
  p_perfil_id uuid,
  p_inicio    date,
  p_fim       date
)
returns table (
  data            date,
  dia_semana      smallint,
  situacao        text,
  feriado_nome    text,
  previsto_min    integer,
  trabalhado_min  integer,
  atraso_min      integer,
  extra_min       integer,
  falta_min       integer,
  abonado_min     integer,
  saldo_min       integer,
  marcacoes       jsonb,
  alertas         text[],
  afastamento_tipo text,
  turno           text
)
language plpgsql
stable
set search_path = public
set jit = off   -- a compilação JIT do Postgres só atrapalha consultas curtas como esta
as $$
#variable_conflict use_column
declare
  v_empresa   uuid;
  v_filial    uuid;
  v_modelo    uuid;
  v_admissao  date;
  v_fuso      text;
  v_tol       integer;
  v_hoje      date;
  v_tipo      text;
  v_turno     uuid;
  v_ref       date;
begin
  if p_inicio is null or p_fim is null or p_fim < p_inicio then
    raise exception 'Período inválido.';
  end if;
  if p_fim - p_inicio > 92 then
    raise exception 'O período pode ter no máximo 93 dias.';
  end if;

  select p.empresa_id, p.filial_id, p.modelo_jornada_id, p.data_admissao,
         p.tipo_escala, p.escala_turno_id, p.escala_referencia
    into v_empresa, v_filial, v_modelo, v_admissao, v_tipo, v_turno, v_ref
    from perfis p where p.id = p_perfil_id;
  if v_empresa is null then
    raise exception 'Pessoa não encontrada.';
  end if;

  -- Quem entra pelo app só vê o próprio espelho (ou o da empresa, se for administrador/RH)
  if current_user in ('authenticated', 'anon') then
    if not (p_perfil_id = (select auth.uid())
            or (v_empresa = (select empresa_do_usuario())
                and (select tipo_do_usuario()) in ('administrador', 'rh'))) then
      raise exception 'Você não tem acesso ao espelho desta pessoa.';
    end if;
  end if;

  select coalesce(f.fuso_horario, 'America/Sao_Paulo') into v_fuso
    from (select 1) x left join filiais f on f.id = v_filial;
  v_fuso := coalesce(v_fuso, 'America/Sao_Paulo');
  v_hoje := (now() at time zone v_fuso)::date;
  -- quem está em escala (12x36 ou calendário) sem jornada usa tolerância de 10 minutos
  select case when v_tipo <> 'semanal' then coalesce(m.tolerancia_minutos, 10)
              else coalesce(m.tolerancia_minutos, 0) end into v_tol
    from (select 1) x left join modelos_jornada m on m.id = v_modelo;

  return query
  with eventos_brutos as (
    -- marcações reais (com o horário corrigido, se houver ajuste aprovado)
    select r.id, r.nsr, r.tipo,
           coalesce(c.marcacao_solicitada, r.marcado_em) as em,
           r.marcado_em as em_original,
           case when c.id is not null then 'corrigida' else 'real' end as origem,
           c.id as ajuste_id
      from registros_ponto r
      left join lateral (
        select a.id, a.marcacao_solicitada
          from ajustes_ponto a
         where a.registro_original_id = r.id
           and a.status = 'aprovado'
           and a.tipo = 'correcao_marcacao'
           and a.marcacao_solicitada is not null
         order by a.analisado_em desc nulls last, a.criado_em desc
         limit 1) c on true
     where r.perfil_id = p_perfil_id
    union all
    -- marcações esquecidas, incluídas por ajuste aprovado
    select a.id, null::bigint, a.tipo_marcacao, a.marcacao_solicitada, null::timestamptz,
           'incluida', a.id
      from ajustes_ponto a
     where a.perfil_id = p_perfil_id
       and a.status = 'aprovado'
       and a.tipo = 'inclusao_esquecida'
       and a.tipo_marcacao is not null
       and a.marcacao_solicitada is not null
  ),
  eventos as (
    select e.*,
           lag(e.tipo)  over w as tipo_anterior,
           lead(e.tipo) over w as tipo_seguinte,
           lead(e.em)   over w as em_seguinte,
           lag(e.em)    over w as em_anterior,
           -- a entrada mais recente até aqui: define de que "dia de trabalho" é cada marcação
           max(case when e.tipo = 'entrada' then e.em end)
             over (w rows between unbounded preceding and current row) as ult_entrada
      from eventos_brutos e
     where e.em >= ((p_inicio - 2)::timestamp at time zone v_fuso)
       and e.em <  ((p_fim + 3)::timestamp at time zone v_fuso)
    window w as (order by e.em, e.nsr nulls last, e.id)
  ),
  classificados as (
    select e.*,
           (e.tipo in ('entrada', 'fim_intervalo')) as abre,
           (e.tipo in ('entrada', 'fim_intervalo')
              and coalesce(e.tipo_seguinte::text, '') in ('saida', 'inicio_intervalo')) as abre_com_par,
           (e.tipo in ('saida', 'inicio_intervalo')
              and coalesce(e.tipo_anterior::text, '') in ('entrada', 'fim_intervalo')) as fecha_com_par,
           case when e.tipo = 'inicio_intervalo' and coalesce(e.tipo_seguinte::text, '') = 'fim_intervalo'
                then floor(extract(epoch from (e.em_seguinte - e.em)) / 60)::integer end as int_min,
           (e.em at time zone v_fuso)::date as dia_proprio,
           -- o dia de trabalho é o dia da entrada (turno da noite, com intervalo antes
           -- ou depois da meia-noite, fica inteiro no dia em que começou)
           (case when e.ult_entrada is not null and e.em - e.ult_entrada <= interval '20 hours'
                 then (e.ult_entrada at time zone v_fuso)::date
                 else (e.em at time zone v_fuso)::date end) as dia_ref
      from eventos e
  ),
  por_dia as (
    select c.dia_ref as dia,
           coalesce(sum(case when c.abre_com_par
                             then floor(extract(epoch from (c.em_seguinte - c.em)) / 60)::integer end), 0) as trabalhado,
           count(*) filter (where c.abre and not c.abre_com_par)                          as abertas,
           count(*) filter (where not c.abre and not c.fecha_com_par)                     as sem_par,
           count(*) filter (where c.tipo = 'inicio_intervalo')                            as n_intervalos,
           coalesce(sum(c.int_min), 0)                                                    as intervalo_total,
           count(*)                                                                       as n_marcacoes,
           jsonb_agg(jsonb_build_object(
             'id', c.id, 'nsr', c.nsr, 'tipo', c.tipo, 'em', c.em,
             'origem', c.origem, 'em_original', c.em_original, 'ajuste_id', c.ajuste_id)
             order by c.em, c.nsr nulls last) as marcacoes
      from classificados c
     group by c.dia_ref
  ),
  dias as (
    -- turno do dia: 12x36 = de dois em dois dias a partir do primeiro dia de trabalho;
    -- calendário = o que foi marcado na grade; semanal = usa a jornada (sem turno)
    select d::date as dia,
           case v_tipo
             when '12x36' then
               case when ((d::date - v_ref) % 2 + 2) % 2 = 0 then v_turno end
             when 'calendario' then
               (select ed.turno_id from escala_dias ed
                 where ed.perfil_id = p_perfil_id and ed.data = d::date)
           end as turno_id
      from generate_series(p_inicio::timestamp, p_fim::timestamp, interval '1 day') d
  ),
  base as (
    select d.dia,
           extract(dow from d.dia)::smallint as dow,
           case when v_tipo = 'semanal' then coalesce(jd.trabalha, false)
                else t.id is not null end as jd_trabalha,
           case when v_tipo = 'semanal' then jd.intervalo_inicio
                else t.intervalo_inicio end as jd_intervalo,
           case when v_tipo = 'semanal' then
                  case when jd.trabalha
                       then minutos_previstos_dia(jd.entrada, jd.saida, jd.intervalo_inicio, jd.intervalo_fim)
                       else 0 end
                when t.id is not null
                then minutos_previstos_dia(t.entrada, t.saida, t.intervalo_inicio, t.intervalo_fim)
                else 0 end as previsto_base,
           d.turno_id,
           case when t.id is not null
                then t.nome || ' ' || to_char(t.entrada, 'HH24:MI') || '–' || to_char(t.saida, 'HH24:MI')
                end as turno_txt,
           (select f.nome from feriados f
             where f.empresa_id = v_empresa and f.data = d.dia
               and (f.filial_id is null or f.filial_id = v_filial)
             order by (f.filial_id is null), f.nome limit 1) as feriado,
           exists (select 1 from ajustes_ponto a
                    where a.perfil_id = p_perfil_id and a.status = 'aprovado' and a.tipo = 'folga'
                      and d.dia between a.data_referencia and coalesce(a.data_fim, a.data_referencia)) as folga,
           exists (select 1 from ajustes_ponto a
                    where a.perfil_id = p_perfil_id and a.status = 'aprovado' and a.tipo = 'abono'
                      and d.dia between a.data_referencia and coalesce(a.data_fim, a.data_referencia)) as abono,
           coalesce(pd.trabalhado, 0) as trabalhado,
           coalesce(pd.abertas, 0)    as abertas,
           coalesce(pd.sem_par, 0)    as sem_par,
           coalesce(pd.n_intervalos, 0) as n_intervalos,
           coalesce(pd.intervalo_total, 0) as intervalo_total,
           (select af.tipo from afastamentos af
             where af.perfil_id = p_perfil_id and af.cancelado_em is null
               and d.dia between af.data_inicio and af.data_fim
             order by af.data_inicio limit 1) as afast_tipo,
           coalesce(pd.n_marcacoes, 0)  as n_marcacoes,
           coalesce(pd.marcacoes, '[]'::jsonb) as marcacoes
      from dias d
      left join modelos_jornada_dias jd
        on v_tipo = 'semanal' and jd.modelo_id = v_modelo
       and jd.dia_semana = extract(dow from d.dia)::smallint
      left join turnos t on t.id = d.turno_id
      left join por_dia pd on pd.dia = d.dia
  ),
  com_situacao as (
    select b.*,
           case
             when v_admissao is not null and b.dia < v_admissao                     then 'antes_admissao'
             when b.afast_tipo is not null                                          then 'afastado'
             when b.folga                                                           then 'folga'
             when b.feriado is not null
                  and not (v_tipo = '12x36' and b.turno_id is not null)             then 'feriado'
             when b.dia > v_hoje                                                    then 'futuro'
             when b.abono                                                           then 'abonado'
             when (b.abertas > 0 or b.sem_par > 0) and b.dia = v_hoje               then 'em_andamento'
             when b.abertas > 0 or b.sem_par > 0                                    then 'incompleto'
             when v_modelo is null and v_tipo = 'semanal' and b.trabalhado = 0     then 'sem_jornada'
             when b.previsto_base = 0 and b.trabalhado = 0 and v_tipo <> 'semanal'  then 'folga_escala'
             when b.previsto_base = 0 and b.trabalhado = 0                          then 'dia_livre'
             when b.previsto_base > 0 and b.trabalhado = 0 and b.dia = v_hoje       then 'em_andamento'
             when b.previsto_base > 0 and b.trabalhado = 0                          then 'falta'
             else 'trabalhado'
           end as sit
      from base b
  ),
  contas as (
    select s.*,
           -- previsto que vale para o dia
           case when s.sit in ('antes_admissao', 'afastado', 'folga', 'feriado', 'sem_jornada', 'dia_livre', 'folga_escala') then 0
                else s.previsto_base end as prev,
           -- trabalhado que vale (antes da admissão nada vale)
           case when s.sit = 'antes_admissao' then 0 else s.trabalhado end as trab
      from com_situacao s
  ),
  final as (
    select c.*,
           case
             when c.sit in ('afastado', 'folga', 'feriado') then c.trab
             when c.sit = 'trabalhado' and c.prev = 0 then c.trab
             when c.sit in ('trabalhado', 'abonado') and c.trab - c.prev > v_tol then c.trab - c.prev
             else 0 end as extra,
           case
             when c.sit = 'trabalhado' and c.prev > 0 and c.prev - c.trab > v_tol then c.prev - c.trab
             else 0 end as atraso,
           case when c.sit = 'falta' then c.prev else 0 end as falta,
           case when c.sit = 'abonado' then greatest(c.prev - c.trab, 0) else 0 end as abonado
      from contas c
  )
  select f.dia,
         f.dow,
         f.sit,
         f.feriado,
         f.prev::integer,
         f.trab::integer,
         f.atraso::integer,
         f.extra::integer,
         f.falta::integer,
         f.abonado::integer,
         (f.extra - f.atraso - f.falta)::integer,
         f.marcacoes,
         array_remove(array[
           case when f.abertas > 0 or f.sem_par > 0
                then 'Marcação sem par: falta uma entrada ou uma saída. Peça o ajuste.' end,
           case when f.sit = 'trabalhado' and f.jd_intervalo is not null and f.n_intervalos = 0
                     and f.abertas = 0 and f.sem_par = 0
                then 'Sem marcação de intervalo. O intervalo não foi descontado das horas.' end,
           case when f.sit = 'trabalhado' and f.jd_intervalo is null and f.n_intervalos = 0
                     and f.abertas = 0 and f.sem_par = 0 and f.trab > 360
                then 'Sem intervalo registrado em jornada de mais de 6 horas (a lei pede 1 hora de intervalo).' end,
           case when f.sit in ('trabalhado', 'abonado') and f.n_intervalos > 0 and f.abertas = 0 and f.sem_par = 0
                     and f.trab > 360 and f.intervalo_total < 60
                then 'Intervalo de menos de 1 hora em jornada de mais de 6 horas.' end,
           case when f.sit in ('trabalhado', 'abonado') and f.n_intervalos > 0 and f.abertas = 0 and f.sem_par = 0
                     and f.trab > 240 and f.trab <= 360 and f.intervalo_total < 15
                then 'Intervalo de menos de 15 minutos em jornada de mais de 4 horas.' end,
           case when f.sit = 'afastado' and f.trab > 0 then 'Trabalhou durante um afastamento.' end,
           case when f.sit = 'feriado' and f.trab > 0 then 'Trabalhou em feriado.' end,
           case when f.sit = 'folga' and f.trab > 0 then 'Trabalhou em dia de folga aprovada.' end,
           case when f.sit = 'trabalhado' and f.prev = 0 and f.trab > 0 and f.jd_trabalha is not true
                then case when v_tipo = 'semanal' then 'Trabalhou em dia sem jornada prevista.'
                          else 'Trabalhou em dia de folga da escala.' end end,
           case when f.sit = 'trabalhado' and f.feriado is not null and v_tipo = '12x36' and f.trab > 0
                then 'Trabalhou em feriado. Na escala 12x36 o feriado já está compensado pela própria escala, então não vira hora extra.' end,
           case when f.sit = 'antes_admissao' and f.n_marcacoes > 0
                then 'Há marcações antes da data de admissão.' end
         ], null),
         f.afast_tipo,
         f.turno_txt
    from final f
   order by f.dia;
end;
$$;

comment on function public.apurar_periodo(uuid, date, date) is
  'Espelho de ponto: dia a dia, horas previstas (jornada semanal, 12x36 ou escala por calendário), trabalhadas, atrasos, extras, faltas, abonos e afastamentos. Ajustes aprovados entram só no cálculo.';


-- ---------------------------------------------------------------------------
-- 5. Quem pode chamar (só quem está logado)
-- ---------------------------------------------------------------------------
revoke execute on function public.apurar_periodo(uuid, date, date) from public, anon;
grant  execute on function public.apurar_periodo(uuid, date, date) to authenticated;

notify pgrst, 'reload schema';
