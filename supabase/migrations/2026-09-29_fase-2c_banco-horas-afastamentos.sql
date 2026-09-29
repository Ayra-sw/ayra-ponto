-- ============================================================================
-- Ayra Ponto — Fase 2C: banco de horas, afastamentos e intervalo mínimo
--
-- O que esta migração faz (tudo é ACRESCENTADO; nenhum dado existente é
-- alterado ou apagado):
--   1. Jornadas: ganham "usa banco de horas", prazo para compensar (meses) e
--      a data em que o banco começa a valer.
--   2. Cria a tabela de lançamentos do banco de horas (saldo inicial,
--      compensação, pagamento e ajuste). Lançamento nunca é apagado nem
--      editado: para corrigir, faz-se um novo lançamento de ajuste.
--   3. Cria a tabela de afastamentos (férias, atestado, licença, INSS,
--      outro), com período. Afastamento não é apagado: só cancelado.
--   4. Atualiza a função apurar_periodo: dias de afastamento não viram falta
--      e o espelho avisa quando o intervalo é curto demais.
--   5. Cria a função banco_horas (saldo, vencimentos e extrato) e a função
--      resumo_banco_horas (a equipe toda, só administrador e RH).
--
-- Regras do saldo: horas extras viram crédito e horas a menos consomem o
-- crédito mais antigo primeiro. Crédito não compensado dentro do prazo
-- "vence" e fica como "vencido, a pagar" até alguém lançar o pagamento.
-- Nada disso é gravado: o saldo é refeito na hora, a partir das marcações,
-- dos ajustes aprovados e dos lançamentos.
--
-- Pode ser executada mais de uma vez sem problema.
-- Para desligar: 2026-09-29_fase-2c_banco-horas-afastamentos_DESFAZER.sql
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 0. Só roda se a Fase 2B já estiver no banco
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regprocedure('public.apurar_periodo(uuid,date,date)') is null
     or to_regprocedure('public.resumo_equipe(date,date,uuid)') is null then
    raise exception 'Antes desta migração é preciso aplicar a Fase 2B.';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 1. Jornadas: banco de horas
-- ---------------------------------------------------------------------------
alter table public.modelos_jornada
  add column if not exists usa_banco_horas            boolean  not null default false,
  add column if not exists banco_horas_validade_meses smallint not null default 6,
  add column if not exists banco_horas_inicio         date;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'modelos_jornada_banco_validade_check') then
    alter table public.modelos_jornada
      add constraint modelos_jornada_banco_validade_check
      check (banco_horas_validade_meses between 1 and 12);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'modelos_jornada_banco_inicio_check') then
    alter table public.modelos_jornada
      add constraint modelos_jornada_banco_inicio_check
      check (not usa_banco_horas or banco_horas_inicio is not null);
  end if;
end $$;

create or replace function public.validar_modelo_banco_horas()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.usa_banco_horas then
    if new.banco_horas_inicio is null then
      raise exception 'Informe a partir de que dia o banco de horas passa a valer.';
    end if;
    if new.banco_horas_inicio < current_date - 1500 or new.banco_horas_inicio > current_date + 60 then
      raise exception 'A data de início do banco de horas está fora do prazo permitido (no máximo 4 anos atrás e 60 dias à frente).';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists validar_modelo_banco_horas on public.modelos_jornada;
create trigger validar_modelo_banco_horas before insert or update on public.modelos_jornada
  for each row execute function public.validar_modelo_banco_horas();

-- ---------------------------------------------------------------------------
-- 2. Lançamentos do banco de horas
--    minutos com sinal: positivo entra no banco, negativo sai.
--    compensacao e pagamento sempre saem (negativos).
-- ---------------------------------------------------------------------------
create table if not exists public.banco_horas_lancamentos (
  id         uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  perfil_id  uuid not null references public.perfis(id) on delete cascade,
  data       date not null,
  tipo       text not null check (tipo in ('saldo_inicial', 'compensacao', 'pagamento', 'ajuste')),
  minutos    integer not null check (minutos <> 0 and abs(minutos) <= 14400),
  motivo     text not null check (char_length(motivo) between 5 and 300),
  criado_por uuid references public.perfis(id) on delete set null,
  criado_em  timestamptz not null default now(),
  constraint lancamento_sinal check (tipo not in ('compensacao', 'pagamento') or minutos < 0)
);
create index if not exists banco_horas_lancamentos_perfil_idx on public.banco_horas_lancamentos (perfil_id, data);

