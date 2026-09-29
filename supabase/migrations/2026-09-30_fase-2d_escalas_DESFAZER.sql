-- ============================================================================
-- Ayra Ponto — DESFAZER da Fase 2D
--
-- Desliga as REGRAS e FUNÇÕES novas da Fase 2D. NÃO apaga nenhuma tabela nem
-- dado: os turnos, os dias das escalas e os campos novos das pessoas continuam
-- guardados.
--
-- IMPORTANTE: este arquivo remove a função apurar_periodo. Logo em seguida
-- rode de novo o arquivo 2026-09-29_fase-2c_banco-horas-afastamentos.sql, que
-- instala a versão da Fase 2C. Sem isso o espelho de ponto fica sem cálculo.
-- Enquanto a Fase 2D estiver desligada, todo mundo é calculado pela jornada
-- semanal (a escala 12x36 e a de calendário deixam de valer).
--
-- Para ligar tudo de novo, rode 2026-09-30_fase-2d_escalas.sql.
-- ============================================================================
drop function if exists public.apurar_periodo(uuid, date, date);

drop trigger if exists validar_escala_perfil    on public.perfis;
drop trigger if exists proteger_escala_perfil   on public.perfis;
drop trigger if exists validar_turno            on public.turnos;
drop trigger if exists bloquear_exclusao_turno  on public.turnos;
drop trigger if exists validar_escala_dia       on public.escala_dias;

drop function if exists public.validar_escala_perfil();
drop function if exists public.proteger_escala_perfil();
drop function if exists public.validar_turno();
drop function if exists public.bloquear_exclusao_turno();
drop function if exists public.validar_escala_dia();

notify pgrst, 'reload schema';
