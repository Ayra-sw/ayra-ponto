-- Conferência da Fase 5C (somente leitura). Todas as linhas devem mostrar "ok = true".
select 'Fila do comprovante por e-mail criada e fechada para o app' as verificacao,
       to_regclass('public.fila_comprovantes_email') is not null
       and not has_table_privilege('authenticated', 'public.fila_comprovantes_email', 'select')
       and not has_table_privilege('anon', 'public.fila_comprovantes_email', 'select') as ok
union all
select 'Cada marcação nova entra na fila',
       exists (select 1 from pg_trigger where tgname = 'fila_comprovante_email'
                and tgrelid = 'public.registros_ponto'::regclass and not tgisinternal)
union all
select 'Preferência de e-mail de cada pessoa, protegida',
       to_regclass('public.preferencias_email') is not null
       and (select relrowsecurity from pg_class where oid = 'public.preferencias_email'::regclass)
union all
select 'Funções do servidor fechadas para o app',
       not has_function_privilege('authenticated', 'public.fila_comprovantes_pegar(uuid,integer)', 'execute')
       and not has_function_privilege('authenticated', 'public.comprovante_montar(uuid)', 'execute')
       and has_function_privilege('authenticated', 'public.dados_comprovante(uuid)', 'execute')
union all
select 'Agendamento a cada 5 minutos ligado',
       exists (select 1 from cron.job where jobname = 'ayra-comprovantes-email' and schedule = '*/5 * * * *' and active);
