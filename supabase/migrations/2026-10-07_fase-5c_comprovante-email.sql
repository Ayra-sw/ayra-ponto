-- ============================================================================
-- Ayra Ponto — Fase 5C: comprovante de ponto por e-mail (Portaria 671, art. 80)
--
-- O que esta migração faz (nenhuma marcação é alterada):
--   1. preferencias_email: cada pessoa escolhe, em Minha conta, se quer
--      receber o comprovante por e-mail. Vem ligado.
--   2. fila_comprovantes_email: cada marcação nova entra numa fila, com o
--      e-mail de login da pessoa. A função "assinar" lê a fila, monta o PDF
--      assinado e envia pelo Resend.
--   3. Um agendamento (pg_cron) chama a função a cada 5 minutos, para enviar o
--      que ficou para trás (sem internet, Resend fora do ar etc.).
--      O art. 80 pede o comprovante em até 48 horas: depois disso a fila
--      desiste daquela marcação (o PDF continua no Meu histórico).
--   4. dados_comprovante() passa a usar comprovante_montar(), a mesma montagem,
--      que o servidor também usa para o e-mail. Nada muda para quem usa.
--
-- Pode ser executada mais de uma vez sem problema.
-- Para desligar: 2026-10-07_fase-5c_comprovante-email_DESFAZER.sql
-- ============================================================================

do $$
begin
  if to_regprocedure('public.dados_comprovante(uuid)') is null then
    raise exception 'Antes desta migração é preciso aplicar a Fase 5B.';
  end if;
end $$;

-- Extensões do agendamento (já vêm no Supabase; aqui só são ligadas)
do $$
begin
  if to_regnamespace('cron') is null then
    create extension if not exists pg_cron with schema pg_catalog;
  end if;
  if to_regnamespace('net') is null then
    create extension if not exists pg_net with schema extensions;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 1. Preferência de cada pessoa
-- ---------------------------------------------------------------------------
create table if not exists public.preferencias_email (
  perfil_id          uuid primary key references public.perfis(id) on delete cascade,
  comprovante_ponto  boolean not null default true,
  atualizado_em      timestamptz not null default now()
);
comment on table public.preferencias_email is
  'Escolhas de e-mail de cada pessoa (ex.: receber o comprovante de ponto). Sem linha = ligado. Cada um mexe só na sua.';

alter table public.preferencias_email enable row level security;
drop policy if exists pref_email_ver on public.preferencias_email;
create policy pref_email_ver on public.preferencias_email
  for select to authenticated using (perfil_id = (select auth.uid()));
drop policy if exists pref_email_criar on public.preferencias_email;
create policy pref_email_criar on public.preferencias_email
  for insert to authenticated with check (perfil_id = (select auth.uid()));
drop policy if exists pref_email_mudar on public.preferencias_email;
create policy pref_email_mudar on public.preferencias_email
  for update to authenticated using (perfil_id = (select auth.uid())) with check (perfil_id = (select auth.uid()));

revoke all on public.preferencias_email from anon;
revoke delete, truncate on public.preferencias_email from authenticated;
grant select, insert, update on public.preferencias_email to authenticated;

create or replace function public.preferencias_email_carimbo()
returns trigger language plpgsql set search_path = public as $$
begin new.atualizado_em := now(); return new; end $$;
drop trigger if exists preferencias_email_carimbo on public.preferencias_email;
create trigger preferencias_email_carimbo before update on public.preferencias_email
  for each row execute function public.preferencias_email_carimbo();

-- ---------------------------------------------------------------------------
-- 2. Fila de envio (só o servidor lê e escreve)
-- ---------------------------------------------------------------------------
create table if not exists public.fila_comprovantes_email (
  registro_id        uuid primary key references public.registros_ponto(id) on delete cascade,
  perfil_id          uuid not null references public.perfis(id) on delete cascade,
  destinatario       text,
  situacao           text not null default 'pendente'
                     check (situacao in ('pendente', 'enviando', 'enviado', 'erro', 'desligado', 'sem_email', 'ignorado_teste', 'expirado')),
  tentativas         smallint not null default 0,
  proxima_tentativa  timestamptz not null default now(),
  ultimo_erro        text,
  id_envio           text,
  criado_em          timestamptz not null default now(),
  atualizado_em      timestamptz not null default now(),
  enviado_em         timestamptz
);
create index if not exists fila_comprovantes_pendentes on public.fila_comprovantes_email (proxima_tentativa)
  where situacao in ('pendente', 'enviando');
