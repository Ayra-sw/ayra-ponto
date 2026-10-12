-- Conferência da Fase 7B (somente leitura). Todas as linhas devem mostrar "ok = true".
select 'Fechamentos e fotos dos espelhos criados e protegidos' as verificacao,
       to_regclass('public.fechamentos') is not null and to_regclass('public.fechamento_espelhos') is not null
       and (select relrowsecurity from pg_class where oid = 'public.fechamento_espelhos'::regclass)
       and not has_table_privilege('authenticated', 'public.fechamento_espelhos', 'insert')
       and not has_table_privilege('authenticated', 'public.fechamentos', 'update') as ok
union all
select 'Trava do mês fechado nos pedidos, afastamentos, banco, escala e feriados',
       (select count(*) from pg_trigger where tgname = 'trava_mes_fechado' and not tgisinternal) = 5
union all
select 'Funções de fechar, reabrir, ver pendências e baixar a planilha',
       has_function_privilege('authenticated', 'public.fechar_mes(date,boolean)', 'execute')
       and has_function_privilege('authenticated', 'public.reabrir_mes(date,text)', 'execute')
       and has_function_privilege('authenticated', 'public.pendencias_fechamento(date)', 'execute')
       and has_function_privilege('authenticated', 'public.planilha_fechamento(date)', 'execute')
       and not has_function_privilege('anon', 'public.fechar_mes(date,boolean)', 'execute')
       and not has_column_privilege('authenticated', 'public.fechamento_espelhos', 'pessoa', 'select')
union all
select 'Fechar e reabrir entram no Histórico de alterações',
       exists (select 1 from pg_trigger where tgname = 'historico'
                and tgrelid = 'public.fechamentos'::regclass and not tgisinternal)
union all
select 'Nome do mês em português',
       public.nome_do_mes('2026-09-01') = 'setembro de 2026';