create or replace function public.validar_lancamento_banco()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_empresa uuid;
begin
  select empresa_id into v_empresa from perfis where id = new.perfil_id;
  if v_empresa is null then
    raise exception 'Pessoa não encontrada.';
  end if;
  new.empresa_id := v_empresa;
  new.motivo := btrim(new.motivo);

  if current_user in ('authenticated', 'anon') then
    new.criado_por := (select auth.uid());
    if new.perfil_id = (select auth.uid()) then
      raise exception 'Você não pode lançar horas no seu próprio banco. Peça a outra pessoa da gestão.';
    end if;
    if new.data > current_date then
      raise exception 'O lançamento não pode ter data no futuro.';
    end if;
    if new.data < current_date - 1500 then
      raise exception 'A data do lançamento está fora do prazo permitido.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists validar_lancamento_banco on public.banco_horas_lancamentos;
create trigger validar_lancamento_banco before insert on public.banco_horas_lancamentos
  for each row execute function public.validar_lancamento_banco();

-- lançamento é permanente: nada de editar ou apagar (a cascata do banco pode)
create or replace function public.bloquear_alteracao_lancamento()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if pg_trigger_depth() > 1 then
    return coalesce(old, new);
  end if;
  raise exception 'Lançamentos do banco de horas não podem ser alterados nem apagados. Para corrigir, faça um novo lançamento de ajuste.';
end;
$$;

drop trigger if exists bloquear_alteracao_lancamento on public.banco_horas_lancamentos;
create trigger bloquear_alteracao_lancamento before update or delete on public.banco_horas_lancamentos
  for each row execute function public.bloquear_alteracao_lancamento();

alter table public.banco_horas_lancamentos enable row level security;
drop policy if exists "banco: ver o próprio ou da empresa (admin/rh)" on public.banco_horas_lancamentos;
drop policy if exists "banco: admin/rh lançam" on public.banco_horas_lancamentos;
create policy "banco: ver o próprio ou da empresa (admin/rh)" on public.banco_horas_lancamentos
  for select to authenticated
  using (perfil_id = (select auth.uid())
         or (empresa_id = (select public.empresa_do_usuario())
             and (select public.tipo_do_usuario()) in ('administrador', 'rh')));
create policy "banco: admin/rh lançam" on public.banco_horas_lancamentos
  for insert to authenticated
  with check (empresa_id = (select public.empresa_do_usuario())
              and (select public.tipo_do_usuario()) in ('administrador', 'rh')
              and perfil_id <> (select auth.uid()));

-- ---------------------------------------------------------------------------
-- 3. Afastamentos (férias, atestado, licença, INSS, outro)
-- ---------------------------------------------------------------------------
create table if not exists public.afastamentos (
  id                   uuid primary key default gen_random_uuid(),
  empresa_id           uuid not null references public.empresas(id) on delete cascade,
  perfil_id            uuid not null references public.perfis(id) on delete cascade,
  tipo                 text not null check (tipo in ('ferias', 'atestado', 'licenca', 'inss', 'outro')),
  data_inicio          date not null,
  data_fim             date not null,
  observacao           text check (observacao is null or char_length(observacao) <= 300),
  criado_por           uuid references public.perfis(id) on delete set null,
  criado_em            timestamptz not null default now(),
  cancelado_em         timestamptz,
  cancelado_por        uuid references public.perfis(id) on delete set null,
  motivo_cancelamento  text check (motivo_cancelamento is null or char_length(motivo_cancelamento) <= 300),
  constraint afastamento_periodo check (data_fim >= data_inicio and data_fim - data_inicio <= 730)
);
create index if not exists afastamentos_perfil_idx on public.afastamentos (perfil_id, data_inicio);

