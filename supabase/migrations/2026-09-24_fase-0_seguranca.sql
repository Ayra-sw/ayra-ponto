-- ============================================================================
-- Ayra Ponto — Fase 0: correções de segurança e de funcionamento
-- Data: 24/09/2026
--
-- O que este script faz (detalhes em docs/fase-0-LEIA-ME.md):
--   C1  Ninguém escolhe o próprio papel. Convite sempre entra como colaborador.
--       O próprio usuário não altera papel, empresa, unidade nem situação.
--   C2  registrar_ponto só registra para a pessoa logada, na unidade dela.
--   C3  Quem entra por convite já fica ligado à unidade principal.
--   A1  Colaborador deixa de ver CPF e dados dos colegas.
--   A3  O NSR da unidade não pode ser editado à mão.
--   A5  Só o administrador muda papéis. Ninguém analisa a própria solicitação.
--   A6  Criar empresa e usar convite exigem login e conta sem empresa.
--   M1  Funções com search_path fixo.
--   M3  Índices para as consultas mais comuns.
--
-- O que este script NÃO faz:
--   - Não apaga nenhuma linha e não recria nenhuma tabela.
--   - Não muda nomes de tabelas, colunas ou tipos.
--   - Única alteração de dados: preenche filial_id de quem tem empresa mas
--     está sem unidade (hoje, provavelmente ninguém).
--
-- Pode ser executado mais de uma vez sem problema.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 0. Conferência: o banco precisa estar na estrutura esperada
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regprocedure('public.registrar_ponto(uuid, uuid, tipo_marcacao, origem_marcacao, numeric, numeric)') is null
     or to_regprocedure('public.criar_empresa(text, text)') is null
     or to_regprocedure('public.entrar_por_codigo(text)') is null
     or to_regprocedure('public.empresa_do_usuario()') is null
     or to_regprocedure('public.tipo_do_usuario()') is null
     or to_regclass('public.filiais') is null
     or to_regclass('public.ajustes_ponto') is null then
    raise exception 'A estrutura do banco é diferente da esperada. Nada foi alterado. Fale com o Claude antes de continuar.';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 1. Funções auxiliares com search_path fixo (M1)
-- ---------------------------------------------------------------------------
create or replace function public.empresa_do_usuario()
returns uuid
language sql stable security definer
set search_path = public
as $$
  select empresa_id from perfis where id = auth.uid();
$$;

create or replace function public.tipo_do_usuario()
returns tipo_perfil
language sql stable security definer
set search_path = public
as $$
  select tipo from perfis where id = auth.uid();
$$;

-- ---------------------------------------------------------------------------
-- 2. Cadastro: o papel nunca vem do formulário (C1)
--    Todo cadastro nasce como colaborador ('funcionario' no banco).
--    Vira administrador só ao criar a própria empresa (criar_empresa).
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  insert into public.perfis (id, nome_completo, cpf, tipo)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data->>'nome_completo'), ''), ''),
    nullif(trim(new.raw_user_meta_data->>'cpf'), ''),
    'funcionario'
  );
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Criar empresa (A6)
-- ---------------------------------------------------------------------------
create or replace function public.criar_empresa(p_nome text, p_cnpj text default null)
returns empresas
language plpgsql security definer
set search_path = public
as $$
declare
  v_uid       uuid := auth.uid();
  v_perfil    perfis;
  v_empresa   empresas;
  v_filial_id uuid;
begin
  if v_uid is null then
    raise exception 'É preciso estar logado para cadastrar uma empresa.';
  end if;

  select * into v_perfil from perfis where id = v_uid for update;
  if v_perfil.id is null then
    raise exception 'Não encontramos o seu cadastro. Saia e entre novamente.';
  end if;
  if v_perfil.empresa_id is not null then
    raise exception 'Sua conta já está vinculada a uma empresa.';
  end if;
  if coalesce(trim(p_nome), '') = '' then
    raise exception 'Informe o nome da empresa.';
  end if;

  insert into empresas (nome, cnpj)
  values (trim(p_nome), nullif(trim(p_cnpj), ''))
  returning * into v_empresa;

  insert into filiais (empresa_id, nome)
  values (v_empresa.id, 'Matriz')
  returning id into v_filial_id;

  update perfis
     set empresa_id = v_empresa.id,
         filial_id  = v_filial_id,
         tipo       = 'administrador'
   where id = v_uid;

  return v_empresa;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Entrar por convite (C1, C3, A6)
