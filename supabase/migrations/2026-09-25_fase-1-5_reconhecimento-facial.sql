-- ============================================================================
-- Ayra Ponto — Fase 1.5: ponto com reconhecimento facial + corrente de
-- integridade das marcações
-- Data: 25/09/2026 · Requer as Fases 0 e 1 aplicadas.
--
-- O que este script faz (detalhes em docs/fase-1-5-LEIA-ME.md):
--   1. Empresa: interruptor "reconhecimento facial" (começa desligado).
--   2. Corrente de integridade (M2): cada marcação nova guarda o código da
--      marcação anterior da mesma unidade e o código da selfie. Apagar ou
--      trocar qualquer marcação quebra a corrente dali para frente.
--   3. Aviso de privacidade (LGPD): registro de quem aceitou e quando.
--   4. Foto de cadastro do rosto: enviada pelo colaborador, aprovada pelo
--      RH ou administrador.
--   5. Verificação facial de cada marcação: resultado guardado ao lado da
--      marcação (a marcação continua intocável). Rosto não reconhecido,
--      sem foto ou sem cadastro: o ponto é registrado mesmo assim e fica
--      "a conferir" pelo RH. O reconhecimento NUNCA impede a marcação
--      (Portaria 671).
--   6. Armazenamento privado "rostos" para as fotos, separado por empresa.
--
-- O que este script NÃO faz: não apaga linhas, não recria tabelas, não muda
-- nomes de tabelas ou colunas, não altera marcações já gravadas.
-- Pode ser executado mais de uma vez.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 0. Conferência: as Fases 0 e 1 precisam estar aplicadas
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'proteger_perfis')
     or not exists (select 1 from pg_trigger where tgname = 'proteger_unidades')
     or to_regprocedure('public.cnpj_valido(text)') is null then
    raise exception 'As Fases 0 e 1 não foram encontradas neste banco. Nada foi alterado. Rode as fases anteriores primeiro.';
  end if;
  if to_regclass('storage.objects') is null or to_regclass('storage.buckets') is null then
    raise exception 'O armazenamento (Storage) do Supabase não foi encontrado. Nada foi alterado. Fale com o Claude.';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 1. Empresa: reconhecimento facial ligado ou desligado
-- ---------------------------------------------------------------------------
alter table public.empresas
  add column if not exists reconhecimento_facial boolean not null default false;

-- ---------------------------------------------------------------------------
-- 2. Corrente de integridade das marcações (M2)
--    versao_hash 1 = marcações antigas (código calculado do jeito anterior)
--    versao_hash 2 = marcações novas, encadeadas
-- ---------------------------------------------------------------------------
alter table public.registros_ponto
  add column if not exists hash_anterior  text,
  add column if not exists hash_evidencia text,
  add column if not exists versao_hash    smallint not null default 1;

-- Texto que entra no código de integridade (versão 2). Sempre em UTC e com
-- os campos em ordem fixa, para que qualquer pessoa consiga recalcular.
create or replace function public.texto_hash_marcacao(
  p_filial_id uuid, p_nsr bigint, p_perfil_id uuid, p_tipo tipo_marcacao,
  p_marcado_em timestamptz, p_origem origem_marcacao, p_latitude numeric, p_longitude numeric,
  p_hash_evidencia text, p_hash_anterior text)