create or replace function public.validar_afastamento()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_empresa uuid;
begin
  if tg_op = 'INSERT' then
    select empresa_id into v_empresa from perfis where id = new.perfil_id;
    if v_empresa is null then
      raise exception 'Pessoa não encontrada.';
    end if;
    new.empresa_id := v_empresa;
    new.observacao := nullif(btrim(new.observacao), '');
    new.cancelado_em := null;
    new.cancelado_por := null;
    new.motivo_cancelamento := null;

    if current_user in ('authenticated', 'anon') then
      new.criado_por := (select auth.uid());
      if new.perfil_id = (select auth.uid()) then
        raise exception 'Você não pode registrar um afastamento para si mesma(o). Peça a outra pessoa da gestão.';
      end if;
    end if;

    if exists (select 1 from afastamentos a
                where a.perfil_id = new.perfil_id and a.cancelado_em is null
                  and a.data_inicio <= new.data_fim and a.data_fim >= new.data_inicio) then
      raise exception 'Já existe um afastamento registrado nesse período. Cancele o anterior ou escolha outras datas.';
    end if;
    return new;
  end if;

  -- alteração: só cancelar
  if (new.empresa_id, new.perfil_id, new.tipo, new.data_inicio, new.data_fim, new.observacao, new.criado_por, new.criado_em)
     is distinct from (old.empresa_id, old.perfil_id, old.tipo, old.data_inicio, old.data_fim, old.observacao, old.criado_por, old.criado_em) then
    raise exception 'Um afastamento registrado não pode ser editado. Cancele-o e registre outro.';
  end if;
  if old.cancelado_em is not null then
    raise exception 'Este afastamento já foi cancelado.';
  end if;
  if new.cancelado_em is null then
    return new;
  end if;
  new.cancelado_em := now();
  new.motivo_cancelamento := nullif(btrim(new.motivo_cancelamento), '');
  if current_user in ('authenticated', 'anon') then
    new.cancelado_por := (select auth.uid());
  end if;
  return new;
end;
$$;

drop trigger if exists validar_afastamento on public.afastamentos;
create trigger validar_afastamento before insert or update on public.afastamentos
  for each row execute function public.validar_afastamento();

create or replace function public.bloquear_exclusao_afastamento()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if pg_trigger_depth() > 1 then
    return old;
  end if;
  raise exception 'Afastamentos não são apagados. Use "Cancelar afastamento".';
end;
$$;

drop trigger if exists bloquear_exclusao_afastamento on public.afastamentos;
create trigger bloquear_exclusao_afastamento before delete on public.afastamentos
  for each row execute function public.bloquear_exclusao_afastamento();

alter table public.afastamentos enable row level security;
drop policy if exists "afastamentos: ver o próprio ou da empresa (admin/rh)" on public.afastamentos;
drop policy if exists "afastamentos: admin/rh registram" on public.afastamentos;
drop policy if exists "afastamentos: admin/rh cancelam" on public.afastamentos;
create policy "afastamentos: ver o próprio ou da empresa (admin/rh)" on public.afastamentos
  for select to authenticated
  using (perfil_id = (select auth.uid())
         or (empresa_id = (select public.empresa_do_usuario())
             and (select public.tipo_do_usuario()) in ('administrador', 'rh')));
create policy "afastamentos: admin/rh registram" on public.afastamentos
  for insert to authenticated
  with check (empresa_id = (select public.empresa_do_usuario())
              and (select public.tipo_do_usuario()) in ('administrador', 'rh')
              and perfil_id <> (select auth.uid()));
create policy "afastamentos: admin/rh cancelam" on public.afastamentos
  for update to authenticated
  using (empresa_id = (select public.empresa_do_usuario())
         and (select public.tipo_do_usuario()) in ('administrador', 'rh')
         and perfil_id <> (select auth.uid()))
  with check (empresa_id = (select public.empresa_do_usuario())
              and (select public.tipo_do_usuario()) in ('administrador', 'rh'));

