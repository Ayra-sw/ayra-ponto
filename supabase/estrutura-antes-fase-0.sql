-- ============================================================================
-- Ayra Ponto — estrutura do banco ANTES da Fase 0 (referência, NÃO executar)
--
-- Reconstruída em 24/09/2026 a partir da consulta de diagnóstico rodada no
-- Supabase (tabelas, colunas, restrições, índices, tipos, funções, gatilhos e
-- políticas RLS). Serve como registro histórico do ponto de partida.
--
-- Não rode este arquivo no Supabase de produção: as tabelas já existem lá.
-- ============================================================================

-- ---------------------------------------------------------------- Tipos
create type public.categoria_funcionario as enum ('estagiario', 'menor_aprendiz', 'trainee', 'clt');
create type public.origem_marcacao       as enum ('web', 'mobile', 'mobile_geolocalizacao');
create type public.status_ajuste         as enum ('pendente', 'aprovado', 'rejeitado');
create type public.status_funcionario    as enum ('ativo', 'afastado', 'desligado');
create type public.tipo_ajuste           as enum ('correcao_marcacao', 'abono', 'folga', 'inclusao_esquecida');
create type public.tipo_marcacao         as enum ('entrada', 'saida', 'inicio_intervalo', 'fim_intervalo');
create type public.tipo_perfil           as enum ('administrador', 'rh', 'funcionario');

-- ---------------------------------------------------------------- Tabelas
create table public.empresas (
  id             uuid primary key default gen_random_uuid(),
  nome           text not null,
  razao_social   text,
  cnpj           text unique,
  codigo_convite text not null unique default substr(md5((random())::text), 1, 8),
  criado_em      timestamptz not null default now()
);

create table public.filiais (
  id                  uuid primary key default gen_random_uuid(),
  empresa_id          uuid not null references public.empresas(id) on delete cascade,
  nome                text not null,
  identificador_legal text,
  endereco            text,
  proximo_nsr         bigint not null default 1,
  criado_em           timestamptz not null default now()
);

create table public.perfis (
  id            uuid primary key references auth.users(id) on delete cascade,
  empresa_id    uuid references public.empresas(id) on delete set null,
  filial_id     uuid references public.filiais(id) on delete set null,
  nome_completo text not null,
  cpf           text,
  cargo         text,
  tipo          public.tipo_perfil not null default 'funcionario',
  categoria     public.categoria_funcionario,
  status        public.status_funcionario not null default 'ativo',
  data_admissao date,
  criado_em     timestamptz not null default now()
);

create table public.jornadas_contratuais (
  id                    uuid primary key default gen_random_uuid(),
  perfil_id             uuid not null references public.perfis(id) on delete cascade,
  carga_horaria_semanal numeric(5,2) not null,
  entrada               time,
  saida                 time,
  intervalo_inicio      time,
  intervalo_fim         time,
  dias_semana           integer[] not null default '{1,2,3,4,5}'::integer[],
  vigencia_inicio       date not null default current_date,
  vigencia_fim          date,
  criado_em             timestamptz not null default now()
);

create table public.registros_ponto (
  id               uuid primary key default gen_random_uuid(),
  nsr              bigint not null,
  filial_id        uuid not null references public.filiais(id),
  perfil_id        uuid not null references public.perfis(id),
  tipo             public.tipo_marcacao not null,
  marcado_em       timestamptz not null default now(),
  origem           public.origem_marcacao not null default 'web',
  latitude         numeric(9,6),
  longitude        numeric(9,6),
  hash_integridade text not null,
  criado_em        timestamptz not null default now(),
  unique (filial_id, nsr)
);

create table public.ajustes_ponto (
  id                   uuid primary key default gen_random_uuid(),
  registro_original_id uuid references public.registros_ponto(id),
  perfil_id            uuid not null references public.perfis(id),
  tipo                 public.tipo_ajuste not null,
  marcacao_solicitada  timestamptz,
  motivo               text not null,
  status               public.status_ajuste not null default 'pendente',
  analisado_por        uuid references public.perfis(id),
  analisado_em         timestamptz,
  criado_em            timestamptz not null default now()
);

create table public.espelhos_ponto (
  id                     uuid primary key default gen_random_uuid(),
  perfil_id              uuid not null references public.perfis(id),
  competencia            date not null,
  storage_path           text not null,
  assinado_em            timestamptz,
  ciencia_funcionario_em timestamptz,
  criado_em              timestamptz not null default now(),
  unique (perfil_id, competencia)
);

create table public.comprovantes_marcacao (
  id                uuid primary key default gen_random_uuid(),
  registro_ponto_id uuid not null references public.registros_ponto(id),
  storage_path      text not null,
  assinado_pades    boolean not null default false,
  criado_em         timestamptz not null default now()
);

