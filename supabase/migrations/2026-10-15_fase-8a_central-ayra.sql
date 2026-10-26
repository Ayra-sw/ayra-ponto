-- ============================================================================
-- Ayra Ponto — Fase 8A: Central Ayra (a área da dona da plataforma)
--
-- O que esta migração faz (nenhuma marcação, pedido ou cálculo muda):
--   1. plataforma_donos: quem é dona/dono da plataforma. Só entra pelo SQL
--      Editor (função plataforma_tornar_dono), nunca pelo app.
--   2. empresas.situacao: teste, ativa ou suspensa. Só a Central muda.
--      Empresas novas começam "em teste"; as que já existem ficam "ativas".
--   3. Empresa suspensa: os funcionários continuam batendo ponto; a gestão
--      (administrador, RH e gestor de equipe) fica sem acesso aos dados da
--      empresa até a Central liberar.
--   4. Funções da Central: números de cada empresa (sem marcações nem dados
--      pessoais dos funcionários), contatos da gestão de cada cliente,
--      suspender/liberar e o registro de tudo o que a Central fez. Elas pedem
--      que a dona tenha confirmado a identidade há pouco (digital ou senha).
--   5. plataforma_config: o WhatsApp e o e-mail do suporte, que aparecem no
--      app para todos os clientes.
--
-- Pode ser executada mais de uma vez sem problema.
-- Para desligar: 2026-10-15_fase-8a_central-ayra_DESFAZER.sql
-- ============================================================================

do $$
begin
  if to_regprocedure('public.confirmacao_recente(integer)') is null then
    raise exception 'Antes desta migração é preciso aplicar a Fase 7C.';
  end if;
end $$;

begin;

-- ---------------------------------------------------------------------------
-- 1. Donas e donos da plataforma
-- ---------------------------------------------------------------------------
create table if not exists public.plataforma_donos (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  nome       text not null,
  criado_em  timestamptz not null default now()
);
alter table public.plataforma_donos enable row level security;
revoke all on public.plataforma_donos from public, anon, authenticated;

create or replace function public.eh_dono()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from plataforma_donos where user_id = auth.uid());
$$;

