-- ============================================================================
-- Ayra Ponto — DESFAZ a Fase 7A (regras de cálculo)
--
-- Tira as contas da folha do espelho (ele volta a ser o da Fase 3B).
-- A tabela regras_calculo fica guardada, sem uso: ao instalar a 7A de novo,
-- as regras que a empresa escolheu voltam como estavam.
-- Nenhuma marcação, pedido ou cálculo antigo é alterado.
-- ============================================================================

drop function if exists public.apurar_clt(uuid, date, date);
drop function if exists public.regras_da_empresa(uuid);
drop trigger if exists regras_calculo_carimbo on public.regras_calculo;
drop trigger if exists historico on public.regras_calculo;
drop function if exists public.regras_calculo_carimbo();

notify pgrst, 'reload schema';