--    Sempre como colaborador, na unidade principal da empresa do convite.
-- ---------------------------------------------------------------------------
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

  select * into v_empresa
    from empresas
   where lower(codigo_convite) = lower(trim(coalesce(p_codigo, '')));
  if v_empresa.id is null then
    raise exception 'Código de convite inválido';
  end if;

  select id into v_filial
    from filiais
   where empresa_id = v_empresa.id
   order by criado_em, id
   limit 1;

  update perfis
     set empresa_id = v_empresa.id,
         filial_id  = v_filial,
         tipo       = 'funcionario',
         status     = 'ativo'
   where id = v_uid;

  return v_empresa;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Registrar ponto (C2)
--    Mesma assinatura de antes, para a tela atual continuar funcionando.
--    Quem marca é sempre a pessoa logada, na unidade do próprio cadastro.
--    Só quem está "desligado" é recusado; a marcação nunca é restringida
--    por horário ou tipo (Portaria 671).
-- ---------------------------------------------------------------------------
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

  -- trava a linha da unidade: NSR sequencial, sem buracos nem repetição
  select proximo_nsr into v_nsr
    from filiais
   where id = v_perfil.filial_id
     and empresa_id = v_perfil.empresa_id
     for update;
  if v_nsr is null then
    raise exception 'Unidade não encontrada. Fale com o RH da sua empresa.';
  end if;

  v_hash := encode(digest(
              v_perfil.filial_id::text || v_uid::text || p_tipo::text || v_agora::text || v_nsr::text,
              'sha256'), 'hex');

  insert into registros_ponto
    (nsr, filial_id, perfil_id, tipo, marcado_em, origem, latitude, longitude, hash_integridade)
  values
    (v_nsr, v_perfil.filial_id, v_uid, p_tipo, v_agora, p_origem, p_latitude, p_longitude, v_hash)
  returning * into v_registro;

  update filiais set proximo_nsr = v_nsr + 1 where id = v_perfil.filial_id;

  return v_registro;
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Proteção dos perfis (C1, A5)
--    Roda em toda alteração feita pelo app (usuários logados).
--    Alterações feitas pelas funções do sistema (criar_empresa,
--    entrar_por_codigo) não passam por estas regras.
-- ---------------------------------------------------------------------------
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
    -- o próprio cadastro
    if v_tipo = 'administrador' then
      if new.tipo is distinct from old.tipo or new.status is distinct from old.status then
        raise exception 'Você não pode alterar o seu próprio papel ou situação.';
      end if;
    elsif new.tipo          is distinct from old.tipo
       or new.status        is distinct from old.status
       or new.filial_id     is distinct from old.filial_id
       or new.cpf           is distinct from old.cpf
       or new.cargo         is distinct from old.cargo
       or new.categoria     is distinct from old.categoria
       or new.data_admissao is distinct from old.data_admissao then
      raise exception 'Esses dados só podem ser alterados pelo RH ou pelo administrador.';
    end if;
  else
    -- cadastro de outra pessoa (a política RLS já garante: mesma empresa, admin ou RH)
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

drop trigger if exists proteger_perfis on public.perfis;
create trigger proteger_perfis
  before update on public.perfis
  for each row execute function public.proteger_perfis();

-- ---------------------------------------------------------------------------
-- 7. Proteção do NSR das unidades (A3)
-- ---------------------------------------------------------------------------
create or replace function public.proteger_nsr_filial()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.proximo_nsr := 1;
  else
    if new.proximo_nsr is distinct from old.proximo_nsr then
      raise exception 'O número sequencial (NSR) da unidade não pode ser alterado manualmente.';
    end if;
    if new.empresa_id is distinct from old.empresa_id then
      raise exception 'Uma unidade não pode ser transferida para outra empresa.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists proteger_nsr_filial on public.filiais;