returns text
language sql immutable
set search_path = public
as $$
  select 'ayra-v2'
    || '|' || p_filial_id::text
    || '|' || p_nsr::text
    || '|' || p_perfil_id::text
    || '|' || p_tipo::text
    || '|' || to_char(p_marcado_em at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
    || '|' || p_origem::text
    || '|' || coalesce(p_latitude::text, '')
    || '|' || coalesce(p_longitude::text, '')
    || '|' || coalesce(p_hash_evidencia, '')
    || '|' || coalesce(p_hash_anterior, '');
$$;

-- Registra a marcação (uso interno: só as funções abaixo chamam esta).
-- Mesmas regras da Fase 0: sempre a pessoa logada, na unidade do cadastro;
-- só "desligado" é recusado; nunca restringe horário ou tipo.
create or replace function public.registrar_marcacao_interna(
  p_tipo           tipo_marcacao,
  p_origem         origem_marcacao,
  p_latitude       numeric,
  p_longitude      numeric,
  p_hash_evidencia text)
returns registros_ponto
language plpgsql security definer
set search_path = public, extensions
as $$
declare
  v_uid       uuid := auth.uid();
  v_perfil    perfis;
  v_nsr       bigint;
  v_agora     timestamptz := now();
  v_anterior  text;
  v_hash      text;
  v_origem    origem_marcacao := coalesce(p_origem, 'web');
  v_registro  registros_ponto;
begin
  if v_uid is null then
    raise exception 'É preciso estar logado para registrar o ponto.';
  end if;
  if p_tipo is null then
    raise exception 'Informe o tipo da marcação.';
  end if;

  select * into v_perfil from perfis where id = v_uid;
  if v_perfil.id is null or v_perfil.empresa_id is null then
    raise exception 'Sua conta ainda não está vinculada a uma empresa.';
  end if;
  if v_perfil.status = 'desligado' then
    raise exception 'Seu cadastro está como desligado. Fale com o RH da sua empresa.';
  end if;
  if v_perfil.filial_id is null then
    raise exception 'Sua conta ainda não está vinculada a uma unidade. Fale com o RH da sua empresa.';
  end if;

  -- trava a linha da unidade: NSR sequencial, sem buracos nem repetição,
  -- e a corrente não se embaralha com duas marcações ao mesmo tempo
  select proximo_nsr into v_nsr
    from filiais
   where id = v_perfil.filial_id
     and empresa_id = v_perfil.empresa_id
     for update;
  if v_nsr is null then
    raise exception 'Unidade não encontrada. Fale com o RH da sua empresa.';
  end if;

  select hash_integridade into v_anterior
    from registros_ponto
   where filial_id = v_perfil.filial_id
   order by nsr desc
   limit 1;

  v_hash := encode(digest(texto_hash_marcacao(
              v_perfil.filial_id, v_nsr, v_uid, p_tipo, v_agora, v_origem,
              p_latitude, p_longitude, p_hash_evidencia, v_anterior), 'sha256'), 'hex');

  insert into registros_ponto
    (nsr, filial_id, perfil_id, tipo, marcado_em, origem, latitude, longitude,
     hash_integridade, hash_anterior, hash_evidencia, versao_hash)
  values
    (v_nsr, v_perfil.filial_id, v_uid, p_tipo, v_agora, v_origem, p_latitude, p_longitude,
     v_hash, v_anterior, p_hash_evidencia, 2)
  returning * into v_registro;

  update filiais set proximo_nsr = v_nsr + 1 where id = v_perfil.filial_id;

  return v_registro;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Aviso de privacidade da biometria (LGPD)
-- ---------------------------------------------------------------------------
create table if not exists public.consentimentos_biometria (
  id           uuid primary key default gen_random_uuid(),
  perfil_id    uuid not null references public.perfis(id) on delete cascade,
  empresa_id   uuid not null references public.empresas(id) on delete cascade,
  versao_aviso text not null,
  aceito_em    timestamptz not null default now(),
  revogado_em  timestamptz
);
create index if not exists consentimentos_biometria_perfil_idx on public.consentimentos_biometria (perfil_id);

-- ---------------------------------------------------------------------------
-- 4. Foto de cadastro do rosto (referência para comparação)
-- ---------------------------------------------------------------------------
create table if not exists public.rostos_referencia (
  id            uuid primary key default gen_random_uuid(),
  perfil_id     uuid not null references public.perfis(id) on delete cascade,
  empresa_id    uuid not null references public.empresas(id) on delete cascade,
  foto_path     text not null,
  descritor     real[] not null,
  modelo        text not null,
  qualidade     numeric(6,4),
  status        text not null default 'pendente',
  motivo_recusa text,
  enviada_em    timestamptz not null default now(),
  analisada_por uuid references public.perfis(id),
  analisada_em  timestamptz,
  constraint rostos_referencia_status_valido
    check (status in ('pendente', 'aprovada', 'recusada', 'substituida')),
  constraint rostos_referencia_descritor_valido
    check (cardinality(descritor) between 64 and 2048)
);
create index if not exists rostos_referencia_perfil_idx  on public.rostos_referencia (perfil_id);
create index if not exists rostos_referencia_empresa_idx on public.rostos_referencia (empresa_id, status);
-- no máximo uma foto aprovada e uma aguardando aprovação por pessoa
create unique index if not exists rostos_referencia_uma_aprovada
  on public.rostos_referencia (perfil_id) where status = 'aprovada';
create unique index if not exists rostos_referencia_uma_pendente
  on public.rostos_referencia (perfil_id) where status = 'pendente';

-- ---------------------------------------------------------------------------
-- 5. Verificação facial de cada marcação
-- ---------------------------------------------------------------------------
create table if not exists public.verificacoes_faciais (
  id              uuid primary key default gen_random_uuid(),
  registro_id     uuid not null unique references public.registros_ponto(id),
  perfil_id       uuid not null references public.perfis(id),
  empresa_id      uuid not null references public.empresas(id),
  resultado       text not null,
  motivo_sem_foto text,
  foto_path       text,
  foto_sha256     text,
  referencia_id   uuid references public.rostos_referencia(id),
  similaridade    numeric(6,4),
  limiar          numeric(6,4),
  antispoof       numeric(6,4),
  vivacidade      numeric(6,4),
  piscou          boolean,
  motor           text,
  conferencia     text not null default 'nao_precisa',
  conferida_por   uuid references public.perfis(id),
  conferida_em    timestamptz,
  observacao      text,
  criado_em       timestamptz not null default now(),
  constraint verificacoes_faciais_resultado_valido
    check (resultado in ('reconhecido', 'nao_reconhecido', 'sem_referencia', 'sem_foto')),
  constraint verificacoes_faciais_conferencia_valida
    check (conferencia in ('nao_precisa', 'pendente', 'confirmada', 'contestada'))
);
create index if not exists verificacoes_faciais_empresa_idx on public.verificacoes_faciais (empresa_id, conferencia);
create index if not exists verificacoes_faciais_perfil_idx  on public.verificacoes_faciais (perfil_id);

-- ---------------------------------------------------------------------------
-- 6. Armazenamento privado das fotos
--    Caminho: <empresa>/<pessoa>/cadastro/<arquivo>.jpg
--             <empresa>/<pessoa>/marcacoes/<arquivo>.jpg
--    Ninguém altera nem apaga uma foto pelo app (é prova da marcação).
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('rostos', 'rostos', false, 1048576, array['image/jpeg'])
on conflict (id) do update
   set public = false,
       file_size_limit = excluded.file_size_limit,
       allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "rostos: enviar a própria foto" on storage.objects;
create policy "rostos: enviar a própria foto" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'rostos'
              and (storage.foldername(name))[1] = (select public.empresa_do_usuario())::text
              and (storage.foldername(name))[2] = (select auth.uid())::text
              and (storage.foldername(name))[3] in ('cadastro', 'marcacoes'));

