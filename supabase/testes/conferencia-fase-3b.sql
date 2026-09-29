-- Conferência da Fase 3B (somente leitura). Todas as linhas devem mostrar "ok = true".
select 'As 4 funções de relatório estão instaladas' as verificacao,
       to_regprocedure('public.pessoas_do_relatorio(uuid, boolean)') is not null
       and to_regprocedure('public.relatorio_frequencia(date, date, uuid, boolean)') is not null
       and to_regprocedure('public.relatorio_banco_horas(date, uuid, boolean)') is not null
       and to_regprocedure('public.relatorio_marcacoes(date, date, uuid, boolean)') is not null as ok
union all
select 'Fechadas para visitantes sem login',
       not has_function_privilege('anon', 'public.relatorio_frequencia(date, date, uuid, boolean)', 'execute')
       and not has_function_privilege('anon', 'public.relatorio_banco_horas(date, uuid, boolean)', 'execute')
       and not has_function_privilege('anon', 'public.relatorio_marcacoes(date, date, uuid, boolean)', 'execute')
       and not has_function_privilege('anon', 'public.pessoas_do_relatorio(uuid, boolean)', 'execute')
union all
select 'Abertas para quem está logado',
       has_function_privilege('authenticated', 'public.relatorio_frequencia(date, date, uuid, boolean)', 'execute')
       and has_function_privilege('authenticated', 'public.relatorio_banco_horas(date, uuid, boolean)', 'execute')
       and has_function_privilege('authenticated', 'public.relatorio_marcacoes(date, date, uuid, boolean)', 'execute')
union all
select 'Sem login, os relatórios não mostram ninguém',
       (select count(*) from public.relatorio_frequencia(current_date - 6, current_date)) = 0
       and (select count(*) from public.relatorio_marcacoes(current_date - 6, current_date)) = 0;
