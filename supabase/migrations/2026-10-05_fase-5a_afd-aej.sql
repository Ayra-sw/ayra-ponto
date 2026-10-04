-- ============================================================================
-- Ayra Ponto — Fase 5A: arquivos oficiais AFD e AEJ (Portaria MTP 671/2021)
--
-- O que esta migração faz (tudo é ACRESCENTADO; nenhuma marcação é alterada):
--   1. ayra_sistema: dados do Ayra Ponto como programa (nº de registro no
--      INPI, CNPJ/razão social/e-mail do desenvolvedor). Fica vazio até a
--      Pati preencher; enquanto isso os arquivos saem com o campo zerado.
--   2. afd_registros: cada linha do AFD fica gravada no momento em que o
--      fato acontece e nunca muda:
--        * tipo 7 = cada marcação de ponto (com o SHA-256 encadeado);
--        * tipo 2 = cadastro/alteração da empresa e da unidade;
--        * tipo 5 = inclusão/alteração/exclusão de pessoa na unidade.
--      Os tipos 2 e 5 usam a MESMA sequência de NSR das marcações (como pede
--      o leiaute). Na instalação, cada unidade recebe um tipo 2 e cada pessoa
--      ativa um tipo 5 ("situação atual"); as marcações antigas ganham a sua
--      linha tipo 7, na ordem do NSR, sem nenhuma alteração.
--   3. gerar_afd() e gerar_aej(): montam os arquivos de uma unidade e período.
--      Só administrador e RH da empresa.
--   4. Correções:
--        * a conferência da corrente (verificar_cadeia_integridade) passa a
--          aceitar os NSR usados pelos registros tipo 2 e 5;
--        * o histórico de alterações deixa de anotar a troca do contador de
--          NSR da unidade (acontecia a cada marcação desde a Fase 3C).
--
-- Pode ser executada mais de uma vez sem problema.
-- Para desligar: 2026-10-05_fase-5a_afd-aej_DESFAZER.sql
-- ============================================================================

do $$
begin
  if to_regclass('public.marcos_usuario') is null then
    raise exception 'Antes desta migração é preciso aplicar a Fase 4A.';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 0. Correção da Fase 3C: o contador de NSR não é "alteração da unidade"
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
          v_uid, case when v_uid is null then 'Sistema' else (select nome_completo from perfis where id = v_uid) end,
          v_campos,
          case when tg_op = 'INSERT' then null else v_antes end,
          case when tg_op = 'DELETE' then null else v_depois end);
  return null;
end;
$$;
revoke execute on function public.registrar_historico() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 1. Dados do Ayra Ponto como programa (uma linha só)
-- ---------------------------------------------------------------------------
create table if not exists public.ayra_sistema (
  id                    boolean primary key default true check (id),
  nome_programa         text not null default 'Ayra Ponto',
  versao_programa       text not null default '1.0' check (char_length(versao_programa) between 1 and 8),
  inpi_registro         text check (inpi_registro is null or inpi_registro ~ '^[0-9]{1,17}$'),
  desenvolvedor_tipo_doc smallint check (desenvolvedor_tipo_doc in (1, 2)),
  desenvolvedor_doc     text check (desenvolvedor_doc is null or desenvolvedor_doc ~ '^[0-9A-Z]{11,14}$'),
  desenvolvedor_nome    text check (desenvolvedor_nome is null or char_length(desenvolvedor_nome) <= 150),
  desenvolvedor_email   text check (desenvolvedor_email is null or desenvolvedor_email ~ '^[^@\s|]+@[^@\s|]+\.[^@\s|]+$'),
  atualizado_em         timestamptz not null default now()
);
comment on table public.ayra_sistema is
  'Dados do Ayra Ponto como REP-P e programa de tratamento (INPI e desenvolvedor). Preenchido pela equipe do Ayra.';
insert into public.ayra_sistema (id) values (true) on conflict (id) do nothing;

alter table public.ayra_sistema enable row level security;
drop policy if exists ayra_sistema_ver on public.ayra_sistema;
create policy ayra_sistema_ver on public.ayra_sistema for select to authenticated using (true);
revoke all on public.ayra_sistema from anon;
revoke insert, update, delete on public.ayra_sistema from authenticated;
grant select on public.ayra_sistema to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Ajudantes de formatação do leiaute (Anexos V e VI)
-- ---------------------------------------------------------------------------
-- Texto que cabe no ISO-8859-1, sem quebras de linha nem "|"
create or replace function public.afd_texto(p text)
returns text language sql immutable set search_path = public as $$
  select regexp_replace(regexp_replace(coalesce(p, ''), '[\r\n\t|]+', ' ', 'g'), '[^ -~ -ÿ]', '?', 'g')
$$;

-- Alfanumérico: alinhado à esquerda, completado com espaços
create or replace function public.afd_a(p text, p_tam int)
returns text language sql immutable set search_path = public as $$
  select rpad(left(afd_texto(p), p_tam), p_tam, ' ')
