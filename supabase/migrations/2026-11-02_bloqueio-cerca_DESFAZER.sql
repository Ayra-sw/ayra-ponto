-- Desfaz o bloqueio de ponto fora da cerca.
-- Depois disto, a cerca volta a ser só um aviso para todas as empresas.
-- As colunas bloquear_fora_cerca e trabalho_externo ficam guardadas
-- (sem efeito), para não perder o que cada empresa configurou.

begin;
drop trigger if exists bloquear_ponto_fora_cerca on public.registros_ponto;
drop trigger if exists proteger_trabalho_externo on public.perfis;
drop function if exists public.conferir_local_ponto(numeric, numeric);
drop function if exists public.bloquear_ponto_fora_cerca();
drop function if exists public.motivo_bloqueio_cerca(uuid, uuid, numeric, numeric);
drop function if exists public.proteger_trabalho_externo();
drop function if exists public.texto_distancia(integer);
commit;

notify pgrst, 'reload schema';
