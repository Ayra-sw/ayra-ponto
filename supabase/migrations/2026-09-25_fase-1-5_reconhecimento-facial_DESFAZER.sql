-- ============================================================================
-- Ayra Ponto — DESFAZER a Fase 1.5 (use só se o Claude pedir)
--
-- Volta o registro de ponto ao funcionamento da Fase 1.
-- ATENÇÃO: apaga as fotos de cadastro aprovadas (a tabela), os aceites do
-- aviso e o resultado das verificações faciais. As MARCAÇÕES de ponto não
-- são apagadas, e as colunas da corrente de integridade continuam nelas.
-- Os arquivos de foto continuam no armazenamento "rostos" (sem acesso pelo
-- app) até serem apagados pelo painel do Supabase.
-- ============================================================================

begin;

drop function if exists public.registrar_ponto_facial(tipo_marcacao, origem_marcacao, numeric, numeric, text, text, uuid, numeric, numeric, numeric, boolean, text, text);
drop function if exists public.aceitar_aviso_biometria(text);
drop function if exists public.enviar_rosto_referencia(text, real[], text, numeric);
drop function if exists public.analisar_rosto_referencia(uuid, boolean, text);
drop function if exists public.conferir_verificacao_facial(uuid, boolean, text);
drop function if exists public.verificar_cadeia_integridade(uuid);
drop function if exists public.foto_rosto_valida(text, text);

drop policy if exists "rostos: enviar a própria foto" on storage.objects;
drop policy if exists "rostos: ver as próprias fotos" on storage.objects;
drop policy if exists "rostos: admin/rh veem as fotos da empresa" on storage.objects;
drop policy if exists "rostos: leitura pelas funções do sistema" on storage.objects;

drop table if exists public.verificacoes_faciais;
drop table if exists public.rostos_referencia;
drop table if exists public.consentimentos_biometria;

-- registrar_ponto volta a ser a da Fase 0 (sem corrente)
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
  v_nsr      bigint;
  v_agora    timestamptz := now();
  v_hash     text;
  v_registro registros_ponto;
begin
  if v_uid is null then
    raise exception 'É preciso estar logado para registrar o ponto.';
  end if;
  if p_perfil_id is not null and p_perfil_id <> v_uid then
    raise exception 'Só é possível registrar o ponto da sua própria conta.';
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
  if p_filial_id is not null and p_filial_id <> v_perfil.filial_id then
    raise exception 'A unidade informada não é a do seu cadastro. Atualize a página e tente de novo.';
  end if;
  select proximo_nsr into v_nsr from filiais
   where id = v_perfil.filial_id and empresa_id = v_perfil.empresa_id for update;
  if v_nsr is null then
    raise exception 'Unidade não encontrada. Fale com o RH da sua empresa.';
  end if;
  v_hash := encode(digest(v_perfil.filial_id::text || v_uid::text || p_tipo::text || v_agora::text || v_nsr::text, 'sha256'), 'hex');
  insert into registros_ponto (nsr, filial_id, perfil_id, tipo, marcado_em, origem, latitude, longitude, hash_integridade)
  values (v_nsr, v_perfil.filial_id, v_uid, p_tipo, v_agora, p_origem, p_latitude, p_longitude, v_hash)
  returning * into v_registro;
  update filiais set proximo_nsr = v_nsr + 1 where id = v_perfil.filial_id;
  return v_registro;
end;
$$;

drop function if exists public.registrar_marcacao_interna(tipo_marcacao, origem_marcacao, numeric, numeric, text);

revoke execute on function public.registrar_ponto(uuid, uuid, tipo_marcacao, origem_marcacao, numeric, numeric) from public, anon;
grant  execute on function public.registrar_ponto(uuid, uuid, tipo_marcacao, origem_marcacao, numeric, numeric) to authenticated;

commit;
