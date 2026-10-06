-- ============================================================================
-- Ayra Ponto — Fase 6A: geolocalização (cerca virtual por unidade)
--
-- O que esta migração faz (nenhuma marcação existente é alterada):
--   1. filiais ganha o ponto do local (latitude e longitude) e o raio da
--      cerca virtual em metros (padrão 200; de 50 m a 5 km).
--   2. distancia_metros(): distância entre dois pontos da Terra (fórmula de
--      haversine), em metros.
--   3. marcacao_local: para cada marcação feita numa unidade que tem cerca,
--      guarda "dentro", "fora" (com a distância) ou "sem localização". É uma
--      foto do momento da marcação: se a unidade mudar de lugar depois, as
--      marcações antigas continuam contando como eram.
--   4. Um gatilho preenche a marcacao_local logo depois de cada marcação.
--      A cerca NUNCA bloqueia o ponto (Portaria 671): se algo der errado
--      aqui, a marcação é registrada do mesmo jeito.
--   5. Quem vê: a própria pessoa, o administrador e o RH da empresa.
--   6. Pequena correção no código de integridade das marcações com
--      localização: a coordenada passa a entrar no cálculo sempre no mesmo
--      formato (6 casas, sem zeros sobrando). Antes, uma coordenada como
--      -23.550120 era calculada como "-23.55012" ao marcar e conferida como
--      "-23.550120" depois, e a conferência acusava diferença sem haver
--      problema nenhum. Para as marcações já registradas nada muda.
--
-- Pode ser executada mais de uma vez sem problema.
-- Para desligar: 2026-10-08_fase-6a_geolocalizacao_DESFAZER.sql
-- ============================================================================

do $$
begin
  if to_regprocedure('public.empresa_do_usuario()') is null
     or to_regclass('public.registros_ponto') is null
     or to_regclass('public.filiais') is null then
    raise exception 'A estrutura do banco é diferente da esperada. Nada foi alterado. Fale com o Claude antes de continuar.';
  end if;
  if to_regclass('public.fila_comprovantes_email') is null then
    raise exception 'Antes desta migração é preciso aplicar a Fase 5C.';
  end if;
end $$;

begin;

-- ---------------------------------------------------------------------------
-- 1. O local de cada unidade
-- ---------------------------------------------------------------------------
alter table public.filiais add column if not exists latitude     numeric(9,6);
alter table public.filiais add column if not exists longitude    numeric(9,6);
alter table public.filiais add column if not exists raio_cerca_m integer not null default 200;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'filiais_local_valido' and conrelid = 'public.filiais'::regclass) then
    alter table public.filiais add constraint filiais_local_valido check (
      (latitude is null) = (longitude is null)
      and (latitude  is null or latitude  between -90  and 90)
      and (longitude is null or longitude between -180 and 180));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'filiais_raio_cerca_valido' and conrelid = 'public.filiais'::regclass) then
    alter table public.filiais add constraint filiais_raio_cerca_valido check (raio_cerca_m between 50 and 5000);
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Distância entre dois pontos (haversine), em metros
-- ---------------------------------------------------------------------------
create or replace function public.distancia_metros(
  p_lat1 numeric, p_lon1 numeric, p_lat2 numeric, p_lon2 numeric)
returns integer
language sql immutable parallel safe
set search_path = public
as $$
  select case
    when p_lat1 is null or p_lon1 is null or p_lat2 is null or p_lon2 is null then null
    else round(2 * 6371008.8 * asin(least(1.0, sqrt(
           power(sin(radians((p_lat2 - p_lat1)::double precision) / 2), 2)
           + cos(radians(p_lat1::double precision)) * cos(radians(p_lat2::double precision))
             * power(sin(radians((p_lon2 - p_lon1)::double precision) / 2), 2)))))::numeric
  end::integer;
$$;

-- ---------------------------------------------------------------------------
-- 3. A foto do local de cada marcação
-- ---------------------------------------------------------------------------
create table if not exists public.marcacao_local (
  registro_id      uuid primary key references public.registros_ponto(id) on delete cascade,
  empresa_id       uuid not null references public.empresas(id),
  perfil_id        uuid not null references public.perfis(id),
  filial_id        uuid not null references public.filiais(id),
  situacao         text not null,
  distancia_m      integer,
  raio_m           integer not null,
  filial_latitude  numeric(9,6) not null,
  filial_longitude numeric(9,6) not null,
  criado_em        timestamptz not null default now(),
  constraint marcacao_local_situacao_valida check (situacao in ('dentro', 'fora', 'sem_localizacao'))
);
create index if not exists marcacao_local_empresa_idx on public.marcacao_local (empresa_id, situacao);
create index if not exists marcacao_local_perfil_idx  on public.marcacao_local (perfil_id);

