-- ============================================================================
-- Ayra Ponto — Fase 3C: avisos (sininho) e histórico de alterações
--
-- O que esta migração faz (tudo é ACRESCENTADO; nenhum dado existente é
-- alterado ou apagado):
--   1. Avisos dentro do sistema (o sininho):
--        * pedido novo   → para o gestor da pessoa (se ela não tiver gestor, ou
--                          se for abono, para o RH e o administrador);
--        * pedido respondido → para quem pediu;
--        * dia incompleto → para a própria pessoa (marcação faltando nos
--                           últimos 3 dias);
--        * banco de horas vencendo ou vencido → para o RH e o administrador,
--                           uma vez por semana;
--        * pessoa nova pelo convite e foto de rosto para aprovar → para o RH e
--          o administrador; foto aprovada ou recusada → para a pessoa.
--      Cada um só vê os próprios avisos. Avisos lidos somem depois de 90 dias.
--   2. Histórico de alterações: o banco anota sozinho quem criou, alterou ou
--      excluiu cadastros, jornadas, escalas, turnos, pedidos, afastamentos,
--      banco de horas, gestores, unidades e dados da empresa. Só o
--      administrador e o RH veem. Ninguém edita nem apaga o histórico.
--      CPF e telefone aparecem só como "***" (LGPD).
--
-- Pode ser executada mais de uma vez sem problema.
-- Para desligar: 2026-10-03_fase-3c_avisos-historico_DESFAZER.sql
-- ============================================================================

do $$
begin
  if to_regprocedure('public.relatorio_frequencia(date,date,uuid,boolean)') is null then
    raise exception 'Antes desta migração é preciso aplicar a Fase 3B.';
  end if;
end $$;

-- ===========================================================================
-- PARTE 1 — AVISOS
-- ===========================================================================
create table if not exists public.avisos (
  id            uuid primary key default gen_random_uuid(),
  empresa_id    uuid not null references public.empresas(id) on delete cascade,
  perfil_id     uuid not null references public.perfis(id) on delete cascade,
  tipo          text not null check (tipo in ('pedido_novo', 'pedido_respondido', 'dia_incompleto', 'banco_vencendo',
                                              'pessoa_nova', 'foto_para_aprovar', 'foto_analisada')),
  titulo        text not null check (char_length(titulo) <= 160),
  texto         text check (texto is null or char_length(texto) <= 600),
  link          text check (link is null or (link like '/%' and char_length(link) <= 200)),
  referencia_id uuid,
  chave         text,
  criado_em     timestamptz not null default now(),
  lido_em       timestamptz
);
create unique index if not exists avisos_chave_unica on public.avisos (perfil_id, chave) where chave is not null;
create index if not exists avisos_perfil_idx      on public.avisos (perfil_id, criado_em desc);
create index if not exists avisos_nao_lidos_idx   on public.avisos (perfil_id) where lido_em is null;
create index if not exists avisos_referencia_idx  on public.avisos (referencia_id) where referencia_id is not null;

-- quem recebe só pode marcar como lido (nada mais muda)
create or replace function public.proteger_aviso()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user in ('authenticated', 'anon')
     and (new.empresa_id, new.perfil_id, new.tipo, new.titulo, new.texto, new.link, new.referencia_id, new.chave, new.criado_em)
         is distinct from (old.empresa_id, old.perfil_id, old.tipo, old.titulo, old.texto, old.link, old.referencia_id, old.chave, old.criado_em) then
    raise exception 'Um aviso só pode ser marcado como lido.';
  end if;
  return new;
end;
$$;
drop trigger if exists proteger_aviso on public.avisos;
create trigger proteger_aviso before update on public.avisos
  for each row execute function public.proteger_aviso();

alter table public.avisos enable row level security;
drop policy if exists "avisos: ver os próprios" on public.avisos;
drop policy if exists "avisos: marcar os próprios como lidos" on public.avisos;
create policy "avisos: ver os próprios" on public.avisos
  for select to authenticated
  using (perfil_id = (select auth.uid()));
create policy "avisos: marcar os próprios como lidos" on public.avisos
  for update to authenticated
  using (perfil_id = (select auth.uid()))
  with check (perfil_id = (select auth.uid()));
revoke all on public.avisos from anon;