revoke all on public.banco_horas_lancamentos from anon;
revoke all on public.afastamentos            from anon;

-- ---------------------------------------------------------------------------
-- 4. apurar_periodo, versão 2C
--    Igual à da 2B, mais: dias de afastamento (não viram falta) e avisos de
--    intervalo curto. A função devolve uma coluna a mais (afastamento_tipo),
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
  afastamento_tipo text
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
begin
  if p_inicio is null or p_fim is null or p_fim < p_inicio then
    raise exception 'Período inválido.';
  end if;
  if p_fim - p_inicio > 92 then
    raise exception 'O período pode ter no máximo 93 dias.';
  end if;

  select p.empresa_id, p.filial_id, p.modelo_jornada_id, p.data_admissao
    into v_empresa, v_filial, v_modelo, v_admissao
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
  select coalesce(m.tolerancia_minutos, 0) into v_tol
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
           lag(e.em)    over w as em_anterior
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
           (case when e.tipo in ('saida', 'inicio_intervalo')
                      and coalesce(e.tipo_anterior::text, '') in ('entrada', 'fim_intervalo')
                 then (e.em_anterior at time zone v_fuso)::date
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
    select d::date as dia
      from generate_series(p_inicio::timestamp, p_fim::timestamp, interval '1 day') d
  ),
  base as (
    select d.dia,
           extract(dow from d.dia)::smallint as dow,
           jd.trabalha as jd_trabalha,
           jd.intervalo_inicio as jd_intervalo,
           case when jd.trabalha
                then minutos_previstos_dia(jd.entrada, jd.saida, jd.intervalo_inicio, jd.intervalo_fim)
                else 0 end as previsto_base,
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
        on jd.modelo_id = v_modelo and jd.dia_semana = extract(dow from d.dia)::smallint
      left join por_dia pd on pd.dia = d.dia
  ),
  com_situacao as (
    select b.*,
           case
             when v_admissao is not null and b.dia < v_admissao                     then 'antes_admissao'
             when b.afast_tipo is not null                                          then 'afastado'
             when b.folga                                                           then 'folga'
             when b.feriado is not null                                             then 'feriado'
             when b.dia > v_hoje                                                    then 'futuro'
             when b.abono                                                           then 'abonado'
             when (b.abertas > 0 or b.sem_par > 0) and b.dia = v_hoje               then 'em_andamento'
             when b.abertas > 0 or b.sem_par > 0                                    then 'incompleto'
             when v_modelo is null and b.trabalhado = 0                             then 'sem_jornada'
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
           case when s.sit in ('antes_admissao', 'afastado', 'folga', 'feriado', 'sem_jornada', 'dia_livre') then 0
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
                then 'Trabalhou em dia sem jornada prevista.' end,
           case when f.sit = 'antes_admissao' and f.n_marcacoes > 0
                then 'Há marcações antes da data de admissão.' end
         ], null),
         f.afast_tipo
    from final f
   order by f.dia;
end;
$$;

comment on function public.apurar_periodo(uuid, date, date) is
  'Espelho de ponto: dia a dia, horas previstas, trabalhadas, atrasos, extras, faltas, abonos e afastamentos. Ajustes aprovados entram só no cálculo.';

