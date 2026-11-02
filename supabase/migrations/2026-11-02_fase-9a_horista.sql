-- ============================================================================
-- Ayra Ponto — Fase 9A: horista (pago por hora)
--
-- O que esta migração faz (nenhuma marcação existente é alterada):
--   1. Novo jeito de trabalhar: "horista" (sem horário fixo). A pessoa não tem
--      jornada: o Ayra não aponta falta nem atraso, só soma as horas.
--      Até o limite diário da pessoa as horas são normais; o que passar vira
--      hora extra. O limite é definido na ficha (padrão 8 horas).
--   2. "Pago por hora" na ficha: vale para o horista sem horário fixo e também
--      para quem tem jornada ou escala e recebe por hora (aí continuam as
--      faltas e atrasos de sempre).
--   3. valores_hora: o valor da hora de cada pessoa, com a data a partir da
--      qual vale (o histórico fica guardado). Só administrador e RH veem.
--      No modo suporte da Ayra os valores ficam escondidos.
--   4. pagamento_por_hora(): estimativa em reais do período (horas normais,
--      extras, adicional noturno, intervalos a pagar e DSR estimado).
--      relatorio_horistas(): a mesma conta para todas as pessoas pagas por hora.
--   5. A conferência da semana (limite semanal das Regras de cálculo) passa a
--      valer também para o horista.
--
-- Pode ser executada mais de uma vez sem problema.
-- Para desligar: 2026-11-02_fase-9a_horista_DESFAZER.sql
-- ============================================================================

do $$
begin
  if to_regclass('public.regras_calculo') is null
     or to_regprocedure('public.apurar_clt(uuid, date, date)') is null then
    raise exception 'Antes desta migração é preciso aplicar a Fase 7A (regras de cálculo). Nada foi alterado.';
  end if;
  if to_regprocedure('public.em_suporte()') is null then
    raise exception 'Antes desta migração é preciso aplicar a Fase 8B (suporte autorizado). Nada foi alterado.';
  end if;
end $$;

begin;

-- ---------------------------------------------------------------------------
-- 1 e 2. Ficha da pessoa
-- ---------------------------------------------------------------------------
alter table public.perfis add column if not exists pago_por_hora     boolean  not null default false;
alter table public.perfis add column if not exists limite_diario_min smallint not null default 480;

alter table public.perfis drop constraint if exists perfis_tipo_escala_check;
alter table public.perfis add constraint perfis_tipo_escala_check
  check (tipo_escala in ('semanal', '12x36', 'calendario', 'horista'));

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'perfis_limite_diario_check') then
    alter table public.perfis add constraint perfis_limite_diario_check check (limite_diario_min between 60 and 720);
  end if;
end $$;

-- Horista sem horário fixo é sempre pago por hora
create or replace function public.ajustar_horista()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.tipo_escala = 'horista' then
    new.pago_por_hora := true;
  end if;
  return new;
end;
$$;

drop trigger if exists ajustar_horista on public.perfis;
create trigger ajustar_horista before insert or update on public.perfis
  for each row execute function public.ajustar_horista();

-- Só administrador e RH mudam o pagamento por hora e o limite diário.
-- O RH não altera o próprio cadastro nem o de um administrador.
create or replace function public.proteger_dados_horista()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_tipo tipo_perfil;
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  if (new.pago_por_hora, new.limite_diario_min) is not distinct from (old.pago_por_hora, old.limite_diario_min) then
    return new;
  end if;
  v_tipo := tipo_do_usuario();
  if v_tipo = 'administrador' then
    return new;
  end if;
  if v_tipo = 'rh' and old.id <> auth.uid() and old.tipo <> 'administrador' then
    return new;
  end if;
  raise exception 'A forma de pagamento e o limite diário só podem ser alterados pelo RH ou pelo administrador.';
end;
$$;

drop trigger if exists proteger_dados_horista on public.perfis;
create trigger proteger_dados_horista before update on public.perfis
  for each row execute function public.proteger_dados_horista();