$$;

-- Numérico: só dígitos, zeros à esquerda
create or replace function public.afd_n(p text, p_tam int)
returns text language sql immutable set search_path = public as $$
  select lpad(right(regexp_replace(coalesce(p, ''), '[^0-9]', '', 'g'), p_tam), p_tam, '0')
$$;

-- Data e hora: AAAA-MM-ddThh:mm:00ZZZZZ, no fuso da unidade
create or replace function public.afd_dh(p_ts timestamptz, p_fuso text)
returns text language plpgsql stable set search_path = public as $$
declare
  v_local timestamp := p_ts at time zone coalesce(p_fuso, 'America/Sao_Paulo');
  v_min   int := round(extract(epoch from (v_local - (p_ts at time zone 'UTC'))) / 60)::int;
begin
  return to_char(v_local, 'YYYY-MM-DD"T"HH24:MI') || ':00'
      || case when v_min < 0 then '-' else '+' end
      || lpad((abs(v_min) / 60)::text, 2, '0') || lpad((abs(v_min) % 60)::text, 2, '0');
end $$;

-- CRC-16 CCITT-TRUE (CRC-16/KERMIT): polinômio 0x1021 refletido (0x8408), início 0
create or replace function public.afd_crc16(p text)
returns text language plpgsql immutable set search_path = public as $$
declare
  b   bytea := convert_to(afd_texto(p), 'LATIN1');
  crc int := 0;
  i   int;
  j   int;
begin
  for i in 0 .. length(b) - 1 loop
    crc := crc # get_byte(b, i);
    for j in 1 .. 8 loop
      if (crc & 1) = 1 then crc := (crc >> 1) # 33800; else crc := crc >> 1; end if;
    end loop;
  end loop;
  return upper(lpad(to_hex(crc), 4, '0'));
end $$;

-- Quem é o empregador no AFD/AEJ de uma unidade:
--   unidade com CNPJ próprio → esse CNPJ; senão o CNPJ da empresa,
--   com o CNO/CAEPF da unidade (se houver).
create or replace function public.afd_empregador(p_filial uuid)
returns table (tipo_id text, id_empregador text, cno_caepf text, razao text, local text, fuso text)
language sql stable security definer set search_path = public as $$
  select '1',
         case when f.tipo_identificador = 'cnpj' and coalesce(f.identificador_legal, '') <> '' then f.identificador_legal
              else coalesce(e.cnpj, '') end,
         case when f.tipo_identificador in ('cno', 'caepf', 'cei') then coalesce(f.identificador_legal, '') else '' end,
         coalesce(nullif(e.razao_social, ''), e.nome),
         concat_ws(' - ',
           nullif(concat_ws(', ', nullif(f.logradouro, ''), nullif(f.numero, ''), nullif(f.complemento, '')), ''),
           nullif(f.bairro, ''),
           nullif(concat_ws('/', nullif(f.cidade, ''), nullif(f.uf, '')), ''),
           case when coalesce(f.logradouro, f.cidade, '') = '' then f.nome end),
         f.fuso_horario
    from filiais f join empresas e on e.id = f.empresa_id
   where f.id = p_filial
$$;
revoke execute on function public.afd_empregador(uuid) from public, anon, authenticated;

-- CPF de quem fez a alteração (ou do primeiro administrador, quando é o sistema)
create or replace function public.afd_cpf_responsavel(p_empresa uuid)
returns text language sql stable security definer set search_path = public as $$
  select coalesce(
    (select nullif(p.cpf, '') from perfis p where p.id = auth.uid()),
    (select nullif(p.cpf, '') from perfis p where p.empresa_id = p_empresa and p.tipo = 'administrador'
      order by p.criado_em limit 1),
    '')