create table public.arquivos_afd (
  id             uuid primary key default gen_random_uuid(),
  empresa_id     uuid not null references public.empresas(id),
  filial_id      uuid not null references public.filiais(id),
  periodo_inicio date not null,
  periodo_fim    date not null,
  storage_path   text not null,
  hash_arquivo   text not null,
  assinado_em    timestamptz,
  gerado_por     uuid references public.perfis(id),
  criado_em      timestamptz not null default now()
);

create table public.arquivos_aej (
  id           uuid primary key default gen_random_uuid(),
  empresa_id   uuid not null references public.empresas(id),
  filial_id    uuid not null references public.filiais(id),
  competencia  date not null,
  storage_path text not null,
  hash_arquivo text not null,
  assinado_em  timestamptz,
  gerado_por   uuid references public.perfis(id),
  criado_em    timestamptz not null default now()
);

-- ---------------------------------------------------------------- Funções
create or replace function public.empresa_do_usuario()
returns uuid language sql stable security definer as $$
  select empresa_id from perfis where id = auth.uid();
$$;

create or replace function public.tipo_do_usuario()
returns tipo_perfil language sql stable security definer as $$
  select tipo from perfis where id = auth.uid();
$$;

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

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

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

-- ---------------------------------------------------------------- RLS
alter table public.empresas              enable row level security;
alter table public.filiais               enable row level security;
alter table public.perfis                enable row level security;
alter table public.jornadas_contratuais  enable row level security;
alter table public.registros_ponto       enable row level security;
alter table public.ajustes_ponto         enable row level security;
alter table public.espelhos_ponto        enable row level security;
alter table public.comprovantes_marcacao enable row level security;
alter table public.arquivos_afd          enable row level security;
alter table public.arquivos_aej          enable row level security;

create policy "empresas: só a própria" on public.empresas for select
  using (id = empresa_do_usuario());
create policy "empresas: admin edita a própria" on public.empresas for update
  using ((id = empresa_do_usuario()) and (tipo_do_usuario() = 'administrador'::tipo_perfil));

create policy "filiais: mesma empresa" on public.filiais for select
  using (empresa_id = empresa_do_usuario());
create policy "filiais: admin/rh gerencia" on public.filiais for all
  using ((empresa_id = empresa_do_usuario()) and (tipo_do_usuario() = any (array['administrador'::tipo_perfil, 'rh'::tipo_perfil])));

create policy "perfis: mesma empresa" on public.perfis for select
  using ((empresa_id = empresa_do_usuario()) or (id = auth.uid()));
create policy "perfis: usuário atualiza o próprio" on public.perfis for update
  using (id = auth.uid());
create policy "perfis: admin/rh atualiza da própria empresa" on public.perfis for update
  using ((empresa_id = empresa_do_usuario()) and (tipo_do_usuario() = any (array['administrador'::tipo_perfil, 'rh'::tipo_perfil])));

create policy "registros: dono vê o próprio" on public.registros_ponto for select
  using (perfil_id = auth.uid());
create policy "registros: admin/rh vê da empresa" on public.registros_ponto for select
  using ((filial_id in (select filiais.id from filiais where filiais.empresa_id = empresa_do_usuario()))
         and (tipo_do_usuario() = any (array['administrador'::tipo_perfil, 'rh'::tipo_perfil])));
create policy "registros: inserção só via função registrar_ponto" on public.registros_ponto for insert
  with check (false);

create policy "ajustes: dono cria e vê" on public.ajustes_ponto for select
  using (perfil_id = auth.uid());
create policy "ajustes: dono insere" on public.ajustes_ponto for insert
  with check (perfil_id = auth.uid());
create policy "ajustes: admin/rh vê e analisa" on public.ajustes_ponto for select
  using ((perfil_id in (select perfis.id from perfis where perfis.empresa_id = empresa_do_usuario()))
         and (tipo_do_usuario() = any (array['administrador'::tipo_perfil, 'rh'::tipo_perfil])));
create policy "ajustes: admin/rh atualiza status" on public.ajustes_ponto for update
  using ((perfil_id in (select perfis.id from perfis where perfis.empresa_id = empresa_do_usuario()))
         and (tipo_do_usuario() = any (array['administrador'::tipo_perfil, 'rh'::tipo_perfil])));

create policy "espelhos: dono ou admin/rh" on public.espelhos_ponto for select
  using ((perfil_id = auth.uid()) or (perfil_id in (select perfis.id from perfis
         where (perfis.empresa_id = empresa_do_usuario())
           and (tipo_do_usuario() = any (array['administrador'::tipo_perfil, 'rh'::tipo_perfil])))));

create policy "comprovantes: dono da marcação" on public.comprovantes_marcacao for select
  using (registro_ponto_id in (select registros_ponto.id from registros_ponto where registros_ponto.perfil_id = auth.uid()));

create policy "afd: mesma empresa" on public.arquivos_afd for select
  using (empresa_id = empresa_do_usuario());
create policy "aej: mesma empresa" on public.arquivos_aej for select
  using (empresa_id = empresa_do_usuario());

-- jornadas_contratuais: RLS ligado e nenhuma política (inacessível pela API).
