-- ============================================================================
-- Ayra Ponto — Fase 4A: primeiros passos e boas-vindas
--
-- O que esta migração faz (tudo é ACRESCENTADO; nenhum dado existente é
-- alterado ou apagado):
--   1. marcos_usuario: anota o que cada pessoa já viu ou dispensou, para não
--      repetir (boas-vindas do colaborador, lista de primeiros passos
--      escondida). Cada pessoa vê e mexe só nas próprias anotações, e elas
--      valem em qualquer aparelho.
--   2. primeiros_passos(): conta, numa consulta só, o que a empresa já
--      configurou (unidade, jornada, feriados, departamentos, equipe, jornada
--      de cada pessoa e primeira marcação). Só o administrador e o RH usam.
--
-- Pode ser executada mais de uma vez sem problema.
-- Para desligar: 2026-10-04_fase-4a_primeiros-passos_DESFAZER.sql
-- ============================================================================

do $$
begin
  if to_regclass('public.avisos') is null or to_regclass('public.historico_alteracoes') is null then
    raise exception 'Antes desta migração é preciso aplicar a Fase 3C.';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 1. Marcos de cada pessoa
-- ---------------------------------------------------------------------------
create table if not exists public.marcos_usuario (
  perfil_id  uuid not null references public.perfis(id) on delete cascade,
  chave      text not null check (chave ~ '^[a-z0-9_:.-]{1,60}$'),
  em         timestamptz not null default now(),
  primary key (perfil_id, chave)
);

comment on table public.marcos_usuario is
  'O que cada pessoa já viu ou dispensou (boas-vindas, primeiros passos). Cada um mexe só nos seus.';

alter table public.marcos_usuario enable row level security;

drop policy if exists marcos_ver on public.marcos_usuario;
create policy marcos_ver on public.marcos_usuario
  for select to authenticated using (perfil_id = (select auth.uid()));

drop policy if exists marcos_criar on public.marcos_usuario;
create policy marcos_criar on public.marcos_usuario
  for insert to authenticated with check (perfil_id = (select auth.uid()));

drop policy if exists marcos_apagar on public.marcos_usuario;
create policy marcos_apagar on public.marcos_usuario
  for delete to authenticated using (perfil_id = (select auth.uid()));

revoke all on public.marcos_usuario from anon;
revoke update on public.marcos_usuario from authenticated;
grant select, insert, delete on public.marcos_usuario to authenticated;

-- Ninguém guarda mais de 50 anotações (proteção contra abuso)
create or replace function public.limitar_marcos()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select count(*) from marcos_usuario where perfil_id = new.perfil_id) >= 50 then
    raise exception 'Limite de anotações atingido.';
  end if;
  return new;
end $$;
revoke execute on function public.limitar_marcos() from public, anon, authenticated;

drop trigger if exists limitar_marcos on public.marcos_usuario;
create trigger limitar_marcos before insert on public.marcos_usuario
  for each row execute function public.limitar_marcos();

-- ---------------------------------------------------------------------------
-- 2. O que a empresa já configurou
--    Roda com as permissões de quem chama (as regras de acesso valem).
--    Colaborador ou visitante recebe vazio.
-- ---------------------------------------------------------------------------
create or replace function public.primeiros_passos()
returns jsonb
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_empresa uuid := (select empresa_do_usuario());
  v_tipo    text := (select tipo_do_usuario())::text;
  v_ano     int  := extract(year from (now() at time zone 'America/Sao_Paulo'))::int;
begin
  if v_empresa is null or v_tipo is null or v_tipo not in ('administrador', 'rh') then
    return null;
  end if;

  return jsonb_build_object(
    'unidade_com_endereco', exists (select 1 from filiais f where f.empresa_id = v_empresa and f.ativa and coalesce(f.cidade, '') <> ''),
    'jornadas',             (select count(*) from modelos_jornada m where m.empresa_id = v_empresa and m.ativo),
    'feriados_do_ano',      (select count(*) from feriados h where h.empresa_id = v_empresa and extract(year from h.data) = v_ano),
    'departamentos',        (select count(*) from departamentos d where d.empresa_id = v_empresa and d.ativo),
    'pessoas',              (select count(*) from perfis p where p.empresa_id = v_empresa and p.status <> 'desligado'),
    'sem_jornada',          (select count(*) from perfis p
                              where p.empresa_id = v_empresa and p.status <> 'desligado'
                                and coalesce(p.tipo_escala, 'semanal') = 'semanal' and p.modelo_jornada_id is null),
    'tem_marcacao',         exists (select 1 from registros_ponto r join filiais f on f.id = r.filial_id where f.empresa_id = v_empresa)
  );
end $$;

comment on function public.primeiros_passos() is
  'Contagens dos primeiros passos da empresa (administrador e RH). Usada na lista da tela Hoje.';

revoke execute on function public.primeiros_passos() from public, anon;
grant  execute on function public.primeiros_passos() to authenticated;

notify pgrst, 'reload schema';
