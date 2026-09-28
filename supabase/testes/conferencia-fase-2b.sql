-- Conferência da Fase 2B (somente leitura). Todas as linhas devem mostrar "ok = true".
select 'Função de cálculo das horas instalada (apurar_periodo)' as verificacao,
       to_regprocedure('public.apurar_periodo(uuid, date, date)') is not null as ok
union all
select 'Função do resumo da equipe instalada (resumo_equipe)',
       to_regprocedure('public.resumo_equipe(date, date, uuid)') is not null
union all
select 'Funções fechadas para visitantes sem login e abertas para quem está logado',
       not has_function_privilege('anon', 'public.apurar_periodo(uuid, date, date)', 'execute')
       and not has_function_privilege('anon', 'public.resumo_equipe(date, date, uuid)', 'execute')
       and has_function_privilege('authenticated', 'public.apurar_periodo(uuid, date, date)', 'execute')
       and has_function_privilege('authenticated', 'public.resumo_equipe(date, date, uuid)', 'execute')
union all
select 'Índices de apoio criados (ajustes por pessoa/situação e por marcação original)',
       (select count(*) from pg_indexes
         where schemaname = 'public'
           and indexname in ('ajustes_ponto_perfil_status_idx', 'ajustes_ponto_original_idx')) = 2
union all
select 'Cálculo roda sem erro (período de teste, sem gravar nada)',
       (select count(*) from public.apurar_periodo(
          (select id from public.perfis limit 1), current_date - 6, current_date)) = 7;