drop policy if exists "rostos: ver as próprias fotos" on storage.objects;
create policy "rostos: ver as próprias fotos" on storage.objects
  for select to authenticated
  using (bucket_id = 'rostos'
         and (storage.foldername(name))[1] = (select public.empresa_do_usuario())::text
         and (storage.foldername(name))[2] = (select auth.uid())::text);

drop policy if exists "rostos: admin/rh veem as fotos da empresa" on storage.objects;
create policy "rostos: admin/rh veem as fotos da empresa" on storage.objects
  for select to authenticated
  using (bucket_id = 'rostos'
         and (storage.foldername(name))[1] = (select public.empresa_do_usuario())::text
         and (select public.tipo_do_usuario()) in ('administrador', 'rh'));

-- as funções do sistema (dono: postgres) precisam enxergar as fotos para
-- conferir se a selfie existe
drop policy if exists "rostos: leitura pelas funções do sistema" on storage.objects;
create policy "rostos: leitura pelas funções do sistema" on storage.objects
  for select to postgres
  using (bucket_id = 'rostos');

-- a foto informada existe e está na pasta da própria pessoa?
create or replace function public.foto_rosto_valida(p_path text, p_pasta text)
returns boolean
language plpgsql stable security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if p_path is null or v_uid is null then
    return false;
  end if;
  if p_path !~ ('^' || empresa_do_usuario()::text || '/' || v_uid::text || '/' || p_pasta || '/[A-Za-z0-9_-]+\.jpg$') then
    return false;
  end if;
  return exists (select 1 from storage.objects o where o.bucket_id = 'rostos' and o.name = p_path);
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. Funções usadas pelo app
-- ---------------------------------------------------------------------------

