-- ============================================================================
-- Ayra Ponto — DESFAZ a Fase 6A (geolocalização)
--
-- Para de conferir o local das marcações novas. A tabela marcacao_local e as
-- colunas da unidade (latitude, longitude, raio) ficam guardadas, sem uso:
-- ao instalar a 6A de novo, tudo volta como estava.
-- Nenhuma marcação é alterada ou apagada.
-- A correção do código de integridade (formato da coordenada) é mantida: ela
-- só faz a conferência acertar e não muda nenhuma marcação já registrada.
-- ============================================================================

drop trigger if exists marcacao_local_registrar on public.registros_ponto;
drop function if exists public.marcacao_local_registrar();

notify pgrst, 'reload schema';
