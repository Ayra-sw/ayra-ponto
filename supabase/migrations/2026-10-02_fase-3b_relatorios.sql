-- ============================================================================
-- Ayra Ponto — Fase 3B: relatórios
--
-- O que esta migração faz: cria as funções de relatório e deixa o cálculo das
-- horas mais rápido. Nenhuma tabela, coluna ou dado é criado, alterado ou apagado.
--   1. relatorio_frequencia: faltas, atrasos, horas extras e avisos por pessoa
--      e por dia, num período de até 3 meses (as contas são as do espelho).
--   2. relatorio_banco_horas: saldo, horas a vencer e vencidas de cada pessoa
--      numa data escolhida.
--   3. relatorio_marcacoes: todas as marcações do período (até 62 dias), com
--      NSR, unidade, origem e, para o RH e o administrador, o resultado do
--      reconhecimento facial.
--   (O relatório de pedidos é montado na tela, a partir dos pedidos que cada
--    um já pode ver.)
--   4. Deixa o cálculo das horas mais rápido (espelho, banco de horas, tela
--      "Banco de horas" da equipe e relatórios), com o mesmo resultado.
--
-- Quem vê: administrador e RH, a empresa toda; gestor, só a própria equipe.
-- Colaborador sem equipe não vê ninguém.
--
-- Pode ser executada mais de uma vez sem problema.
-- Para desligar: 2026-10-02_fase-3b_relatorios_DESFAZER.sql
-- ============================================================================

do $$
begin
  if to_regprocedure('public.equipe_ids()') is null or to_regprocedure('public.minha_equipe()') is null then
    raise exception 'Antes desta migração é preciso aplicar a Fase 3A.';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 0. Quem entra nos relatórios de quem está logado
-- ---------------------------------------------------------------------------
create or replace function public.pessoas_do_relatorio(
  p_departamento        uuid    default null,
  p_incluir_desligados  boolean default false
)
returns table (
  perfil_id        uuid,
  nome_completo    text,
  matricula        text,
  departamento_id  uuid,
  departamento     text,
  filial_id        uuid,
  status           status_funcionario
)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.nome_completo, p.matricula, p.departamento_id, d.nome, p.filial_id, p.status
    from perfis p
    left join departamentos d on d.id = p.departamento_id
   where p.empresa_id = public.empresa_do_usuario()
     and ((public.tipo_do_usuario() in ('administrador', 'rh')
           and (coalesce(p_incluir_desligados, false) or p.status <> 'desligado'))
          or p.id in (select public.equipe_ids()))
     and (p_departamento is null or p.departamento_id = p_departamento)
   order by p.nome_completo;
$$;

-- ---------------------------------------------------------------------------
-- 1. Frequência: uma linha por pessoa, com os dias do período dentro
-- ---------------------------------------------------------------------------
create or replace function public.relatorio_frequencia(
  p_inicio              date,
  p_fim                 date,
  p_departamento        uuid    default null,
  p_incluir_desligados  boolean default false
)
returns table (
  perfil_id        uuid,
  nome_completo    text,
  matricula        text,
  departamento     text,
  status           status_funcionario,
  previsto_min     bigint,
  trabalhado_min   bigint,
  atraso_min       bigint,
  extra_min        bigint,
  falta_min        bigint,
  abonado_min      bigint,
  dias_falta       bigint,
  dias_atraso      bigint,
  dias_extra       bigint,
  dias_incompletos bigint,
  dias_com_alerta  bigint,
  dias             jsonb
)
language plpgsql
stable
security definer
set search_path = public
set jit = off
as $$
#variable_conflict use_column
begin
  if p_inicio is null or p_fim is null or p_fim < p_inicio then
    raise exception 'Período inválido.';
  end if;
  if p_fim - p_inicio > 92 then
    raise exception 'O relatório pode ter no máximo 3 meses (93 dias).';
  end if;

  return query
  select q.perfil_id, q.nome_completo, q.matricula, q.departamento, q.status,
         coalesce(sum(a.previsto_min) filter (where a.situacao <> 'futuro'), 0)::bigint,
         coalesce(sum(a.trabalhado_min), 0)::bigint,
         coalesce(sum(a.atraso_min), 0)::bigint,
         coalesce(sum(a.extra_min), 0)::bigint,
         coalesce(sum(a.falta_min), 0)::bigint,
         coalesce(sum(a.abonado_min), 0)::bigint,
         count(*) filter (where a.situacao = 'falta')::bigint,
         count(*) filter (where a.atraso_min > 0)::bigint,
         count(*) filter (where a.extra_min > 0)::bigint,
         count(*) filter (where a.situacao = 'incompleto')::bigint,
         count(*) filter (where cardinality(a.alertas) > 0)::bigint,
         coalesce(jsonb_agg(jsonb_build_object(
             'data', a.data, 'situacao', a.situacao, 'feriado_nome', a.feriado_nome,
             'afastamento_tipo', a.afastamento_tipo, 'turno', a.turno,
             'previsto_min', a.previsto_min, 'trabalhado_min', a.trabalhado_min,
             'atraso_min', a.atraso_min, 'extra_min', a.extra_min, 'falta_min', a.falta_min,
             'abonado_min', a.abonado_min, 'alertas', a.alertas)
           order by a.data) filter (where a.situacao not in ('futuro')), '[]'::jsonb)
    from public.pessoas_do_relatorio(p_departamento, p_incluir_desligados) q
    cross join lateral public.apurar_periodo(q.perfil_id, p_inicio, p_fim) a
   group by q.perfil_id, q.nome_completo, q.matricula, q.departamento, q.status
   order by q.nome_completo;