alter table public.marcacao_local enable row level security;

drop policy if exists "marcacao_local: a própria pessoa vê" on public.marcacao_local;
create policy "marcacao_local: a própria pessoa vê" on public.marcacao_local
  for select to authenticated
  using (perfil_id = (select auth.uid()));

drop policy if exists "marcacao_local: admin/rh veem a empresa" on public.marcacao_local;
create policy "marcacao_local: admin/rh veem a empresa" on public.marcacao_local
  for select to authenticated
  using (empresa_id = (select public.empresa_do_usuario())
         and (select public.tipo_do_usuario()) in ('administrador', 'rh'));

-- ninguém grava pelo app: só o gatilho (dono do banco)
revoke all on public.marcacao_local from public, anon, authenticated;
grant select on public.marcacao_local to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Gatilho: depois de cada marcação, confere o local
--    Só entra na tabela se a unidade tem cerca (latitude e longitude).
--    Qualquer erro aqui é engolido: o ponto nunca deixa de ser registrado.
-- ---------------------------------------------------------------------------
create or replace function public.marcacao_local_registrar()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  v_filial filiais;
  v_dist   integer;
  v_perfil perfis;
begin
  begin
    select * into v_filial from filiais where id = new.filial_id;
    if v_filial.id is null or v_filial.latitude is null or v_filial.longitude is null then
      return null;
    end if;
    select * into v_perfil from perfis where id = new.perfil_id;
    if v_perfil.id is null then
      return null;
    end if;

    v_dist := distancia_metros(new.latitude, new.longitude, v_filial.latitude, v_filial.longitude);

    insert into marcacao_local
      (registro_id, empresa_id, perfil_id, filial_id, situacao, distancia_m, raio_m, filial_latitude, filial_longitude)
    values
      (new.id, v_perfil.empresa_id, new.perfil_id, new.filial_id,
       case when v_dist is null then 'sem_localizacao'
            when v_dist <= v_filial.raio_cerca_m then 'dentro'
            else 'fora' end,
       v_dist, v_filial.raio_cerca_m, v_filial.latitude, v_filial.longitude)
    on conflict (registro_id) do nothing;
  exception when others then
    -- a cerca é só um aviso: nunca atrapalha o registro do ponto
    null;
  end;
  return null;
end;
$$;

drop trigger if exists marcacao_local_registrar on public.registros_ponto;
create trigger marcacao_local_registrar after insert on public.registros_ponto
  for each row execute function public.marcacao_local_registrar();

revoke execute on function public.marcacao_local_registrar() from public, anon, authenticated;
grant  execute on function public.distancia_metros(numeric, numeric, numeric, numeric) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Código de integridade: coordenada sempre no mesmo formato
--    (mesmo texto na hora de marcar e na hora de conferir)
-- ---------------------------------------------------------------------------
create or replace function public.texto_hash_marcacao(
  p_filial_id uuid, p_nsr bigint, p_perfil_id uuid, p_tipo tipo_marcacao,
  p_marcado_em timestamptz, p_origem origem_marcacao, p_latitude numeric, p_longitude numeric,
  p_hash_evidencia text, p_hash_anterior text)
returns text
language sql immutable
set search_path = public
as $$
  select 'ayra-v2'
    || '|' || p_filial_id::text
    || '|' || p_nsr::text
    || '|' || p_perfil_id::text
    || '|' || p_tipo::text
    || '|' || to_char(p_marcado_em at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
    || '|' || p_origem::text
    || '|' || coalesce(trim_scale(round(p_latitude, 6))::text, '')
    || '|' || coalesce(trim_scale(round(p_longitude, 6))::text, '')
    || '|' || coalesce(p_hash_evidencia, '')
    || '|' || coalesce(p_hash_anterior, '');
$$;

commit;

notify pgrst, 'reload schema';

-- Pronto. Rode em seguida supabase/testes/conferencia-fase-6a.sql.
