-- ============================================================================
-- Ayra Ponto — Fase 2B: apuração das horas (espelho de ponto)
--
-- O que esta migração faz (tudo é ACRESCENTADO; nenhuma tabela, coluna ou dado
-- existente é alterado ou apagado):
--   1. Cria a função apurar_periodo: para uma pessoa e um período, devolve dia
--      a dia as marcações, as horas previstas (pela jornada e pelos feriados),
--      as horas trabalhadas, atrasos, horas extras, faltas e abonos.
--   2. Cria a função resumo_equipe: os mesmos totais, uma linha por pessoa
--      (só administrador e RH).
--   3. Cria dois índices para deixar a consulta rápida.
--
-- Regra da Portaria 671 respeitada (decisão A): as marcações reais continuam
-- intactas no AFD. Os ajustes APROVADOS entram só no cálculo (camada de
-- tratamento), sempre ligados à marcação original, que nunca é alterada.
--
-- Nada é gravado: o cálculo é refeito na hora, então nunca fica desatualizado.
-- Pode ser executada mais de uma vez sem problema.
-- Para desligar: 2026-09-28_fase-2b_apuracao_DESFAZER.sql
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 0. Só roda se a Fase 2A já estiver no banco
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.modelos_jornada_dias') is null
     or to_regclass('public.feriados') is null
     or to_regprocedure('public.minutos_previstos_dia(time,time,time,time)') is null then
    raise exception 'Antes desta migração é preciso aplicar a Fase 2A.';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 1. Índices de apoio
-- ---------------------------------------------------------------------------
create index if not exists ajustes_ponto_perfil_status_idx
  on public.ajustes_ponto (perfil_id, status);
create index if not exists ajustes_ponto_original_idx
  on public.ajustes_ponto (registro_original_id) where registro_original_id is not null;

-- ---------------------------------------------------------------------------
-- 2. apurar_periodo(pessoa, primeiro dia, último dia)
--
-- Como a conta é feita:
--   * "Dia" é o dia do relógio da unidade da pessoa (fuso da unidade).
--   * Um trecho trabalhado vai de uma ENTRADA (ou fim de intervalo) até a
--     marcação seguinte de SAÍDA (ou início de intervalo). O trecho conta no
--     dia em que começou (turno da noite fica todo no mesmo dia).
--   * Marcação sem par (entrada sem saída, etc.) deixa o dia "incompleto":
--     o RH precisa ajustar; nenhuma falta ou atraso é inventado.
--   * Ajuste aprovado de "esqueci de bater" vira uma marcação a mais;
--     ajuste aprovado de "horário errado" troca o horário no cálculo.
--   * Feriado ou folga aprovada: nada previsto; se trabalhou, tudo é extra.
--   * Abono aprovado: a diferença para a jornada não vira falta nem atraso.
--   * Tolerância da jornada: se a diferença do dia for até a tolerância,
--     nada conta (nem atraso nem extra); passou disso, conta a diferença toda.
--   * O intervalo previsto NÃO é descontado sozinho: só vale o que a pessoa
--     marcou. Sem marcação de intervalo, o dia recebe um alerta.
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
  alertas         text[]
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
           case when s.sit in ('antes_admissao', 'folga', 'feriado', 'sem_jornada', 'dia_livre') then 0
                else s.previsto_base end as prev,
           -- trabalhado que vale (antes da admissão nada vale)
           case when s.sit = 'antes_admissao' then 0 else s.trabalhado end as trab
      from com_situacao s
  ),
  final as (
    select c.*,
           case
             when c.sit in ('folga', 'feriado') then c.trab
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
           case when f.sit = 'feriado' and f.trab > 0 then 'Trabalhou em feriado.' end,
           case when f.sit = 'folga' and f.trab > 0 then 'Trabalhou em dia de folga aprovada.' end,
           case when f.sit = 'trabalhado' and f.prev = 0 and f.trab > 0 and f.jd_trabalha is not true
                then 'Trabalhou em dia sem jornada prevista.' end,
           case when f.sit = 'antes_admissao' and f.n_marcacoes > 0
                then 'Há marcações antes da data de admissão.' end
         ], null)
    from final f
   order by f.dia;
end;
$$;

comment on function public.apurar_periodo(uuid, date, date) is
  'Espelho de ponto: dia a dia, horas previstas, trabalhadas, atrasos, extras, faltas e abonos. Ajustes aprovados entram só no cálculo.';

-- ---------------------------------------------------------------------------
-- 3. resumo_equipe(primeiro dia, último dia, departamento opcional)
--    Só administrador e RH da própria empresa.
-- ---------------------------------------------------------------------------
create or replace function public.resumo_equipe(
  p_inicio       date,
  p_fim          date,
  p_departamento uuid default null
)
returns table (
  perfil_id        uuid,
  nome_completo    text,
  matricula        text,
  departamento_id  uuid,
  status           status_funcionario,
  previsto_min     bigint,
  trabalhado_min   bigint,
  atraso_min       bigint,
  extra_min        bigint,
  falta_min        bigint,
  abonado_min      bigint,
  dias_falta       bigint,
  dias_com_alerta  bigint
)
language plpgsql
stable
set search_path = public
set jit = off   -- a compilação JIT do Postgres só atrapalha consultas curtas como esta
as $$
#variable_conflict use_column
begin
  if p_inicio is null or p_fim is null or p_fim < p_inicio then
    raise exception 'Período inválido.';
  end if;
  if p_fim - p_inicio > 61 then
    raise exception 'O resumo da equipe pode ter no máximo 62 dias.';
  end if;
  if current_user in ('authenticated', 'anon')
     and (select tipo_do_usuario()) not in ('administrador', 'rh') then
    raise exception 'Só administrador e RH veem o resumo da equipe.';
  end if;

  return query
  select p.id, p.nome_completo, p.matricula, p.departamento_id, p.status,
         coalesce(sum(a.previsto_min) filter (where a.situacao <> 'futuro'), 0)::bigint,
         coalesce(sum(a.trabalhado_min), 0)::bigint,
         coalesce(sum(a.atraso_min), 0)::bigint,
         coalesce(sum(a.extra_min), 0)::bigint,
         coalesce(sum(a.falta_min), 0)::bigint,
         coalesce(sum(a.abonado_min), 0)::bigint,
         count(*) filter (where a.situacao = 'falta')::bigint,
         count(*) filter (where cardinality(a.alertas) > 0)::bigint
    from perfis p
    cross join lateral apurar_periodo(p.id, p_inicio, p_fim) a
   where p.empresa_id = (case when current_user in ('authenticated', 'anon')
                              then (select empresa_do_usuario()) else p.empresa_id end)
     and p.status <> 'desligado'
     and (p_departamento is null or p.departamento_id = p_departamento)
   group by p.id, p.nome_completo, p.matricula, p.departamento_id, p.status
   order by p.nome_completo;
end;
$$;

comment on function public.resumo_equipe(date, date, uuid) is
  'Totais do período por pessoa (administrador e RH).';

-- ---------------------------------------------------------------------------
-- 4. Quem pode chamar (só quem está logado)
-- ---------------------------------------------------------------------------
revoke execute on function public.apurar_periodo(uuid, date, date) from public, anon;
revoke execute on function public.resumo_equipe(date, date, uuid)  from public, anon;
grant  execute on function public.apurar_periodo(uuid, date, date) to authenticated;
grant  execute on function public.resumo_equipe(date, date, uuid)  to authenticated;

notify pgrst, 'reload schema';