-- ---------------------------------------------------------------------------
-- 5. banco_horas(pessoa, até o dia)
--    Devolve um documento (jsonb) com o saldo e o extrato. Como a conta é feita:
--      * O banco conta a partir da data de início da jornada (ou da admissão, se
--        for depois) até "hoje" (ou o dia pedido, se for antes).
--      * Cada dia entra com o saldo que o espelho calcula (extras menos
--        atrasos e faltas, já com tolerância, abono, feriado e ajuste aprovado).
--        Dia "incompleto" não entra até ser ajustado.
--      * Hora extra vira CRÉDITO. Hora a menos consome o crédito mais antigo
--        primeiro; sem crédito, vira DÍVIDA (saldo negativo), que os próximos
--        créditos quitam.
--      * Crédito que passa do prazo da jornada VENCE: sai do saldo e fica em
--        "vencido, a pagar" até alguém lançar o pagamento.
--      * Lançamentos: saldo inicial e ajuste (entram ou saem), compensação
--        (sai do saldo) e pagamento (quita primeiro o vencido, depois o saldo).
-- ---------------------------------------------------------------------------
create or replace function public.banco_horas(
  p_perfil_id uuid,
  p_ate       date default null
)
returns jsonb
language plpgsql
stable
set search_path = public
set jit = off
as $$
#variable_conflict use_column
declare
  v_empresa    uuid;
  v_filial     uuid;
  v_modelo     uuid;
  v_admissao   date;
  v_fuso       text;
  v_hoje       date;
  v_usa        boolean;
  v_meses      integer;
  v_inicio     date;
  v_ini        date;
  v_fim        date;
  d0           date;
  d1           date;
  r            record;
  cred_d       date[]   := '{}';
  cred_m       integer[] := '{}';
  v_head       integer  := 1;
  v_saldo      integer  := 0;
  v_divida     integer  := 0;
  v_vencido    integer  := 0;
  v_incompletos integer := 0;
  v_need       integer;
  v_take       integer;
  v_venc       date;
  v_movs       jsonb    := '[]'::jsonb;
  v_a_vencer   integer  := 0;
  v_prox       jsonb    := null;
  v_desc       text;
  i            integer;