create trigger proteger_nsr_filial
  before insert or update on public.filiais
  for each row execute function public.proteger_nsr_filial();

-- ---------------------------------------------------------------------------
-- 8. Proteção das solicitações (A5)
--    Na criação: sempre "pendente". Na análise: só muda a situação, e
--    quem analisou e quando são preenchidos pelo próprio banco.
-- ---------------------------------------------------------------------------
create or replace function public.proteger_ajustes()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.status        := 'pendente';
    new.analisado_por := null;
    new.analisado_em  := null;
    new.criado_em     := now();
    if new.registro_original_id is not null and not exists (
         select 1 from registros_ponto r
          where r.id = new.registro_original_id and r.perfil_id = new.perfil_id) then
      raise exception 'A marcação informada não pertence a este colaborador.';
    end if;
  else
    if old.status <> 'pendente' then
      raise exception 'Esta solicitação já foi analisada.';
    end if;
    if (new.perfil_id, new.tipo, new.marcacao_solicitada, new.motivo, new.registro_original_id, new.criado_em)
       is distinct from
       (old.perfil_id, old.tipo, old.marcacao_solicitada, old.motivo, old.registro_original_id, old.criado_em) then
      raise exception 'Na análise, só a situação da solicitação pode ser alterada.';
    end if;
    new.analisado_por := auth.uid();
    new.analisado_em  := now();
  end if;

  return new;
end;
$$;

drop trigger if exists proteger_ajustes on public.ajustes_ponto;
create trigger proteger_ajustes
  before insert or update on public.ajustes_ponto
  for each row execute function public.proteger_ajustes();

-- ---------------------------------------------------------------------------
-- 9. Políticas de acesso revistas
-- ---------------------------------------------------------------------------

-- perfis (A1): colaborador vê só o próprio cadastro; admin e RH veem a empresa
drop policy if exists "perfis: mesma empresa" on public.perfis;
drop policy if exists "perfis: ver o próprio" on public.perfis;
drop policy if exists "perfis: admin/rh veem a empresa" on public.perfis;

create policy "perfis: ver o próprio" on public.perfis
  for select to authenticated
  using (id = (select auth.uid()));

create policy "perfis: admin/rh veem a empresa" on public.perfis
  for select to authenticated
  using (empresa_id = (select empresa_do_usuario())
         and (select tipo_do_usuario()) in ('administrador', 'rh'));

drop policy if exists "perfis: usuário atualiza o próprio" on public.perfis;
create policy "perfis: usuário atualiza o próprio" on public.perfis
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

drop policy if exists "perfis: admin/rh atualiza da própria empresa" on public.perfis;
create policy "perfis: admin/rh atualiza da própria empresa" on public.perfis
  for update to authenticated
  using (empresa_id = (select empresa_do_usuario())
         and (select tipo_do_usuario()) in ('administrador', 'rh'))
  with check (empresa_id = (select empresa_do_usuario())
              and (select tipo_do_usuario()) in ('administrador', 'rh'));

-- empresas: a edição continua só do administrador, agora com checagem do resultado
drop policy if exists "empresas: admin edita a própria" on public.empresas;
create policy "empresas: admin edita a própria" on public.empresas
  for update to authenticated
  using (id = (select empresa_do_usuario())
         and (select tipo_do_usuario()) = 'administrador')
  with check (id = (select empresa_do_usuario())
              and (select tipo_do_usuario()) = 'administrador');

-- filiais: todos da empresa veem; só o administrador cria, edita e exclui
-- (antes o RH também podia; não havia tela usando isso)
drop policy if exists "filiais: admin/rh gerencia" on public.filiais;
drop policy if exists "filiais: admin cria" on public.filiais;
drop policy if exists "filiais: admin edita" on public.filiais;
drop policy if exists "filiais: admin exclui" on public.filiais;

create policy "filiais: admin cria" on public.filiais
  for insert to authenticated
  with check (empresa_id = (select empresa_do_usuario())
              and (select tipo_do_usuario()) = 'administrador');