-- 7.1 Registrar ponto (tela antiga / sem câmera) — mesma assinatura de antes.
--     Se a empresa usa reconhecimento facial, a marcação fica "a conferir".
create or replace function public.registrar_ponto(
  p_filial_id uuid,
  p_perfil_id uuid,
  p_tipo      tipo_marcacao,
  p_origem    origem_marcacao default 'web'::origem_marcacao,
  p_latitude  numeric default null::numeric,
  p_longitude numeric default null::numeric)
returns registros_ponto
language plpgsql security definer
set search_path = public, extensions
as $$
declare
  v_uid      uuid := auth.uid();
  v_perfil   perfis;
  v_registro registros_ponto;
begin
  if v_uid is null then
    raise exception 'É preciso estar logado para registrar o ponto.';
  end if;
  if p_perfil_id is not null and p_perfil_id <> v_uid then
    raise exception 'Só é possível registrar o ponto da sua própria conta.';
  end if;
  select * into v_perfil from perfis where id = v_uid;
  if p_filial_id is not null and p_filial_id is distinct from v_perfil.filial_id then
    raise exception 'A unidade informada não é a do seu cadastro. Atualize a página e tente de novo.';
  end if;

  v_registro := registrar_marcacao_interna(p_tipo, p_origem, p_latitude, p_longitude, null);

  if exists (select 1 from empresas e where e.id = v_perfil.empresa_id and e.reconhecimento_facial) then
    insert into verificacoes_faciais (registro_id, perfil_id, empresa_id, resultado, motivo_sem_foto, conferencia)
    values (v_registro.id, v_uid, v_perfil.empresa_id, 'sem_foto', 'app_sem_camera', 'pendente');
  end if;

  return v_registro;
end;
$$;

-- 7.2 Registrar ponto com a selfie e o resultado da comparação feita no
--     aparelho. Problemas com a foto nunca impedem a marcação: viram
--     "sem foto" ou "não reconhecido" e o RH confere.
create or replace function public.registrar_ponto_facial(
  p_tipo            tipo_marcacao,
  p_origem          origem_marcacao default 'web'::origem_marcacao,
  p_latitude        numeric default null,
  p_longitude       numeric default null,
  p_foto_path       text default null,
  p_foto_sha256     text default null,
  p_referencia_id   uuid default null,
  p_similaridade    numeric default null,
  p_antispoof       numeric default null,
  p_vivacidade      numeric default null,
  p_piscou          boolean default null,
  p_motor           text default null,
  p_motivo_sem_foto text default null)
returns jsonb
language plpgsql security definer
set search_path = public, extensions
as $$
declare
  c_limiar     constant numeric := 0.50;
  v_uid        uuid := auth.uid();
  v_perfil     perfis;
  v_foto       text;
  v_sha        text;
  v_motivo     text;
  v_ref        uuid;
  v_sim        numeric;
  v_resultado  text;
  v_registro   registros_ponto;
  v_verif      verificacoes_faciais;
