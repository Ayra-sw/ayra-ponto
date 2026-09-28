-- ============================================================================
-- Ayra Ponto — DESFAZER da Fase 2A
--
-- Desliga as REGRAS novas da Fase 2A (validações, proteções e a função de
-- salvar jornada). NÃO apaga nenhuma tabela, coluna nem dado: departamentos,
-- cargos, jornadas, feriados e os campos novos das pessoas e das solicitações
-- continuam guardados. Para ligar as regras de novo, rode outra vez a
-- migração 2026-09-28_fase-2a_organizacao-jornadas.sql.
-- ============================================================================
drop trigger if exists normalizar_nome         on public.departamentos;
drop trigger if exists normalizar_nome         on public.cargos;
drop trigger if exists normalizar_nome         on public.modelos_jornada;
drop trigger if exists bloquear_exclusao       on public.departamentos;
drop trigger if exists bloquear_exclusao       on public.cargos;
drop trigger if exists bloquear_exclusao       on public.modelos_jornada;
drop trigger if exists validar_feriado         on public.feriados;
drop trigger if exists validar_vinculos_perfil on public.perfis;
drop trigger if exists proteger_perfis_fase2   on public.perfis;
drop trigger if exists validar_ajuste          on public.ajustes_ponto;
drop trigger if exists proteger_ajustes_fase2  on public.ajustes_ponto;

drop function if exists public.normalizar_nome_cadastro();
drop function if exists public.bloquear_exclusao_em_uso();
drop function if exists public.validar_feriado();
drop function if exists public.validar_vinculos_perfil();
drop function if exists public.proteger_perfis_fase2();
drop function if exists public.validar_ajuste();
drop function if exists public.proteger_ajustes_fase2();
drop function if exists public.salvar_modelo_jornada(uuid, text, text, integer, boolean, jsonb);