create policy "filiais: admin edita" on public.filiais
  for update to authenticated
  using (empresa_id = (select empresa_do_usuario())
         and (select tipo_do_usuario()) = 'administrador')
  with check (empresa_id = (select empresa_do_usuario())
              and (select tipo_do_usuario()) = 'administrador');

create policy "filiais: admin exclui" on public.filiais
  for delete to authenticated
  using (empresa_id = (select empresa_do_usuario())
         and (select tipo_do_usuario()) = 'administrador');

-- ajustes (A5): admin e RH analisam os da empresa, nunca os próprios
drop policy if exists "ajustes: admin/rh atualiza status" on public.ajustes_ponto;
create policy "ajustes: admin/rh atualiza status" on public.ajustes_ponto
  for update to authenticated
  using (perfil_id <> (select auth.uid())
         and perfil_id in (select p.id from perfis p where p.empresa_id = (select empresa_do_usuario()))
         and (select tipo_do_usuario()) in ('administrador', 'rh'))
  with check (perfil_id <> (select auth.uid())
              and perfil_id in (select p.id from perfis p where p.empresa_id = (select empresa_do_usuario()))
              and (select tipo_do_usuario()) in ('administrador', 'rh'));

-- ---------------------------------------------------------------------------
-- 10. Quem pode executar cada função (C2, A6)
--     Visitantes sem login não executam mais nada.
-- ---------------------------------------------------------------------------
revoke execute on function public.registrar_ponto(uuid, uuid, tipo_marcacao, origem_marcacao, numeric, numeric) from public, anon;
revoke execute on function public.criar_empresa(text, text) from public, anon;
revoke execute on function public.entrar_por_codigo(text) from public, anon;
grant  execute on function public.registrar_ponto(uuid, uuid, tipo_marcacao, origem_marcacao, numeric, numeric) to authenticated;
grant  execute on function public.criar_empresa(text, text) to authenticated;
grant  execute on function public.entrar_por_codigo(text) to authenticated;

revoke execute on function public.handle_new_user()     from public, anon, authenticated;
revoke execute on function public.proteger_perfis()     from public, anon, authenticated;
revoke execute on function public.proteger_nsr_filial() from public, anon, authenticated;
revoke execute on function public.proteger_ajustes()    from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 11. Índices (M3)
-- ---------------------------------------------------------------------------
create index if not exists perfis_empresa_id_idx            on public.perfis (empresa_id);
create index if not exists perfis_filial_id_idx             on public.perfis (filial_id);
create index if not exists filiais_empresa_id_idx           on public.filiais (empresa_id);
create index if not exists registros_ponto_perfil_data_idx  on public.registros_ponto (perfil_id, marcado_em);
create index if not exists registros_ponto_filial_data_idx  on public.registros_ponto (filial_id, marcado_em);
create index if not exists ajustes_ponto_perfil_id_idx      on public.ajustes_ponto (perfil_id);
create index if not exists ajustes_ponto_status_idx         on public.ajustes_ponto (status);
create index if not exists ajustes_ponto_registro_idx       on public.ajustes_ponto (registro_original_id);
create index if not exists jornadas_contratuais_perfil_idx  on public.jornadas_contratuais (perfil_id);
create index if not exists comprovantes_registro_idx        on public.comprovantes_marcacao (registro_ponto_id);
create index if not exists arquivos_afd_empresa_idx         on public.arquivos_afd (empresa_id);
create index if not exists arquivos_aej_empresa_idx         on public.arquivos_aej (empresa_id);

-- ---------------------------------------------------------------------------
-- 12. Dados: quem já tem empresa mas está sem unidade vai para a principal (C3)
-- ---------------------------------------------------------------------------
update public.perfis p
   set filial_id = (select f.id from public.filiais f
                     where f.empresa_id = p.empresa_id
                     order by f.criado_em, f.id limit 1)
 where p.empresa_id is not null
   and p.filial_id is null;

commit;

-- Pronto. Rode em seguida a consulta de conferência que está no
-- docs/fase-0-LEIA-ME.md (passo 3).