begin
  if v_uid is null then
    raise exception 'É preciso estar logado para registrar o ponto.';
  end if;
  select * into v_perfil from perfis where id = v_uid;

  -- selfie: só vale se estiver na pasta da própria pessoa e existir
  if p_foto_path is not null and foto_rosto_valida(p_foto_path, 'marcacoes') then
    v_foto := p_foto_path;
    v_sha  := case when lower(p_foto_sha256) ~ '^[0-9a-f]{64}$' then lower(p_foto_sha256) end;
  elsif p_foto_path is not null then
    v_motivo := 'falha_envio';
  else
    v_motivo := case when p_motivo_sem_foto in ('sem_camera', 'permissao_negada', 'aviso_nao_aceito', 'falha_envio', 'rosto_nao_encontrado',
                                             'usuario_optou', 'reconhecimento_indisponivel', 'outro')
                     then p_motivo_sem_foto else 'outro' end;
  end if;

  -- a comparação só conta se foi feita com a foto de cadastro APROVADA
  select id into v_ref from rostos_referencia where perfil_id = v_uid and status = 'aprovada';
  if p_similaridade is not null and p_similaridade between 0 and 1 then
    v_sim := round(p_similaridade, 4);
  end if;

  v_resultado := case
    when v_foto is null then 'sem_foto'
    when v_ref is null or p_referencia_id is distinct from v_ref then 'sem_referencia'
    when v_sim is null or v_sim < c_limiar then 'nao_reconhecido'
    else 'reconhecido'
  end;

  v_registro := registrar_marcacao_interna(p_tipo, p_origem, p_latitude, p_longitude, v_sha);

  insert into verificacoes_faciais
    (registro_id, perfil_id, empresa_id, resultado, motivo_sem_foto, foto_path, foto_sha256,
     referencia_id, similaridade, limiar, antispoof, vivacidade, piscou, motor, conferencia)
  values
    (v_registro.id, v_uid, v_perfil.empresa_id,
     v_resultado, v_motivo, v_foto, v_sha,
     case when v_resultado in ('reconhecido', 'nao_reconhecido') then v_ref end,
     case when v_resultado in ('reconhecido', 'nao_reconhecido') then v_sim end,
     c_limiar,
     case when p_antispoof between 0 and 1 then round(p_antispoof, 4) end,
     case when p_vivacidade between 0 and 1 then round(p_vivacidade, 4) end,
     p_piscou,
     left(p_motor, 60),
     case when v_resultado = 'reconhecido' then 'nao_precisa' else 'pendente' end)
  returning * into v_verif;

  return to_jsonb(v_registro) || jsonb_build_object('verificacao_facial', jsonb_build_object(
    'id', v_verif.id, 'resultado', v_verif.resultado, 'conferencia', v_verif.conferencia,
    'similaridade', v_verif.similaridade, 'motivo_sem_foto', v_verif.motivo_sem_foto));
end;
$$;

-- 7.3 Aceitar o aviso de privacidade da biometria
create or replace function public.aceitar_aviso_biometria(p_versao text)
returns consentimentos_biometria
language plpgsql security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_perfil perfis;
  v_aceite consentimentos_biometria;
begin
  if v_uid is null then
    raise exception 'É preciso estar logado.';
  end if;
  if coalesce(trim(p_versao), '') = '' then
    raise exception 'Versão do aviso não informada.';
  end if;
  select * into v_perfil from perfis where id = v_uid;
  if v_perfil.empresa_id is null then
    raise exception 'Sua conta ainda não está vinculada a uma empresa.';
  end if;

  select * into v_aceite from consentimentos_biometria
   where perfil_id = v_uid and versao_aviso = trim(p_versao) and revogado_em is null
   limit 1;
  if v_aceite.id is null then
    insert into consentimentos_biometria (perfil_id, empresa_id, versao_aviso)
    values (v_uid, v_perfil.empresa_id, trim(p_versao))
    returning * into v_aceite;
  end if;
  return v_aceite;
