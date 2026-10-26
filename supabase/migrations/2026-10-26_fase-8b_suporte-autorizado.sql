-- ============================================================================
-- Ayra Ponto — Fase 8B: acesso de suporte autorizado
--
-- Como funciona:
--   1. O administrador da empresa libera o suporte por 1, 3 ou 7 dias
--      (confirmando a identidade com digital ou senha). Pode encerrar a
--      qualquer momento. Tudo fica registrado e visível para a empresa.
--   2. Enquanto está liberado, a dona da Central entra "como suporte": o banco
--      passa a tratar essa pessoa como administradora SOMENTE para a empresa
--      que liberou, e só até o prazo acabar (ou até o cliente encerrar).
--   3. O suporte vê e ajusta cadastros (pessoas, unidades, departamentos,
--      cargos, jornadas, escalas, feriados, regras e a própria empresa).
--   4. Ações proibidas são barradas no banco, não só na tela: marcar ponto,
--      aprovar/recusar/cancelar pedidos, fechar/reabrir mês, assinar,
--      aprovar foto de rosto, conferir marcação facial, lançar banco de horas
--      e afastamentos, criar ou excluir pessoas e mudar o tipo de acesso.
--   5. Empresa suspensa: o suporte não entra e perde o acesso na hora.
--   6. Quando o suporte age, o histórico mostra "Suporte Ayra" como quem fez.
--
-- Nenhuma marcação, pedido ou cálculo muda. Pode ser executada mais de uma vez.
-- Para desligar: 2026-10-26_fase-8b_suporte-autorizado_DESFAZER.sql
-- ============================================================================

do $$
begin
  if to_regprocedure('public.exigir_dono(integer)') is null
     or to_regprocedure('public.registrar_historico()') is null then
    raise exception 'Antes desta migração é preciso aplicar a Fase 8A.';
  end if;
end $$;

begin;

-- ---------------------------------------------------------------------------
-- 1. Autorizações (liberadas pelo administrador da empresa)
-- ---------------------------------------------------------------------------
create table if not exists public.suporte_autorizacoes (
  id             uuid primary key default gen_random_uuid(),
  empresa_id     uuid not null references public.empresas(id) on delete cascade,
  dias           integer not null check (dias in (1, 3, 7)),
  liberado_por   uuid references public.perfis(id) on delete set null,
  liberado_nome  text,
  liberado_em    timestamptz not null default now(),
  expira_em      timestamptz not null,
  encerrado_em   timestamptz,
  encerrado_por  uuid references public.perfis(id) on delete set null,
  encerrado_nome text,
  constraint suporte_prazo_valido check (expira_em > liberado_em)
);
-- no máximo um suporte aberto por empresa
create unique index if not exists suporte_uma_aberta on public.suporte_autorizacoes (empresa_id) where encerrado_em is null;
alter table public.suporte_autorizacoes enable row level security;
revoke all on public.suporte_autorizacoes from public, anon, authenticated;

-- quem está usando agora (uma sessão por pessoa da Central)
create table if not exists public.suporte_sessoes (
  dono_id        uuid primary key references auth.users(id) on delete cascade,
  autorizacao_id uuid not null references public.suporte_autorizacoes(id) on delete cascade,
  empresa_id     uuid not null references public.empresas(id) on delete cascade,
  entrou_em      timestamptz not null default now()
);
alter table public.suporte_sessoes enable row level security;
revoke all on public.suporte_sessoes from public, anon, authenticated;

-- o que a empresa vê na tela "Suporte da Ayra"
create table if not exists public.suporte_eventos (
  id         bigint generated always as identity primary key,
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  acao       text not null check (acao in ('liberou', 'encerrou', 'entrou', 'saiu')),
  quem       text not null,
  detalhe    jsonb,
  em         timestamptz not null default now()
);
create index if not exists suporte_eventos_empresa_idx on public.suporte_eventos (empresa_id, em desc);
alter table public.suporte_eventos enable row level security;
revoke all on public.suporte_eventos from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Quem está em suporte agora (usado pelo banco inteiro)
-- ---------------------------------------------------------------------------
create or replace function public.empresa_em_suporte()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select s.empresa_id
    from suporte_sessoes s
    join suporte_autorizacoes a on a.id = s.autorizacao_id
    join empresas e on e.id = s.empresa_id
   where s.dono_id = auth.uid()
     and a.encerrado_em is null
     and a.expira_em > now()
     and e.situacao <> 'suspensa';
