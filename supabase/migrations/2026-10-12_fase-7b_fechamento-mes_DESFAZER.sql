-- ============================================================================
-- Ayra Ponto — DESFAZ a Fase 7B (fechar o mês)
--
-- Tira as travas de mês fechado e as funções de fechar e reabrir.
-- As tabelas (fechamentos e as fotos dos espelhos) ficam guardadas, sem uso.
-- Nenhuma marcação, pedido ou cálculo é alterado.
-- ============================================================================

drop trigger if exists trava_mes_fechado on public.ajustes_ponto;
drop trigger if exists trava_mes_fechado on public.afastamentos;
drop trigger if exists trava_mes_fechado on public.banco_horas_lancamentos;
drop trigger if exists trava_mes_fechado on public.escala_dias;
drop trigger if exists trava_mes_fechado on public.feriados;
drop function if exists public.trava_mes_ajuste();
drop function if exists public.trava_mes_periodo();
drop function if exists public.fechar_mes(date, boolean);
drop function if exists public.reabrir_mes(date, text);
drop function if exists public.pendencias_fechamento(date);
drop function if exists public.planilha_fechamento(date);
drop function if exists public.pessoas_do_fechamento(uuid, date);
drop function if exists public.checar_mes_aberto(uuid, date, date);

notify pgrst, 'reload schema';
