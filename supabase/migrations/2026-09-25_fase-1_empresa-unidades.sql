-- ============================================================================
-- Ayra Ponto — Fase 1: cadastro completo da empresa, CNPJ alfanumérico e
-- unidades
-- Data: 25/09/2026 · Requer a Fase 0 aplicada.
--
-- O que este script faz (detalhes em docs/fase-1-LEIA-ME.md):
--   1. Empresa: novos campos (inscrições, endereço, telefone, e-mail).
--   2. CNPJ: passa a ser guardado sem pontuação e em maiúsculas, e é validado
--      no padrão alfanumérico da Receita Federal (vale também para os CNPJs
--      só com números). O CNPJ já gravado é só padronizado, nunca apagado.
--   3. Unidades (tabela filiais): ativa/inativa, tipo de identificação
--      (CNPJ, CEI, CAEPF, CNO), endereço em campos e fuso horário.
--   4. Unidade com colaboradores não pode ser desativada nem excluída; a
--      empresa sempre mantém pelo menos uma unidade ativa.
--   5. Convite e troca de unidade só usam unidades ativas.
--
-- O que este script NÃO faz: não apaga linhas, não recria tabelas, não muda
-- nomes de tabelas ou colunas. Pode ser executado mais de uma vez.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 0. Conferência: a Fase 0 precisa estar aplicada
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'proteger_perfis')
     or not exists (select 1 from pg_trigger where tgname = 'proteger_nsr_filial') then
    raise exception 'A Fase 0 não foi encontrada neste banco. Nada foi alterado. Rode a Fase 0 primeiro.';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 1. Validação de CNPJ (numérico ou alfanumérico)
--    Regra da Receita: 12 caracteres (0-9, A-Z) + 2 dígitos verificadores.
--    Valor de cada caractere = código ASCII − 48; pesos e módulo 11 iguais
--    aos do CNPJ antigo.
-- ---------------------------------------------------------------------------
create or replace function public.normalizar_documento(p_valor text)
returns text
language sql immutable
set search_path = public
as $$
  select nullif(upper(regexp_replace(coalesce(p_valor, ''), '[^0-9A-Za-z]', '', 'g')), '');
$$;

create or replace function public.cnpj_valido(p_cnpj text)
returns boolean
language plpgsql immutable
set search_path = public
as $$
declare
  v      text := normalizar_documento(p_cnpj);
  pesos1 int[] := array[5,4,3,2,9,8,7,6,5,4,3,2];
  pesos2 int[] := array[6,5,4,3,2,9,8,7,6,5,4,3,2];
  soma   int;
  dv1    int;
  dv2    int;
  i      int;
begin
  if v is null or v !~ '^[0-9A-Z]{12}[0-9]{2}$' then
    return false;
  end if;
  if v ~ '^(.)\1{13}$' then
    return false; -- todos os caracteres iguais
  end if;

  soma := 0;
  for i in 1..12 loop
    soma := soma + (ascii(substr(v, i, 1)) - 48) * pesos1[i];
  end loop;
  dv1 := case when soma % 11 < 2 then 0 else 11 - soma % 11 end;

  soma := 0;
  for i in 1..12 loop
    soma := soma + (ascii(substr(v, i, 1)) - 48) * pesos2[i];
  end loop;
  soma := soma + dv1 * pesos2[13];
  dv2 := case when soma % 11 < 2 then 0 else 11 - soma % 11 end;

  return substr(v, 13, 1)::int = dv1 and substr(v, 14, 1)::int = dv2;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Empresa: novos campos
--    "nome" continua sendo o nome da empresa exibido no sistema (fantasia).
-- ---------------------------------------------------------------------------
alter table public.empresas
  add column if not exists inscricao_estadual  text,
  add column if not exists inscricao_municipal text,
  add column if not exists telefone            text,
  add column if not exists email               text,
  add column if not exists cep                 text,
  add column if not exists logradouro          text,
  add column if not exists numero              text,
  add column if not exists complemento         text,
  add column if not exists bairro              text,
  add column if not exists cidade              text,
  add column if not exists uf                  text;

create or replace function public.normalizar_empresa()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.cnpj := normalizar_documento(new.cnpj);
  new.cep  := nullif(regexp_replace(coalesce(new.cep, ''), '[^0-9]', '', 'g'), '');
  new.uf   := nullif(upper(trim(coalesce(new.uf, ''))), '');
  new.nome := trim(new.nome);
  return new;
end;
$$;

drop trigger if exists normalizar_empresa on public.empresas;
create trigger normalizar_empresa
  before insert or update on public.empresas
  for each row execute function public.normalizar_empresa();

-- padroniza o que já existe (só remove pontuação; nada é apagado)
alter table public.empresas drop constraint if exists empresas_cnpj_valido;
alter table public.empresas drop constraint if exists empresas_uf_valida;
update public.empresas
   set cnpj = cnpj, uf = uf, cep = cep
 where cnpj is not null or uf is not null or cep is not null;

-- a partir de agora, todo CNPJ novo ou alterado precisa ser válido.
-- "not valid": um CNPJ antigo inválido continua gravado até ser editado.
alter table public.empresas
  add constraint empresas_cnpj_valido
  check (cnpj is null or cnpj_valido(cnpj)) not valid;