$$;

create or replace function public.em_suporte()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select empresa_em_suporte() is not null;
$$;

-- A empresa de quem está logado: a da própria conta, ou a da sessão de suporte.
create or replace function public.empresa_do_usuario()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(empresa_em_suporte(),
                  (select p.empresa_id from perfis p where p.id = auth.uid()));
$$;

-- Em suporte, o papel é de administrador, mas só dentro da empresa liberada.
-- Empresa suspensa: a regra da 8A continua valendo.
create or replace function public.tipo_do_usuario()
returns tipo_perfil
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    case when empresa_em_suporte() is not null then 'administrador'::tipo_perfil end,
    (select case when p.tipo in ('administrador', 'rh') and e.situacao = 'suspensa'
                 then 'funcionario'::tipo_perfil else p.tipo end
       from perfis p
       left join empresas e on e.id = p.empresa_id
      where p.id = auth.uid()));
$$;

-- ---------------------------------------------------------------------------
-- 3. Barreiras: o suporte não faz estas ações, nem que tente pela tela
-- ---------------------------------------------------------------------------
create or replace function public.bloquear_em_suporte()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if empresa_em_suporte() is not null then
    raise exception 'O suporte da Ayra não faz esta ação. Só a empresa ou o próprio colaborador podem fazer isso.';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

