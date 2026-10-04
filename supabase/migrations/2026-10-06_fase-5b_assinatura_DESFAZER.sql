-- ============================================================================
-- Ayra Ponto — DESFAZER da Fase 5B
-- Tira a função que monta os dados do comprovante. O cofre "certificados" e o
-- certificado guardado nele NÃO são apagados (apague pelo painel do Storage, se
-- quiser). A Edge Function "assinar" é desligada pelo painel (Edge Functions).
-- ============================================================================
drop function if exists public.dados_comprovante(uuid);
notify pgrst, 'reload schema';
