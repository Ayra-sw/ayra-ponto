-- Conferência da Fase 2D (somente leitura). Todas as linhas devem mostrar "ok = true".
select 'Tabelas novas criadas (turnos e dias da escala)' as verificacao,
       (select count(*) from information_schema.tables
         where table_schema = 'public' and table_name in ('turnos', 'escala_dias')) = 2 as ok
union all
select 'As duas tabelas com proteção por linha (RLS) ligada',
       (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
         where n.nspname = 'public' and c.relrowsecurity
           and c.relname in ('turnos', 'escala_dias')) = 2
union all
select 'Pessoas com os campos de escala (tipo, turno, primeiro dia)',
       (select count(*) from information_schema.columns
         where table_schema = 'public' and table_name = 'perfis'
           and column_name in ('tipo_escala', 'escala_turno_id', 'escala_referencia')) = 3
union all
select 'Regras novas ativas (turno protegido, escala protegida, dias validados)',
       (select count(*) from pg_trigger
         where tgname in ('validar_turno', 'bloquear_exclusao_turno', 'validar_escala_dia',
                          'validar_escala_perfil', 'proteger_escala_perfil')) = 5
union all
select 'Cálculo das horas instalado, fechado para visitantes e aberto para quem está logado',
       to_regprocedure('public.apurar_periodo(uuid, date, date)') is not null
       and not has_function_privilege('anon', 'public.apurar_periodo(uuid, date, date)', 'execute')
       and has_function_privilege('authenticated', 'public.apurar_periodo(uuid, date, date)', 'execute')
union all
select 'Espelho atualizado (devolve o turno do dia) e roda sem erro',
       (select count(*) from information_schema.parameters
         where specific_schema = 'public' and parameter_mode = 'OUT' and parameter_name = 'turno'
           and specific_name like 'apurar_periodo%') = 1
       and (select count(*) from public.apurar_periodo(
              (select id from public.perfis limit 1), current_date - 6, current_date)) = 7;