comment on table public.fila_comprovantes_email is
  'Fila do comprovante de ponto por e-mail. Só o servidor (função assinar) mexe.';

alter table public.fila_comprovantes_email enable row level security;
revoke all on public.fila_comprovantes_email from anon, authenticated;
grant select, insert, update, delete on public.fila_comprovantes_email to service_role;

-- Dados internos do agendamento: endereço da função, chave pública e senha da fila
create table if not exists public.ayra_interno (
  chave  text primary key,
  valor  text not null
);
comment on table public.ayra_interno is 'Configuração interna do servidor. Ninguém do app lê.';
alter table public.ayra_interno enable row level security;
revoke all on public.ayra_interno from anon, authenticated, service_role;

insert into public.ayra_interno (chave, valor)
values ('fila_token', encode(extensions.gen_random_bytes(24), 'hex'))
on conflict (chave) do nothing;

-- Toda marcação nova entra na fila (nunca impede a marcação)
create or replace function public.fila_comprovante_entrar()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_email text;
  v_quer  boolean;
begin
  begin
    select u.email into v_email from auth.users u where u.id = new.perfil_id;
    select p.comprovante_ponto into v_quer from preferencias_email p where p.perfil_id = new.perfil_id;
    insert into fila_comprovantes_email (registro_id, perfil_id, destinatario, situacao)
    values (new.id, new.perfil_id, nullif(trim(v_email), ''),
            case when coalesce(v_quer, true) = false then 'desligado'
                 when nullif(trim(v_email), '') is null then 'sem_email'
                 else 'pendente' end)
    on conflict (registro_id) do nothing;
  exception when others then
    raise warning 'Comprovante por e-mail não entrou na fila: %', sqlerrm;
  end;
  return null;
end $$;
revoke execute on function public.fila_comprovante_entrar() from public, anon, authenticated;

drop trigger if exists fila_comprovante_email on public.registros_ponto;
create trigger fila_comprovante_email after insert on public.registros_ponto
  for each row execute function public.fila_comprovante_entrar();

-- ---------------------------------------------------------------------------
-- 3. Montagem do comprovante (a mesma da tela e do e-mail)
-- ---------------------------------------------------------------------------
create or replace function public.comprovante_montar(p_registro uuid)
returns jsonb
language plpgsql stable security definer
set search_path = public
as $$
declare
  r    registros_ponto;
  v    record;
  f    filiais;
  p    perfis;
  v_sis ayra_sistema;
  v_local timestamp;
begin
  select * into r from registros_ponto where id = p_registro;
  if r.id is null then
    raise exception 'Marcação não encontrada.';
  end if;
  select * into p from perfis where id = r.perfil_id;
  select * into f from filiais where id = r.filial_id;
  select * into v from afd_empregador(r.filial_id);
  select * into v_sis from ayra_sistema limit 1;
  v_local := r.marcado_em at time zone coalesce(f.fuso_horario, 'America/Sao_Paulo');

  return jsonb_build_object(
    'registro_id', r.id,
    'nsr',         r.nsr,
    'tipo',        r.tipo,
    'data',        to_char(v_local, 'DD/MM/YYYY'),
    'hora',        to_char(v_local, 'HH24:MI:SS'),
    'fuso',        substr(afd_dh(r.marcado_em, f.fuso_horario), 20, 5),
    'data_hora_iso', afd_dh(r.marcado_em, f.fuso_horario),
    'empregador',  jsonb_build_object('tipo_id', v.tipo_id, 'documento', v.id_empregador, 'cno_caepf', nullif(v.cno_caepf, ''),
                                      'razao_social', v.razao, 'local', v.local),
    'unidade',     f.nome,
    'trabalhador', jsonb_build_object('nome', p.nome_completo, 'cpf', p.cpf),
    'inpi',        v_sis.inpi_registro,
    'programa',    v_sis.nome_programa,
    'hash',        (select substr(a.linha, 74, 64) from afd_registros a where a.registro_id = r.id),
    'origem',      r.origem
  );