alter table public.empresas
  add constraint empresas_uf_valida
  check (uf is null or uf ~ '^[A-Z]{2}$') not valid;

-- ---------------------------------------------------------------------------
-- 3. Unidades (tabela filiais): novos campos
-- ---------------------------------------------------------------------------
alter table public.filiais
  add column if not exists ativa              boolean not null default true,
  add column if not exists tipo_identificador text,
  add column if not exists cep                text,
  add column if not exists logradouro         text,
  add column if not exists numero             text,
  add column if not exists complemento        text,
  add column if not exists bairro             text,
  add column if not exists cidade             text,
  add column if not exists uf                 text,
  add column if not exists fuso_horario       text not null default 'America/Sao_Paulo';

alter table public.filiais drop constraint if exists filiais_tipo_identificador_valido;
alter table public.filiais
  add constraint filiais_tipo_identificador_valido
  check (tipo_identificador is null or tipo_identificador in ('cnpj', 'cei', 'caepf', 'cno'));

create or replace function public.normalizar_filial()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.identificador_legal := normalizar_documento(new.identificador_legal);
  if new.identificador_legal is null then
    new.tipo_identificador := null;
  elsif new.tipo_identificador is null then
    new.tipo_identificador := 'cnpj';
  end if;
  new.cep  := nullif(regexp_replace(coalesce(new.cep, ''), '[^0-9]', '', 'g'), '');
  new.uf   := nullif(upper(trim(coalesce(new.uf, ''))), '');
  new.nome := trim(new.nome);
  return new;
end;
$$;

drop trigger if exists normalizar_filial on public.filiais;
create trigger normalizar_filial
  before insert or update on public.filiais
  for each row execute function public.normalizar_filial();

alter table public.filiais drop constraint if exists filiais_cnpj_valido;
alter table public.filiais drop constraint if exists filiais_uf_valida;
update public.filiais
   set identificador_legal = identificador_legal, uf = uf, cep = cep
 where identificador_legal is not null or uf is not null or cep is not null;

alter table public.filiais
  add constraint filiais_cnpj_valido
  check (identificador_legal is null
         or tipo_identificador is distinct from 'cnpj'
         or cnpj_valido(identificador_legal)) not valid;

alter table public.filiais
  add constraint filiais_uf_valida
  check (uf is null or uf ~ '^[A-Z]{2}$') not valid;

-- ---------------------------------------------------------------------------
-- 4. Regras para desativar e excluir unidades
-- ---------------------------------------------------------------------------
create or replace function public.proteger_unidades()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' then
    if old.ativa and not new.ativa then
      if exists (select 1 from perfis p where p.filial_id = old.id and p.status <> 'desligado') then
        raise exception 'Esta unidade ainda tem colaboradores. Mova as pessoas para outra unidade antes de desativá-la.';
      end if;
      if not exists (select 1 from filiais f where f.empresa_id = old.empresa_id and f.id <> old.id and f.ativa) then
        raise exception 'A empresa precisa ter pelo menos uma unidade ativa.';
      end if;
    end if;
    return new;
  end if;

  -- DELETE
  if exists (select 1 from perfis p where p.filial_id = old.id) then
    raise exception 'Esta unidade tem pessoas vinculadas e não pode ser excluída. Mova as pessoas ou desative a unidade.';
  end if;
  if exists (select 1 from registros_ponto r where r.filial_id = old.id) then
    raise exception 'Esta unidade já tem marcações de ponto e não pode ser excluída. Você pode desativá-la.';
  end if;
  if old.ativa and not exists (select 1 from filiais f where f.empresa_id = old.empresa_id and f.id <> old.id and f.ativa) then
    raise exception 'A empresa precisa ter pelo menos uma unidade ativa.';
  end if;
  return old;
end;
$$;

drop trigger if exists proteger_unidades on public.filiais;
create trigger proteger_unidades
  before update or delete on public.filiais
  for each row execute function public.proteger_unidades();

-- ---------------------------------------------------------------------------
-- 5. Convite entra na unidade principal ATIVA (mesma regra da Fase 0)
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
     and ativa
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

revoke execute on function public.entrar_por_codigo(text) from public, anon;
grant  execute on function public.entrar_por_codigo(text) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Troca de unidade de uma pessoa: só para unidade ativa da mesma empresa
--    (mesmas regras da Fase 0 + unidade ativa)
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
    if not exists (select 1 from filiais f
                    where f.id = new.filial_id
                      and f.empresa_id = new.empresa_id
                      and f.ativa) then
      raise exception 'A unidade escolhida não pertence a esta empresa ou está desativada.';
    end if;
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. Permissões das funções novas
-- ---------------------------------------------------------------------------
revoke execute on function public.normalizar_empresa()  from public, anon, authenticated;
revoke execute on function public.normalizar_filial()   from public, anon, authenticated;
revoke execute on function public.proteger_unidades()   from public, anon, authenticated;
grant  execute on function public.cnpj_valido(text)          to authenticated;
grant  execute on function public.normalizar_documento(text) to authenticated;

commit;

-- Pronto. Rode em seguida supabase/testes/conferencia-fase-1.sql.