end;
$$;

-- 7.4 Enviar a foto de cadastro do rosto (fica aguardando aprovação)
create or replace function public.enviar_rosto_referencia(
  p_foto_path text, p_descritor real[], p_modelo text, p_qualidade numeric default null)
returns rostos_referencia
language plpgsql security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_perfil perfis;
  v_ref    rostos_referencia;
begin
  if v_uid is null then
    raise exception 'É preciso estar logado.';
  end if;
  select * into v_perfil from perfis where id = v_uid for update;
  if v_perfil.empresa_id is null then
    raise exception 'Sua conta ainda não está vinculada a uma empresa.';
  end if;
  if not exists (select 1 from consentimentos_biometria c where c.perfil_id = v_uid and c.revogado_em is null) then
    raise exception 'Antes de cadastrar o rosto, leia e aceite o aviso de privacidade.';
  end if;
  if not foto_rosto_valida(p_foto_path, 'cadastro') then
    raise exception 'A foto não foi encontrada. Tire a foto de novo.';
  end if;
  if p_descritor is null or cardinality(p_descritor) not between 64 and 2048 then
    raise exception 'Não conseguimos ler o rosto na foto. Tire a foto de novo, de frente e com boa luz.';
  end if;

  update rostos_referencia set status = 'substituida'
   where perfil_id = v_uid and status = 'pendente';

  insert into rostos_referencia (perfil_id, empresa_id, foto_path, descritor, modelo, qualidade)
  values (v_uid, v_perfil.empresa_id, p_foto_path, p_descritor, left(coalesce(p_modelo, 'desconhecido'), 60),
          case when p_qualidade between 0 and 1 then round(p_qualidade, 4) end)
  returning * into v_ref;
  return v_ref;
end;
$$;

-- 7.5 Aprovar ou recusar a foto de cadastro (administrador ou RH).
--     Ninguém aprova a própria foto, exceto o administrador.
--     O RH não analisa a foto de um administrador.
create or replace function public.analisar_rosto_referencia(p_id uuid, p_aprovar boolean, p_motivo text default null)
returns rostos_referencia
language plpgsql security definer
set search_path = public
as $$
declare
  v_uid  uuid := auth.uid();
  v_tipo tipo_perfil := tipo_do_usuario();
  v_ref  rostos_referencia;
  v_dono perfis;
begin
  if v_uid is null or v_tipo not in ('administrador', 'rh') then
    raise exception 'Somente o administrador ou o RH podem analisar fotos de cadastro.';
  end if;
  select * into v_ref from rostos_referencia where id = p_id for update;
  if v_ref.id is null or v_ref.empresa_id is distinct from empresa_do_usuario() then
    raise exception 'Foto não encontrada.';
  end if;
  if v_ref.status <> 'pendente' then
    raise exception 'Esta foto já foi analisada.';
  end if;
  select * into v_dono from perfis where id = v_ref.perfil_id;
  if v_ref.perfil_id = v_uid and v_tipo <> 'administrador' then
    raise exception 'Você não pode aprovar a sua própria foto. Peça ao administrador.';
  end if;
  if v_tipo = 'rh' and v_dono.tipo = 'administrador' then
    raise exception 'O RH não analisa a foto de um administrador.';
  end if;
  if not coalesce(p_aprovar, false) and coalesce(trim(p_motivo), '') = '' then
    raise exception 'Conte à pessoa por que a foto foi recusada (por exemplo: "foto escura").';
  end if;

  if p_aprovar then
    update rostos_referencia set status = 'substituida'
     where perfil_id = v_ref.perfil_id and status = 'aprovada';
  end if;

  update rostos_referencia
     set status        = case when p_aprovar then 'aprovada' else 'recusada' end,
         motivo_recusa = case when p_aprovar then null else trim(p_motivo) end,
         analisada_por = v_uid,
         analisada_em  = now()
   where id = p_id
  returning * into v_ref;
  return v_ref;
