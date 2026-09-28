-- ============================================================================
-- Ayra Ponto — Fase 2A: organização da empresa e jornadas
--
-- O que esta migração faz (tudo é ACRESCENTADO; nada é apagado ou recriado):
--   1. Cria departamentos, cargos, modelos de jornada (com os 7 dias da
--      semana) e feriados, todos separados por empresa.
--   2. Acrescenta ao cadastro das pessoas: matrícula, telefone, departamento,
--      cargo e jornada. Quem só é colaborador NÃO altera esses vínculos.
--   3. Amplia as solicitações de ajuste (o colaborador pede pelo app):
--      tipo da marcação, dia e período, com validações no banco.
--   4. Cria a função salvar_modelo_jornada (grava a jornada e seus dias de uma
--      só vez, sem risco de ficar pela metade).
--
-- Pode ser executada mais de uma vez sem problema.
-- Para desligar as regras novas: 2026-09-28_fase-2a_organizacao-jornadas_DESFAZER.sql
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 0. Só roda se as fases anteriores já estiverem no banco
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regprocedure('public.cnpj_valido(text)') is null
     or to_regclass('public.verificacoes_faciais') is null
     or to_regclass('public.ajustes_ponto') is null then
    raise exception 'As fases anteriores (0, 1 e 1.5) não foram encontradas neste banco. Nada foi alterado. Rode as fases anteriores primeiro.';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 1. Departamentos e cargos
-- ---------------------------------------------------------------------------
create table if not exists public.departamentos (
  id         uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  nome       text not null check (char_length(nome) between 2 and 80),
  descricao  text check (descricao is null or char_length(descricao) <= 300),
  ativo      boolean not null default true,
  criado_em  timestamptz not null default now()
);

create table if not exists public.cargos (
  id         uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  nome       text not null check (char_length(nome) between 2 and 80),
  descricao  text check (descricao is null or char_length(descricao) <= 300),
  ativo      boolean not null default true,
  criado_em  timestamptz not null default now()
);

create unique index if not exists departamentos_nome_unico on public.departamentos (empresa_id, lower(nome));
create unique index if not exists cargos_nome_unico        on public.cargos (empresa_id, lower(nome));

-- ---------------------------------------------------------------------------
-- 2. Modelos de jornada
--    Um modelo tem os 7 dias da semana (0 = domingo … 6 = sábado). Saída
--    menor que a entrada significa que o turno termina no dia seguinte.
-- ---------------------------------------------------------------------------
create or replace function public.minutos_previstos_dia(
  p_entrada time, p_saida time, p_intervalo_inicio time, p_intervalo_fim time
) returns integer
language sql immutable
set search_path = public
as $$
  select case when p_entrada is null or p_saida is null then 0 else
    ( (extract(epoch from (p_saida - p_entrada))::int / 60 + 1440) % 1440 )
    - case when p_intervalo_inicio is null or p_intervalo_fim is null then 0
           else ((extract(epoch from (p_intervalo_fim - p_intervalo_inicio))::int / 60 + 1440) % 1440) end
  end;
$$;

create table if not exists public.modelos_jornada (
  id                 uuid primary key default gen_random_uuid(),
  empresa_id         uuid not null references public.empresas(id) on delete cascade,
  nome               text not null check (char_length(nome) between 2 and 80),
  descricao          text check (descricao is null or char_length(descricao) <= 300),
  tolerancia_minutos integer not null default 10 check (tolerancia_minutos between 0 and 60),
  ativo              boolean not null default true,
  criado_em          timestamptz not null default now()
);
create unique index if not exists modelos_jornada_nome_unico on public.modelos_jornada (empresa_id, lower(nome));

