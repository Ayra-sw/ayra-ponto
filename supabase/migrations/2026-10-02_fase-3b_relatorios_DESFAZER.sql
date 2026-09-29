-- ============================================================================
-- Ayra Ponto — DESFAZER da Fase 3B
-- Remove as funções de relatório. Nenhum dado é apagado (os relatórios não
-- guardam nada). O cálculo mais rápido das horas continua (o resultado é o mesmo).
-- Para ligar de novo, rode 2026-10-02_fase-3b_relatorios.sql.
-- ============================================================================
drop function if exists public.relatorio_marcacoes(date, date, uuid, boolean);
drop function if exists public.relatorio_banco_horas(date, uuid, boolean);
drop function if exists public.relatorio_frequencia(date, date, uuid, boolean);
drop function if exists public.pessoas_do_relatorio(uuid, boolean);

notify pgrst, 'reload schema';
