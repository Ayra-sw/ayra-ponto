-- Conferência da Fase 7C (somente leitura). Todas as linhas devem mostrar "ok = true".
select 'Assinaturas do espelho criadas e protegidas' as verificacao,
       to_regclass('public.espelho_conferencias') is not null
       and (select relrowsecurity from pg_class where oid = 'public.espelho_conferencias'::regclass)
       and not has_table_privilege('authenticated', 'public.espelho_conferencias', 'insert')
       and not has_table_privilege('authenticated', 'public.espelho_conferencias', 'update') as ok
union all
select 'Assinar, ver as próprias e lembrar quem falta',
       has_function_privilege('authenticated', 'public.assinar_espelho(date,text)', 'execute')
       and has_function_privilege('authenticated', 'public.minhas_conferencias()', 'execute')
       and has_function_privilege('authenticated', 'public.lembrar_assinaturas(date)', 'execute')
       and not has_function_privilege('anon', 'public.assinar_espelho(date,text)', 'execute')
union all
select 'Aviso ao fechar, ao reabrir e quando há problema',
       (select count(*) from pg_trigger where not tgisinternal
         and tgname in ('conferencia_ao_fechar', 'conferencias_ao_reabrir', 'problema_no_espelho')) = 3
union all
select 'Sininho aceita os avisos novos',
       pg_get_constraintdef((select oid from pg_constraint where conname = 'avisos_tipo_check'
                              and conrelid = 'public.avisos'::regclass)) like '%espelho_para_assinar%'
union all
select 'Assinaturas entram no Histórico de alterações',
       exists (select 1 from pg_trigger where tgname = 'historico'
                and tgrelid = 'public.espelho_conferencias'::regclass and not tgisinternal);