end;
$$;
revoke execute on function public.comprovante_montar(uuid) from public, anon, authenticated;
grant  execute on function public.comprovante_montar(uuid) to service_role;

create or replace function public.dados_comprovante(p_registro uuid)
returns jsonb
language plpgsql stable security definer
set search_path = public
as $$
declare
  v_perfil  uuid;
  v_empresa uuid;
begin
  select r.perfil_id, f.empresa_id into v_perfil, v_empresa
    from registros_ponto r join filiais f on f.id = r.filial_id
   where r.id = p_registro;
  if v_perfil is null then
    raise exception 'Marcação não encontrada.';
  end if;
  if auth.uid() is null
     or not (v_perfil = auth.uid()
             or ((select tipo_do_usuario()) in ('administrador', 'rh') and v_empresa = (select empresa_do_usuario()))) then
    raise exception 'Você só pode ver os comprovantes das suas próprias marcações.';
  end if;
  return comprovante_montar(p_registro);
end;
$$;
comment on function public.dados_comprovante(uuid) is
  'Dados do Comprovante de Registro de Ponto do Trabalhador (art. 79). A própria pessoa, o administrador e o RH.';
revoke execute on function public.dados_comprovante(uuid) from public, anon;
grant  execute on function public.dados_comprovante(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Funções da fila (só o servidor)
-- ---------------------------------------------------------------------------

-- A função "assinar" guarda o próprio endereço e a chave pública do projeto,
-- para o agendamento saber quem chamar. A chave pública (anon) já é pública: vai no site.
create or replace function public.fila_comprovantes_preparar(p_url text, p_chave text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if coalesce(p_url, '') !~ '^https://' then return; end if;
  insert into ayra_interno (chave, valor) values ('url_funcoes', rtrim(p_url, '/'))
  on conflict (chave) do update set valor = excluded.valor;
  if coalesce(p_chave, '') <> '' then
    insert into ayra_interno (chave, valor) values ('chave_publica', p_chave)
    on conflict (chave) do update set valor = excluded.valor;
  end if;
end $$;

create or replace function public.fila_comprovantes_token_ok(p_token text)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(length(p_token) >= 32 and p_token = (select valor from ayra_interno where chave = 'fila_token'), false)
$$;

-- Separa até p_limite comprovantes para enviar (de uma pessoa, ou de todos).
-- Quem está "enviando" há mais de 10 minutos volta para a fila.
create or replace function public.fila_comprovantes_pegar(p_perfil uuid default null, p_limite int default 20)
returns table (registro_id uuid, perfil_id uuid, destinatario text, tentativas smallint)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
begin
  update fila_comprovantes_email q
     set situacao = 'expirado', atualizado_em = now(),
         ultimo_erro = coalesce(q.ultimo_erro, 'Não foi enviado em 48 horas.')
   where q.situacao in ('pendente', 'enviando')
     and q.criado_em < now() - interval '48 hours'
     and (p_perfil is null or q.perfil_id = p_perfil);

  update fila_comprovantes_email q
     set situacao = 'desligado', atualizado_em = now()
   where q.situacao = 'pendente'
     and (p_perfil is null or q.perfil_id = p_perfil)
     and exists (select 1 from preferencias_email p where p.perfil_id = q.perfil_id and not p.comprovante_ponto);

  return query
  with escolhidos as (
    select q.registro_id
      from fila_comprovantes_email q
     where (q.situacao = 'pendente' and q.proxima_tentativa <= now()
            or q.situacao = 'enviando' and q.atualizado_em < now() - interval '10 minutes')
       and (p_perfil is null or q.perfil_id = p_perfil)
     order by q.criado_em
     limit greatest(1, least(coalesce(p_limite, 20), 50))
     for update skip locked
  )
  update fila_comprovantes_email q
     set situacao = 'enviando', atualizado_em = now()
    from escolhidos e
   where q.registro_id = e.registro_id
  returning q.registro_id, q.perfil_id, q.destinatario, q.tentativas;
end $$;

-- Resultado de cada envio.
--   enviado | ignorado_teste | erro (definitivo) | tentar_de_novo | pendente (sem contar tentativa)
create or replace function public.fila_comprovantes_concluir(p_registro uuid, p_resultado text, p_erro text default null, p_id_envio text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_resultado = 'enviado' then
    update fila_comprovantes_email set situacao = 'enviado', enviado_em = now(), atualizado_em = now(),
           id_envio = p_id_envio, ultimo_erro = null
     where registro_id = p_registro;
  elsif p_resultado in ('ignorado_teste', 'erro', 'desligado', 'sem_email') then
    update fila_comprovantes_email set situacao = p_resultado, atualizado_em = now(), ultimo_erro = left(p_erro, 500)
     where registro_id = p_registro;
  elsif p_resultado = 'tentar_de_novo' then
    update fila_comprovantes_email
       set tentativas = tentativas + 1,
           situacao = case when tentativas + 1 >= 6 then 'erro' else 'pendente' end,
           proxima_tentativa = now() + (interval '5 minutes' * power(3, tentativas)),
           atualizado_em = now(), ultimo_erro = left(p_erro, 500)
     where registro_id = p_registro;
  elsif p_resultado = 'pendente' then
    update fila_comprovantes_email set situacao = 'pendente', atualizado_em = now(), ultimo_erro = left(p_erro, 500)
     where registro_id = p_registro;
  else
    raise exception 'Resultado desconhecido: %', p_resultado;
  end if;
end $$;

revoke execute on function public.fila_comprovantes_preparar(text, text) from public, anon, authenticated;
revoke execute on function public.fila_comprovantes_token_ok(text) from public, anon, authenticated;
revoke execute on function public.fila_comprovantes_pegar(uuid, int) from public, anon, authenticated;
revoke execute on function public.fila_comprovantes_concluir(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.fila_comprovantes_preparar(text, text) to service_role;
grant execute on function public.fila_comprovantes_token_ok(text) to service_role;
grant execute on function public.fila_comprovantes_pegar(uuid, int) to service_role;
grant execute on function public.fila_comprovantes_concluir(uuid, text, text, text) to service_role;

-- ---------------------------------------------------------------------------
-- 5. Agendamento: a cada 5 minutos, se houver algo na fila, chama a função
-- ---------------------------------------------------------------------------
create or replace function public.fila_comprovantes_chamar()
returns void language plpgsql security definer set search_path = public, extensions as $$
declare
  v_url   text := (select valor from ayra_interno where chave = 'url_funcoes');
  v_chave text := (select valor from ayra_interno where chave = 'chave_publica');
  v_token text := (select valor from ayra_interno where chave = 'fila_token');
  v_cab   jsonb;
  v_qtd   int;
begin
  if v_url is null or v_token is null then return; end if;
  select count(*) into v_qtd from fila_comprovantes_email q
   where q.situacao = 'pendente' and q.proxima_tentativa <= now()
      or q.situacao = 'enviando' and q.atualizado_em < now() - interval '10 minutes';
  if v_qtd = 0 then return; end if;
  v_cab := jsonb_build_object('Content-Type', 'application/json', 'x-ayra-fila', v_token);
  if v_chave is not null then
    v_cab := v_cab || jsonb_build_object('Authorization', 'Bearer ' || v_chave, 'apikey', v_chave);
  end if;
  -- cada chamada envia até 5; com muita coisa na fila, até 6 chamadas juntas
  for i in 1 .. least(6, ceil(v_qtd / 5.0)::int) loop
    perform net.http_post(
      url := v_url || '/functions/v1/assinar',
      body := jsonb_build_object('acao', 'processar_fila'),
      headers := v_cab,
      timeout_milliseconds := 60000
    );
  end loop;
end $$;
revoke execute on function public.fila_comprovantes_chamar() from public, anon, authenticated;

do $$
begin
  perform cron.schedule('ayra-comprovantes-email', '*/5 * * * *', 'select public.fila_comprovantes_chamar()');
end $$;

notify pgrst, 'reload schema';
