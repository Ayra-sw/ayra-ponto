-- Conferência da Fase 2C (somente leitura). Todas as linhas devem mostrar "ok = true".
select 'Tabelas novas criadas (lançamentos do banco de horas e afastamentos)' as verificacao,
       (select count(*) from information_schema.tables
         where table_schema = 'public'
           and table_name in ('banco_horas_lancamentos', 'afastamentos')) = 2 as ok
union all
select 'As duas tabelas com proteção por linha (RLS) ligada',
       (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
         where n.nspname = 'public' and c.relrowsecurity
           and c.relname in ('banco_horas_lancamentos', 'afastamentos')) = 2
union all
select 'Jornadas com os campos do banco de horas (usa, prazo, início)',
       (select count(*) from information_schema.columns
         where table_schema = 'public' and table_name = 'modelos_jornada'
           and column_name in ('usa_banco_horas', 'banco_horas_validade_meses', 'banco_horas_inicio')) = 3
union all
select 'Regras novas ativas (lançamento permanente, afastamento sem edição e sem sobreposição)',
       (select count(*) from pg_trigger
         where tgname in ('validar_lancamento_banco', 'bloquear_alteracao_lancamento',
                          'validar_afastamento', 'bloquear_exclusao_afastamento',
                          'validar_modelo_banco_horas')) = 5
union all
select 'Funções novas instaladas, fechadas para visitantes e abertas para quem está logado',
       to_regprocedure('public.banco_horas(uuid, date)') is not null
       and to_regprocedure('public.resumo_banco_horas(uuid)') is not null
       and not has_function_privilege('anon', 'public.banco_horas(uuid, date)', 'execute')
       and not has_function_privilege('anon', 'public.resumo_banco_horas(uuid)', 'execute')
       and not has_function_privilege('anon', 'public.apurar_periodo(uuid, date, date)', 'execute')
       and has_function_privilege('authenticated', 'public.banco_horas(uuid, date)', 'execute')
       and has_function_privilege('authenticated', 'public.resumo_banco_horas(uuid)', 'execute')
       and has_function_privilege('authenticated', 'public.apurar_periodo(uuid, date, date)', 'execute')
union all
select 'Espelho atualizado (devolve o tipo de afastamento) e roda sem erro',
       (select count(*) from information_schema.parameters
         where specific_schema = 'public' and parameter_mode = 'OUT' and parameter_name = 'afastamento_tipo'
           and specific_name like 'apurar_periodo%') = 1
       and (select count(*) from public.apurar_periodo(
              (select id from public.perfis limit 1), current_date - 6, current_date)) = 7;