-- Uso no SQL Editor: select plataforma_tornar_dono('email@exemplo.com', 'Seu nome');
create or replace function public.plataforma_tornar_dono(p_email text, p_nome text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_emp uuid;
begin
  select id into v_id from auth.users where lower(email) = lower(trim(p_email));
  if v_id is null then
    raise exception 'Não existe conta com o e-mail %. Crie a conta antes em Authentication → Users → Add user.', p_email;
  end if;
  select empresa_id into v_emp from perfis where id = v_id;
  if v_emp is not null then
    raise exception 'A conta % já é de uma empresa. A Central precisa de uma conta separada, só para ela.', p_email;
  end if;
  insert into plataforma_donos (user_id, nome) values (v_id, trim(p_nome))
  on conflict (user_id) do update set nome = excluded.nome;
  update perfis set nome_completo = trim(p_nome) where id = v_id and coalesce(nome_completo, '') = '';
  return 'Pronto: ' || p_email || ' agora entra na Central Ayra.';
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Situação de cada empresa no Ayra
-- ---------------------------------------------------------------------------
alter table public.empresas add column if not exists situacao text;
alter table public.empresas add column if not exists situacao_em timestamptz;
alter table public.empresas add column if not exists suspensa_motivo text;
update public.empresas set situacao = 'ativa' where situacao is null;
alter table public.empresas alter column situacao set default 'teste';
alter table public.empresas alter column situacao set not null;
alter table public.empresas drop constraint if exists empresas_situacao_check;
alter table public.empresas add constraint empresas_situacao_check check (situacao in ('teste', 'ativa', 'suspensa'));
alter table public.empresas drop constraint if exists empresas_suspensa_motivo_check;
alter table public.empresas add constraint empresas_suspensa_motivo_check
  check (suspensa_motivo is null or char_length(suspensa_motivo) between 3 and 300);

-- só a Central muda a situação (o cliente não consegue se "liberar")
create or replace function public.proteger_situacao_empresa()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then
      new.situacao := 'teste'; new.situacao_em := null; new.suspensa_motivo := null;
    elsif (new.situacao, new.situacao_em, new.suspensa_motivo) is distinct from (old.situacao, old.situacao_em, old.suspensa_motivo) then
      raise exception 'A situação da empresa no Ayra só é alterada pela Central Ayra.';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists proteger_situacao_empresa on public.empresas;
create trigger proteger_situacao_empresa before insert or update on public.empresas
  for each row execute function public.proteger_situacao_empresa();

-- ---------------------------------------------------------------------------
-- 3. Empresa suspensa: a gestão perde o acesso; o ponto continua
--    (o banco passa a tratar administrador e RH como colaborador, e o gestor
--    fica sem equipe, até a empresa ser liberada)
-- ---------------------------------------------------------------------------
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

create or replace function public.equipe_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select distinct p.id
    from departamento_gestores dg
    join perfis g on g.id = dg.perfil_id and g.status <> 'desligado'
    join empresas e on e.id = dg.empresa_id and e.situacao <> 'suspensa'
    join perfis p on p.departamento_id = dg.departamento_id and p.empresa_id = dg.empresa_id
   where dg.perfil_id = auth.uid()
     and p.id <> auth.uid()
     and p.status <> 'desligado';
$$;

-- ---------------------------------------------------------------------------
-- 4. Registro do que a Central fez
-- ---------------------------------------------------------------------------
create table if not exists public.plataforma_registro (
  id          bigint generated always as identity primary key,
  dono_id     uuid references auth.users(id) on delete set null,
  dono_nome   text,
  acao        text not null,
  empresa_id  uuid references public.empresas(id) on delete set null,
  empresa_nome text,
  detalhe     jsonb,
  em          timestamptz not null default now()
);
create index if not exists plataforma_registro_empresa_idx on public.plataforma_registro (empresa_id, em desc);
alter table public.plataforma_registro enable row level security;
revoke all on public.plataforma_registro from public, anon, authenticated;

create or replace function public.registrar_na_central(p_acao text, p_empresa uuid, p_detalhe jsonb default null)
returns void
language sql
security definer
set search_path = public
as $$
  insert into plataforma_registro (dono_id, dono_nome, acao, empresa_id, empresa_nome, detalhe)
  values (auth.uid(), (select nome from plataforma_donos where user_id = auth.uid()), p_acao, p_empresa,
          (select nome from empresas where id = p_empresa), p_detalhe);
$$;

-- Toda função da Central começa por aqui: é dona? confirmou a identidade há pouco?
create or replace function public.exigir_dono(p_minutos integer)
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not eh_dono() then
    raise exception 'Somente a Central Ayra pode fazer isso.';
  end if;
  if confirmacao_recente(p_minutos) is null then
    raise exception 'Para continuar na Central Ayra, confirme que é você com a sua digital ou a sua senha.';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Funções da Central
-- ---------------------------------------------------------------------------
-- Números gerais
create or replace function public.central_resumo()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform exigir_dono(720);
  return jsonb_build_object(
    'empresas',  (select count(*) from empresas),
    'teste',     (select count(*) from empresas where situacao = 'teste'),
    'ativas',    (select count(*) from empresas where situacao = 'ativa'),
    'suspensas', (select count(*) from empresas where situacao = 'suspensa'),
    'pessoas',   (select count(*) from perfis where empresa_id is not null and status <> 'desligado'),
    'marcacoes_hoje', (select count(*) from registros_ponto where marcado_em >= date_trunc('day', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo'),
    'novas_30d', (select count(*) from empresas where criado_em >= now() - interval '30 days'));
end;
$$;

-- Lista de empresas (só números: nada de marcações ou dados dos funcionários)
create or replace function public.central_empresas()
returns table (
  id uuid, nome text, razao_social text, cnpj text, cidade text, uf text, telefone text, email text,
  criado_em timestamptz, situacao text, situacao_em timestamptz, suspensa_motivo text,
  pessoas_ativas bigint, pessoas_total bigint, unidades bigint, ultima_marcacao timestamptz, marcacoes_30d bigint,
  administradores jsonb)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform exigir_dono(720);
  return query
  select e.id, e.nome, e.razao_social, e.cnpj, e.cidade, e.uf, e.telefone, e.email,
         e.criado_em, e.situacao, e.situacao_em, e.suspensa_motivo,
         (select count(*) from perfis p where p.empresa_id = e.id and p.status = 'ativo'),
         (select count(*) from perfis p where p.empresa_id = e.id and p.status <> 'desligado'),
         (select count(*) from filiais f where f.empresa_id = e.id),
         (select max(r.marcado_em) from registros_ponto r join filiais f on f.id = r.filial_id where f.empresa_id = e.id),
         (select count(*) from registros_ponto r join filiais f on f.id = r.filial_id
           where f.empresa_id = e.id and r.marcado_em >= now() - interval '30 days'),
         coalesce((select jsonb_agg(jsonb_build_object('nome', p.nome_completo) order by p.nome_completo)
                     from perfis p where p.empresa_id = e.id and p.tipo = 'administrador' and p.status <> 'desligado'), '[]'::jsonb)
    from empresas e
   order by e.criado_em desc;
end;
$$;

-- Uma empresa: dados e as pessoas da gestão (para ajudar a entrar)
create or replace function public.central_empresa(p_empresa uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v jsonb;
begin
  perform exigir_dono(720);
  select to_jsonb(x) into v from central_empresas() x where x.id = p_empresa;
  if v is null then
    raise exception 'Empresa não encontrada.';
  end if;
  return v || jsonb_build_object(
    'gestao', coalesce((
      select jsonb_agg(jsonb_build_object(
               'perfil_id', p.id, 'nome', p.nome_completo, 'tipo', p.tipo, 'status', p.status,
               'email', u.email, 'ultimo_acesso', u.last_sign_in_at, 'email_confirmado', u.email_confirmed_at is not null)
             order by (p.tipo = 'administrador') desc, p.nome_completo)
        from perfis p join auth.users u on u.id = p.id
       where p.empresa_id = p_empresa and p.tipo in ('administrador', 'rh') and p.status <> 'desligado'), '[]'::jsonb),
    'registro', coalesce((
      select jsonb_agg(jsonb_build_object('acao', r.acao, 'dono_nome', r.dono_nome, 'detalhe', r.detalhe, 'em', r.em) order by r.em desc)
        from (select * from plataforma_registro where empresa_id = p_empresa order by em desc limit 50) r), '[]'::jsonb));
end;
$$;

-- Mudar a situação: teste, ativa ou suspensa
create or replace function public.central_mudar_situacao(p_empresa uuid, p_situacao text, p_motivo text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_e empresas;
begin
  perform exigir_dono(30);
  select * into v_e from empresas where id = p_empresa for update;
  if v_e.id is null then
    raise exception 'Empresa não encontrada.';
  end if;
  if p_situacao not in ('teste', 'ativa', 'suspensa') then
    raise exception 'Situação inválida.';
  end if;
  if p_situacao = 'suspensa' and (p_motivo is null or char_length(trim(p_motivo)) < 3) then
    raise exception 'Conte em poucas palavras o motivo da suspensão (fica no registro da Central).';
  end if;
  if v_e.situacao = p_situacao then
    raise exception 'A empresa já está com essa situação.';
  end if;
  update empresas
     set situacao = p_situacao, situacao_em = now(),
         suspensa_motivo = case when p_situacao = 'suspensa' then left(trim(p_motivo), 300) end
   where id = p_empresa;
  perform registrar_na_central(
    case p_situacao when 'suspensa' then 'suspendeu' when 'ativa' then case when v_e.situacao = 'suspensa' then 'liberou' else 'ativou' end else 'voltou_para_teste' end,
    p_empresa, jsonb_build_object('de', v_e.situacao, 'para', p_situacao, 'motivo', nullif(trim(coalesce(p_motivo, '')), '')));
  return jsonb_build_object('situacao', p_situacao);
end;
$$;

-- Anotar no registro algo feito pela tela (ex.: link de nova senha enviado)
create or replace function public.central_anotar(p_acao text, p_empresa uuid, p_detalhe jsonb default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform exigir_dono(30);
  if p_acao not in ('enviou_link_senha') then
    raise exception 'Ação desconhecida.';
  end if;
  if p_acao = 'enviou_link_senha' and not exists (
       select 1 from perfis p join auth.users u on u.id = p.id
        where p.empresa_id = p_empresa and p.tipo in ('administrador', 'rh') and lower(u.email) = lower(p_detalhe ->> 'email')) then
    raise exception 'Esse e-mail não é da gestão desta empresa.';
  end if;
  perform registrar_na_central(p_acao, p_empresa, p_detalhe);
end;
$$;

-- Registro geral da Central
create or replace function public.central_registro(p_limite integer default 200)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform exigir_dono(720);
  return coalesce((
    select jsonb_agg(jsonb_build_object('acao', r.acao, 'dono_nome', r.dono_nome, 'empresa_id', r.empresa_id,
                                        'empresa_nome', r.empresa_nome, 'detalhe', r.detalhe, 'em', r.em) order by r.em desc)
      from (select * from plataforma_registro order by em desc limit least(greatest(p_limite, 1), 1000)) r), '[]'::jsonb);
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Contato do suporte (aparece no app para todos)
-- ---------------------------------------------------------------------------
create table if not exists public.plataforma_config (
  id          integer primary key default 1 check (id = 1),
  whatsapp    text check (whatsapp is null or whatsapp ~ '^\d{10,13}$'),
  email       text check (email is null or email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  atualizado_em timestamptz not null default now()
);
insert into public.plataforma_config (id) values (1) on conflict (id) do nothing;
alter table public.plataforma_config enable row level security;
drop policy if exists "plataforma_config: todos leem" on public.plataforma_config;
create policy "plataforma_config: todos leem" on public.plataforma_config for select to anon, authenticated using (true);
revoke all on public.plataforma_config from public, anon, authenticated;
grant select on public.plataforma_config to anon, authenticated;

create or replace function public.central_salvar_contato(p_whatsapp text, p_email text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_zap text := nullif(regexp_replace(coalesce(p_whatsapp, ''), '\D', '', 'g'), '');
  v_mail text := nullif(lower(trim(coalesce(p_email, ''))), '');
begin
  perform exigir_dono(30);
  update plataforma_config set whatsapp = v_zap, email = v_mail, atualizado_em = now() where id = 1;
  perform registrar_na_central('mudou_contato', null, jsonb_build_object('whatsapp', v_zap, 'email', v_mail));
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. Quem pode chamar
-- ---------------------------------------------------------------------------
revoke execute on function public.plataforma_tornar_dono(text, text)         from public, anon, authenticated;
revoke execute on function public.registrar_na_central(text, uuid, jsonb)    from public, anon, authenticated;
revoke execute on function public.exigir_dono(integer)                       from public, anon, authenticated;
revoke execute on function public.proteger_situacao_empresa()                from public, anon, authenticated;
revoke execute on function public.eh_dono()                                  from public, anon;
revoke execute on function public.central_resumo()                           from public, anon;
revoke execute on function public.central_empresas()                         from public, anon;
revoke execute on function public.central_empresa(uuid)                      from public, anon;
revoke execute on function public.central_mudar_situacao(uuid, text, text)   from public, anon;
revoke execute on function public.central_anotar(text, uuid, jsonb)          from public, anon;
revoke execute on function public.central_registro(integer)                  from public, anon;
revoke execute on function public.central_salvar_contato(text, text)         from public, anon;
grant  execute on function public.eh_dono()                                  to authenticated;
grant  execute on function public.central_resumo()                           to authenticated;
grant  execute on function public.central_empresas()                         to authenticated;
grant  execute on function public.central_empresa(uuid)                      to authenticated;
grant  execute on function public.central_mudar_situacao(uuid, text, text)   to authenticated;
grant  execute on function public.central_anotar(text, uuid, jsonb)          to authenticated;
grant  execute on function public.central_registro(integer)                  to authenticated;
grant  execute on function public.central_salvar_contato(text, text)         to authenticated;

commit;

notify pgrst, 'reload schema';

-- Pronto. Rode em seguida supabase/testes/conferencia-fase-8a.sql.
