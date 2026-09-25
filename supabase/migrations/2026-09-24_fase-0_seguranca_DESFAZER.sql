-- ============================================================================
-- Ayra Ponto — DESFAZER a Fase 0 (use só em emergência)
--
-- Volta funções e regras de acesso para como estavam antes de 24/09/2026.
-- ATENÇÃO: isso reabre as falhas de segurança C1, C2, C3, A1, A3, A5 e A6.
-- Use apenas se a Fase 0 tiver causado um problema que impeça o uso do
-- sistema, e avise o Claude em seguida para corrigirmos com calma.
--
-- Não apaga dados. Os índices criados na Fase 0 são mantidos (não fazem mal).
-- ============================================================================

begin;

drop trigger if exists proteger_perfis     on public.perfis;
drop trigger if exists proteger_nsr_filial on public.filiais;
drop trigger if exists proteger_ajustes    on public.ajustes_ponto;
drop function if exists public.proteger_perfis();
drop function if exists public.proteger_nsr_filial();
drop function if exists public.proteger_ajustes();

create or replace function public.empresa_do_usuario()
returns uuid language sql stable security definer as $$
  select empresa_id from perfis where id = auth.uid();
$$;
alter function public.empresa_do_usuario() reset search_path;

create or replace function public.tipo_do_usuario()
returns tipo_perfil language sql stable security definer as $$
  select tipo from perfis where id = auth.uid();
$$;
alter function public.tipo_do_usuario() reset search_path;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  insert into public.perfis (id, nome_completo, cpf, tipo)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nome_completo', ''),
    new.raw_user_meta_data->>'cpf',
    coalesce((new.raw_user_meta_data->>'tipo')::tipo_perfil, 'funcionario')
  );
  return new;
end;
$$;

create or replace function public.criar_empresa(p_nome text, p_cnpj text default null)
returns empresas language plpgsql security definer as $$
declare
  v_empresa empresas;
  v_filial_id uuid;
begin
  insert into empresas (nome, cnpj) values (p_nome, p_cnpj) returning * into v_empresa;
  insert into filiais (empresa_id, nome) values (v_empresa.id, 'Matriz') returning id into v_filial_id;
  update perfis
  set empresa_id = v_empresa.id, filial_id = v_filial_id, tipo = 'administrador'
  where id = auth.uid();
  return v_empresa;
end;
$$;
alter function public.criar_empresa(text, text) reset search_path;

create or replace function public.entrar_por_codigo(p_codigo text)
returns empresas language plpgsql security definer as $$
declare
  v_empresa empresas;
begin
  select * into v_empresa from empresas where codigo_convite = p_codigo;
  if v_empresa.id is null then
    raise exception 'Código de convite inválido';
  end if;
  update perfis set empresa_id = v_empresa.id where id = auth.uid();
  return v_empresa;
end;
$$;
alter function public.entrar_por_codigo(text) reset search_path;

create or replace function public.registrar_ponto(
  p_filial_id uuid, p_perfil_id uuid, p_tipo tipo_marcacao,
  p_origem origem_marcacao default 'web'::origem_marcacao,
  p_latitude numeric default null::numeric, p_longitude numeric default null::numeric)
returns registros_ponto language plpgsql security definer as $$
declare
  v_nsr bigint;
  v_registro registros_ponto;
  v_hash text;
begin
  select proximo_nsr into v_nsr from filiais where id = p_filial_id for update;
  v_hash := encode(digest(p_filial_id::text || p_perfil_id::text || p_tipo::text || now()::text || v_nsr::text, 'sha256'), 'hex');
  insert into registros_ponto (nsr, filial_id, perfil_id, tipo, origem, latitude, longitude, hash_integridade)
  values (v_nsr, p_filial_id, p_perfil_id, p_tipo, p_origem, p_latitude, p_longitude, v_hash)
  returning * into v_registro;
  update filiais set proximo_nsr = v_nsr + 1 where id = p_filial_id;
  return v_registro;
end;
$$;
alter function public.registrar_ponto(uuid, uuid, tipo_marcacao, origem_marcacao, numeric, numeric) reset search_path;

grant execute on function public.registrar_ponto(uuid, uuid, tipo_marcacao, origem_marcacao, numeric, numeric) to anon, authenticated;
grant execute on function public.criar_empresa(text, text) to anon, authenticated;
grant execute on function public.entrar_por_codigo(text) to anon, authenticated;

drop policy if exists "perfis: ver o próprio" on public.perfis;
drop policy if exists "perfis: admin/rh veem a empresa" on public.perfis;
drop policy if exists "perfis: mesma empresa" on public.perfis;
create policy "perfis: mesma empresa" on public.perfis for select
  using ((empresa_id = empresa_do_usuario()) or (id = auth.uid()));

drop policy if exists "perfis: usuário atualiza o próprio" on public.perfis;
create policy "perfis: usuário atualiza o próprio" on public.perfis for update
  using (id = auth.uid());

drop policy if exists "perfis: admin/rh atualiza da própria empresa" on public.perfis;
create policy "perfis: admin/rh atualiza da própria empresa" on public.perfis for update
  using ((empresa_id = empresa_do_usuario()) and (tipo_do_usuario() = any (array['administrador'::tipo_perfil, 'rh'::tipo_perfil])));

drop policy if exists "empresas: admin edita a própria" on public.empresas;
create policy "empresas: admin edita a própria" on public.empresas for update
  using ((id = empresa_do_usuario()) and (tipo_do_usuario() = 'administrador'::tipo_perfil));

drop policy if exists "filiais: admin cria" on public.filiais;
drop policy if exists "filiais: admin edita" on public.filiais;
drop policy if exists "filiais: admin exclui" on public.filiais;
drop policy if exists "filiais: admin/rh gerencia" on public.filiais;
create policy "filiais: admin/rh gerencia" on public.filiais for all
  using ((empresa_id = empresa_do_usuario()) and (tipo_do_usuario() = any (array['administrador'::tipo_perfil, 'rh'::tipo_perfil])));

drop policy if exists "ajustes: admin/rh atualiza status" on public.ajustes_ponto;
create policy "ajustes: admin/rh atualiza status" on public.ajustes_ponto for update
  using ((perfil_id in (select perfis.id from perfis where perfis.empresa_id = empresa_do_usuario()))
         and (tipo_do_usuario() = any (array['administrador'::tipo_perfil, 'rh'::tipo_perfil])));

commit;