end;
$$;
comment on function public.relatorio_frequencia(date, date, uuid, boolean) is
  'Relatório de frequência (faltas, atrasos, extras, avisos) por pessoa e por dia. Administrador/RH: empresa; gestor: equipe.';

-- ---------------------------------------------------------------------------
-- 2. Banco de horas numa data
-- ---------------------------------------------------------------------------
create or replace function public.relatorio_banco_horas(
  p_ate                 date    default null,
  p_departamento        uuid    default null,
  p_incluir_desligados  boolean default false
)
returns table (
  perfil_id          uuid,
  nome_completo      text,
  matricula          text,
  departamento       text,
  status             status_funcionario,
  validade_meses     integer,
  saldo_min          integer,
  a_vencer_min       integer,
  vencido_min        integer,
  proximo_vencimento date,
  dias_incompletos   integer
)
language plpgsql
stable
security definer
set search_path = public
set jit = off
as $$
#variable_conflict use_column
begin
  if p_ate is not null and p_ate > current_date then
    raise exception 'Escolha uma data de hoje para trás.';
  end if;

  return query
  select q.perfil_id, q.nome_completo, q.matricula, q.departamento, q.status,
         (b.j->>'validade_meses')::integer,
         (b.j->>'saldo_min')::integer,
         (b.j->>'a_vencer_min')::integer,
         (b.j->>'vencido_min')::integer,
         (b.j->'proximo_vencimento'->>'data')::date,
         (b.j->>'dias_incompletos')::integer
    from public.pessoas_do_relatorio(p_departamento, p_incluir_desligados) q
    join perfis p on p.id = q.perfil_id
    join modelos_jornada m on m.id = p.modelo_jornada_id and m.usa_banco_horas
    -- "offset 0": a conta do banco de horas roda uma vez só por pessoa
    cross join lateral (select public.banco_horas(q.perfil_id, p_ate) as j offset 0) b
   where coalesce((b.j->>'ainda_nao_comecou')::boolean, false) = false
   order by q.nome_completo;
end;
$$;
comment on function public.relatorio_banco_horas(date, uuid, boolean) is
  'Saldo, a vencer e vencido do banco de horas de cada pessoa numa data. Administrador/RH: empresa; gestor: equipe.';

-- ---------------------------------------------------------------------------
-- 3. Marcações do período
-- ---------------------------------------------------------------------------
create or replace function public.relatorio_marcacoes(
  p_inicio              date,
  p_fim                 date,
  p_departamento        uuid    default null,
  p_incluir_desligados  boolean default false
)
returns table (
  perfil_id      uuid,
  nome_completo  text,
  matricula      text,
  departamento   text,
  status         status_funcionario,
  marcacoes      jsonb
)
language plpgsql
stable
security definer
set search_path = public
set jit = off
as $$
#variable_conflict use_column
declare
  v_gestao boolean := public.tipo_do_usuario() in ('administrador', 'rh');
