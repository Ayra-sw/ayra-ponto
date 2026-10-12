-- ============================================================================
-- Ayra Ponto — Fase 7B: fechar o mês
--
-- O que esta migração faz (nenhuma marcação, pedido ou cálculo antigo muda):
--   1. fechamentos: um registro por empresa e mês. Fechado, o mês fica
--      travado; só o administrador reabre (com motivo, que vai para o
--      Histórico de alterações).
--   2. fechamento_espelhos: no fechamento, o espelho de cada pessoa é
--      guardado como estava (uma "foto", com código de integridade). A
--      planilha do contador e a assinatura do colaborador (Fase 7C) usam essa
--      foto: mudar uma jornada ou uma regra depois não muda o mês fechado.
--   3. Trava: com o mês fechado, não dá para aprovar pedido, lançar
--      afastamento, banco de horas, escala ou feriado daquele mês. Pedido
--      novo pode ser feito (fica esperando até o mês ser reaberto).
--   4. pendencias_fechamento(): o que falta antes de fechar (dias sem saída,
--      pedidos sem resposta, pessoas sem jornada).
--   5. fechar_mes() (administrador e RH) e reabrir_mes() (só administrador).
--   6. planilha_fechamento(): os dados da planilha do contador (adm. e RH).
--
-- Pode ser executada mais de uma vez sem problema.
-- Para desligar: 2026-10-12_fase-7b_fechamento-mes_DESFAZER.sql
-- ============================================================================

do $$
begin
  if to_regprocedure('public.apurar_clt(uuid,date,date)') is null then
    raise exception 'Antes desta migração é preciso aplicar a Fase 7A.';
  end if;
end $$;

begin;

-- ---------------------------------------------------------------------------
-- 1. Tabelas
-- ---------------------------------------------------------------------------
create table if not exists public.fechamentos (
  id                 uuid primary key default gen_random_uuid(),
  empresa_id         uuid not null references public.empresas(id) on delete cascade,
  competencia        date not null,
  status             text not null default 'fechado',
  fechado_em         timestamptz not null default now(),
  fechado_por        uuid references public.perfis(id) on delete set null,
  fechado_por_nome   text,
  pendencias         integer not null default 0,
  pessoas            integer not null default 0,
  regras             jsonb,
  reaberto_em        timestamptz,
  reaberto_por       uuid references public.perfis(id) on delete set null,
  motivo_reabertura  text,
  constraint fechamentos_competencia_dia1 check (extract(day from competencia) = 1),
  constraint fechamentos_status check (status in ('fechado', 'reaberto')),
  constraint fechamentos_motivo check (motivo_reabertura is null or char_length(motivo_reabertura) between 5 and 300),
  constraint fechamentos_unico unique (empresa_id, competencia)
);

create table if not exists public.fechamento_espelhos (
  fechamento_id  uuid not null references public.fechamentos(id) on delete cascade,
  perfil_id      uuid not null references public.perfis(id) on delete cascade,
  empresa_id     uuid not null references public.empresas(id) on delete cascade,
  competencia    date not null,
  pessoa         jsonb not null,
  linhas         jsonb not null,
  totais         jsonb not null,
  hash           text not null,
  criado_em      timestamptz not null default now(),
  primary key (fechamento_id, perfil_id)
);
alter table public.fechamentos add column if not exists regras jsonb;
create index if not exists fechamento_espelhos_perfil_idx on public.fechamento_espelhos (perfil_id, competencia);

alter table public.fechamentos        enable row level security;
alter table public.fechamento_espelhos enable row level security;

drop policy if exists "fechamentos: a empresa vê" on public.fechamentos;
create policy "fechamentos: a empresa vê" on public.fechamentos
  for select to authenticated
  using (empresa_id = (select public.empresa_do_usuario()));

drop policy if exists "fechamento_espelhos: a própria pessoa vê" on public.fechamento_espelhos;
create policy "fechamento_espelhos: a própria pessoa vê" on public.fechamento_espelhos
  for select to authenticated
  using (perfil_id = (select auth.uid()));

