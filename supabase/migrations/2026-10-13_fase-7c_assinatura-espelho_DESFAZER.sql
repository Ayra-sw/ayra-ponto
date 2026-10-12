-- ============================================================================
-- Ayra Ponto — DESFAZ a Fase 7C (o colaborador confere e assina o espelho)
--
-- Tira as funções de assinar e lembrar, e os avisos automáticos.
-- As assinaturas já feitas ficam guardadas na tabela, sem uso.
-- Nenhuma marcação, pedido ou cálculo é alterado.
-- ============================================================================

drop trigger if exists conferencia_ao_fechar on public.fechamento_espelhos;
drop trigger if exists conferencias_ao_reabrir on public.fechamentos;
drop trigger if exists problema_no_espelho on public.ajustes_ponto;
drop function if exists public.conferencia_ao_fechar();
drop function if exists public.conferencias_ao_reabrir();
drop function if exists public.problema_no_espelho();
drop function if exists public.assinar_espelho(date, text);
drop function if exists public.minhas_conferencias();
drop function if exists public.lembrar_assinaturas(date);
drop function if exists public.confirmacao_recente(integer);

-- avisos: volta aos tipos de antes (os avisos de espelho saem)
delete from public.avisos where tipo in ('espelho_para_assinar', 'espelho_com_problema');
alter table public.avisos drop constraint if exists avisos_tipo_check;
alter table public.avisos add constraint avisos_tipo_check check (tipo in (
  'pedido_novo', 'pedido_respondido', 'dia_incompleto', 'banco_vencendo', 'pessoa_nova', 'foto_para_aprovar', 'foto_analisada'));

notify pgrst, 'reload schema';