create table if not exists public.modelos_jornada_dias (
  modelo_id        uuid not null references public.modelos_jornada(id) on delete cascade,
  dia_semana       smallint not null check (dia_semana between 0 and 6),
  trabalha         boolean not null default true,
  entrada          time,
  saida            time,
  intervalo_inicio time,
  intervalo_fim    time,
  primary key (modelo_id, dia_semana),
  constraint dia_folga_sem_horario check (
    trabalha or (entrada is null and saida is null and intervalo_inicio is null and intervalo_fim is null)),
  constraint dia_trabalho_completo check (
    not trabalha or (entrada is not null and saida is not null and entrada <> saida)),
  constraint dia_intervalo_par check (
    (intervalo_inicio is null) = (intervalo_fim is null)),
  constraint dia_intervalo_valido check (
    intervalo_inicio is null or intervalo_inicio <> intervalo_fim),
  constraint dia_carga_positiva check (
    not trabalha or public.minutos_previstos_dia(entrada, saida, intervalo_inicio, intervalo_fim) > 0)
);

-- ---------------------------------------------------------------------------
-- 3. Feriados (da empresa toda ou de uma unidade)
-- ---------------------------------------------------------------------------
create table if not exists public.feriados (
  id         uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  filial_id  uuid references public.filiais(id) on delete cascade,
  data       date not null,
  nome       text not null check (char_length(nome) between 2 and 80),
  tipo       text not null default 'nacional'
             check (tipo in ('nacional', 'estadual', 'municipal', 'facultativo', 'empresa')),
  criado_em  timestamptz not null default now()
);
create unique index if not exists feriados_unico
  on public.feriados (empresa_id, data, coalesce(filial_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(nome));
create index if not exists feriados_empresa_data_idx on public.feriados (empresa_id, data);

-- ---------------------------------------------------------------------------
-- 4. Cadastro das pessoas: campos e vínculos novos
-- ---------------------------------------------------------------------------
alter table public.perfis
  add column if not exists matricula          text check (matricula is null or char_length(matricula) <= 30),
  add column if not exists telefone           text check (telefone is null or telefone ~ '^[0-9]{10,11}$'),
  add column if not exists departamento_id    uuid references public.departamentos(id) on delete set null,
  add column if not exists cargo_id           uuid references public.cargos(id) on delete set null,
  add column if not exists modelo_jornada_id  uuid references public.modelos_jornada(id) on delete set null;

create unique index if not exists perfis_matricula_unica on public.perfis (empresa_id, lower(matricula)) where matricula is not null;
create index if not exists perfis_departamento_idx on public.perfis (departamento_id);
create index if not exists perfis_cargo_idx        on public.perfis (cargo_id);
create index if not exists perfis_jornada_idx      on public.perfis (modelo_jornada_id);

-- ---------------------------------------------------------------------------
-- 5. Solicitações de ajuste: campos novos
-- ---------------------------------------------------------------------------
alter table public.ajustes_ponto
  add column if not exists tipo_marcacao   public.tipo_marcacao,
  add column if not exists data_referencia date,
  add column if not exists data_fim        date;

create index if not exists ajustes_ponto_perfil_criado_idx on public.ajustes_ponto (perfil_id, criado_em desc);

-- ---------------------------------------------------------------------------
-- 6. Regras (gatilhos)
-- ---------------------------------------------------------------------------

-- 6.1 Nomes sem espaços sobrando
create or replace function public.normalizar_nome_cadastro()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.nome      := regexp_replace(btrim(new.nome), '\s+', ' ', 'g');
  new.descricao := nullif(btrim(new.descricao), '');
  return new;
end;
$$;

drop trigger if exists normalizar_nome on public.departamentos;
create trigger normalizar_nome before insert or update on public.departamentos
  for each row execute function public.normalizar_nome_cadastro();
drop trigger if exists normalizar_nome on public.cargos;
create trigger normalizar_nome before insert or update on public.cargos
  for each row execute function public.normalizar_nome_cadastro();
drop trigger if exists normalizar_nome on public.modelos_jornada;
create trigger normalizar_nome before insert or update on public.modelos_jornada
  for each row execute function public.normalizar_nome_cadastro();

-- 6.2 Não excluir departamento, cargo ou jornada que ainda tem gente.
--     (Desativar continua permitido.) O aviso "pg_trigger_depth" deixa passar
--     as exclusões em cascata feitas pelo próprio banco.
create or replace function public.bloquear_exclusao_em_uso()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_qtd integer;
begin
  if pg_trigger_depth() > 1 then
    return old;
  end if;
  execute format('select count(*) from public.perfis where %I = $1', tg_argv[0]) into v_qtd using old.id;
  if v_qtd > 0 then
    raise exception 'Há % pessoa(s) vinculada(s) a este cadastro. Desative-o em vez de excluir, ou troque o vínculo delas antes.', v_qtd;
  end if;
  return old;
end;
$$;

drop trigger if exists bloquear_exclusao on public.departamentos;
create trigger bloquear_exclusao before delete on public.departamentos
  for each row execute function public.bloquear_exclusao_em_uso('departamento_id');
drop trigger if exists bloquear_exclusao on public.cargos;
create trigger bloquear_exclusao before delete on public.cargos
  for each row execute function public.bloquear_exclusao_em_uso('cargo_id');
drop trigger if exists bloquear_exclusao on public.modelos_jornada;
create trigger bloquear_exclusao before delete on public.modelos_jornada
  for each row execute function public.bloquear_exclusao_em_uso('modelo_jornada_id');

-- 6.3 Feriado de unidade: a unidade precisa ser da mesma empresa
create or replace function public.validar_feriado()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.filial_id is not null and not exists (
       select 1 from filiais f where f.id = new.filial_id and f.empresa_id = new.empresa_id) then
    raise exception 'A unidade escolhida não pertence a esta empresa.';
  end if;
  new.nome := regexp_replace(btrim(new.nome), '\s+', ' ', 'g');
  return new;
end;
$$;

drop trigger if exists validar_feriado on public.feriados;
create trigger validar_feriado before insert or update on public.feriados
  for each row execute function public.validar_feriado();

-- 6.4 Cadastro da pessoa: vínculos sempre dentro da própria empresa
--     (vale para qualquer origem), matrícula e telefone padronizados e o
--     texto do cargo acompanhando o cargo escolhido.
create or replace function public.validar_vinculos_perfil()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.matricula := nullif(btrim(new.matricula), '');
  new.telefone  := nullif(regexp_replace(coalesce(new.telefone, ''), '\D', '', 'g'), '');

  if new.departamento_id is not null
     and (tg_op = 'INSERT' or new.departamento_id is distinct from old.departamento_id) then
    if not exists (select 1 from departamentos d
                    where d.id = new.departamento_id and d.empresa_id = new.empresa_id and d.ativo) then
      raise exception 'O departamento escolhido não pertence a esta empresa ou está desativado.';
    end if;
  end if;

  if new.modelo_jornada_id is not null
     and (tg_op = 'INSERT' or new.modelo_jornada_id is distinct from old.modelo_jornada_id) then
    if not exists (select 1 from modelos_jornada j
                    where j.id = new.modelo_jornada_id and j.empresa_id = new.empresa_id and j.ativo) then
      raise exception 'A jornada escolhida não pertence a esta empresa ou está desativada.';
    end if;
  end if;

  if tg_op = 'INSERT' then
    if new.cargo_id is not null then
      select c.nome into new.cargo from cargos c where c.id = new.cargo_id and c.empresa_id = new.empresa_id and c.ativo;
      if not found then
        raise exception 'O cargo escolhido não pertence a esta empresa ou está desativado.';
      end if;
    end if;
  elsif new.cargo_id is distinct from old.cargo_id then
    if new.cargo_id is null then
      new.cargo := null;
    else
      select c.nome into new.cargo from cargos c where c.id = new.cargo_id and c.empresa_id = new.empresa_id and c.ativo;
      if not found then
        raise exception 'O cargo escolhido não pertence a esta empresa ou está desativado.';
      end if;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists validar_vinculos_perfil on public.perfis;
create trigger validar_vinculos_perfil before insert or update on public.perfis
  for each row execute function public.validar_vinculos_perfil();

-- 6.5 Colaborador não altera o próprio departamento, cargo, jornada ou matrícula
create or replace function public.proteger_perfis_fase2()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  if old.id = auth.uid() and tipo_do_usuario() is distinct from 'administrador'
     and (new.matricula, new.departamento_id, new.cargo_id, new.modelo_jornada_id)
         is distinct from (old.matricula, old.departamento_id, old.cargo_id, old.modelo_jornada_id) then
    raise exception 'Esses dados só podem ser alterados pelo RH ou pelo administrador.';
  end if;
  return new;
end;
$$;

drop trigger if exists proteger_perfis_fase2 on public.perfis;
create trigger proteger_perfis_fase2 before update on public.perfis
  for each row execute function public.proteger_perfis_fase2();

-- 6.6 Pedido de ajuste: o que é obrigatório em cada tipo
--     (roda com as permissões de quem pede: cada pessoa só enxerga o que é seu)
create or replace function public.validar_ajuste()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_status status_funcionario;
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  select status into v_status from perfis where id = new.perfil_id;
  if v_status is null or v_status = 'desligado' then
    raise exception 'Não é possível abrir solicitações para este cadastro.';
  end if;

  new.motivo := btrim(new.motivo);
  if char_length(new.motivo) < 5 then
    raise exception 'Conte o motivo com um pouco mais de detalhe (mínimo de 5 letras).';
  end if;
  if char_length(new.motivo) > 500 then
    raise exception 'O motivo pode ter no máximo 500 caracteres.';
  end if;

  if (select count(*) from ajustes_ponto a where a.perfil_id = new.perfil_id and a.status = 'pendente') >= 20 then
    raise exception 'Você já tem 20 solicitações esperando análise. Aguarde a resposta do RH antes de abrir novas.';
  end if;

  if new.tipo in ('inclusao_esquecida', 'correcao_marcacao') then
    if new.marcacao_solicitada is null then
      raise exception 'Informe o dia e o horário da marcação.';
    end if;
    if new.marcacao_solicitada > now() + interval '5 minutes' then
      raise exception 'O horário informado ainda não aconteceu.';
    end if;
    if new.marcacao_solicitada < now() - interval '90 days' then
      raise exception 'Só é possível pedir ajuste de marcações dos últimos 90 dias. Fale com o RH.';
    end if;
    if new.tipo = 'inclusao_esquecida' and new.tipo_marcacao is null then
      raise exception 'Informe qual marcação foi esquecida (entrada, saída…).';
    end if;
    if new.tipo = 'correcao_marcacao' and new.registro_original_id is null then
      raise exception 'Escolha a marcação que precisa ser corrigida.';
    end if;
    new.data_referencia := null;
    new.data_fim := null;
  else
    if new.data_referencia is null then
      raise exception 'Informe o dia.';
    end if;
    if new.data_fim is not null and new.data_fim < new.data_referencia then
      raise exception 'O último dia não pode ser antes do primeiro.';
    end if;
    if new.data_fim is not null and new.data_fim > new.data_referencia + 60 then
      raise exception 'O período pode ter no máximo 60 dias.';
    end if;
    if new.data_referencia < current_date - 90 or new.data_referencia > current_date + 365 then
      raise exception 'O dia informado está fora do prazo permitido.';
    end if;
    new.marcacao_solicitada := null;
    new.tipo_marcacao := null;
  end if;

  return new;
end;
$$;

drop trigger if exists validar_ajuste on public.ajustes_ponto;
create trigger validar_ajuste before insert on public.ajustes_ponto
  for each row execute function public.validar_ajuste();

-- 6.7 Na análise, os campos novos também não mudam
create or replace function public.proteger_ajustes_fase2()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user in ('authenticated', 'anon')
     and (new.tipo_marcacao, new.data_referencia, new.data_fim)
         is distinct from (old.tipo_marcacao, old.data_referencia, old.data_fim) then
    raise exception 'Na análise, só a situação da solicitação pode ser alterada.';
  end if;
  return new;
end;
$$;

drop trigger if exists proteger_ajustes_fase2 on public.ajustes_ponto;
create trigger proteger_ajustes_fase2 before update on public.ajustes_ponto
  for each row execute function public.proteger_ajustes_fase2();

-- ---------------------------------------------------------------------------
-- 7. Quem vê e quem altera
--    Ver: qualquer pessoa da empresa. Criar, alterar e excluir: administrador
--    e RH da própria empresa.
-- ---------------------------------------------------------------------------
alter table public.departamentos        enable row level security;
alter table public.cargos               enable row level security;
alter table public.modelos_jornada      enable row level security;
alter table public.modelos_jornada_dias enable row level security;
alter table public.feriados             enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['departamentos', 'cargos', 'modelos_jornada', 'feriados'] loop
    execute format('drop policy if exists %I on public.%I', t || ': ver da empresa', t);
    execute format('drop policy if exists %I on public.%I', t || ': admin/rh criam', t);
    execute format('drop policy if exists %I on public.%I', t || ': admin/rh alteram', t);
    execute format('drop policy if exists %I on public.%I', t || ': admin/rh excluem', t);

    execute format($f$create policy %I on public.%I for select to authenticated
      using (empresa_id = (select public.empresa_do_usuario()))$f$, t || ': ver da empresa', t);
    execute format($f$create policy %I on public.%I for insert to authenticated
      with check (empresa_id = (select public.empresa_do_usuario())
                  and (select public.tipo_do_usuario()) in ('administrador', 'rh'))$f$, t || ': admin/rh criam', t);
    execute format($f$create policy %I on public.%I for update to authenticated
      using (empresa_id = (select public.empresa_do_usuario())
             and (select public.tipo_do_usuario()) in ('administrador', 'rh'))
      with check (empresa_id = (select public.empresa_do_usuario())
                  and (select public.tipo_do_usuario()) in ('administrador', 'rh'))$f$, t || ': admin/rh alteram', t);
    execute format($f$create policy %I on public.%I for delete to authenticated
      using (empresa_id = (select public.empresa_do_usuario())
             and (select public.tipo_do_usuario()) in ('administrador', 'rh'))$f$, t || ': admin/rh excluem', t);
  end loop;
end $$;

drop policy if exists "jornada dias: ver da empresa" on public.modelos_jornada_dias;
drop policy if exists "jornada dias: admin/rh criam" on public.modelos_jornada_dias;
drop policy if exists "jornada dias: admin/rh alteram" on public.modelos_jornada_dias;
drop policy if exists "jornada dias: admin/rh excluem" on public.modelos_jornada_dias;

create policy "jornada dias: ver da empresa" on public.modelos_jornada_dias
  for select to authenticated
  using (exists (select 1 from public.modelos_jornada m
                  where m.id = modelo_id and m.empresa_id = (select public.empresa_do_usuario())));
create policy "jornada dias: admin/rh criam" on public.modelos_jornada_dias
  for insert to authenticated
  with check ((select public.tipo_do_usuario()) in ('administrador', 'rh')
              and exists (select 1 from public.modelos_jornada m
                           where m.id = modelo_id and m.empresa_id = (select public.empresa_do_usuario())));
create policy "jornada dias: admin/rh alteram" on public.modelos_jornada_dias
  for update to authenticated
  using ((select public.tipo_do_usuario()) in ('administrador', 'rh')
         and exists (select 1 from public.modelos_jornada m
                      where m.id = modelo_id and m.empresa_id = (select public.empresa_do_usuario())))
  with check ((select public.tipo_do_usuario()) in ('administrador', 'rh')
              and exists (select 1 from public.modelos_jornada m
                           where m.id = modelo_id and m.empresa_id = (select public.empresa_do_usuario())));
create policy "jornada dias: admin/rh excluem" on public.modelos_jornada_dias
  for delete to authenticated
  using ((select public.tipo_do_usuario()) in ('administrador', 'rh')
         and exists (select 1 from public.modelos_jornada m
                      where m.id = modelo_id and m.empresa_id = (select public.empresa_do_usuario())));

-- ---------------------------------------------------------------------------
-- 8. Salvar uma jornada com todos os dias de uma vez
--    p_dias: lista com um item por dia, por exemplo
--    {"dia_semana":1,"trabalha":true,"entrada":"09:00","saida":"18:00",
--     "intervalo_inicio":"12:00","intervalo_fim":"13:00"}
--    Roda com as permissões de quem chama (só administrador e RH conseguem).
-- ---------------------------------------------------------------------------
create or replace function public.salvar_modelo_jornada(
  p_id uuid,
  p_nome text,
  p_descricao text,
  p_tolerancia integer,
  p_ativo boolean,
  p_dias jsonb
) returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_empresa uuid := empresa_do_usuario();
  v_id      uuid;
  v_dia     jsonb;
begin
  if auth.uid() is null or v_empresa is null then
    raise exception 'Entre na sua conta para continuar.';
  end if;
  if p_dias is null or jsonb_typeof(p_dias) <> 'array' or jsonb_array_length(p_dias) = 0 then
    raise exception 'Informe os dias da semana da jornada.';
  end if;

  if p_id is null then
    insert into modelos_jornada (empresa_id, nome, descricao, tolerancia_minutos, ativo)
    values (v_empresa, p_nome, p_descricao, coalesce(p_tolerancia, 10), coalesce(p_ativo, true))
    returning id into v_id;
  else
    update modelos_jornada
       set nome = p_nome, descricao = p_descricao,
           tolerancia_minutos = coalesce(p_tolerancia, 10), ativo = coalesce(p_ativo, true)
     where id = p_id and empresa_id = v_empresa
    returning id into v_id;
    if v_id is null then
      raise exception 'Jornada não encontrada ou sem permissão para alterá-la.';
    end if;
    delete from modelos_jornada_dias where modelo_id = v_id;
  end if;

  for v_dia in select * from jsonb_array_elements(p_dias) loop
    insert into modelos_jornada_dias (modelo_id, dia_semana, trabalha, entrada, saida, intervalo_inicio, intervalo_fim)
    values (
      v_id,
      (v_dia->>'dia_semana')::smallint,
      coalesce((v_dia->>'trabalha')::boolean, false),
      nullif(v_dia->>'entrada', '')::time,
      nullif(v_dia->>'saida', '')::time,
      nullif(v_dia->>'intervalo_inicio', '')::time,
      nullif(v_dia->>'intervalo_fim', '')::time
    );
  end loop;

  if not exists (select 1 from modelos_jornada_dias where modelo_id = v_id and trabalha) then
    raise exception 'Marque pelo menos um dia de trabalho.';
  end if;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 9. Permissões de execução
-- ---------------------------------------------------------------------------
revoke all on public.departamentos, public.cargos, public.modelos_jornada,
              public.modelos_jornada_dias, public.feriados from anon;

revoke execute on function public.salvar_modelo_jornada(uuid, text, text, integer, boolean, jsonb) from public, anon;
grant  execute on function public.salvar_modelo_jornada(uuid, text, text, integer, boolean, jsonb) to authenticated;

revoke execute on function public.normalizar_nome_cadastro()   from public, anon, authenticated;
revoke execute on function public.bloquear_exclusao_em_uso()   from public, anon, authenticated;
revoke execute on function public.validar_feriado()            from public, anon, authenticated;
revoke execute on function public.validar_vinculos_perfil()    from public, anon, authenticated;
revoke execute on function public.proteger_perfis_fase2()      from public, anon, authenticated;
revoke execute on function public.validar_ajuste()             from public, anon, authenticated;
revoke execute on function public.proteger_ajustes_fase2()     from public, anon, authenticated;

-- Avisa a API do Supabase que o banco mudou (para enxergar as tabelas e a função nova na hora)
notify pgrst, 'reload schema';