begin
  select p.empresa_id, p.filial_id, p.modelo_jornada_id, p.data_admissao
    into v_empresa, v_filial, v_modelo, v_admissao
    from perfis p where p.id = p_perfil_id;
  if v_empresa is null then
    raise exception 'Pessoa não encontrada.';
  end if;

  if current_user in ('authenticated', 'anon') then
    if not (p_perfil_id = (select auth.uid())
            or (v_empresa = (select empresa_do_usuario())
                and (select tipo_do_usuario()) in ('administrador', 'rh'))) then
      raise exception 'Pessoa não encontrada.';
    end if;
  end if;

  select m.usa_banco_horas, m.banco_horas_validade_meses, m.banco_horas_inicio
    into v_usa, v_meses, v_inicio
    from (select 1) x left join modelos_jornada m on m.id = v_modelo;

  if v_usa is not true then
    return jsonb_build_object('usa_banco', false);
  end if;

  select coalesce(f.fuso_horario, 'America/Sao_Paulo') into v_fuso
    from (select 1) x left join filiais f on f.id = v_filial;
  v_fuso := coalesce(v_fuso, 'America/Sao_Paulo');
  v_hoje := (now() at time zone v_fuso)::date;

  v_ini := greatest(v_inicio, coalesce(v_admissao, v_inicio));
  v_fim := least(coalesce(p_ate, v_hoje), v_hoje);

  if v_ini > v_fim then
    return jsonb_build_object(
      'usa_banco', true, 'ainda_nao_comecou', true, 'inicio', v_ini, 'ate', v_fim,
      'validade_meses', v_meses, 'saldo_min', 0, 'vencido_min', 0, 'a_vencer_min', 0,
      'proximo_vencimento', null, 'dias_incompletos', 0, 'movimentos', '[]'::jsonb);
  end if;
  if v_fim - v_ini > 1830 then
    raise exception 'O banco de horas desta pessoa começa há mais de 5 anos. Peça ao suporte para fechar os períodos antigos.';
  end if;

  d0 := v_ini;
  while d0 <= v_fim loop
    d1 := least(d0 + 91, v_fim);

    for r in
      with ap as materialized (select * from apurar_periodo(p_perfil_id, d0, d1))
      select a.data as dia,
             case when a.situacao = 'incompleto' then 'incompleto' else 'dia' end as tipo,
             a.saldo_min as minutos, null::text as motivo, 0 as ordem, null::timestamptz as criado_em
        from ap a
       where a.saldo_min <> 0 or a.situacao = 'incompleto'
      union all
      select greatest(l.data, d0), l.tipo, l.minutos, l.motivo, 1, l.criado_em
        from banco_horas_lancamentos l
       where l.perfil_id = p_perfil_id
         and l.data <= d1
         and (l.data >= d0 or d0 = v_ini)
      order by 1, 5, 6
    loop
      -- 1. vence o que já passou do prazo
      while v_head <= coalesce(array_length(cred_d, 1), 0)
            and (cred_d[v_head] + make_interval(months => v_meses))::date <= r.dia loop
        v_venc := (cred_d[v_head] + make_interval(months => v_meses))::date;
        if cred_m[v_head] > 0 then
          v_saldo   := v_saldo - cred_m[v_head];
          v_vencido := v_vencido + cred_m[v_head];
          v_movs := v_movs || jsonb_build_object(
            'data', v_venc, 'tipo', 'vencimento', 'minutos', -cred_m[v_head],
            'saldo_apos', v_saldo, 'vencido_apos', v_vencido,
            'descricao', 'Horas de ' || to_char(cred_d[v_head], 'DD/MM/YYYY') || ' passaram do prazo e ficam a pagar');
        end if;
        v_head := v_head + 1;
      end loop;

      if r.tipo = 'incompleto' then
        v_incompletos := v_incompletos + 1;
        continue;
      end if;

      -- 2. aplica o movimento
      if r.minutos > 0 then
        v_saldo := v_saldo + r.minutos;
        v_need  := r.minutos;
        if v_divida > 0 then
          v_take   := least(v_need, v_divida);
          v_divida := v_divida - v_take;
          v_need   := v_need - v_take;
        end if;
        if v_need > 0 then
          cred_d := cred_d || r.dia;
          cred_m := cred_m || v_need;
        end if;
      else
        v_need := -r.minutos;
        if r.tipo = 'pagamento' and v_vencido > 0 then
          v_take    := least(v_need, v_vencido);
          v_vencido := v_vencido - v_take;
          v_need    := v_need - v_take;
        end if;
        while v_need > 0 and v_head <= coalesce(array_length(cred_d, 1), 0) loop
          v_take := least(v_need, cred_m[v_head]);
          cred_m[v_head] := cred_m[v_head] - v_take;
          v_need  := v_need - v_take;
          v_saldo := v_saldo - v_take;
          if cred_m[v_head] = 0 then
            v_head := v_head + 1;
          end if;
        end loop;
        if v_need > 0 then
          v_divida := v_divida + v_need;
          v_saldo  := v_saldo - v_need;
        end if;
      end if;

      v_desc := case r.tipo
        when 'dia'           then 'Saldo do dia'
        when 'saldo_inicial' then 'Saldo inicial: ' || coalesce(r.motivo, '')
        when 'compensacao'   then 'Compensação: ' || coalesce(r.motivo, '')
        when 'pagamento'     then 'Pagamento: ' || coalesce(r.motivo, '')
        else                      'Ajuste: ' || coalesce(r.motivo, '')
      end;
      v_movs := v_movs || jsonb_build_object(
        'data', r.dia, 'tipo', r.tipo, 'minutos', r.minutos,
        'saldo_apos', v_saldo, 'vencido_apos', v_vencido, 'descricao', v_desc);
    end loop;

    d0 := d1 + 1;
  end loop;

  -- vencimentos até o último dia
  while v_head <= coalesce(array_length(cred_d, 1), 0)
        and (cred_d[v_head] + make_interval(months => v_meses))::date <= v_fim loop
    v_venc := (cred_d[v_head] + make_interval(months => v_meses))::date;
    if cred_m[v_head] > 0 then
      v_saldo   := v_saldo - cred_m[v_head];
      v_vencido := v_vencido + cred_m[v_head];
      v_movs := v_movs || jsonb_build_object(
        'data', v_venc, 'tipo', 'vencimento', 'minutos', -cred_m[v_head],
        'saldo_apos', v_saldo, 'vencido_apos', v_vencido,
        'descricao', 'Horas de ' || to_char(cred_d[v_head], 'DD/MM/YYYY') || ' passaram do prazo e ficam a pagar');
    end if;
    v_head := v_head + 1;
  end loop;

  -- o que vence nos próximos 30 dias
  i := v_head;
  while i <= coalesce(array_length(cred_d, 1), 0) loop
    v_venc := (cred_d[i] + make_interval(months => v_meses))::date;
    if cred_m[i] > 0 then
      if v_venc <= v_fim + 30 then
        v_a_vencer := v_a_vencer + cred_m[i];
      end if;
      if v_prox is null then
        v_prox := jsonb_build_object('data', v_venc, 'minutos', cred_m[i]);
      end if;
    end if;
    i := i + 1;
  end loop;

  return jsonb_build_object(
    'usa_banco', true, 'inicio', v_ini, 'ate', v_fim, 'validade_meses', v_meses,
    'saldo_min', v_saldo, 'vencido_min', v_vencido, 'a_vencer_min', v_a_vencer,
    'proximo_vencimento', v_prox, 'dias_incompletos', v_incompletos,
    'movimentos', v_movs);