-- 1.1 Criar um aviso (uso interno; ninguém chama direto pelo app)
create or replace function public.criar_aviso(
  p_perfil_id uuid, p_tipo text, p_titulo text, p_texto text, p_link text,
  p_referencia uuid default null, p_chave text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_empresa uuid;
begin
  select empresa_id into v_empresa from perfis where id = p_perfil_id and status <> 'desligado';
  if v_empresa is null then
    return;
  end if;
  insert into avisos (empresa_id, perfil_id, tipo, titulo, texto, link, referencia_id, chave)
  values (v_empresa, p_perfil_id, p_tipo, left(p_titulo, 160), left(p_texto, 600), p_link, p_referencia, p_chave)
  on conflict (perfil_id, chave) where chave is not null do nothing;
end;
$$;

-- 1.2 Para onde o aviso leva, conforme quem recebe
create or replace function public.link_do_aviso(p_perfil_id uuid, p_destino text, p_extra text default null)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p_destino = 'solicitacoes' then case when p.tipo in ('administrador', 'rh') then '/gestao/solicitacoes' else '/equipe' end
    when p_destino = 'meus_pedidos' then case when p.tipo in ('administrador', 'rh') then '/gestao/meu-historico?aba=pedidos' else '/historico?aba=pedidos' end
    when p_destino = 'espelho'      then case when p.tipo in ('administrador', 'rh') then '/gestao/meu-espelho' else '/espelho' end
                                         || coalesce('?mes=' || p_extra, '')
    when p_destino = 'conta'        then case when p.tipo in ('administrador', 'rh') then '/gestao/conta' else '/conta' end
    when p_destino = 'pessoa'       then '/gestao/pessoas/' || p_extra || '?aba=trabalho'
    when p_destino = 'reconhecimento' then '/gestao/reconhecimento'
    when p_destino = 'banco'        then '/gestao/banco-de-horas'
  end
    from perfis p where p.id = p_perfil_id;
$$;

create or replace function public.rotulo_pedido(p_tipo text)
returns text
language sql
immutable
as $$
  select case p_tipo
    when 'correcao_marcacao' then 'correção de marcação'
    when 'inclusao_esquecida' then 'marcação esquecida'
    when 'abono' then 'abono'
    when 'folga' then 'folga'
    else p_tipo end;
$$;

-- 1.3 Pedido novo e pedido respondido
create or replace function public.avisos_pedido()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pessoa   perfis;
  v_dest     uuid;
  v_gestores uuid[];
  v_status   text := new.status::text;
begin
  select * into v_pessoa from perfis where id = new.perfil_id;
  if v_pessoa.id is null or v_pessoa.empresa_id is null then
    return null;
  end if;

  if tg_op = 'INSERT' then
    if v_status <> 'pendente' then
      return null;
    end if;
    if new.tipo::text <> 'abono' then
      select array_agg(dg.perfil_id) into v_gestores
        from departamento_gestores dg
        join perfis g on g.id = dg.perfil_id and g.status <> 'desligado'
       where dg.departamento_id = v_pessoa.departamento_id
         and dg.perfil_id <> v_pessoa.id;
    end if;
    if v_gestores is null then
      select array_agg(p.id) into v_gestores
        from perfis p
       where p.empresa_id = v_pessoa.empresa_id and p.tipo in ('administrador', 'rh')
         and p.status <> 'desligado' and p.id <> v_pessoa.id;
    end if;
    foreach v_dest in array coalesce(v_gestores, '{}') loop
      perform criar_aviso(v_dest, 'pedido_novo',
        'Novo pedido de ' || rotulo_pedido(new.tipo::text),
        coalesce(nullif(v_pessoa.nome_completo, ''), 'Alguém da equipe') || ': ' || left(new.motivo, 200),
        link_do_aviso(v_dest, 'solicitacoes'), new.id, 'pedido:' || new.id);
    end loop;
    return null;
  end if;

  -- alteração: só interessa quando sai de "pendente"
  if old.status::text <> 'pendente' or v_status = 'pendente' then
    return null;
  end if;
  -- o pedido não precisa mais de ninguém: some o aviso de "pedido novo"
  delete from avisos where referencia_id = new.id and tipo = 'pedido_novo';
  if v_status in ('aprovado', 'rejeitado') then
    perform criar_aviso(new.perfil_id, 'pedido_respondido',
      'Seu pedido de ' || rotulo_pedido(new.tipo::text) || case when v_status = 'aprovado' then ' foi aprovado' else ' foi recusado' end,
      coalesce('Resposta: ' || nullif(new.comentario_analise, ''), case when v_status = 'aprovado' then 'Ele já vale no seu espelho de ponto.' else null end),
      link_do_aviso(new.perfil_id, 'meus_pedidos'), new.id, 'resposta:' || new.id);
  end if;
  return null;
end;
$$;
drop trigger if exists avisos_pedido on public.ajustes_ponto;
create trigger avisos_pedido after insert or update of status on public.ajustes_ponto
  for each row execute function public.avisos_pedido();

-- 1.4 Pessoa nova pelo convite
create or replace function public.avisos_pessoa_nova()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dest uuid;
begin
  if old.empresa_id is not null or new.empresa_id is null or new.tipo <> 'funcionario' then
    return null;
  end if;
  for v_dest in
    select p.id from perfis p
     where p.empresa_id = new.empresa_id and p.tipo in ('administrador', 'rh')
       and p.status <> 'desligado' and p.id <> new.id
  loop
    perform criar_aviso(v_dest, 'pessoa_nova',
      'Pessoa nova: ' || coalesce(nullif(new.nome_completo, ''), 'sem nome'),
      'Entrou pelo convite. Complete o cadastro: jornada, departamento e data de admissão.',
      link_do_aviso(v_dest, 'pessoa', new.id::text), new.id, 'pessoa_nova:' || new.id);
  end loop;
  return null;
end;
$$;
drop trigger if exists avisos_pessoa_nova on public.perfis;
create trigger avisos_pessoa_nova after update of empresa_id on public.perfis
  for each row execute function public.avisos_pessoa_nova();

-- 1.5 Foto de rosto enviada e analisada
create or replace function public.avisos_foto()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dest uuid;
  v_nome text;
begin
  if tg_op = 'INSERT' then
    if new.status <> 'pendente' then
      return null;
    end if;
    select nome_completo into v_nome from perfis where id = new.perfil_id;
    for v_dest in
      select p.id from perfis p
       where p.empresa_id = new.empresa_id and p.tipo in ('administrador', 'rh')
         and p.status <> 'desligado' and p.id <> new.perfil_id
    loop
      perform criar_aviso(v_dest, 'foto_para_aprovar', 'Foto de rosto para aprovar',
        coalesce(nullif(v_nome, ''), 'Alguém') || ' enviou a foto de cadastro do rosto.',
        link_do_aviso(v_dest, 'reconhecimento'), new.id, 'foto:' || new.id);
    end loop;
    return null;
  end if;

  if old.status <> 'pendente' or new.status = 'pendente' then
    return null;
  end if;
  delete from avisos where referencia_id = new.id and tipo = 'foto_para_aprovar';
  if new.status in ('aprovada', 'recusada') then
    perform criar_aviso(new.perfil_id, 'foto_analisada',
      case when new.status = 'aprovada' then 'Sua foto de rosto foi aprovada' else 'Sua foto de rosto foi recusada' end,
      case when new.status = 'aprovada' then 'Agora o ponto com reconhecimento facial já confere o seu rosto.'
           else coalesce('Motivo: ' || nullif(new.motivo_recusa, '') || '. ', '') || 'Tire uma foto nova em Minha conta.' end,
      link_do_aviso(new.perfil_id, 'conta'), new.id, 'foto_resposta:' || new.id);
  end if;
  return null;
end;
$$;
drop trigger if exists avisos_foto on public.rostos_referencia;
create trigger avisos_foto after insert or update of status on public.rostos_referencia
  for each row execute function public.avisos_foto();

-- 1.6 Avisos que dependem do dia (chamada pelo app quando a pessoa entra)
--     * dia incompleto nos últimos 3 dias (para a própria pessoa);
--     * banco de horas vencendo ou vencido (RH e administrador, 1 vez por semana).
--     Devolve quantos avisos ainda não foram lidos.
create table if not exists public.avisos_verificados (
  perfil_id uuid not null references public.perfis(id) on delete cascade,
  chave     text not null,
  em        timestamptz not null default now(),
  primary key (perfil_id, chave)
);
alter table public.avisos_verificados enable row level security;
revoke all on public.avisos_verificados from anon, authenticated;

create or replace function public.atualizar_meus_avisos()
returns integer
language plpgsql
security definer
set search_path = public
set jit = off
as $$
declare
  v_uid     uuid := auth.uid();
  v_eu      perfis;
  v_hoje    date;
  v_fuso    text;
  r         record;
  v_chave   text;
  v_vencido integer := 0;
  v_vencer  integer := 0;
  v_min_venc integer := 0;
  v_min_vencer integer := 0;
  j         jsonb;
begin
  if v_uid is null then
    return 0;
  end if;
  select * into v_eu from perfis where id = v_uid;
  if v_eu.id is null or v_eu.empresa_id is null or v_eu.status = 'desligado' then
    return 0;
  end if;

  select coalesce(f.fuso_horario, 'America/Sao_Paulo') into v_fuso
    from (select 1) x left join filiais f on f.id = v_eu.filial_id;
  v_hoje := (now() at time zone coalesce(v_fuso, 'America/Sao_Paulo'))::date;

  -- limpeza: lidos há mais de 90 dias e não lidos há mais de 180 dias
  delete from avisos
   where perfil_id = v_uid
     and ((lido_em is not null and lido_em < now() - interval '90 days')
          or criado_em < now() - interval '180 days');

  -- dia incompleto (uma vez por dia)
  v_chave := 'incompleto:' || v_hoje;
  if not exists (select 1 from avisos_verificados where perfil_id = v_uid and chave = v_chave) then
    for r in
      select a.data, a.situacao from apurar_periodo(v_uid, v_hoje - 3, v_hoje - 1) a
    loop
      if r.situacao = 'incompleto'
         and not exists (select 1 from ajustes_ponto aj
                          where aj.perfil_id = v_uid and aj.status = 'pendente'
                            and aj.tipo in ('inclusao_esquecida', 'correcao_marcacao')
                            and (aj.marcacao_solicitada at time zone coalesce(v_fuso, 'America/Sao_Paulo'))::date = r.data) then
        perform criar_aviso(v_uid, 'dia_incompleto',
          'Ficou faltando uma marcação em ' || to_char(r.data, 'DD/MM'),
          'Tem entrada sem saída (ou saída sem entrada) nesse dia. Se esqueceu de bater, peça o ajuste.',
          link_do_aviso(v_uid, 'espelho', to_char(r.data, 'YYYY-MM')), null, 'incompleto:' || r.data);
      elsif r.situacao <> 'incompleto' then
        -- o dia foi resolvido: o aviso não lido sai
        delete from avisos where perfil_id = v_uid and chave = 'incompleto:' || r.data and lido_em is null;
      end if;
    end loop;
    insert into avisos_verificados (perfil_id, chave) values (v_uid, v_chave) on conflict do nothing;
    delete from avisos_verificados where perfil_id = v_uid and em < now() - interval '30 days';
  end if;

  -- banco de horas (RH e administrador, uma vez por semana)
  if v_eu.tipo in ('administrador', 'rh') then
    v_chave := 'banco:' || to_char(v_hoje, 'IYYY-IW');
    if not exists (select 1 from avisos_verificados where perfil_id = v_uid and chave = v_chave) then
      for r in
        select p.id from perfis p
          join modelos_jornada m on m.id = p.modelo_jornada_id and m.usa_banco_horas
         where p.empresa_id = v_eu.empresa_id and p.status <> 'desligado'
      loop
        j := banco_horas(r.id);
        if coalesce((j->>'vencido_min')::integer, 0) > 0 then
          v_vencido := v_vencido + 1; v_min_venc := v_min_venc + (j->>'vencido_min')::integer;
        end if;
        if coalesce((j->>'a_vencer_min')::integer, 0) > 0 then
          v_vencer := v_vencer + 1; v_min_vencer := v_min_vencer + (j->>'a_vencer_min')::integer;
        end if;
      end loop;
      if v_vencido > 0 or v_vencer > 0 then
        perform criar_aviso(v_uid, 'banco_vencendo', 'Banco de horas: confira os vencimentos',
          concat_ws(' ',
            case when v_vencer > 0 then v_vencer || case when v_vencer = 1 then ' pessoa tem ' else ' pessoas têm ' end
                 || (v_min_vencer / 60) || 'h' || lpad((v_min_vencer % 60)::text, 2, '0') || ' vencendo nos próximos 30 dias.' end,
            case when v_vencido > 0 then v_vencido || case when v_vencido = 1 then ' pessoa tem ' else ' pessoas têm ' end
                 || (v_min_venc / 60) || 'h' || lpad((v_min_venc % 60)::text, 2, '0') || ' vencidas, a pagar.' end),
          link_do_aviso(v_uid, 'banco'), null, v_chave);
      end if;
      insert into avisos_verificados (perfil_id, chave) values (v_uid, v_chave) on conflict do nothing;
    end if;
  end if;

  return (select count(*) from avisos where perfil_id = v_uid and lido_em is null);
end;
$$;

-- ===========================================================================
-- PARTE 2 — HISTÓRICO DE ALTERAÇÕES
-- ===========================================================================
create table if not exists public.historico_alteracoes (
  id             bigint generated always as identity primary key,
  empresa_id     uuid not null references public.empresas(id) on delete cascade,
  tabela         text not null,
  registro_id    uuid,
  pessoa_id      uuid,
  acao           text not null check (acao in ('criou', 'alterou', 'excluiu')),
  feito_por      uuid,
  feito_por_nome text,
  em             timestamptz not null default now(),
  transacao      bigint not null default txid_current(),
  campos         text[],
  antes          jsonb,
  depois         jsonb
);
create index if not exists historico_empresa_idx  on public.historico_alteracoes (empresa_id, em desc);
create index if not exists historico_pessoa_idx   on public.historico_alteracoes (pessoa_id, em desc) where pessoa_id is not null;
create index if not exists historico_registro_idx on public.historico_alteracoes (tabela, registro_id);

-- ninguém edita nem apaga o histórico (só some junto se a empresa for excluída)
create or replace function public.proteger_historico()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'DELETE' and pg_trigger_depth() > 1 then
    return old;
  end if;
  raise exception 'O histórico de alterações não pode ser editado nem apagado.';
end;
$$;
drop trigger if exists proteger_historico on public.historico_alteracoes;
create trigger proteger_historico before update or delete on public.historico_alteracoes
  for each row execute function public.proteger_historico();

alter table public.historico_alteracoes enable row level security;
drop policy if exists "histórico: admin/rh veem a empresa" on public.historico_alteracoes;
create policy "histórico: admin/rh veem a empresa" on public.historico_alteracoes
  for select to authenticated
  using (empresa_id = (select public.empresa_do_usuario())
         and (select public.tipo_do_usuario()) in ('administrador', 'rh'));
revoke all on public.historico_alteracoes from anon;
revoke insert, update, delete on public.historico_alteracoes from authenticated;

-- O gatilho que anota as alterações (igual para todas as tabelas)
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
                             'hash_anterior', 'hash_evidencia', 'enviada_em', 'foto_sha256'];
  v_mascara  text[] := array['cpf', 'telefone'];
  v_campos   text[];
  v_antes    jsonb := '{}'::jsonb;
  v_depois   jsonb := '{}'::jsonb;
  v_empresa  uuid;
  v_registro uuid;
  v_pessoa   uuid;
  v_uid      uuid := auth.uid();
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

  -- de que empresa é
  v_empresa := case
    when tg_table_name = 'empresas' then (v_ref ->> 'id')::uuid
    when tg_table_name = 'modelos_jornada_dias' then (select m.empresa_id from modelos_jornada m where m.id = (v_ref ->> 'modelo_id')::uuid)
    when v_ref ? 'empresa_id' and v_ref ->> 'empresa_id' is not null then (v_ref ->> 'empresa_id')::uuid
    when v_ref ? 'perfil_id' then (select p.empresa_id from perfis p where p.id = (v_ref ->> 'perfil_id')::uuid)
  end;
  -- pessoa que entrou pelo convite: a empresa nova
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
          v_uid, case when v_uid is null then 'Sistema' else (select nome_completo from perfis where id = v_uid) end,
          v_campos,
          case when tg_op = 'INSERT' then null else v_antes end,
          case when tg_op = 'DELETE' then null else v_depois end);
  return null;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array['empresas', 'filiais', 'perfis', 'departamentos', 'cargos', 'modelos_jornada',
                           'modelos_jornada_dias', 'feriados', 'turnos', 'escala_dias', 'ajustes_ponto',
                           'afastamentos', 'banco_horas_lancamentos', 'departamento_gestores', 'rostos_referencia'] loop
    execute format('drop trigger if exists historico on public.%I', t);
    execute format('create trigger historico after insert or update or delete on public.%I
                      for each row execute function public.registrar_historico()', t);
  end loop;
  -- conferência das marcações com reconhecimento facial: só quando o RH confere
  drop trigger if exists historico on public.verificacoes_faciais;
  create trigger historico after update on public.verificacoes_faciais
    for each row execute function public.registrar_historico();
end $$;

-- ---------------------------------------------------------------------------
-- 3. Quem pode chamar
-- ---------------------------------------------------------------------------
revoke execute on function public.criar_aviso(uuid, text, text, text, text, uuid, text) from public, anon, authenticated;
revoke execute on function public.link_do_aviso(uuid, text, text)                       from public, anon, authenticated;
revoke execute on function public.avisos_pedido()                                       from public, anon, authenticated;
revoke execute on function public.avisos_pessoa_nova()                                  from public, anon, authenticated;
revoke execute on function public.avisos_foto()                                         from public, anon, authenticated;
revoke execute on function public.registrar_historico()                                 from public, anon, authenticated;
revoke execute on function public.atualizar_meus_avisos()                               from public, anon;
grant  execute on function public.atualizar_meus_avisos()                               to authenticated;

notify pgrst, 'reload schema';