end;
$$;

-- 7.6 Conferir uma marcação "a conferir" (administrador ou RH).
--     confirmar = era mesmo a pessoa; contestar = não era (com observação).
create or replace function public.conferir_verificacao_facial(p_id uuid, p_confirmar boolean, p_observacao text default null)
returns verificacoes_faciais
language plpgsql security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_tipo  tipo_perfil := tipo_do_usuario();
  v_verif verificacoes_faciais;
  v_dono  perfis;
begin
  if v_uid is null or v_tipo not in ('administrador', 'rh') then
    raise exception 'Somente o administrador ou o RH podem conferir marcações.';
  end if;
  select * into v_verif from verificacoes_faciais where id = p_id for update;
  if v_verif.id is null or v_verif.empresa_id is distinct from empresa_do_usuario() then
    raise exception 'Marcação não encontrada.';
  end if;
  if v_verif.conferencia <> 'pendente' then
    raise exception 'Esta marcação já foi conferida.';
  end if;
  select * into v_dono from perfis where id = v_verif.perfil_id;
  if v_verif.perfil_id = v_uid and v_tipo <> 'administrador' then
    raise exception 'Você não pode conferir a sua própria marcação. Peça ao administrador.';
  end if;
  if v_tipo = 'rh' and v_dono.tipo = 'administrador' then
    raise exception 'O RH não confere marcações de um administrador.';
  end if;
  if not coalesce(p_confirmar, false) and coalesce(trim(p_observacao), '') = '' then
    raise exception 'Explique por que a marcação foi contestada.';
  end if;

  update verificacoes_faciais
     set conferencia   = case when p_confirmar then 'confirmada' else 'contestada' end,
         observacao    = nullif(trim(coalesce(p_observacao, '')), ''),
         conferida_por = v_uid,
         conferida_em  = now()
   where id = p_id
  returning * into v_verif;
  return v_verif;
end;
$$;

-- 7.7 Conferir a corrente de integridade de uma unidade.
--     Devolve as marcações com problema (nenhuma linha = tudo certo).
create or replace function public.verificar_cadeia_integridade(p_filial_id uuid)
returns table (nsr bigint, problema text)
language plpgsql stable security definer
set search_path = public, extensions
as $$
declare
  r            registros_ponto;
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

  for r in select * from registros_ponto x where x.filial_id = p_filial_id order by x.nsr loop
    if v_nsr_prev is not null and r.nsr <> v_nsr_prev + 1 then
      nsr := r.nsr; problema := 'Falta a marcação de NSR ' || (v_nsr_prev + 1) || ' (sequência interrompida).'; return next;
    end if;
    if r.versao_hash >= 2 then
      if r.hash_anterior is distinct from v_hash_prev then
        nsr := r.nsr; problema := 'O elo com a marcação anterior não confere.'; return next;
      end if;
      v_calculado := encode(digest(texto_hash_marcacao(r.filial_id, r.nsr, r.perfil_id, r.tipo, r.marcado_em,
                       r.origem, r.latitude, r.longitude, r.hash_evidencia, r.hash_anterior), 'sha256'), 'hex');
      if v_calculado <> r.hash_integridade then
        nsr := r.nsr; problema := 'Os dados desta marcação não batem com o código de integridade.'; return next;
      end if;
    end if;
    v_nsr_prev  := r.nsr;
    v_hash_prev := r.hash_integridade;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- 8. Quem vê o quê (RLS). Ninguém grava direto nestas tabelas: só pelas
--    funções acima.
-- ---------------------------------------------------------------------------
alter table public.consentimentos_biometria enable row level security;
alter table public.rostos_referencia        enable row level security;
alter table public.verificacoes_faciais     enable row level security;

drop policy if exists "consentimentos: ver o próprio" on public.consentimentos_biometria;
create policy "consentimentos: ver o próprio" on public.consentimentos_biometria
  for select to authenticated
  using (perfil_id = (select auth.uid()));