-- Limite diário, com a mesma regra de acesso do espelho
create or replace function public.limite_diario_da_pessoa(p_perfil_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select p.limite_diario_min::integer
    from perfis p
   where p.id = p_perfil_id
     and (auth.uid() is null
          or p.id = auth.uid()
          or (p.empresa_id = public.empresa_do_usuario()
              and public.tipo_do_usuario() in ('administrador', 'rh'))
          or public.eh_gestor_de(p.id));
$$;

-- ---------------------------------------------------------------------------
-- 3. Valor da hora (com a data a partir da qual vale)
-- ---------------------------------------------------------------------------
create table if not exists public.valores_hora (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  uuid not null references public.empresas(id) on delete cascade,
  perfil_id   uuid not null references public.perfis(id) on delete cascade,
  valor       numeric(10,2) not null,
  desde       date not null,
  criado_por  uuid references public.perfis(id) on delete set null,
  criado_em   timestamptz not null default now(),
  constraint valores_hora_valor_check check (valor > 0 and valor <= 100000),
  constraint valores_hora_um_por_dia unique (perfil_id, desde)
);
create index if not exists valores_hora_empresa_idx on public.valores_hora (empresa_id);

alter table public.valores_hora enable row level security;

drop policy if exists "valores_hora: admin/rh veem a empresa" on public.valores_hora;
create policy "valores_hora: admin/rh veem a empresa" on public.valores_hora
  for select to authenticated
  using (empresa_id = (select public.empresa_do_usuario())
         and (select public.tipo_do_usuario()) in ('administrador', 'rh')
         and not (select public.em_suporte()));

-- ninguém grava direto: só pelas funções abaixo
revoke all on public.valores_hora from public, anon, authenticated;
grant select on public.valores_hora to authenticated;

-- quem pode definir o valor da hora desta pessoa (devolve a empresa)
create or replace function public.pode_definir_valor_hora(p_perfil_id uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_alvo perfis;
  v_tipo tipo_perfil;
begin
  if auth.uid() is null then
    raise exception 'É preciso estar logado.';
  end if;
  if em_suporte() then
    raise exception 'Os valores de pagamento não podem ser vistos nem alterados no modo suporte.';
  end if;
  select * into v_alvo from perfis where id = p_perfil_id;
  if v_alvo.id is null or v_alvo.empresa_id is distinct from empresa_do_usuario() then
    raise exception 'Pessoa não encontrada.';
  end if;
  v_tipo := tipo_do_usuario();
  if v_tipo = 'administrador'
     or (v_tipo = 'rh' and v_alvo.id <> auth.uid() and v_alvo.tipo <> 'administrador') then
    return v_alvo.empresa_id;
  end if;
  raise exception 'O valor da hora só pode ser alterado pelo RH ou pelo administrador.';
end;
$$;

create or replace function public.definir_valor_hora(p_perfil_id uuid, p_valor numeric, p_desde date)
returns public.valores_hora
language plpgsql
security definer
set search_path = public
as $$
declare
  v_empresa uuid;
  v_linha   valores_hora;
begin
  v_empresa := pode_definir_valor_hora(p_perfil_id);
  if p_valor is null or p_valor <= 0 then
    raise exception 'Informe o valor da hora.';
  end if;
  if p_valor > 100000 then
    raise exception 'O valor da hora parece alto demais. Confira o número.';
  end if;
  if p_desde is null then
    raise exception 'Informe a partir de quando o valor vale.';
  end if;
  if p_desde > current_date + 366 then
    raise exception 'A data pode ser no máximo daqui a um ano.';
  end if;
  insert into valores_hora (empresa_id, perfil_id, valor, desde, criado_por)
  values (v_empresa, p_perfil_id, round(p_valor, 2), p_desde, auth.uid())
  on conflict (perfil_id, desde) do update
    set valor = excluded.valor, criado_por = excluded.criado_por, criado_em = now()
  returning * into v_linha;
  return v_linha;
end;
$$;

create or replace function public.excluir_valor_hora(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_perfil uuid;
begin
  select perfil_id into v_perfil from valores_hora where id = p_id;
  if v_perfil is null then
    raise exception 'Valor não encontrado.';
  end if;
  perform pode_definir_valor_hora(v_perfil);
  delete from valores_hora where id = p_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 1 e 5. Contas do espelho com o horista
--   (as mesmas funções das Fases 3B e 7A, com o horista)
-- ---------------------------------------------------------------------------
create or replace function public.apurar_periodo(
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
  v_lim       integer;
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
    from public.dados_para_apuracao(p_perfil_id) p;
  if v_empresa is null then
    raise exception 'Pessoa não encontrada.';
  end if;
  -- horista sem horário fixo: limite de horas normais por dia (o resto é extra)
  v_lim := coalesce(public.limite_diario_da_pessoa(p_perfil_id), 480);

  -- Quem entra pelo app só vê o próprio espelho, o da empresa (administrador/RH)
  -- ou o da própria equipe (gestor)
  if current_user in ('authenticated', 'anon') then
    if not (p_perfil_id = (select auth.uid())
            or (v_empresa = (select empresa_do_usuario())
                and (select tipo_do_usuario()) in ('administrador', 'rh'))
            or public.eh_gestor_de(p_perfil_id)) then
      raise exception 'Você não tem acesso ao espelho desta pessoa.';
    end if;
  end if;

  select coalesce(f.fuso_horario, 'America/Sao_Paulo') into v_fuso
    from (select 1) x left join filiais f on f.id = v_filial;
  v_fuso := coalesce(v_fuso, 'America/Sao_Paulo');
  v_hoje := (now() at time zone v_fuso)::date;
  -- quem está em escala (12x36 ou calendário) sem jornada usa tolerância de 10 minutos
  select case when v_tipo = 'horista' then coalesce(m.tolerancia_minutos, 0)
              when v_tipo <> 'semanal' then coalesce(m.tolerancia_minutos, 10)
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
  base as materialized (
    select d.dia,
           extract(dow from d.dia)::smallint as dow,
           case when v_tipo = 'horista' then coalesce(pd.trabalhado, 0) > 0
                when v_tipo = 'semanal' then coalesce(jd.trabalha, false)
                else t.id is not null end as jd_trabalha,
           case when v_tipo = 'semanal' then jd.intervalo_inicio
                else t.intervalo_inicio end as jd_intervalo,
           -- horista: o previsto é o que trabalhou, até o limite do dia
           case when v_tipo = 'horista' then least(coalesce(pd.trabalhado, 0), v_lim)
                when v_tipo = 'semanal' then
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
  com_situacao as materialized (
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
             when b.previsto_base = 0 and b.trabalhado = 0 and v_tipo not in ('semanal', 'horista') then 'folga_escala'
             when b.previsto_base = 0 and b.trabalhado = 0                          then 'dia_livre'
             when b.previsto_base > 0 and b.trabalhado = 0 and b.dia = v_hoje       then 'em_andamento'
             when b.previsto_base > 0 and b.trabalhado = 0                          then 'falta'
             else 'trabalhado'
           end as sit
      from base b
  ),
  contas as materialized (
    select s.*,
           -- previsto que vale para o dia
           case when s.sit in ('antes_admissao', 'afastado', 'folga', 'feriado', 'sem_jornada', 'dia_livre', 'folga_escala') then 0
                else s.previsto_base end as prev,
           -- trabalhado que vale (antes da admissão nada vale)
           case when s.sit = 'antes_admissao' then 0 else s.trabalhado end as trab
      from com_situacao s
  ),
  final as materialized (
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

create or replace function public.apurar_clt(
  p_perfil_id uuid,
  p_inicio    date,
  p_fim       date
)
returns table (
  data                     date,
  dia_semana               smallint,
  situacao                 text,
  feriado_nome             text,
  previsto_min             integer,
  trabalhado_min           integer,
  atraso_min               integer,
  extra_min                integer,
  falta_min                integer,
  abonado_min              integer,
  saldo_min                integer,
  marcacoes                jsonb,
  alertas                  text[],
  afastamento_tipo         text,
  turno                    text,
  extra_normal_min         integer,
  extra_especial_min       integer,
  noturno_min              integer,
  noturno_reduzido_min     integer,
  intervalo_feito_min      integer,
  intervalo_a_pagar_min    integer,
  descanso_anterior_min    integer,
  interjornada_a_pagar_min integer,
  dsr_perdido              boolean,
  semana_min               integer,
  banco                    boolean
)
language plpgsql
stable
set search_path = public
set jit = off
as $$
#variable_conflict use_column
declare
  v_empresa  uuid;
  v_filial   uuid;
  v_modelo   uuid;
  v_admissao date;
  v_tipo     text;
  v_fuso     text;
  v_r        regras_calculo;
  v_usa      boolean;
  v_bh_ini   date;
  v_janela   integer;
begin
  if p_inicio is null or p_fim is null or p_fim < p_inicio then
    raise exception 'Período inválido.';
  end if;
  if p_fim - p_inicio > 84 then
    raise exception 'O período pode ter no máximo 85 dias.';
  end if;

  select p.empresa_id, p.filial_id, p.modelo_jornada_id, p.data_admissao, p.tipo_escala
    into v_empresa, v_filial, v_modelo, v_admissao, v_tipo
    from public.dados_para_apuracao(p_perfil_id) p;
  if v_empresa is null then
    raise exception 'Pessoa não encontrada.';
  end if;

  v_r := regras_da_empresa(v_empresa);
  select coalesce(f.fuso_horario, 'America/Sao_Paulo') into v_fuso
    from (select 1) x left join filiais f on f.id = v_filial;
  v_fuso := coalesce(v_fuso, 'America/Sao_Paulo');

  select coalesce(m.usa_banco_horas, false),
         greatest(m.banco_horas_inicio, coalesce(v_admissao, m.banco_horas_inicio))
    into v_usa, v_bh_ini
    from (select 1) x left join modelos_jornada m on m.id = v_modelo;

  -- tamanho da janela noturna, em minutos (22h–5h = 420)
  v_janela := (extract(epoch from (v_r.noturno_fim - v_r.noturno_inicio)) / 60)::integer;
  if v_janela <= 0 then v_janela := v_janela + 1440; end if;

  return query
  with ap as materialized (
    -- 7 dias antes, para o descanso entre dias, a semana e o DSR
    select * from apurar_periodo(p_perfil_id, p_inicio - 7, p_fim)
  ),
  ev as (
    select a.data as dia, m.ord, m.v ->> 'tipo' as tipo, (m.v ->> 'em')::timestamptz as em
      from ap a
      cross join lateral jsonb_array_elements(a.marcacoes) with ordinality as m(v, ord)
  ),
  pares as (
    select e.dia, e.tipo, e.em,
           lead(e.tipo) over w as tipo_seg,
           lead(e.em)   over w as em_seg
      from ev e
    window w as (partition by e.dia order by e.em, e.ord)
  ),
  trechos as (
    select p.dia, (p.em at time zone v_fuso) as ini, (p.em_seg at time zone v_fuso) as fim
      from pares p
     where p.tipo in ('entrada', 'fim_intervalo')
       and p.tipo_seg in ('saida', 'inicio_intervalo')
       and p.em_seg > p.em
  ),
  noite_trecho as (
    select t.dia,
           coalesce(sum(greatest(0, extract(epoch from (least(t.fim, j.wf) - greatest(t.ini, j.wi))) / 60)), 0) as noite,
           coalesce(max(case when t.ini < j.wf and t.fim > j.wf
                             then extract(epoch from (t.fim - j.wf)) / 60 end), 0) as depois
      from trechos t
      cross join lateral (
        select d + v_r.noturno_inicio as wi,
               case when v_r.noturno_fim > v_r.noturno_inicio then d + v_r.noturno_fim
                    else d + 1 + v_r.noturno_fim end as wf
          from generate_series(t.ini::date - 1, t.fim::date, interval '1 day') as g(dd),
               lateral (select g.dd::date as d) x
      ) j
     group by t.dia, t.ini, t.fim
  ),
  noite_dia as (
    select n.dia, sum(n.noite) as noite, sum(n.depois) as depois
      from noite_trecho n
     group by n.dia
  ),
  intervalos as (
    select p.dia, sum(floor(extract(epoch from (p.em_seg - p.em)) / 60))::integer as minutos,
           count(*) as qtd
      from pares p
     where p.tipo = 'inicio_intervalo' and p.tipo_seg = 'fim_intervalo'
     group by p.dia
  ),
  limites_dia as (
    select e.dia,
           min(e.em) filter (where e.tipo = 'entrada') as primeira_entrada,
           max(e.em) filter (where e.tipo = 'saida')   as ultima_saida
      from ev e
     group by e.dia
  ),
  descanso as (
    select l.dia, l.primeira_entrada,
           lag(l.ultima_saida) over (order by l.dia) as saida_anterior
      from limites_dia l
     where l.primeira_entrada is not null or l.ultima_saida is not null
  ),
  base as materialized (
    select a.*,
           coalesce(nd.noite, 0)  as noite,
           coalesce(nd.depois, 0) as depois,
           coalesce(i.minutos, 0) as int_min,
           coalesce(i.qtd, 0)     as int_qtd,
           case when ds.primeira_entrada is not null and ds.saida_anterior is not null
                     and ds.primeira_entrada > ds.saida_anterior
                then floor(extract(epoch from (ds.primeira_entrada - ds.saida_anterior)) / 60)::integer
           end as descanso,
           -- extra em percentual especial: feriado e folga trabalhados; dia sem
           -- jornada prevista no domingo (jornada semanal) ou folga da escala
           (v_r.extra_especial_folgas
            and (a.situacao in ('feriado', 'folga')
                 or (a.situacao = 'trabalhado' and a.previsto_min = 0
                     and (v_tipo <> 'semanal' or a.dia_semana = 0)))) as especial
      from ap a
      left join noite_dia  nd on nd.dia = a.data
      left join intervalos i  on i.dia  = a.data
      left join descanso   ds on ds.dia = a.data
  ),
  contas as materialized (
    select b.*,
           (b.noite + case when v_r.prorrogar_noturno and b.noite >= v_janela - 60 then b.depois else 0 end) as not_min,
           case
             when b.situacao in ('trabalhado', 'abonado', 'feriado', 'folga', 'afastado')
                  and not (v_r.intervalo_pre_assinalado and b.int_qtd = 0)
             then greatest((case when b.trabalhado_min > 360 then 60
                                 when b.trabalhado_min > 240 then 15 else 0 end) - b.int_min, 0)
             else 0 end as int_pagar,
           case when b.descanso is not null and b.descanso < v_r.interjornada_min
                then v_r.interjornada_min - b.descanso else 0 end as inter_pagar,
           -- semana de segunda a domingo, calculada no domingo
           case when b.dia_semana = 0 then
                  (select sum(x.trabalhado_min) from ap x where x.data between b.data - 6 and b.data)::integer
           end as semana,
           case when v_tipo = 'semanal' and b.dia_semana = 0 and b.previsto_min = 0
                     and b.situacao <> 'antes_admissao' then
                  ((v_r.dsr_perde_falta and exists (
                      select 1 from ap x where x.data between b.data - 6 and b.data - 1 and x.situacao = 'falta'))
                   or (v_r.dsr_perde_atraso and exists (
                      select 1 from ap x where x.data between b.data - 6 and b.data - 1 and x.atraso_min > 0)))
                else false end as dsr
      from base b
  )
  select c.data, c.dia_semana, c.situacao, c.feriado_nome, c.previsto_min, c.trabalhado_min,
         c.atraso_min, c.extra_min, c.falta_min, c.abonado_min, c.saldo_min, c.marcacoes,
         c.alertas || array_remove(array[
           case when c.inter_pagar > 0
                then 'Descansou só ' || texto_duracao(c.descanso) || ' desde a saída do dia anterior (o mínimo é '
                     || texto_duracao(v_r.interjornada_min::integer) || '). O tempo que faltou é pago como hora extra.' end,
           case when c.int_pagar > 0 and c.int_qtd > 0
                then 'Faltaram ' || texto_duracao(c.int_pagar) || ' de intervalo. A lei manda pagar esse tempo com 50% a mais.' end,
           case when c.int_pagar > 0 and c.int_qtd = 0
                then 'Sem intervalo registrado: ' || texto_duracao(c.int_pagar) || ' de intervalo a pagar com 50% a mais (se a pessoa fez o intervalo, peça o ajuste).' end,
           case when c.dsr
                then 'DSR perdido: houve falta sem justificativa na semana.' end,
           case when v_tipo in ('semanal', 'horista') and c.semana > v_r.limite_semanal_min
                then 'A semana somou ' || texto_duracao(c.semana) || ', acima do limite de '
                     || texto_duracao(v_r.limite_semanal_min::integer) || '.' end
         ], null),
         c.afastamento_tipo, c.turno,
         (c.extra_min - case when c.especial then c.extra_min else 0 end)::integer,
         (case when c.especial then c.extra_min else 0 end)::integer,
         round(c.not_min)::integer,
         round(case when v_r.hora_noturna_reduzida then c.not_min * 60 / 52.5 else c.not_min end)::integer,
         c.int_min,
         c.int_pagar::integer,
         c.descanso,
         c.inter_pagar::integer,
         c.dsr,
         c.semana,
         (v_usa and v_bh_ini is not null and c.data >= v_bh_ini)
    from contas c
   where c.data between p_inicio and p_fim
   order by c.data;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Pagamento por hora: estimativa em reais
--    Horas normais e abonadas x valor da hora; extras com o percentual das
--    Regras de cálculo; adicional noturno (e a diferença da hora reduzida);
--    intervalo e descanso a pagar com 50%. DSR estimado: o total variável
--    dividido pelos dias úteis e multiplicado por domingos e feriados.
--    Não inclui férias, 13º, INSS, FGTS nem descontos: é para a folha conferir.
-- ---------------------------------------------------------------------------
create or replace function public.pagamento_por_hora(p_perfil_id uuid, p_inicio date, p_fim date)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
set jit = off
as $$
declare
  v_emp     uuid;
  v_r       regras_calculo;
  d         record;
  v_valor   numeric;
  v_normal  integer;
  m_normal  integer := 0;  m_ext_n integer := 0;  m_ext_e integer := 0;
  m_not     integer := 0;  m_not_r integer := 0;  m_pagar integer := 0;
  r_normal  numeric := 0;  r_ext_n numeric := 0;  r_ext_e numeric := 0;
  r_not     numeric := 0;  r_red   numeric := 0;  r_pagar numeric := 0;
  v_sem     integer := 0;
  v_uteis   integer := 0;
  v_repouso integer := 0;
  v_variavel numeric;
  v_dsr     numeric := 0;
  v_atual   numeric;
begin
  if p_inicio is null or p_fim is null or p_fim < p_inicio then
    raise exception 'Período inválido.';
  end if;
  if p_fim - p_inicio > 61 then
    raise exception 'O período pode ter no máximo 62 dias.';
  end if;
  select p.empresa_id into v_emp from perfis p where p.id = p_perfil_id;
  if v_emp is null then
    raise exception 'Pessoa não encontrada.';
  end if;
  if auth.uid() is not null then
    if em_suporte() then
      raise exception 'Os valores de pagamento não aparecem no modo suporte.';
    end if;
    if v_emp is distinct from empresa_do_usuario() or tipo_do_usuario() not in ('administrador', 'rh') then
      raise exception 'Só o administrador e o RH veem os valores de pagamento.';
    end if;
  end if;

  v_r := regras_da_empresa(v_emp);

  for d in select * from apurar_clt(p_perfil_id, p_inicio, p_fim) loop
    continue when d.situacao = 'antes_admissao';
    if d.dia_semana = 0 or d.feriado_nome is not null then
      v_repouso := v_repouso + 1;
    else
      v_uteis := v_uteis + 1;
    end if;

    v_normal := greatest(d.trabalhado_min - d.extra_min, 0) + coalesce(d.abonado_min, 0);
    if v_normal + d.extra_min + d.noturno_min + d.intervalo_a_pagar_min + d.interjornada_a_pagar_min = 0 then
      continue;
    end if;

    select vh.valor into v_valor
      from valores_hora vh
     where vh.perfil_id = p_perfil_id and vh.desde <= d.data
     order by vh.desde desc
     limit 1;
    if v_valor is null then
      v_sem := v_sem + 1;
      v_valor := 0;
    end if;

    m_normal := m_normal + v_normal;
    m_ext_n  := m_ext_n + d.extra_normal_min;
    m_ext_e  := m_ext_e + d.extra_especial_min;
    m_not    := m_not + d.noturno_min;
    m_not_r  := m_not_r + d.noturno_reduzido_min;
    m_pagar  := m_pagar + d.intervalo_a_pagar_min + d.interjornada_a_pagar_min;

    r_normal := r_normal + v_normal / 60.0 * v_valor;
    r_ext_n  := r_ext_n + d.extra_normal_min / 60.0 * v_valor * (1 + v_r.extra_normal_pct / 100.0);
    r_ext_e  := r_ext_e + d.extra_especial_min / 60.0 * v_valor * (1 + v_r.extra_especial_pct / 100.0);
    r_not    := r_not + d.noturno_reduzido_min / 60.0 * v_valor * v_r.noturno_pct / 100.0;
    r_red    := r_red + greatest(d.noturno_reduzido_min - d.noturno_min, 0) / 60.0 * v_valor;
    r_pagar  := r_pagar + (d.intervalo_a_pagar_min + d.interjornada_a_pagar_min) / 60.0 * v_valor * 1.5;
  end loop;

  v_variavel := r_normal + r_ext_n + r_ext_e + r_not + r_red;
  if v_uteis > 0 then
    v_dsr := v_variavel / v_uteis * v_repouso;
  end if;

  select vh.valor into v_atual
    from valores_hora vh
   where vh.perfil_id = p_perfil_id and vh.desde <= p_fim
   order by vh.desde desc
   limit 1;

  return jsonb_build_object(
    'valor_hora', v_atual,
    'dias_sem_valor', v_sem,
    'minutos', jsonb_build_object(
      'normais', m_normal, 'extra_normal', m_ext_n, 'extra_especial', m_ext_e,
      'noturno', m_not, 'noturno_reduzido', m_not_r, 'a_pagar_50', m_pagar),
    'valores', jsonb_build_object(
      'normais', round(r_normal, 2), 'extra_normal', round(r_ext_n, 2), 'extra_especial', round(r_ext_e, 2),
      'adicional_noturno', round(r_not, 2), 'hora_reduzida', round(r_red, 2), 'a_pagar_50', round(r_pagar, 2)),
    'subtotal', round(r_normal + r_ext_n + r_ext_e + r_not + r_red + r_pagar, 2),
    'dsr', jsonb_build_object('dias_uteis', v_uteis, 'dias_repouso', v_repouso, 'valor', round(v_dsr, 2)),
    'total', round(r_normal + r_ext_n + r_ext_e + r_not + r_red + r_pagar + v_dsr, 2),
    'regras', jsonb_build_object('extra_normal_pct', v_r.extra_normal_pct, 'extra_especial_pct', v_r.extra_especial_pct,
                                 'noturno_pct', v_r.noturno_pct, 'hora_noturna_reduzida', v_r.hora_noturna_reduzida));
end;
$$;

-- Todas as pessoas pagas por hora, no período
create or replace function public.relatorio_horistas(
  p_inicio              date,
  p_fim                 date,
  p_departamento        uuid    default null,
  p_incluir_desligados  boolean default false
)
returns table (
  perfil_id     uuid,
  nome_completo text,
  matricula     text,
  departamento  text,
  status        status_funcionario,
  tipo_escala   text,
  pagamento     jsonb
)
language plpgsql
stable
security definer
set search_path = public
set jit = off
as $$
#variable_conflict use_column
begin
  if em_suporte() then
    raise exception 'Os valores de pagamento não aparecem no modo suporte.';
  end if;
  if tipo_do_usuario() not in ('administrador', 'rh') then
    raise exception 'Só o administrador e o RH veem os valores de pagamento.';
  end if;
  return query
  select q.perfil_id, q.nome_completo, q.matricula, q.departamento, q.status, p.tipo_escala,
         x.j
    from public.pessoas_do_relatorio(p_departamento, p_incluir_desligados) q
    join perfis p on p.id = q.perfil_id and p.pago_por_hora
    cross join lateral (select public.pagamento_por_hora(q.perfil_id, p_inicio, p_fim) as j offset 0) x
   order by q.nome_completo;
end;
$$;

comment on function public.pagamento_por_hora(uuid, date, date) is
  'Estimativa em reais do período de quem é pago por hora. Não substitui a folha de pagamento.';

revoke execute on function public.ajustar_horista()                              from public, anon, authenticated;
revoke execute on function public.proteger_dados_horista()                       from public, anon, authenticated;
revoke execute on function public.limite_diario_da_pessoa(uuid)                  from public, anon;
revoke execute on function public.pode_definir_valor_hora(uuid)                  from public, anon, authenticated;
revoke execute on function public.definir_valor_hora(uuid, numeric, date)        from public, anon;
revoke execute on function public.excluir_valor_hora(uuid)                       from public, anon;
revoke execute on function public.pagamento_por_hora(uuid, date, date)           from public, anon;
revoke execute on function public.relatorio_horistas(date, date, uuid, boolean)  from public, anon;
revoke execute on function public.apurar_periodo(uuid, date, date)               from public, anon;
revoke execute on function public.apurar_clt(uuid, date, date)                   from public, anon;
grant  execute on function public.limite_diario_da_pessoa(uuid)                  to authenticated;
grant  execute on function public.definir_valor_hora(uuid, numeric, date)        to authenticated;
grant  execute on function public.excluir_valor_hora(uuid)                       to authenticated;
grant  execute on function public.pagamento_por_hora(uuid, date, date)           to authenticated;
grant  execute on function public.relatorio_horistas(date, date, uuid, boolean)  to authenticated;
grant  execute on function public.apurar_periodo(uuid, date, date)               to authenticated;
grant  execute on function public.apurar_clt(uuid, date, date)                   to authenticated;

commit;

notify pgrst, 'reload schema';

-- Pronto. Rode em seguida supabase/testes/conferencia-fase-9a.sql.