-- pessoas: o suporte não cadastra nem exclui pessoas, e não muda o tipo de acesso
create or replace function public.proteger_perfis_em_suporte()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if empresa_em_suporte() is not null then
    if tg_op = 'INSERT' then
      raise exception 'O suporte da Ayra não cadastra pessoas novas. Isso é feito pela empresa.';
    elsif tg_op = 'DELETE' then
      raise exception 'O suporte da Ayra não exclui pessoas. Para desligar, use a situação "desligado".';
    elsif new.tipo is distinct from old.tipo then
      raise exception 'O suporte da Ayra não muda o tipo de acesso (administrador, RH ou funcionário). Isso é feito pela empresa.';
    end if;
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array['registros_ponto', 'ajustes_ponto', 'fechamentos', 'fechamento_espelhos',
                           'espelho_conferencias', 'banco_horas_lancamentos', 'afastamentos',
                           'rostos_referencia', 'verificacoes_faciais', 'consentimentos_biometria'] loop
    execute format('drop trigger if exists bloquear_suporte on public.%I', t);
    execute format('create trigger bloquear_suporte before insert or update or delete on public.%I
                    for each row execute function public.bloquear_em_suporte()', t);
  end loop;
end $$;

drop trigger if exists proteger_perfis_suporte on public.perfis;
create trigger proteger_perfis_suporte before insert or update or delete on public.perfis
  for each row execute function public.proteger_perfis_em_suporte();

-- ---------------------------------------------------------------------------
-- 4. Histórico: quando o suporte age, aparece "Suporte Ayra"
-- ---------------------------------------------------------------------------
create or replace function public.registrar_historico()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_novo     jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
  v_velho    jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
  v_ref      jsonb;
  v_fora     text[] := array['descritor', 'criado_em', 'atualizado_em', 'atualizado_por', 'hash_integridade',
                             'hash_anterior', 'hash_evidencia', 'enviada_em', 'foto_sha256', 'proximo_nsr'];
  v_mascara  text[] := array['cpf', 'telefone'];
  v_campos   text[];
  v_antes    jsonb := '{}'::jsonb;
  v_depois   jsonb := '{}'::jsonb;
  v_empresa  uuid;
  v_registro uuid;
  v_pessoa   uuid;
  v_uid      uuid := auth.uid();
  v_suporte  boolean := empresa_em_suporte() is not null;
  k          text;
begin
  v_ref := coalesce(v_novo, v_velho);

  if tg_op = 'UPDATE' then
    select array_agg(c order by c) into v_campos
      from jsonb_object_keys(v_novo) c
     where c <> all(v_fora) and (v_novo -> c) is distinct from (v_velho -> c);
    if v_campos is null then
      return null;     -- nada que interesse mudou
    end if;
  else
    select array_agg(c order by c) into v_campos
      from jsonb_object_keys(v_ref) c
     where c <> all(v_fora) and jsonb_typeof(v_ref -> c) <> 'null';
  end if;

  foreach k in array coalesce(v_campos, '{}') loop
    if v_velho is not null then
      v_antes := v_antes || jsonb_build_object(k,
        case when k = any(v_mascara) and jsonb_typeof(v_velho -> k) <> 'null' then to_jsonb('***'::text) else v_velho -> k end);
    end if;
    if v_novo is not null then
      v_depois := v_depois || jsonb_build_object(k,
        case when k = any(v_mascara) and jsonb_typeof(v_novo -> k) <> 'null' then to_jsonb('***'::text) else v_novo -> k end);
    end if;
  end loop;

  v_empresa := case
    when tg_table_name = 'empresas' then (v_ref ->> 'id')::uuid
    when tg_table_name = 'modelos_jornada_dias' then (select m.empresa_id from modelos_jornada m where m.id = (v_ref ->> 'modelo_id')::uuid)
    when v_ref ? 'empresa_id' and v_ref ->> 'empresa_id' is not null then (v_ref ->> 'empresa_id')::uuid
    when v_ref ? 'perfil_id' then (select p.empresa_id from perfis p where p.id = (v_ref ->> 'perfil_id')::uuid)
  end;
  if tg_table_name = 'perfis' and v_empresa is null and v_novo is not null then
    v_empresa := (v_novo ->> 'empresa_id')::uuid;
  end if;
  if v_empresa is null or not exists (select 1 from empresas e where e.id = v_empresa) then
    return null;
  end if;

  v_registro := coalesce(v_ref ->> 'id', v_ref ->> 'modelo_id', v_ref ->> 'departamento_id')::uuid;
  v_pessoa := case when tg_table_name = 'perfis' then (v_ref ->> 'id')::uuid else (v_ref ->> 'perfil_id')::uuid end;

  insert into historico_alteracoes (empresa_id, tabela, registro_id, pessoa_id, acao, feito_por, feito_por_nome, campos, antes, depois)
  values (v_empresa, tg_table_name, v_registro, v_pessoa,
          case tg_op when 'INSERT' then 'criou' when 'UPDATE' then 'alterou' else 'excluiu' end,
          case when v_suporte then null else v_uid end,
          case when v_suporte then 'Suporte Ayra'
               when v_uid is null then 'Sistema'
               else (select nome_completo from perfis where id = v_uid) end,
          v_campos,
          case when tg_op = 'INSERT' then null else v_antes end,
          case when tg_op = 'DELETE' then null else v_depois end);
  return null;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Administrador da empresa: liberar, encerrar e ver
-- ---------------------------------------------------------------------------
create or replace function public.suporte_liberar(p_dias integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_perfil perfis;
  v_emp    empresas;
  v_aut    suporte_autorizacoes;
begin
  select * into v_perfil from perfis where id = auth.uid();
  if v_perfil.id is null or v_perfil.tipo <> 'administrador' or v_perfil.status <> 'ativo' then
    raise exception 'Só o administrador da empresa pode liberar o suporte da Ayra.';
  end if;
  if confirmacao_recente(10) is null then
    raise exception 'Confirme que é você com a sua digital ou a sua senha antes de liberar o suporte.';
  end if;
  if p_dias is null or p_dias not in (1, 3, 7) then
    raise exception 'Escolha 1, 3 ou 7 dias.';
  end if;

  select * into v_emp from empresas where id = v_perfil.empresa_id for update;
  if v_emp.situacao = 'suspensa' then
    raise exception 'A empresa está suspensa no Ayra. Fale com o Ayra para liberar o acesso.';
  end if;

  -- um suporte que já passou do prazo e não foi encerrado é encerrado agora
  update suporte_autorizacoes
     set encerrado_em = expira_em, encerrado_nome = 'prazo'
   where empresa_id = v_emp.id and encerrado_em is null and expira_em <= now();

  if exists (select 1 from suporte_autorizacoes where empresa_id = v_emp.id and encerrado_em is null) then
    raise exception 'O suporte já está liberado. Encerre antes para liberar de novo.';
  end if;

  insert into suporte_autorizacoes (empresa_id, dias, liberado_por, liberado_nome, expira_em)
  values (v_emp.id, p_dias, v_perfil.id, v_perfil.nome_completo, now() + make_interval(days => p_dias))
  returning * into v_aut;

  insert into suporte_eventos (empresa_id, acao, quem, detalhe)
  values (v_emp.id, 'liberou', v_perfil.nome_completo, jsonb_build_object('dias', p_dias, 'ate', v_aut.expira_em));

  return jsonb_build_object('dias', p_dias, 'ate', v_aut.expira_em);
end;
$$;

create or replace function public.suporte_encerrar()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_perfil perfis;
  v_aberta suporte_autorizacoes;
begin
  select * into v_perfil from perfis where id = auth.uid();
  if v_perfil.id is null or v_perfil.tipo <> 'administrador' or v_perfil.status <> 'ativo' then
    raise exception 'Só o administrador da empresa pode encerrar o suporte da Ayra.';
  end if;

  update suporte_autorizacoes
     set encerrado_em = now(), encerrado_por = v_perfil.id, encerrado_nome = v_perfil.nome_completo
   where empresa_id = v_perfil.empresa_id and encerrado_em is null
  returning * into v_aberta;

  if v_aberta.id is null then
    raise exception 'Não há suporte liberado agora.';
  end if;

  delete from suporte_sessoes where autorizacao_id = v_aberta.id;
  insert into suporte_eventos (empresa_id, acao, quem)
  values (v_perfil.empresa_id, 'encerrou', v_perfil.nome_completo);
end;
$$;

-- o que a tela da empresa mostra: se está liberado, até quando e o histórico
create or replace function public.suporte_da_empresa()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_perfil perfis;
  v_aberta suporte_autorizacoes;
begin
  select * into v_perfil from perfis where id = auth.uid();
  if v_perfil.id is null or v_perfil.tipo not in ('administrador', 'rh') or v_perfil.status <> 'ativo' then
    raise exception 'Só a administração e o RH veem isto.';
  end if;

  select * into v_aberta from suporte_autorizacoes
   where empresa_id = v_perfil.empresa_id and encerrado_em is null and expira_em > now();

  return jsonb_build_object(
    'liberado', v_aberta.id is not null,
    'ate', v_aberta.expira_em,
    'dias', v_aberta.dias,
    'liberado_em', v_aberta.liberado_em,
    'liberado_nome', v_aberta.liberado_nome,
    'conectado', exists (select 1 from suporte_sessoes s where s.autorizacao_id = v_aberta.id),
    'eventos', coalesce((
      select jsonb_agg(jsonb_build_object('acao', x.acao, 'quem', x.quem, 'em', x.em, 'detalhe', x.detalhe) order by x.em desc)
        from (select * from suporte_eventos where empresa_id = v_perfil.empresa_id order by em desc limit 60) x
    ), '[]'::jsonb));
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. A Central: entrar, sair, ver a situação
-- ---------------------------------------------------------------------------
create or replace function public.central_suporte(p_empresa uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_aberta suporte_autorizacoes;
  v_emp    empresas;
begin
  perform exigir_dono(720);
  select * into v_emp from empresas where id = p_empresa;
  if v_emp.id is null then
    raise exception 'Empresa não encontrada.';
  end if;
  select * into v_aberta from suporte_autorizacoes
   where empresa_id = p_empresa and encerrado_em is null and expira_em > now();
  return jsonb_build_object(
    'liberado', v_aberta.id is not null and v_emp.situacao <> 'suspensa',
    'ate', v_aberta.expira_em,
    'dias', v_aberta.dias,
    'liberado_em', v_aberta.liberado_em,
    'liberado_nome', v_aberta.liberado_nome,
    'situacao', v_emp.situacao,
    'eventos', coalesce((
      select jsonb_agg(jsonb_build_object('acao', x.acao, 'quem', x.quem, 'em', x.em) order by x.em desc)
        from (select * from suporte_eventos where empresa_id = p_empresa order by em desc limit 30) x
    ), '[]'::jsonb));
end;
$$;

create or replace function public.suporte_entrar(p_empresa uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_aberta suporte_autorizacoes;
  v_emp    empresas;
begin
  perform exigir_dono(30);
  select * into v_emp from empresas where id = p_empresa;
  if v_emp.id is null then
    raise exception 'Empresa não encontrada.';
  end if;
  if v_emp.situacao = 'suspensa' then
    raise exception 'A empresa está suspensa no Ayra. O suporte não entra enquanto estiver suspensa.';
  end if;
  select * into v_aberta from suporte_autorizacoes
   where empresa_id = p_empresa and encerrado_em is null and expira_em > now();
  if v_aberta.id is null then
    raise exception 'A empresa não liberou o suporte agora, ou o prazo acabou. Peça para ela liberar em Configurações → Suporte da Ayra.';
  end if;

  delete from suporte_sessoes where dono_id = auth.uid();
  insert into suporte_sessoes (dono_id, autorizacao_id, empresa_id) values (auth.uid(), v_aberta.id, p_empresa);
  insert into suporte_eventos (empresa_id, acao, quem, detalhe) values (p_empresa, 'entrou', 'Suporte Ayra', jsonb_build_object('ate', v_aberta.expira_em));
  perform registrar_na_central('suporte_entrou', p_empresa, jsonb_build_object('ate', v_aberta.expira_em));

  return jsonb_build_object('empresa_id', p_empresa, 'empresa_nome', v_emp.nome, 'ate', v_aberta.expira_em);
end;
$$;

create or replace function public.suporte_sair()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_emp uuid;
begin
  delete from suporte_sessoes where dono_id = auth.uid() returning empresa_id into v_emp;
  if v_emp is not null then
    insert into suporte_eventos (empresa_id, acao, quem) values (v_emp, 'saiu', 'Suporte Ayra');
    perform registrar_na_central('suporte_saiu', v_emp, null);
  end if;
end;
$$;

-- a tela da Central e o aviso no app: está em suporte agora, em qual empresa e até quando
create or replace function public.suporte_sessao_atual()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_emp uuid;
  v_nome text;
  v_ate timestamptz;
begin
  select e.id, e.nome, a.expira_em into v_emp, v_nome, v_ate
    from suporte_sessoes s
    join suporte_autorizacoes a on a.id = s.autorizacao_id
    join empresas e on e.id = s.empresa_id
   where s.dono_id = auth.uid() and a.encerrado_em is null and a.expira_em > now()
     and e.situacao <> 'suspensa';
  if v_emp is null then
    return null;
  end if;
  return jsonb_build_object('empresa_id', v_emp, 'empresa_nome', v_nome, 'ate', v_ate);
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. Quem pode chamar
-- ---------------------------------------------------------------------------
revoke execute on function public.empresa_em_suporte()                  from public, anon, authenticated;
revoke execute on function public.em_suporte()                          from public, anon;
revoke execute on function public.bloquear_em_suporte()                 from public, anon, authenticated;
revoke execute on function public.proteger_perfis_em_suporte()          from public, anon, authenticated;
revoke execute on function public.suporte_liberar(integer)              from public, anon;
revoke execute on function public.suporte_encerrar()                    from public, anon;
revoke execute on function public.suporte_da_empresa()                  from public, anon;
revoke execute on function public.central_suporte(uuid)                 from public, anon;
revoke execute on function public.suporte_entrar(uuid)                  from public, anon;
revoke execute on function public.suporte_sair()                        from public, anon;
revoke execute on function public.suporte_sessao_atual()                from public, anon;
grant  execute on function public.em_suporte()                          to authenticated;
grant  execute on function public.suporte_liberar(integer)              to authenticated;
grant  execute on function public.suporte_encerrar()                    to authenticated;
grant  execute on function public.suporte_da_empresa()                  to authenticated;
grant  execute on function public.central_suporte(uuid)                 to authenticated;
grant  execute on function public.suporte_entrar(uuid)                  to authenticated;
grant  execute on function public.suporte_sair()                        to authenticated;
grant  execute on function public.suporte_sessao_atual()                to authenticated;

commit;

notify pgrst, 'reload schema';

-- Pronto. Rode em seguida supabase/testes/conferencia-fase-8b.sql.