drop policy if exists "fechamento_espelhos: admin/rh veem a empresa" on public.fechamento_espelhos;
create policy "fechamento_espelhos: admin/rh veem a empresa" on public.fechamento_espelhos
  for select to authenticated
  using (empresa_id = (select public.empresa_do_usuario())
         and (select public.tipo_do_usuario()) in ('administrador', 'rh'));

drop policy if exists "fechamento_espelhos: gestor vê a equipe" on public.fechamento_espelhos;
create policy "fechamento_espelhos: gestor vê a equipe" on public.fechamento_espelhos
  for select to authenticated
  using (perfil_id in (select public.equipe_ids()));

-- ninguém grava pelo app: só as funções abaixo
-- os dados de cadastro da foto (CPF etc.) não são lidos pela tabela: só pela
-- função planilha_fechamento(), do administrador e do RH
revoke all on public.fechamentos, public.fechamento_espelhos from public, anon, authenticated;
grant select on public.fechamentos to authenticated;
grant select (fechamento_id, perfil_id, empresa_id, competencia, linhas, totais, hash, criado_em)
  on public.fechamento_espelhos to authenticated;

drop trigger if exists historico on public.fechamentos;
create trigger historico after insert or update on public.fechamentos
  for each row execute function public.registrar_historico();

-- ---------------------------------------------------------------------------
-- 2. Auxiliares
-- ---------------------------------------------------------------------------
create or replace function public.nome_do_mes(p_competencia date)
returns text
language sql
immutable
set search_path = public
as $$
  select (array['janeiro','fevereiro','março','abril','maio','junho','julho','agosto',
                'setembro','outubro','novembro','dezembro'])[extract(month from p_competencia)::integer]
         || ' de ' || extract(year from p_competencia)::integer;
$$;

-- "hoje" no relógio da empresa (fuso da primeira unidade ativa)
create or replace function public.hoje_da_empresa(p_empresa uuid)
returns date
language sql
stable
security definer
set search_path = public
as $$
  select (now() at time zone coalesce(
            (select f.fuso_horario from filiais f where f.empresa_id = p_empresa and f.ativa
              order by f.criado_em limit 1), 'America/Sao_Paulo'))::date;
$$;

-- Trava: algum mês fechado entre p_inicio e p_fim?
create or replace function public.checar_mes_aberto(p_empresa uuid, p_inicio date, p_fim date default null)
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_comp date;
begin
  if p_empresa is null or p_inicio is null then
    return;
  end if;
  select f.competencia into v_comp
    from fechamentos f
   where f.empresa_id = p_empresa
     and f.status = 'fechado'
     and f.competencia between date_trunc('month', p_inicio)::date
                           and date_trunc('month', coalesce(p_fim, p_inicio))::date
   order by f.competencia
   limit 1;
  if v_comp is not null then
    raise exception 'O mês de % está fechado. Para mudar algo nele, o administrador precisa reabrir o mês em Fechamento do mês.',
      nome_do_mes(v_comp);
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Travas nas tabelas que mudam o cálculo do mês
-- ---------------------------------------------------------------------------
create or replace function public.trava_mes_ajuste()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_emp  uuid;
  v_fuso text;
  v_d1   date;
  v_d2   date;
  v_orig date;
begin
  -- só importa quando o pedido passa a valer (aprovado) ou deixa de valer
  if not ((new.status::text = 'aprovado' and (tg_op = 'INSERT' or old.status::text is distinct from 'aprovado'))
          or (tg_op = 'UPDATE' and old.status::text = 'aprovado' and new.status::text <> 'aprovado')) then
    return new;
  end if;
  select p.empresa_id, coalesce(f.fuso_horario, 'America/Sao_Paulo') into v_emp, v_fuso
    from perfis p left join filiais f on f.id = p.filial_id
   where p.id = new.perfil_id;
  v_d1 := coalesce(new.data_referencia, (new.marcacao_solicitada at time zone v_fuso)::date);
  v_d2 := coalesce(new.data_fim, v_d1);
  if new.registro_original_id is not null then
    select (r.marcado_em at time zone v_fuso)::date into v_orig from registros_ponto r where r.id = new.registro_original_id;
    perform checar_mes_aberto(v_emp, v_orig, v_orig);
  end if;
  perform checar_mes_aberto(v_emp, v_d1, v_d2);
  return new;