drop policy if exists "consentimentos: admin/rh veem a empresa" on public.consentimentos_biometria;
create policy "consentimentos: admin/rh veem a empresa" on public.consentimentos_biometria
  for select to authenticated
  using (empresa_id = (select empresa_do_usuario())
         and (select tipo_do_usuario()) in ('administrador', 'rh'));

drop policy if exists "rostos: ver o próprio cadastro" on public.rostos_referencia;
create policy "rostos: ver o próprio cadastro" on public.rostos_referencia
  for select to authenticated
  using (perfil_id = (select auth.uid()));

drop policy if exists "rostos: admin/rh veem a empresa" on public.rostos_referencia;
create policy "rostos: admin/rh veem a empresa" on public.rostos_referencia
  for select to authenticated
  using (empresa_id = (select empresa_do_usuario())
         and (select tipo_do_usuario()) in ('administrador', 'rh'));

drop policy if exists "verificações: ver as próprias" on public.verificacoes_faciais;
create policy "verificações: ver as próprias" on public.verificacoes_faciais
  for select to authenticated
  using (perfil_id = (select auth.uid()));

drop policy if exists "verificações: admin/rh veem a empresa" on public.verificacoes_faciais;
create policy "verificações: admin/rh veem a empresa" on public.verificacoes_faciais
  for select to authenticated
  using (empresa_id = (select empresa_do_usuario())
         and (select tipo_do_usuario()) in ('administrador', 'rh'));

-- ---------------------------------------------------------------------------
-- 9. Permissões das funções
-- ---------------------------------------------------------------------------
revoke execute on function public.registrar_marcacao_interna(tipo_marcacao, origem_marcacao, numeric, numeric, text) from public, anon, authenticated;
revoke execute on function public.foto_rosto_valida(text, text) from public, anon, authenticated;
revoke execute on function public.texto_hash_marcacao(uuid, bigint, uuid, tipo_marcacao, timestamptz, origem_marcacao, numeric, numeric, text, text) from public, anon;

revoke execute on function public.registrar_ponto(uuid, uuid, tipo_marcacao, origem_marcacao, numeric, numeric) from public, anon;
revoke execute on function public.registrar_ponto_facial(tipo_marcacao, origem_marcacao, numeric, numeric, text, text, uuid, numeric, numeric, numeric, boolean, text, text) from public, anon;
revoke execute on function public.aceitar_aviso_biometria(text) from public, anon;
revoke execute on function public.enviar_rosto_referencia(text, real[], text, numeric) from public, anon;
revoke execute on function public.analisar_rosto_referencia(uuid, boolean, text) from public, anon;
revoke execute on function public.conferir_verificacao_facial(uuid, boolean, text) from public, anon;
revoke execute on function public.verificar_cadeia_integridade(uuid) from public, anon;

grant execute on function public.texto_hash_marcacao(uuid, bigint, uuid, tipo_marcacao, timestamptz, origem_marcacao, numeric, numeric, text, text) to authenticated;
grant execute on function public.registrar_ponto(uuid, uuid, tipo_marcacao, origem_marcacao, numeric, numeric) to authenticated;
grant execute on function public.registrar_ponto_facial(tipo_marcacao, origem_marcacao, numeric, numeric, text, text, uuid, numeric, numeric, numeric, boolean, text, text) to authenticated;
grant execute on function public.aceitar_aviso_biometria(text) to authenticated;
grant execute on function public.enviar_rosto_referencia(text, real[], text, numeric) to authenticated;
grant execute on function public.analisar_rosto_referencia(uuid, boolean, text) to authenticated;
grant execute on function public.conferir_verificacao_facial(uuid, boolean, text) to authenticated;
grant execute on function public.verificar_cadeia_integridade(uuid) to authenticated;

commit;

-- Pronto. Rode em seguida supabase/testes/conferencia-fase-1-5.sql.
