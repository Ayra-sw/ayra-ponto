-- ============================================================================
-- Ayra Ponto — DESFAZER da Fase 2C
--
-- Desliga as REGRAS e FUNÇÕES novas da Fase 2C. NÃO apaga nenhuma tabela nem
-- dado: os lançamentos do banco de horas, os afastamentos e os campos novos
-- das jornadas continuam guardados.
--
-- IMPORTANTE: este arquivo remove a função apurar_periodo. Logo em seguida
-- rode de novo o arquivo 2026-09-28_fase-2b_apuracao.sql, que instala a
-- versão da Fase 2B. Sem isso o espelho de ponto fica sem cálculo.
--
-- Para ligar tudo de novo, rode 2026-09-29_fase-2c_banco-horas-afastamentos.sql.
-- ============================================================================
drop function if exists public.resumo_banco_horas(uuid);
drop function if exists public.banco_horas(uuid, date);
drop function if exists public.apurar_periodo(uuid, date, date);

drop trigger if exists validar_modelo_banco_horas      on public.modelos_jornada;
drop trigger if exists validar_lancamento_banco        on public.banco_horas_lancamentos;
drop trigger if exists bloquear_alteracao_lancamento   on public.banco_horas_lancamentos;
drop trigger if exists validar_afastamento             on public.afastamentos;
drop trigger if exists bloquear_exclusao_afastamento   on public.afastamentos;

drop function if exists public.validar_modelo_banco_horas();
drop function if exists public.validar_lancamento_banco();
drop function if exists public.bloquear_alteracao_lancamento();
drop function if exists public.validar_afastamento();
drop function if exists public.bloquear_exclusao_afastamento();

notify pgrst, 'reload schema';
