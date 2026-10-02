-- ============================================================================
-- Ayra Ponto — DESFAZER da Fase 3C
-- Desliga os avisos novos e o histórico de alterações. NÃO apaga nada: os
-- avisos e o histórico já anotados continuam guardados.
-- Para ligar de novo, rode 2026-10-03_fase-3c_avisos-historico.sql.
-- ============================================================================
drop trigger if exists avisos_pedido      on public.ajustes_ponto;
drop trigger if exists avisos_pessoa_nova on public.perfis;
drop trigger if exists avisos_foto        on public.rostos_referencia;

do $$
declare
  t text;
begin
  foreach t in array array['empresas', 'filiais', 'perfis', 'departamentos', 'cargos', 'modelos_jornada',
                           'modelos_jornada_dias', 'feriados', 'turnos', 'escala_dias', 'ajustes_ponto',
                           'afastamentos', 'banco_horas_lancamentos', 'departamento_gestores', 'rostos_referencia',
                           'verificacoes_faciais'] loop
    execute format('drop trigger if exists historico on public.%I', t);
  end loop;
end $$;

drop function if exists public.atualizar_meus_avisos();
drop function if exists public.avisos_pedido();
drop function if exists public.avisos_pessoa_nova();
drop function if exists public.avisos_foto();
drop function if exists public.registrar_historico();

notify pgrst, 'reload schema';
