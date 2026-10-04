-- ============================================================================
-- Ayra Ponto — DESFAZER da Fase 4A
-- Remove a contagem dos primeiros passos e as anotações de "já vi"
-- (boas-vindas e lista escondida). Nenhum dado de ponto, cadastro ou pedido é
-- tocado. Depois disso, a tela Hoje volta a mostrar a lista simples e as
-- boas-vindas podem aparecer de novo.
-- Para ligar de novo, rode 2026-10-04_fase-4a_primeiros-passos.sql.
-- ============================================================================
drop function if exists public.primeiros_passos();
drop table if exists public.marcos_usuario;
drop function if exists public.limitar_marcos();

notify pgrst, 'reload schema';