end;
$$;
drop trigger if exists trava_mes_fechado on public.ajustes_ponto;
create trigger trava_mes_fechado before insert or update on public.ajustes_ponto
  for each row execute function public.trava_mes_ajuste();

create or replace function public.trava_mes_periodo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- afastamentos (data_inicio/data_fim) ou tabelas com uma data (data)
  if tg_op in ('UPDATE', 'DELETE') then
    if tg_table_name = 'afastamentos' then
      perform checar_mes_aberto(old.empresa_id, old.data_inicio, old.data_fim);
    else
      perform checar_mes_aberto(old.empresa_id, old.data, old.data);
    end if;
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    if tg_table_name = 'afastamentos' then
      perform checar_mes_aberto(new.empresa_id, new.data_inicio, new.data_fim);
    else
      perform checar_mes_aberto(new.empresa_id, new.data, new.data);
    end if;
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array['afastamentos', 'banco_horas_lancamentos', 'escala_dias', 'feriados'] loop
    execute format('drop trigger if exists trava_mes_fechado on public.%I', t);
    execute format('create trigger trava_mes_fechado before insert or update or delete on public.%I
                      for each row execute function public.trava_mes_periodo()', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 4. Quem entra no fechamento e o que falta antes de fechar
-- ---------------------------------------------------------------------------
create or replace function public.pessoas_do_fechamento(p_empresa uuid, p_competencia date)
returns table (perfil_id uuid, nome_completo text)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.nome_completo
    from perfis p
   where p.empresa_id = p_empresa
     and (p.data_admissao is null or p.data_admissao <= (p_competencia + interval '1 month - 1 day')::date)
     and (p.status <> 'desligado'
          or exists (select 1 from registros_ponto r
                      where r.perfil_id = p.id
                        and r.marcado_em >= p_competencia::timestamp at time zone 'America/Sao_Paulo'
                        and r.marcado_em <  (p_competencia + interval '1 month')::timestamp at time zone 'America/Sao_Paulo'))
   order by p.nome_completo;
$$;

create or replace function public.pendencias_fechamento(p_competencia date)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_emp   uuid := empresa_do_usuario();
  v_comp  date := date_trunc('month', p_competencia)::date;
  v_fim   date := (date_trunc('month', p_competencia) + interval '1 month - 1 day')::date;
  v_hoje  date;
  v_f     fechamentos;
  v_inc   jsonb := '[]'::jsonb;
  v_semj  jsonb := '[]'::jsonb;
  v_dias  jsonb;
  v_ped   integer;
  v_total integer := 0;
  v_n     integer := 0;
  p       record;
begin
  if auth.uid() is null or tipo_do_usuario() not in ('administrador', 'rh') then
    raise exception 'Somente o administrador ou o RH podem ver o fechamento do mês.';
  end if;
  v_hoje := hoje_da_empresa(v_emp);
  select * into v_f from fechamentos where empresa_id = v_emp and competencia = v_comp;

  for p in select * from pessoas_do_fechamento(v_emp, v_comp) loop
    v_n := v_n + 1;
    v_dias := null;
    if v_comp <= v_hoje then
      select jsonb_agg(a.data order by a.data) into v_dias
        from apurar_clt(p.perfil_id, v_comp, least(v_fim, v_hoje)) a
       where a.situacao = 'incompleto';
    end if;
    if v_dias is not null then
      v_inc := v_inc || jsonb_build_object('perfil_id', p.perfil_id, 'nome', p.nome_completo, 'dias', v_dias);
      v_total := v_total + jsonb_array_length(v_dias);
    end if;
    if exists (select 1 from perfis x where x.id = p.perfil_id and x.modelo_jornada_id is null
                 and coalesce(x.tipo_escala, 'semanal') = 'semanal') then
      v_semj := v_semj || jsonb_build_object('perfil_id', p.perfil_id, 'nome', p.nome_completo);
      v_total := v_total + 1;
    end if;
  end loop;

  select count(*) into v_ped
    from ajustes_ponto a
    join perfis x on x.id = a.perfil_id
   where x.empresa_id = v_emp
     and a.status::text = 'pendente'
     and coalesce(a.data_referencia, (a.marcacao_solicitada at time zone 'America/Sao_Paulo')::date) <= v_fim
     and coalesce(a.data_fim, a.data_referencia, (a.marcacao_solicitada at time zone 'America/Sao_Paulo')::date) >= v_comp;
  v_total := v_total + v_ped;

  return jsonb_build_object(
    'competencia', v_comp,
    'nome', nome_do_mes(v_comp),
    'mes_terminou', v_fim < v_hoje,
    'pode_fechar_em', (v_fim + 1),
    'pessoas', v_n,
    'incompletos', v_inc,
    'sem_jornada', v_semj,
    'pedidos_pendentes', v_ped,
    'total_pendencias', v_total,
    'fechamento', case when v_f.id is null then null else jsonb_build_object(
      'id', v_f.id, 'status', v_f.status, 'fechado_em', v_f.fechado_em, 'fechado_por_nome', v_f.fechado_por_nome,
      'pendencias', v_f.pendencias, 'pessoas', v_f.pessoas, 'reaberto_em', v_f.reaberto_em,
      'motivo_reabertura', v_f.motivo_reabertura) end);
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Fechar e reabrir
-- ---------------------------------------------------------------------------
create or replace function public.fechar_mes(p_competencia date, p_forcar boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_uid   uuid := auth.uid();
  v_emp   uuid := empresa_do_usuario();
  v_comp  date := date_trunc('month', p_competencia)::date;
  v_fim   date := (date_trunc('month', p_competencia) + interval '1 month - 1 day')::date;
  v_f     fechamentos;
  v_pend  jsonb;
  v_n     integer;
  v_qtd   integer := 0;
  v_linhas jsonb;
  v_totais jsonb;
  v_pessoa jsonb;
  p       record;
begin
  if v_uid is null or tipo_do_usuario() not in ('administrador', 'rh') then
    raise exception 'Somente o administrador ou o RH podem fechar o mês.';
  end if;
  if v_fim >= hoje_da_empresa(v_emp) then
    raise exception 'O mês de % ainda não terminou. Você poderá fechar a partir de %.',
      nome_do_mes(v_comp), to_char(v_fim + 1, 'DD/MM/YYYY');
  end if;

  select * into v_f from fechamentos where empresa_id = v_emp and competencia = v_comp for update;
  if v_f.status = 'fechado' then
    raise exception 'O mês de % já está fechado.', nome_do_mes(v_comp);
  end if;

  v_pend := pendencias_fechamento(v_comp);
  v_n := (v_pend ->> 'total_pendencias')::integer;
  if v_n > 0 and not coalesce(p_forcar, false) then
    raise exception 'Ainda há % pendência(s) em %. Confira a lista e, se quiser, feche mesmo assim.', v_n, nome_do_mes(v_comp);
  end if;

  if v_f.id is null then
    insert into fechamentos (empresa_id, competencia, status, fechado_em, fechado_por, fechado_por_nome, pendencias, regras)
    values (v_emp, v_comp, 'fechado', now(), v_uid, (select nome_completo from perfis where id = v_uid), v_n,
            to_jsonb(regras_da_empresa(v_emp)))
    returning * into v_f;
  else
    update fechamentos
       set status = 'fechado', fechado_em = now(), fechado_por = v_uid,
           fechado_por_nome = (select nome_completo from perfis where id = v_uid), pendencias = v_n,
           regras = to_jsonb(regras_da_empresa(v_emp))
     where id = v_f.id
    returning * into v_f;
  end if;

  delete from fechamento_espelhos where fechamento_id = v_f.id;

  for p in select * from pessoas_do_fechamento(v_emp, v_comp) loop
    select coalesce(jsonb_agg(to_jsonb(a) order by a.data), '[]'::jsonb),
           jsonb_build_object(
             'previsto',          coalesce(sum(a.previsto_min), 0),
             'trabalhado',        coalesce(sum(a.trabalhado_min), 0),
             'atraso',            coalesce(sum(a.atraso_min), 0),
             'falta',             coalesce(sum(a.falta_min), 0),
             'abonado',           coalesce(sum(a.abonado_min), 0),
             'extra',             coalesce(sum(a.extra_min), 0),
             'extra_normal',      coalesce(sum(a.extra_normal_min), 0),
             'extra_especial',    coalesce(sum(a.extra_especial_min), 0),
             'noturno',           coalesce(sum(a.noturno_min), 0),
             'noturno_reduzido',  coalesce(sum(a.noturno_reduzido_min), 0),
             'intervalo_pagar',   coalesce(sum(a.intervalo_a_pagar_min), 0),
             'descanso_pagar',    coalesce(sum(a.interjornada_a_pagar_min), 0),
             'dsr_perdidos',      count(*) filter (where a.dsr_perdido),
             'saldo',             coalesce(sum(a.saldo_min), 0),
             'dias_trabalhados',  count(*) filter (where a.trabalhado_min > 0),
             'dias_falta',        count(*) filter (where a.situacao = 'falta'),
             'dias_incompletos',  count(*) filter (where a.situacao = 'incompleto'),
             'dias_alerta',       count(*) filter (where cardinality(a.alertas) > 0),
             'banco',             coalesce(bool_or(a.banco), false))
      into v_linhas, v_totais
      from apurar_clt(p.perfil_id, v_comp, v_fim) a;

    select jsonb_build_object(
             'nome', x.nome_completo, 'cpf', x.cpf, 'matricula', x.matricula,
             'cargo', coalesce(c.nome, x.cargo), 'departamento', d.nome, 'unidade', f.nome,
             'jornada', m.nome, 'tipo_escala', x.tipo_escala, 'status', x.status,
             'fuso', coalesce(f.fuso_horario, 'America/Sao_Paulo'))
      into v_pessoa
      from perfis x
      left join cargos c on c.id = x.cargo_id
      left join departamentos d on d.id = x.departamento_id
      left join filiais f on f.id = x.filial_id
      left join modelos_jornada m on m.id = x.modelo_jornada_id
     where x.id = p.perfil_id;

    insert into fechamento_espelhos (fechamento_id, perfil_id, empresa_id, competencia, pessoa, linhas, totais, hash)
    values (v_f.id, p.perfil_id, v_emp, v_comp, v_pessoa, v_linhas, v_totais,
            encode(digest(v_pessoa::text || '|' || v_linhas::text || '|' || v_totais::text, 'sha256'), 'hex'));
    v_qtd := v_qtd + 1;
  end loop;

  update fechamentos set pessoas = v_qtd where id = v_f.id;

  return jsonb_build_object('fechamento_id', v_f.id, 'competencia', v_comp, 'nome', nome_do_mes(v_comp),
                            'pessoas', v_qtd, 'pendencias', v_n);
end;
$$;

create or replace function public.reabrir_mes(p_competencia date, p_motivo text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid  uuid := auth.uid();
  v_emp  uuid := empresa_do_usuario();
  v_comp date := date_trunc('month', p_competencia)::date;
  v_f    fechamentos;
begin
  if v_uid is null or tipo_do_usuario() <> 'administrador' then
    raise exception 'Somente o administrador pode reabrir um mês fechado.';
  end if;
  if p_motivo is null or char_length(trim(p_motivo)) < 5 then
    raise exception 'Conte em poucas palavras por que o mês está sendo reaberto.';
  end if;
  select * into v_f from fechamentos where empresa_id = v_emp and competencia = v_comp for update;
  if v_f.id is null or v_f.status <> 'fechado' then
    raise exception 'O mês de % não está fechado.', nome_do_mes(v_comp);
  end if;
  update fechamentos
     set status = 'reaberto', reaberto_em = now(), reaberto_por = v_uid, motivo_reabertura = trim(p_motivo)
   where id = v_f.id;
  delete from fechamento_espelhos where fechamento_id = v_f.id;
  return jsonb_build_object('competencia', v_comp, 'nome', nome_do_mes(v_comp));
end;
$$;

-- Tudo o que a planilha do contador precisa de um mês fechado
create or replace function public.planilha_fechamento(p_competencia date)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_emp  uuid := empresa_do_usuario();
  v_comp date := date_trunc('month', p_competencia)::date;
  v_f    fechamentos;
begin
  if auth.uid() is null or tipo_do_usuario() not in ('administrador', 'rh') then
    raise exception 'Somente o administrador ou o RH podem baixar a planilha do fechamento.';
  end if;
  select * into v_f from fechamentos where empresa_id = v_emp and competencia = v_comp;
  if v_f.id is null or v_f.status <> 'fechado' then
    raise exception 'O mês de % não está fechado. Feche o mês para baixar a planilha.', nome_do_mes(v_comp);
  end if;
  return jsonb_build_object(
    'competencia', v_comp,
    'nome', nome_do_mes(v_comp),
    'fechamento', jsonb_build_object('id', v_f.id, 'fechado_em', v_f.fechado_em, 'fechado_por_nome', v_f.fechado_por_nome,
                                     'pendencias', v_f.pendencias, 'pessoas', v_f.pessoas, 'regras', v_f.regras),
    'empresa', (select jsonb_build_object('nome', e.nome, 'razao_social', e.razao_social, 'cnpj', e.cnpj)
                  from empresas e where e.id = v_emp),
    'espelhos', coalesce((select jsonb_agg(jsonb_build_object('perfil_id', s.perfil_id, 'pessoa', s.pessoa,
                                                              'totais', s.totais, 'linhas', s.linhas, 'hash', s.hash)
                                           order by s.pessoa ->> 'nome')
                            from fechamento_espelhos s where s.fechamento_id = v_f.id), '[]'::jsonb));
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Quem pode chamar
-- ---------------------------------------------------------------------------
revoke execute on function public.checar_mes_aberto(uuid, date, date)      from public, anon, authenticated;
revoke execute on function public.trava_mes_ajuste()                       from public, anon, authenticated;
revoke execute on function public.trava_mes_periodo()                      from public, anon, authenticated;
revoke execute on function public.pessoas_do_fechamento(uuid, date)        from public, anon, authenticated;
revoke execute on function public.hoje_da_empresa(uuid)                    from public, anon, authenticated;
revoke execute on function public.pendencias_fechamento(date)              from public, anon;
revoke execute on function public.fechar_mes(date, boolean)                from public, anon;
revoke execute on function public.reabrir_mes(date, text)                  from public, anon;
grant  execute on function public.pendencias_fechamento(date)              to authenticated;
grant  execute on function public.fechar_mes(date, boolean)                to authenticated;
grant  execute on function public.reabrir_mes(date, text)                  to authenticated;
revoke execute on function public.planilha_fechamento(date)                from public, anon;
grant  execute on function public.planilha_fechamento(date)                to authenticated;
grant  execute on function public.nome_do_mes(date)                        to authenticated;

commit;

notify pgrst, 'reload schema';

-- Pronto. Rode em seguida supabase/testes/conferencia-fase-7b.sql.
