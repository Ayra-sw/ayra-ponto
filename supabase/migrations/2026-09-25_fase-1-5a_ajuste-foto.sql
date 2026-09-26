-- ============================================================================
-- Ayra Ponto — Ajuste da Fase 1.5 (1.5a): motivos de "sem foto" mais claros
-- Data: 25/09/2026 · Requer a Fase 1.5 aplicada.
--
-- Só substitui a função registrar_ponto_facial, com dois motivos novos para
-- marcação sem foto:
--   usuario_optou               a pessoa tocou em "Registrar sem foto"
--   reconhecimento_indisponivel o reconhecimento não carregou no aparelho
-- Nada mais muda. Não apaga nem altera dados. Pode ser executado mais de uma vez.
-- ============================================================================

begin;

do $$
begin
  if to_regprocedure('public.registrar_ponto_facial(tipo_marcacao, origem_marcacao, numeric, numeric, text, text, uuid, numeric, numeric, numeric, boolean, text, text)') is null then
    raise exception 'A Fase 1.5 não foi encontrada neste banco. Nada foi alterado.';
  end if;
end $$;

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

revoke execute on function public.registrar_ponto_facial(tipo_marcacao, origem_marcacao, numeric, numeric, text, text, uuid, numeric, numeric, numeric, boolean, text, text) from public, anon;
grant  execute on function public.registrar_ponto_facial(tipo_marcacao, origem_marcacao, numeric, numeric, text, text, uuid, numeric, numeric, numeric, boolean, text, text) to authenticated;

commit;

-- Pronto. Deve aparecer "Success. No rows returned".
