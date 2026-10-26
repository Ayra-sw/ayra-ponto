-- ============================================================================
-- DESFAZER da Fase 8B: tira o acesso de suporte.
-- Não apaga autorizações, sessões nem o histórico (ficam guardados).
-- Depois de rodar, o suporte perde o acesso na hora e a gestão volta ao normal.
-- Para aplicar de novo, rode a migração 2026-10-26_fase-8b_suporte-autorizado.sql.
-- ============================================================================

begin;

drop trigger if exists proteger_perfis_suporte on public.perfis;
drop trigger if exists bloquear_suporte on public.registros_ponto;
drop trigger if exists bloquear_suporte on public.ajustes_ponto;
drop trigger if exists bloquear_suporte on public.fechamentos;
drop trigger if exists bloquear_suporte on public.fechamento_espelhos;
drop trigger if exists bloquear_suporte on public.espelho_conferencias;
drop trigger if exists bloquear_suporte on public.banco_horas_lancamentos;
drop trigger if exists bloquear_suporte on public.afastamentos;
drop trigger if exists bloquear_suporte on public.rostos_referencia;
drop trigger if exists bloquear_suporte on public.verificacoes_faciais;
drop trigger if exists bloquear_suporte on public.consentimentos_biometria;

-- volta as versões de antes da 8B (empresa_do_usuario da Fase 0)
create or replace function public.empresa_do_usuario()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select empresa_id from perfis where id = auth.uid();
$$;

-- tipo_do_usuario, como estava na 8A
create or replace function public.tipo_do_usuario()
returns tipo_perfil
language sql
stable
security definer
set search_path = public
as $$
  select case when p.tipo in ('administrador', 'rh') and e.situacao = 'suspensa' then 'funcionario'::tipo_perfil
              else p.tipo end
    from perfis p
    left join empresas e on e.id = p.empresa_id
   where p.id = auth.uid();
$$;

-- registrar_historico, como estava na 5A
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

drop function if exists public.bloquear_em_suporte();
drop function if exists public.proteger_perfis_em_suporte();
drop function if exists public.suporte_liberar(integer);
drop function if exists public.suporte_encerrar();
drop function if exists public.suporte_da_empresa();
drop function if exists public.central_suporte(uuid);
drop function if exists public.suporte_entrar(uuid);
drop function if exists public.suporte_sair();
drop function if exists public.suporte_sessao_atual();
drop function if exists public.em_suporte();
drop function if exists public.empresa_em_suporte();

commit;

notify pgrst, 'reload schema';

-- Pronto. Para a 8B voltar a funcionar, rode de novo a migração 8B.
