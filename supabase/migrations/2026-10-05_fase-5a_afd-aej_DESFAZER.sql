-- ============================================================================
-- Ayra Ponto — DESFAZER da Fase 5A
-- Para de gravar novas linhas do AFD e tira as funções que geram o AFD e o AEJ.
-- NÃO apaga nada: as linhas do AFD já gravadas continuam guardadas (são
-- registros legais). Ao rodar a Fase 5A de novo, as marcações feitas nesse
-- meio-tempo ganham a linha que faltou, na ordem do NSR.
-- A correção do histórico e a conferência da corrente continuam valendo.
-- ============================================================================
drop trigger if exists afd_marcacao on public.registros_ponto;
drop trigger if exists afd_filial   on public.filiais;
drop trigger if exists afd_empresa  on public.empresas;
drop trigger if exists afd_pessoa   on public.perfis;
drop function if exists public.gerar_afd(uuid, date, date);
drop function if exists public.gerar_aej(uuid, date, date);

notify pgrst, 'reload schema';