$$;
revoke execute on function public.afd_cpf_responsavel(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Linhas do AFD, gravadas no momento do fato
-- ---------------------------------------------------------------------------
create table if not exists public.afd_registros (
  filial_id    uuid not null references public.filiais(id) on delete cascade,
  nsr          bigint not null check (nsr > 0),
  tipo         smallint not null check (tipo in (2, 5, 6, 7)),
  gravado_em   timestamptz not null default now(),
  linha        text not null,
  registro_id  uuid unique references public.registros_ponto(id),
  perfil_id    uuid references public.perfis(id) on delete set null,
  primary key (filial_id, nsr),
  check ((tipo = 2 and char_length(linha) = 331) or (tipo = 5 and char_length(linha) = 118)
      or (tipo = 6 and char_length(linha) = 36)  or (tipo = 7 and char_length(linha) = 137))
);
create index if not exists afd_registros_data on public.afd_registros (filial_id, gravado_em);
comment on table public.afd_registros is
  'Linhas do AFD (Portaria 671, Anexo V), gravadas quando o fato acontece. Nunca mudam.';

alter table public.afd_registros enable row level security;
drop policy if exists afd_ver on public.afd_registros;
create policy afd_ver on public.afd_registros for select to authenticated
  using ((select tipo_do_usuario()) in ('administrador', 'rh')
         and exists (select 1 from filiais f where f.id = filial_id and f.empresa_id = (select empresa_do_usuario())));
revoke all on public.afd_registros from anon;
revoke insert, update, delete on public.afd_registros from authenticated;
grant select on public.afd_registros to authenticated;

create or replace function public.proteger_afd()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'DELETE' and pg_trigger_depth() > 1 then return old; end if;  -- unidade excluída (cascata)
  raise exception 'As linhas do AFD não podem ser alteradas nem apagadas.';
end $$;
drop trigger if exists proteger_afd on public.afd_registros;
create trigger proteger_afd before update or delete on public.afd_registros
  for each row execute function public.proteger_afd();

-- Tipo 7: a linha da marcação (fica pronta junto com a marcação)
create or replace function public.afd_linha_marcacao(p_registro registros_ponto)
returns text language plpgsql stable security definer set search_path = public, extensions as $$
declare
  v_fuso   text;
  v_cpf    text;
  v_ant    text;
  v_base   text;
begin
  select f.fuso_horario into v_fuso from filiais f where f.id = p_registro.filial_id;
  select p.cpf into v_cpf from perfis p where p.id = p_registro.perfil_id;
  select substr(a.linha, 74, 64) into v_ant
    from afd_registros a
   where a.filial_id = p_registro.filial_id and a.tipo = 7 and a.nsr < p_registro.nsr
   order by a.nsr desc limit 1;
  v_base := afd_n(p_registro.nsr::text, 9) || '7'
         || afd_dh(p_registro.marcado_em, v_fuso)
         || afd_n(v_cpf, 12)
         || afd_dh(coalesce(p_registro.criado_em, p_registro.marcado_em), v_fuso)
         || case when p_registro.origem::text like 'mobile%' then '01' else '02' end
         || '0';
  return v_base || encode(digest(v_base || coalesce(v_ant, ''), 'sha256'), 'hex');
end $$;
revoke execute on function public.afd_linha_marcacao(registros_ponto) from public, anon, authenticated;

create or replace function public.afd_registrar_marcacao()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into afd_registros (filial_id, nsr, tipo, gravado_em, linha, registro_id, perfil_id)
  values (new.filial_id, new.nsr, 7, coalesce(new.criado_em, new.marcado_em), afd_linha_marcacao(new), new.id, new.perfil_id)
  on conflict do nothing;
  return null;
end $$;
revoke execute on function public.afd_registrar_marcacao() from public, anon, authenticated;

-- Tipos 2, 5 e 6: pegam o próximo NSR da unidade (a mesma sequência das marcações)
create or replace function public.afd_registrar_evento(p_filial uuid, p_tipo smallint, p_meio text, p_perfil uuid default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_nsr  bigint;
  v_fuso text;
  v_base text;
begin
  select proximo_nsr, fuso_horario into v_nsr, v_fuso from filiais where id = p_filial for update;
  if v_nsr is null then return; end if;
  -- por segurança, nunca reaproveita um NSR já usado
  v_nsr := greatest(v_nsr,
                    coalesce((select max(r.nsr) from registros_ponto r where r.filial_id = p_filial), 0) + 1,
                    coalesce((select max(a.nsr) from afd_registros a where a.filial_id = p_filial), 0) + 1);
  v_base := afd_n(v_nsr::text, 9) || p_tipo::text || afd_dh(now(), v_fuso) || p_meio;
  insert into afd_registros (filial_id, nsr, tipo, gravado_em, linha, perfil_id)
  values (p_filial, v_nsr, p_tipo, now(),
          case when p_tipo in (2, 5) then v_base || afd_crc16(v_base) else v_base end, p_perfil);
  update filiais set proximo_nsr = v_nsr + 1 where id = p_filial;
end $$;
revoke execute on function public.afd_registrar_evento(uuid, smallint, text, uuid) from public, anon, authenticated;

-- Tipo 2 de uma unidade (empresa e local de trabalho)
create or replace function public.afd_evento_empresa(p_filial uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v record;
  v_emp uuid;
begin
  select f.empresa_id into v_emp from filiais f where f.id = p_filial;
  select * into v from afd_empregador(p_filial);
  if not found then return; end if;
  perform afd_registrar_evento(p_filial, 2::smallint,
    afd_n(afd_cpf_responsavel(v_emp), 14) || v.tipo_id || afd_a(v.id_empregador, 14)
    || afd_n(v.cno_caepf, 14) || afd_a(v.razao, 150) || afd_a(v.local, 100));
end $$;
revoke execute on function public.afd_evento_empresa(uuid) from public, anon, authenticated;

-- Tipo 5 de uma pessoa (I = inclusão, A = alteração, E = exclusão)
create or replace function public.afd_evento_pessoa(p_filial uuid, p_operacao text, p_cpf text, p_nome text, p_perfil uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_emp uuid;
begin
  select f.empresa_id into v_emp from filiais f where f.id = p_filial;
  perform afd_registrar_evento(p_filial, 5::smallint,
    p_operacao || afd_n(p_cpf, 12) || afd_a(p_nome, 52) || afd_a('', 4) || afd_n(afd_cpf_responsavel(v_emp), 11),
    p_perfil);
end $$;
revoke execute on function public.afd_evento_pessoa(uuid, text, text, text, uuid) from public, anon, authenticated;

-- Gatilhos que gravam os tipos 2 e 5
create or replace function public.afd_gatilho_filial()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform afd_evento_empresa(new.id);
  elsif (new.identificador_legal, new.tipo_identificador, new.logradouro, new.numero, new.complemento,
         new.bairro, new.cidade, new.uf, new.nome)
        is distinct from
        (old.identificador_legal, old.tipo_identificador, old.logradouro, old.numero, old.complemento,
         old.bairro, old.cidade, old.uf, old.nome) then
    perform afd_evento_empresa(new.id);
  end if;
  return null;
end $$;
revoke execute on function public.afd_gatilho_filial() from public, anon, authenticated;

create or replace function public.afd_gatilho_empresa()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  f uuid;
begin
  if (new.cnpj, new.razao_social, new.nome) is distinct from (old.cnpj, old.razao_social, old.nome) then
    for f in select id from filiais where empresa_id = new.id and ativa order by criado_em loop
      perform afd_evento_empresa(f);
    end loop;
  end if;
  return null;
end $$;
revoke execute on function public.afd_gatilho_empresa() from public, anon, authenticated;

create or replace function public.afd_gatilho_pessoa()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_antes  uuid;  -- unidade em que a pessoa estava ativa
  v_depois uuid;  -- unidade em que a pessoa está ativa agora
begin
  if tg_op = 'UPDATE' and old.empresa_id is not null and old.status <> 'desligado' then v_antes := old.filial_id; end if;
  if new.empresa_id is not null and new.status <> 'desligado' then v_depois := new.filial_id; end if;

  if v_antes is not null and v_antes is distinct from v_depois then
    perform afd_evento_pessoa(v_antes, 'E', old.cpf, old.nome_completo, old.id);
  end if;
  if v_depois is not null and v_depois is distinct from v_antes then
    perform afd_evento_pessoa(v_depois, 'I', new.cpf, new.nome_completo, new.id);
  elsif v_depois is not null and tg_op = 'UPDATE'
        and (new.cpf, new.nome_completo) is distinct from (old.cpf, old.nome_completo) then
    perform afd_evento_pessoa(v_depois, 'A', new.cpf, new.nome_completo, new.id);
  end if;
  return null;
end $$;
revoke execute on function public.afd_gatilho_pessoa() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Carga inicial (só para unidades que ainda não têm linhas do AFD)
-- ---------------------------------------------------------------------------
do $$
declare
  f record;
  p record;
  r registros_ponto;
begin
  for f in select fi.id from filiais fi order by fi.criado_em loop
    -- marcações que ainda não têm a linha tipo 7 (na 1ª instalação, todas), na ordem do NSR.
    -- NSR e horário não mudam; a linha só é escrita.
    for r in select * from registros_ponto x
              where x.filial_id = f.id
                and not exists (select 1 from afd_registros a where a.registro_id = x.id)
              order by x.nsr loop
      insert into afd_registros (filial_id, nsr, tipo, gravado_em, linha, registro_id, perfil_id)
      values (r.filial_id, r.nsr, 7, coalesce(r.criado_em, r.marcado_em), afd_linha_marcacao(r), r.id, r.perfil_id);
    end loop;
    -- 1ª instalação da unidade: a situação atual (empresa/unidade e pessoas ativas), com NSR a partir de agora
    if not exists (select 1 from afd_registros a where a.filial_id = f.id and a.tipo = 2) then
      perform afd_evento_empresa(f.id);
      for p in select pe.* from perfis pe
                where pe.filial_id = f.id and pe.empresa_id is not null and pe.status <> 'desligado'
                order by pe.nome_completo, pe.id loop
        perform afd_evento_pessoa(f.id, 'I', p.cpf, p.nome_completo, p.id);
      end loop;
    end if;
  end loop;
end $$;

drop trigger if exists afd_marcacao on public.registros_ponto;
create trigger afd_marcacao after insert on public.registros_ponto
  for each row execute function public.afd_registrar_marcacao();
drop trigger if exists afd_filial on public.filiais;
create trigger afd_filial after insert or update of identificador_legal, tipo_identificador, logradouro, numero,
  complemento, bairro, cidade, uf, nome on public.filiais
  for each row execute function public.afd_gatilho_filial();
drop trigger if exists afd_empresa on public.empresas;
create trigger afd_empresa after update of cnpj, razao_social, nome on public.empresas
  for each row execute function public.afd_gatilho_empresa();
drop trigger if exists afd_pessoa on public.perfis;
create trigger afd_pessoa after insert or update of empresa_id, filial_id, status, cpf, nome_completo on public.perfis
  for each row execute function public.afd_gatilho_pessoa();

-- ---------------------------------------------------------------------------
-- 5. Conferência da corrente: os NSR dos tipos 2 e 5 não são "buraco"
-- ---------------------------------------------------------------------------
create or replace function public.verificar_cadeia_integridade(p_filial_id uuid)
returns table (nsr bigint, problema text)
language plpgsql stable security definer
set search_path = public, extensions
as $$
declare
  r            record;
  v_nsr_prev   bigint;
  v_hash_prev  text;
  v_calculado  text;
begin
  if auth.uid() is not null then
    if tipo_do_usuario() not in ('administrador', 'rh')
       or not exists (select 1 from filiais f where f.id = p_filial_id and f.empresa_id = empresa_do_usuario()) then
      raise exception 'Somente o administrador ou o RH da empresa podem conferir a corrente.';
    end if;
  end if;

  for r in
    select x.nsr as n, x as reg
      from registros_ponto x where x.filial_id = p_filial_id
    union all
    select a.nsr, null::registros_ponto
      from afd_registros a where a.filial_id = p_filial_id and a.tipo <> 7
     order by 1
  loop
    if v_nsr_prev is not null and r.n <> v_nsr_prev + 1 then
      nsr := r.n; problema := 'Falta o registro de NSR ' || (v_nsr_prev + 1) || ' (sequência interrompida).'; return next;
    end if;
    if (r.reg).id is not null and (r.reg).versao_hash >= 2 then
      if (r.reg).hash_anterior is distinct from v_hash_prev then
        nsr := r.n; problema := 'O elo com a marcação anterior não confere.'; return next;
      end if;
      v_calculado := encode(digest(texto_hash_marcacao((r.reg).filial_id, (r.reg).nsr, (r.reg).perfil_id, (r.reg).tipo,
                       (r.reg).marcado_em, (r.reg).origem, (r.reg).latitude, (r.reg).longitude,
                       (r.reg).hash_evidencia, (r.reg).hash_anterior), 'sha256'), 'hex');
      if v_calculado <> (r.reg).hash_integridade then
        nsr := r.n; problema := 'Os dados desta marcação não batem com o código de integridade.'; return next;
      end if;
    end if;
    if (r.reg).id is not null then v_hash_prev := (r.reg).hash_integridade; end if;
    v_nsr_prev := r.n;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Gerar o AFD de uma unidade e período (Anexo V, leiaute 004)
-- ---------------------------------------------------------------------------
create or replace function public.gerar_afd(p_filial uuid, p_inicio date, p_fim date)
returns text
language plpgsql stable security definer
set search_path = public, extensions
as $$
declare
  v_emp    record;
  v_sis    ayra_sistema;
  v_ini    timestamptz;
  v_fim    timestamptz;
  v_cab    text;
  v_corpo  text;
  v_q      int[] := array[0, 0, 0, 0, 0, 0];  -- tipos 2..7
begin
  if auth.uid() is null or (select tipo_do_usuario()) not in ('administrador', 'rh')
     or not exists (select 1 from filiais f where f.id = p_filial and f.empresa_id = (select empresa_do_usuario())) then
    raise exception 'Somente o administrador ou o RH da empresa podem gerar o AFD.';
  end if;
  if p_inicio is null or p_fim is null or p_fim < p_inicio then
    raise exception 'Período inválido: o último dia precisa ser depois do primeiro.';
  end if;
  if p_fim - p_inicio > 366 then
    raise exception 'O AFD pode ter no máximo 1 ano por arquivo. Gere em partes.';
  end if;

  select * into v_emp from afd_empregador(p_filial);
  select * into v_sis from ayra_sistema limit 1;
  v_ini := p_inicio::timestamp at time zone v_emp.fuso;
  v_fim := (p_fim + 1)::timestamp at time zone v_emp.fuso;

  v_cab := '000000000' || '1' || v_emp.tipo_id || afd_a(v_emp.id_empregador, 14) || afd_n(v_emp.cno_caepf, 14)
        || afd_a(v_emp.razao, 150) || afd_n(v_sis.inpi_registro, 17)
        || to_char(p_inicio, 'YYYY-MM-DD') || to_char(p_fim, 'YYYY-MM-DD')
        || afd_dh(now(), v_emp.fuso) || '004'
        || coalesce(v_sis.desenvolvedor_tipo_doc::text, '1') || afd_a(v_sis.desenvolvedor_doc, 14) || afd_a('', 30);
  v_cab := v_cab || afd_crc16(v_cab);

  select coalesce(string_agg(a.linha, E'\r\n' order by a.nsr), ''),
         array[count(*) filter (where a.tipo = 2), 0, 0, count(*) filter (where a.tipo = 5),
               count(*) filter (where a.tipo = 6), count(*) filter (where a.tipo = 7)]
    into v_corpo, v_q
    from afd_registros a
   where a.filial_id = p_filial and a.gravado_em >= v_ini and a.gravado_em < v_fim;

  return v_cab || E'\r\n'
      || case when v_corpo <> '' then v_corpo || E'\r\n' else '' end
      || '999999999' || afd_n(v_q[1]::text, 9) || afd_n(v_q[2]::text, 9) || afd_n(v_q[3]::text, 9)
      || afd_n(v_q[4]::text, 9) || afd_n(v_q[5]::text, 9) || afd_n(v_q[6]::text, 9) || '9' || E'\r\n'
      || rpad('ASSINATURA_DIGITAL_EM_ARQUIVO_P7S', 100, ' ') || E'\r\n';
end;
$$;
comment on function public.gerar_afd(uuid, date, date) is
  'AFD (Portaria 671, Anexo V) de uma unidade e período. Administrador e RH.';

-- ---------------------------------------------------------------------------
-- 7. Gerar o AEJ de uma unidade e período (Anexo VI, leiaute 002)
-- ---------------------------------------------------------------------------
create or replace function public.aej_hhmm(t time)
returns text language sql immutable set search_path = public as $$ select to_char(t, 'HH24MI') $$;

create or replace function public.gerar_aej(p_filial uuid, p_inicio date, p_fim date)
returns text
language plpgsql volatile security definer
set search_path = public, extensions
set jit = off
as $$
declare
  v_emp     record;
  v_sis     ayra_sistema;
  v_linhas  text[] := '{}';
  v_q       int[] := array[0, 0, 0, 0, 0, 0, 0, 0];  -- tipos 01..08
  v_vinc    int := 0;
  v_vincs   jsonb := '{}';     -- perfil_id -> idtVinculoAej
  v_hor     jsonb := '{}';     -- codHorContratual -> linha tipo 04
  v_l05     text[] := '{}';
  v_l06     text[] := '{}';
  v_l07     text[] := '{}';
  p         record;
  d         record;
  m         jsonb;
  v_cod     text;
  v_seq     int;
  v_tp      text;
  v_mot     text;
  v_dur     int;
  v_banco   boolean;
  v_bh_ini  date;
  l         record;
  h         record;
  v_tipo_escala text;
  v_turno   uuid;
  v_ref     date;
  v_modelo  uuid;
begin
  if auth.uid() is null or (select tipo_do_usuario()) not in ('administrador', 'rh')
     or not exists (select 1 from filiais f where f.id = p_filial and f.empresa_id = (select empresa_do_usuario())) then
    raise exception 'Somente o administrador ou o RH da empresa podem gerar o AEJ.';
  end if;
  if p_inicio is null or p_fim is null or p_fim < p_inicio then
    raise exception 'Período inválido: o último dia precisa ser depois do primeiro.';
  end if;
  if p_fim - p_inicio > 92 then
    raise exception 'O AEJ pode ter no máximo 3 meses por arquivo. Gere em partes.';
  end if;
  if p_fim > (now() at time zone 'America/Sao_Paulo')::date then
    raise exception 'Escolha um período até hoje.';
  end if;

  select * into v_emp from afd_empregador(p_filial);
  select * into v_sis from ayra_sistema limit 1;

  -- 01 cabeçalho
  v_linhas := v_linhas || ('01|' || v_emp.tipo_id || '|' || afd_texto(v_emp.id_empregador) || '|'
    || case when length(regexp_replace(v_emp.cno_caepf, '\D', '', 'g')) = 14 then regexp_replace(v_emp.cno_caepf, '\D', '', 'g') else '' end || '|'
    || case when length(regexp_replace(v_emp.cno_caepf, '\D', '', 'g')) = 12 then regexp_replace(v_emp.cno_caepf, '\D', '', 'g') else '' end || '|'
    || left(afd_texto(v_emp.razao), 150) || '|' || to_char(p_inicio, 'YYYY-MM-DD') || '|' || to_char(p_fim, 'YYYY-MM-DD')
    || '|' || afd_dh(now(), v_emp.fuso) || '|002');
  v_q[1] := 1;
  -- 02 o REP-P desta unidade (o próprio Ayra Ponto)
  v_linhas := v_linhas || ('02|1|3|' || afd_n(v_sis.inpi_registro, 17));
  v_q[2] := 1;

  -- pessoas: quem esteve ativo na unidade ou marcou ponto nela no período
  for p in
    select pe.id, pe.cpf, pe.nome_completo, pe.matricula, pe.modelo_jornada_id, pe.tipo_escala,
           pe.escala_turno_id, pe.escala_referencia,
           coalesce(mj.usa_banco_horas, false) as usa_banco, mj.banco_horas_inicio
      from perfis pe
      left join modelos_jornada mj on mj.id = pe.modelo_jornada_id
     where pe.empresa_id = (select empresa_do_usuario())
       and ((pe.filial_id = p_filial and pe.status <> 'desligado')
            or exists (select 1 from registros_ponto r where r.perfil_id = pe.id and r.filial_id = p_filial
                        and r.marcado_em >= (p_inicio::timestamp at time zone v_emp.fuso)
                        and r.marcado_em <  ((p_fim + 1)::timestamp at time zone v_emp.fuso)))
     order by pe.nome_completo, pe.id
  loop
    v_vinc := v_vinc + 1;
    v_vincs := v_vincs || jsonb_build_object(p.id::text, v_vinc);
    v_linhas := v_linhas || ('03|' || v_vinc || '|' || afd_n(p.cpf, 11) || '|' || left(afd_texto(p.nome_completo), 150));
    v_q[3] := v_q[3] + 1;
    if coalesce(p.matricula, '') <> '' then
      v_l06 := v_l06 || ('06|' || v_vinc || '|' || left(afd_texto(p.matricula), 30));
    end if;

    for d in select * from apurar_periodo(p.id, p_inicio, p_fim) loop
      -- horário contratual do dia (jornada semanal ou turno da escala)
      v_cod := null;
      if coalesce(p.tipo_escala, 'semanal') = 'semanal' then
        select jd.* into h from modelos_jornada_dias jd
         where jd.modelo_id = p.modelo_jornada_id and jd.dia_semana = d.dia_semana and jd.trabalha;
        if found then
          v_cod := 'J' || left(replace(p.modelo_jornada_id::text, '-', ''), 8) || '-'
                    || (array['DOM','SEG','TER','QUA','QUI','SEX','SAB'])[d.dia_semana + 1];
          if not v_hor ? v_cod then
            v_dur := minutos_previstos_dia(h.entrada, h.saida, h.intervalo_inicio, h.intervalo_fim);
            v_hor := v_hor || jsonb_build_object(v_cod, '04|' || v_cod || '|' || v_dur || '|' || aej_hhmm(h.entrada) || '|'
              || case when h.intervalo_inicio is not null and h.intervalo_fim is not null
                      then aej_hhmm(h.intervalo_inicio) || '|' || aej_hhmm(h.intervalo_fim) || '|' || aej_hhmm(h.saida)
                      else aej_hhmm(h.saida) end);
          end if;
        end if;
      else
        v_turno := case when p.tipo_escala = '12x36'
                          then case when ((d.data - p.escala_referencia) % 2 + 2) % 2 = 0 then p.escala_turno_id end
                        else (select ed.turno_id from escala_dias ed where ed.perfil_id = p.id and ed.data = d.data) end;
        if v_turno is not null then
          select t.* into h from turnos t where t.id = v_turno;
          if found then
            v_cod := 'T' || left(replace(h.id::text, '-', ''), 8) || '-' || afd_texto(coalesce(h.sigla, ''));
            if not v_hor ? v_cod then
              v_dur := minutos_previstos_dia(h.entrada, h.saida, h.intervalo_inicio, h.intervalo_fim);
              v_hor := v_hor || jsonb_build_object(v_cod, '04|' || v_cod || '|' || v_dur || '|' || aej_hhmm(h.entrada) || '|'
                || case when h.intervalo_inicio is not null and h.intervalo_fim is not null
                        then aej_hhmm(h.intervalo_inicio) || '|' || aej_hhmm(h.intervalo_fim) || '|' || aej_hhmm(h.saida)
                        else aej_hhmm(h.saida) end);
            end if;
          end if;
        end if;
      end if;
      if v_cod is null then
        v_cod := 'SEM-JORNADA';
        if not v_hor ? v_cod then v_hor := v_hor || jsonb_build_object(v_cod, '04|SEM-JORNADA|0|0000|0000'); end if;
      end if;

      -- 05 marcações do dia (tratadas): originais, desconsideradas e incluídas
      v_seq := 0;
      for m in select * from jsonb_array_elements(coalesce(d.marcacoes, '[]'::jsonb)) loop
        v_tp := case when m ->> 'tipo' in ('entrada', 'fim_intervalo') then 'E' else 'S' end;
        if v_tp = 'E' then v_seq := v_seq + 1; end if;
        if m ->> 'origem' = 'corrigida' then
          select left(afd_texto(a.motivo), 120) into v_mot from ajustes_ponto a where a.id = (m ->> 'ajuste_id')::uuid;
          v_l05 := v_l05 || ('05|' || v_vinc || '|' || afd_dh((m ->> 'em_original')::timestamptz, v_emp.fuso) || '|1|D|'
            || greatest(v_seq, 1) || '|O||' || 'Horário corrigido por ajuste aprovado');
          v_l05 := v_l05 || ('05|' || v_vinc || '|' || afd_dh((m ->> 'em')::timestamptz, v_emp.fuso) || '||' || v_tp || '|'
            || greatest(v_seq, 1) || '|I|' || case when v_tp = 'E' and v_seq = 1 then v_cod else '' end || '|'
            || 'Ajuste aprovado: ' || coalesce(v_mot, ''));
        elsif m ->> 'origem' = 'incluida' then
          select left(afd_texto(a.motivo), 120) into v_mot from ajustes_ponto a where a.id = (m ->> 'ajuste_id')::uuid;
          v_l05 := v_l05 || ('05|' || v_vinc || '|' || afd_dh((m ->> 'em')::timestamptz, v_emp.fuso) || '||' || v_tp || '|'
            || greatest(v_seq, 1) || '|I|' || case when v_tp = 'E' and v_seq = 1 then v_cod else '' end || '|'
            || 'Marcação incluída por ajuste aprovado: ' || coalesce(v_mot, ''));
        else
          v_l05 := v_l05 || ('05|' || v_vinc || '|' || afd_dh((m ->> 'em')::timestamptz, v_emp.fuso) || '|1|' || v_tp || '|'
            || greatest(v_seq, 1) || '|O|' || case when v_tp = 'E' and v_seq = 1 then v_cod else '' end || '|');
        end if;
      end loop;

      -- 07 falta não justificada
      if d.situacao = 'falta' then
        v_l07 := v_l07 || ('07|' || v_vinc || '|2|' || to_char(d.data, 'YYYY-MM-DD') || '||');
      end if;
      -- 07 banco de horas: saldo do dia (só dias fechados, na jornada com banco)
      if p.usa_banco and (p.banco_horas_inicio is null or d.data >= p.banco_horas_inicio)
         and d.situacao not in ('incompleto', 'em_andamento', 'futuro') and coalesce(d.saldo_min, 0) <> 0 then
        v_l07 := v_l07 || ('07|' || v_vinc || '|3|' || to_char(d.data, 'YYYY-MM-DD') || '|' || abs(d.saldo_min)
          || '|' || case when d.saldo_min > 0 then '1' else '2' end);
      end if;
    end loop;

    -- 07 lançamentos manuais do banco de horas (o pagamento em folha não é compensação: fica de fora)
    for l in select bl.data as data_lancamento, bl.minutos, bl.tipo::text as tipo from banco_horas_lancamentos bl
              where bl.perfil_id = p.id and bl.data between p_inicio and p_fim
                and bl.tipo::text <> 'pagamento' and bl.minutos <> 0
              order by bl.data loop
      v_l07 := v_l07 || ('07|' || v_vinc || '|3|' || to_char(l.data_lancamento, 'YYYY-MM-DD') || '|' || abs(l.minutos)
        || '|' || case when l.minutos > 0 then '1' else '2' end);
    end loop;
  end loop;

  -- 04 horários (antes das marcações, como pede a ordem do leiaute)
  for h in select key, value #>> '{}' as linha from jsonb_each(v_hor) order by key loop
    v_linhas := v_linhas || h.linha;
    v_q[4] := v_q[4] + 1;
  end loop;
  v_linhas := v_linhas || v_l05;  v_q[5] := coalesce(array_length(v_l05, 1), 0);
  v_linhas := v_linhas || v_l06;  v_q[6] := coalesce(array_length(v_l06, 1), 0);
  v_linhas := v_linhas || v_l07;  v_q[7] := coalesce(array_length(v_l07, 1), 0);
  -- 08 o programa de tratamento (Ayra Ponto)
  v_linhas := v_linhas || ('08|' || afd_texto(v_sis.nome_programa) || '|' || afd_texto(v_sis.versao_programa) || '|'
    || coalesce(v_sis.desenvolvedor_tipo_doc::text, '1') || '|' || coalesce(v_sis.desenvolvedor_doc, '') || '|'
    || left(afd_texto(v_sis.desenvolvedor_nome), 150) || '|' || coalesce(v_sis.desenvolvedor_email, ''));
  v_q[8] := 1;
  v_linhas := v_linhas || ('99|' || array_to_string(v_q, '|'));
  v_linhas := v_linhas || rpad('ASSINATURA_DIGITAL_EM_ARQUIVO_P7S', 100, ' ');
  return array_to_string(v_linhas, E'\r\n') || E'\r\n';
end;
$$;
comment on function public.gerar_aej(uuid, date, date) is
  'AEJ (Portaria 671, Anexo VI) de uma unidade e período (até 3 meses). Administrador e RH.';

-- ---------------------------------------------------------------------------
-- 8. Permissões
-- ---------------------------------------------------------------------------
revoke execute on function public.afd_texto(text)              from public, anon;
revoke execute on function public.afd_a(text, int)             from public, anon;
revoke execute on function public.afd_n(text, int)             from public, anon;
revoke execute on function public.afd_dh(timestamptz, text)    from public, anon;
revoke execute on function public.afd_crc16(text)              from public, anon;
revoke execute on function public.aej_hhmm(time)               from public, anon;
revoke execute on function public.gerar_afd(uuid, date, date)  from public, anon;
revoke execute on function public.gerar_aej(uuid, date, date)  from public, anon;
grant  execute on function public.gerar_afd(uuid, date, date)  to authenticated;
grant  execute on function public.gerar_aej(uuid, date, date)  to authenticated;

notify pgrst, 'reload schema';
