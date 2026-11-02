-- ============================================================================
-- Ayra Ponto — Bloqueio de ponto fora da cerca virtual (opcional por empresa)
--
-- O que esta migração faz (nenhuma marcação existente é alterada):
--   1. empresas ganha a chave "bloquear_fora_cerca" (desligada por padrão).
--      Só o administrador liga ou desliga, em Configurações > Empresa.
--   2. perfis ganha "trabalho_externo" (desligado por padrão). Quem está
--      marcado como trabalho externo nunca é bloqueado: continua só com o
--      selo "Fora do local". Só o administrador e o RH alteram.
--   3. Antes de cada marcação feita pela própria pessoa, o banco confere:
--      com a chave ligada, numa unidade que tem cerca, e sem trabalho
--      externo, a marcação só entra se a pessoa estiver dentro do raio.
--      Sem localização, também não entra.
--      Unidades sem cerca nunca bloqueiam.
--   4. conferir_local_ponto(): a tela pergunta antes de abrir a câmera do
--      reconhecimento facial, para ninguém tirar a selfie à toa.
--
-- Sobre a Portaria 671: o art. 74 proíbe restrições de HORÁRIO à marcação.
-- Esta regra é de LOCAL, fica desligada por padrão e cada empresa decide.
-- Recomendação: a empresa ligar só com orientação do seu jurídico.
--
-- Pode ser executada mais de uma vez sem problema.
-- Para desligar: 2026-11-02_bloqueio-cerca_DESFAZER.sql
-- ============================================================================

do $$
begin
  if to_regclass('public.marcacao_local') is null
     or to_regprocedure('public.distancia_metros(numeric, numeric, numeric, numeric)') is null then
    raise exception 'Antes desta migração é preciso aplicar a Fase 6A (cerca virtual). Nada foi alterado.';
  end if;
end $$;

begin;

-- ---------------------------------------------------------------------------
-- 1 e 2. As duas chaves
-- ---------------------------------------------------------------------------
alter table public.empresas add column if not exists bloquear_fora_cerca boolean not null default false;
alter table public.perfis   add column if not exists trabalho_externo    boolean not null default false;

-- Só administrador e RH mexem no "trabalho externo".
-- O RH não altera o próprio cadastro nem o de um administrador.
create or replace function public.proteger_trabalho_externo()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_tipo tipo_perfil;
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  if new.trabalho_externo is not distinct from old.trabalho_externo then
    return new;
  end if;
  v_tipo := tipo_do_usuario();
  if v_tipo = 'administrador' then
    return new;
  end if;
  if v_tipo = 'rh' and old.id <> auth.uid() and old.tipo <> 'administrador' then
    return new;
  end if;
  raise exception 'O trabalho externo só pode ser alterado pelo RH ou pelo administrador.';
end;
$$;

drop trigger if exists proteger_trabalho_externo on public.perfis;
create trigger proteger_trabalho_externo before update on public.perfis
  for each row execute function public.proteger_trabalho_externo();

-- ---------------------------------------------------------------------------
-- 3. A regra (uma só, usada pelo gatilho e pela conferência da tela)
--    Devolve NULO quando pode marcar, ou a mensagem para a pessoa.
-- ---------------------------------------------------------------------------
create or replace function public.texto_distancia(p_metros integer)
returns text
language sql immutable
as $$
  select case
    when p_metros is null then ''
    when p_metros < 1000 then p_metros::text || ' m'
    else replace(to_char(p_metros / 1000.0, 'FM999990.0'), '.', ',') || ' km'
  end;
$$;

create or replace function public.motivo_bloqueio_cerca(
  p_perfil_id uuid, p_filial_id uuid, p_latitude numeric, p_longitude numeric)
returns text
language plpgsql stable security definer
set search_path = public
as $$
declare
  v_bloqueia boolean;
  v_externo  boolean;
  v_filial   filiais;
  v_dist     integer;
begin
  select e.bloquear_fora_cerca, p.trabalho_externo
    into v_bloqueia, v_externo
    from perfis p
    join empresas e on e.id = p.empresa_id
   where p.id = p_perfil_id;

  if not coalesce(v_bloqueia, false) or coalesce(v_externo, false) then
    return null;
  end if;

  select * into v_filial from filiais where id = p_filial_id;
  if v_filial.id is null or v_filial.latitude is null or v_filial.longitude is null then
    return null; -- unidade sem cerca: nunca bloqueia
  end if;

  if p_latitude is null or p_longitude is null then
    return 'Sua empresa só permite bater o ponto no local de trabalho, e não conseguimos ver onde você está. '
        || 'Ligue a localização do celular, permita o acesso para o Ayra Ponto e tente de novo.';
  end if;

  v_dist := distancia_metros(p_latitude, p_longitude, v_filial.latitude, v_filial.longitude);
  if v_dist > v_filial.raio_cerca_m then
    return 'Você está a cerca de ' || texto_distancia(v_dist) || ' da unidade ' || v_filial.nome
        || ', fora da área onde sua empresa permite bater o ponto. '
        || 'Chegando ao local, tente de novo. Se estiver em trabalho externo, fale com o RH.';
  end if;

  return null;
end;
$$;

-- Gatilho: só vale quando a própria pessoa registra o ponto.
-- Rotinas do sistema (sem usuário logado) passam direto.
create or replace function public.bloquear_ponto_fora_cerca()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  v_motivo text;
begin
  if auth.uid() is null or new.perfil_id is distinct from auth.uid() then
    return new;
  end if;
  v_motivo := motivo_bloqueio_cerca(new.perfil_id, new.filial_id, new.latitude, new.longitude);
  if v_motivo is not null then
    raise exception '%', v_motivo;
  end if;
  return new;
end;
$$;

drop trigger if exists bloquear_ponto_fora_cerca on public.registros_ponto;
create trigger bloquear_ponto_fora_cerca before insert on public.registros_ponto
  for each row execute function public.bloquear_ponto_fora_cerca();

-- ---------------------------------------------------------------------------
-- 4. Conferência pela tela (antes da câmera do reconhecimento facial)
-- ---------------------------------------------------------------------------
create or replace function public.conferir_local_ponto(
  p_latitude numeric default null, p_longitude numeric default null)
returns text
language sql stable security definer
set search_path = public
as $$
  select motivo_bloqueio_cerca(p.id, p.filial_id, p_latitude, p_longitude)
    from perfis p
   where p.id = auth.uid();
$$;

revoke execute on function public.motivo_bloqueio_cerca(uuid, uuid, numeric, numeric) from public, anon, authenticated;
revoke execute on function public.bloquear_ponto_fora_cerca() from public, anon, authenticated;
revoke execute on function public.proteger_trabalho_externo() from public, anon, authenticated;
revoke execute on function public.conferir_local_ponto(numeric, numeric) from public, anon;
grant  execute on function public.conferir_local_ponto(numeric, numeric) to authenticated;
grant  execute on function public.texto_distancia(integer) to authenticated;

commit;

notify pgrst, 'reload schema';

-- Pronto. Rode em seguida supabase/testes/conferencia-bloqueio-cerca.sql.