begin
  if p_inicio is null or p_fim is null or p_fim < p_inicio then
    raise exception 'Período inválido.';
  end if;
  if p_fim - p_inicio > 61 then
    raise exception 'O relatório de marcações pode ter no máximo 62 dias.';
  end if;

  return query
  select q.perfil_id, q.nome_completo, q.matricula, q.departamento, q.status,
         coalesce((
           select jsonb_agg(jsonb_build_object(
                    'id', r.id, 'nsr', r.nsr, 'tipo', r.tipo, 'marcado_em', r.marcado_em,
                    'origem', r.origem, 'unidade', f.nome, 'fuso', f.fuso_horario,
                    'facial', case when v_gestao then v.resultado end,
                    'corrigida', exists (select 1 from ajustes_ponto aj
                                          where aj.registro_original_id = r.id and aj.status = 'aprovado'
                                            and aj.tipo = 'correcao_marcacao'))
                  order by r.marcado_em, r.nsr)
             from registros_ponto r
             join filiais f on f.id = r.filial_id
             left join verificacoes_faciais v on v.registro_id = r.id
            where r.perfil_id = q.perfil_id
              and r.marcado_em >= ((p_inicio)::timestamp at time zone coalesce(f.fuso_horario, 'America/Sao_Paulo'))
              and r.marcado_em <  ((p_fim + 1)::timestamp at time zone coalesce(f.fuso_horario, 'America/Sao_Paulo'))
         ), '[]'::jsonb)
    from public.pessoas_do_relatorio(p_departamento, p_incluir_desligados) q
   order by q.nome_completo;
end;
$$;
comment on function public.relatorio_marcacoes(date, date, uuid, boolean) is
  'Marcações do período por pessoa (NSR, unidade, origem, reconhecimento facial para admin/RH). Administrador/RH: empresa; gestor: equipe.';

-- ---------------------------------------------------------------------------
-- 4. Tela "Banco de horas" da equipe (Fase 2C) mais rápida
--     A conta do banco de horas de cada pessoa era repetida uma vez para cada
--     coluna do resultado. Agora roda uma vez só (o resultado é o mesmo).
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
    cross join lateral (select public.banco_horas(p.id) as j offset 0) b
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
-- 5. Cálculo das horas mais rápido (espelho, banco de horas e relatórios)
--    Mesma conta da Fase 3A, mas cada dia é montado uma vez só ("materialized").
--    Em testes com 50 pessoas e 3 meses, ficou cerca de 7 vezes mais rápido.
--    O resultado é exatamente o mesmo.
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
  base as materialized (
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
             when b.previsto_base = 0 and b.trabalhado = 0 and v_tipo <> 'semanal'  then 'folga_escala'
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

comment on function public.apurar_periodo(uuid, date, date) is
  'Espelho de ponto: dia a dia, horas previstas (jornada semanal, 12x36 ou escala por calendário), trabalhadas, atrasos, extras, faltas, abonos e afastamentos. Ajustes aprovados entram só no cálculo.';

-- ---------------------------------------------------------------------------
-- 6. Quem pode chamar (só quem está logado)
-- ---------------------------------------------------------------------------
revoke execute on function public.pessoas_do_relatorio(uuid, boolean)                 from public, anon;
revoke execute on function public.relatorio_frequencia(date, date, uuid, boolean)     from public, anon;
revoke execute on function public.relatorio_banco_horas(date, uuid, boolean)          from public, anon;
revoke execute on function public.relatorio_marcacoes(date, date, uuid, boolean)      from public, anon;
grant  execute on function public.pessoas_do_relatorio(uuid, boolean)                 to authenticated;
grant  execute on function public.relatorio_frequencia(date, date, uuid, boolean)     to authenticated;
grant  execute on function public.relatorio_banco_horas(date, uuid, boolean)          to authenticated;
grant  execute on function public.relatorio_marcacoes(date, date, uuid, boolean)      to authenticated;

notify pgrst, 'reload schema';
