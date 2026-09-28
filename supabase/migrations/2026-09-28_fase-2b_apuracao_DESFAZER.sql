-- ============================================================================
-- Ayra Ponto — DESFAZER da Fase 2B
--
-- Remove as duas funções de cálculo (apurar_periodo e resumo_equipe). Não
-- apaga tabela, coluna nem dado: as marcações e os ajustes continuam
-- exatamente como estão. Para instalar de novo, rode outra vez a migração
-- 2026-09-28_fase-2b_apuracao.sql.
-- ============================================================================
drop function if exists public.resumo_equipe(date, date, uuid);
drop function if exists public.apurar_periodo(uuid, date, date);
notify pgrst, 'reload schema';