end;
$$;

comment on function public.banco_horas(uuid, date) is
  'Saldo do banco de horas (com vencimento por ordem de chegada) e extrato, a partir do espelho e dos lançamentos.';

-- ---------------------------------------------------------------------------
-- 6. resumo_banco_horas: a equipe toda (só administrador e RH)
-- ---------------------------------------------------------------------------
create or replace function public.resumo_banco_horas(p_departamento uuid default null)
returns table (
  perfil_id          uuid,
  nome_completo      text,
  matricula          text,
  departamento_id    uuid,
  saldo_min          integer,
  a_vencer_min       integer,
  vencido_min        integer,
  proximo_vencimento date,
  dias_incompletos   integer
)
language plpgsql
stable
set search_path = public
set jit = off
as $$
#variable_conflict use_column
begin
  if current_user in ('authenticated', 'anon')
     and (select tipo_do_usuario()) not in ('administrador', 'rh') then
    raise exception 'Só administrador e RH veem o banco de horas da equipe.';
  end if;

  return query
  select p.id, p.nome_completo, p.matricula, p.departamento_id,
         (b.j->>'saldo_min')::integer,
         (b.j->>'a_vencer_min')::integer,
         (b.j->>'vencido_min')::integer,
         (b.j->'proximo_vencimento'->>'data')::date,
         (b.j->>'dias_incompletos')::integer
    from perfis p
    join modelos_jornada m on m.id = p.modelo_jornada_id and m.usa_banco_horas
    cross join lateral (select public.banco_horas(p.id) as j) b
   where p.empresa_id = (case when current_user in ('authenticated', 'anon')
                              then (select empresa_do_usuario()) else p.empresa_id end)
     and p.status <> 'desligado'
     and (p_departamento is null or p.departamento_id = p_departamento)
     and coalesce((b.j->>'ainda_nao_comecou')::boolean, false) = false
   order by p.nome_completo;
end;
$$;

comment on function public.resumo_banco_horas(uuid) is
  'Saldo, a vencer e vencido de cada pessoa cuja jornada usa banco de horas (administrador e RH).';

-- ---------------------------------------------------------------------------
-- 7. Quem pode chamar (só quem está logado)
-- ---------------------------------------------------------------------------
revoke execute on function public.apurar_periodo(uuid, date, date)   from public, anon;
revoke execute on function public.banco_horas(uuid, date)            from public, anon;
revoke execute on function public.resumo_banco_horas(uuid)           from public, anon;
grant  execute on function public.apurar_periodo(uuid, date, date)   to authenticated;
grant  execute on function public.banco_horas(uuid, date)            to authenticated;
grant  execute on function public.resumo_banco_horas(uuid)           to authenticated;

notify pgrst, 'reload schema';
