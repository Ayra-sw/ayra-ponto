-- ============================================================================
-- Ayra Ponto — Fase 7A: horas do jeito que o contador precisa
--
-- O que esta migração faz (nenhuma marcação, pedido ou cálculo antigo muda):
--   1. regras_calculo: as regras de cálculo de cada empresa. Sem linha na
--      tabela, valem os padrões da CLT (abaixo). Só o administrador altera.
--   2. apurar_clt(): o mesmo espelho de sempre (apurar_periodo) com as contas
--      que a folha de pagamento precisa, dia a dia:
--        * hora extra separada em percentual normal (padrão 50%) e especial
--          (padrão 100%: domingo de descanso, feriado e folga trabalhados);
--        * horas noturnas (padrão 22h às 5h), com a hora noturna reduzida
--          (52min30s) e a prorrogação depois das 5h (Súmula 60 do TST);
--        * intervalo abaixo do mínimo (art. 71 da CLT: 1h acima de 6h de
--          trabalho; 15 min entre 4h e 6h);
--        * descanso menor que 11h entre um dia e outro (art. 66);
--        * DSR perdido por falta sem justificativa na semana (Lei 605/49);
--        * semana acima do limite (padrão 44h — é configuração, porque a PEC
--          do fim da escala 6x1 pode reduzir para 42h e depois 40h).
--      apurar_periodo, o banco de horas e os relatórios continuam iguais.
--
-- Pode ser executada mais de uma vez sem problema.
-- Para desligar: 2026-10-11_fase-7a_regras-calculo_DESFAZER.sql
-- ============================================================================

do $$
begin
  if to_regprocedure('public.apurar_periodo(uuid,date,date)') is null
     or to_regprocedure('public.dados_para_apuracao(uuid)') is null
     or to_regprocedure('public.registrar_historico()') is null then
    raise exception 'Antes desta migração é preciso aplicar as Fases 2B, 3A e 3C.';
  end if;
end $$;

begin;

-- ---------------------------------------------------------------------------
-- 1. Regras de cálculo de cada empresa (padrão: CLT)
-- ---------------------------------------------------------------------------
create table if not exists public.regras_calculo (
  empresa_id                 uuid primary key references public.empresas(id) on delete cascade,
  extra_normal_pct           smallint not null default 50,
  extra_especial_pct         smallint not null default 100,
  extra_especial_folgas      boolean  not null default true,
  noturno_inicio             time     not null default '22:00',
  noturno_fim                time     not null default '05:00',
  noturno_pct                smallint not null default 20,
  hora_noturna_reduzida      boolean  not null default true,
  prorrogar_noturno          boolean  not null default true,
  intervalo_pre_assinalado   boolean  not null default false,
  interjornada_min           smallint not null default 660,
  dsr_perde_falta            boolean  not null default true,
  dsr_perde_atraso           boolean  not null default false,
  limite_semanal_min         smallint not null default 2640,
  atualizado_em              timestamptz not null default now(),
  atualizado_por             uuid references public.perfis(id) on delete set null,
  constraint regras_extra_normal   check (extra_normal_pct between 50 and 200),
  constraint regras_extra_especial check (extra_especial_pct between 50 and 300),
  constraint regras_noturno_pct    check (noturno_pct between 20 and 100),
  constraint regras_noturno_janela check (noturno_inicio <> noturno_fim),
  constraint regras_interjornada   check (interjornada_min between 0 and 1440),
  constraint regras_limite_semanal check (limite_semanal_min between 600 and 3600)
);

alter table public.regras_calculo enable row level security;

drop policy if exists "regras_calculo: a empresa vê" on public.regras_calculo;
create policy "regras_calculo: a empresa vê" on public.regras_calculo
  for select to authenticated
  using (empresa_id = (select public.empresa_do_usuario()));

drop policy if exists "regras_calculo: admin cria" on public.regras_calculo;
create policy "regras_calculo: admin cria" on public.regras_calculo
  for insert to authenticated
  with check (empresa_id = (select public.empresa_do_usuario())
              and (select public.tipo_do_usuario()) = 'administrador');

drop policy if exists "regras_calculo: admin altera" on public.regras_calculo;
create policy "regras_calculo: admin altera" on public.regras_calculo
  for update to authenticated
  using (empresa_id = (select public.empresa_do_usuario())
         and (select public.tipo_do_usuario()) = 'administrador')
  with check (empresa_id = (select public.empresa_do_usuario())
              and (select public.tipo_do_usuario()) = 'administrador');

revoke all on public.regras_calculo from public, anon, authenticated;
grant select, insert, update on public.regras_calculo to authenticated;

-- quem mudou e quando (o resto vai para o Histórico de alterações)
create or replace function public.regras_calculo_carimbo()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.atualizado_em := now();
  new.atualizado_por := auth.uid();
  return new;
end;
$$;
drop trigger if exists regras_calculo_carimbo on public.regras_calculo;
create trigger regras_calculo_carimbo before insert or update on public.regras_calculo
  for each row execute function public.regras_calculo_carimbo();

drop trigger if exists historico on public.regras_calculo;
create trigger historico after insert or update on public.regras_calculo
  for each row execute function public.registrar_historico();

-- As regras que valem para uma empresa (padrão da CLT se não houver linha)
create or replace function public.regras_da_empresa(p_empresa uuid)
returns public.regras_calculo
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  r regras_calculo;
begin
  if auth.uid() is not null and p_empresa is distinct from empresa_do_usuario() then
    raise exception 'Empresa não encontrada.';
  end if;
  select * into r from regras_calculo where empresa_id = p_empresa;
  if r.empresa_id is null then
    r.empresa_id               := p_empresa;
    r.extra_normal_pct         := 50;
    r.extra_especial_pct       := 100;
    r.extra_especial_folgas    := true;
    r.noturno_inicio           := '22:00';
    r.noturno_fim              := '05:00';
    r.noturno_pct              := 20;
    r.hora_noturna_reduzida    := true;
    r.prorrogar_noturno        := true;
    r.intervalo_pre_assinalado := false;
    r.interjornada_min         := 660;
    r.dsr_perde_falta          := true;
    r.dsr_perde_atraso         := false;
    r.limite_semanal_min       := 2640;
  end if;
  return r;
end;
$$;

-- "9h40"
create or replace function public.texto_duracao(p_min integer)
returns text
language sql
immutable
set search_path = public
as $$
  select (abs(coalesce(p_min, 0)) / 60)::text || 'h' || lpad((abs(coalesce(p_min, 0)) % 60)::text, 2, '0');
$$;

-- ---------------------------------------------------------------------------
-- 2. Espelho com as contas da folha
-- ---------------------------------------------------------------------------
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
           case when v_tipo = 'semanal' and c.semana > v_r.limite_semanal_min
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

comment on function public.apurar_clt(uuid, date, date) is
  'Espelho de ponto com as contas da folha: extras normal/especial, noturno (com hora reduzida), intervalo e descanso a pagar, DSR perdido e semana. Usa as regras_calculo da empresa.';

revoke execute on function public.regras_calculo_carimbo()            from public, anon, authenticated;
revoke execute on function public.regras_da_empresa(uuid)             from public, anon;
revoke execute on function public.apurar_clt(uuid, date, date)        from public, anon;
grant  execute on function public.regras_da_empresa(uuid)             to authenticated;
grant  execute on function public.apurar_clt(uuid, date, date)        to authenticated;
grant  execute on function public.texto_duracao(integer)              to authenticated;

commit;

notify pgrst, 'reload schema';

-- Pronto. Rode em seguida supabase/testes/conferencia-fase-7a.sql.
