-- ============================================================================
-- Ayra Ponto — DESFAZER a Fase 1 (use só em emergência)
--
-- Volta as regras do banco para como estavam depois da Fase 0.
-- As colunas novas de empresas e unidades são MANTIDAS, com os dados que
-- já tiverem sido preenchidos: nada é apagado. Elas só deixam de ser
-- validadas.
-- ============================================================================

begin;

drop trigger if exists normalizar_empresa on public.empresas;
drop trigger if exists normalizar_filial  on public.filiais;
drop trigger if exists proteger_unidades  on public.filiais;
drop function if exists public.normalizar_empresa();
drop function if exists public.normalizar_filial();
drop function if exists public.proteger_unidades();

alter table public.empresas drop constraint if exists empresas_cnpj_valido;
alter table public.empresas drop constraint if exists empresas_uf_valida;
alter table public.filiais  drop constraint if exists filiais_cnpj_valido;
alter table public.filiais  drop constraint if exists filiais_uf_valida;
alter table public.filiais  drop constraint if exists filiais_tipo_identificador_valido;

-- entrar_por_codigo como na Fase 0 (unidade mais antiga, ativa ou não)
create or replace function public.entrar_por_codigo(p_codigo text)
returns empresas
language plpgsql security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_perfil  perfis;
  v_empresa empresas;
  v_filial  uuid;
begin
  if v_uid is null then
    raise exception 'É preciso estar logado para usar um convite.';
  end if;
  select * into v_perfil from perfis where id = v_uid for update;
  if v_perfil.id is null then
    raise exception 'Não encontramos o seu cadastro. Saia e entre novamente.';
  end if;
  if v_perfil.empresa_id is not null then
    raise exception 'Sua conta já está vinculada a uma empresa.';
  end if;
  select * into v_empresa from empresas
   where lower(codigo_convite) = lower(trim(coalesce(p_codigo, '')));
  if v_empresa.id is null then
    raise exception 'Código de convite inválido';
  end if;
  select id into v_filial from filiais
   where empresa_id = v_empresa.id order by criado_em, id limit 1;
  update perfis
     set empresa_id = v_empresa.id, filial_id = v_filial, tipo = 'funcionario', status = 'ativo'
   where id = v_uid;
  return v_empresa;
end;
$$;

-- proteger_perfis como na Fase 0 (sem exigir unidade ativa)
create or replace function public.proteger_perfis()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_uid  uuid := auth.uid();
  v_tipo tipo_perfil;
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  if new.id is distinct from old.id then
    raise exception 'O identificador do cadastro não pode ser alterado.';
  end if;
  if new.empresa_id is distinct from old.empresa_id then
    raise exception 'A empresa de um usuário não pode ser alterada.';
  end if;
  v_tipo := tipo_do_usuario();
  if old.id = v_uid then
    if v_tipo = 'administrador' then
      if new.tipo is distinct from old.tipo or new.status is distinct from old.status then
        raise exception 'Você não pode alterar o seu próprio papel ou situação.';
      end if;
    elsif new.tipo is distinct from old.tipo or new.status is distinct from old.status
       or new.filial_id is distinct from old.filial_id or new.cpf is distinct from old.cpf
       or new.cargo is distinct from old.cargo or new.categoria is distinct from old.categoria
       or new.data_admissao is distinct from old.data_admissao then
      raise exception 'Esses dados só podem ser alterados pelo RH ou pelo administrador.';
    end if;
  else
    if v_tipo = 'rh' then
      if old.tipo = 'administrador' then
        raise exception 'O RH não pode alterar o cadastro de um administrador.';
      end if;
      if new.tipo is distinct from old.tipo then
        raise exception 'Somente o administrador pode alterar o papel de um usuário.';
      end if;
    elsif v_tipo is distinct from 'administrador' then
      raise exception 'Você não tem permissão para alterar este cadastro.';
    end if;
  end if;
  if new.filial_id is distinct from old.filial_id and new.filial_id is not null then
    if not exists (select 1 from filiais f where f.id = new.filial_id and f.empresa_id = new.empresa_id) then
      raise exception 'A unidade escolhida não pertence a esta empresa.';
    end if;
  end if;
  return new;
end;
$$;

commit;
