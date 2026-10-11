-- Conferência da Fase 7A (somente leitura). Todas as linhas devem mostrar "ok = true".
select 'Regras de cálculo da empresa criadas e protegidas' as verificacao,
       to_regclass('public.regras_calculo') is not null
       and (select relrowsecurity from pg_class where oid = 'public.regras_calculo'::regclass)
       and not has_table_privilege('anon', 'public.regras_calculo', 'select') as ok
union all
select 'Padrão da CLT: extra 50%/100%, noturno 22h às 5h com 20%, descanso de 11h, semana de 44h',
       (select r.extra_normal_pct = 50 and r.extra_especial_pct = 100 and r.noturno_inicio = '22:00'
               and r.noturno_fim = '05:00' and r.noturno_pct = 20 and r.interjornada_min = 660
               and r.limite_semanal_min = 2640
          from public.regras_da_empresa(null) r)
union all
select 'Espelho com as contas da folha instalado',
       to_regprocedure('public.apurar_clt(uuid,date,date)') is not null
       and has_function_privilege('authenticated', 'public.apurar_clt(uuid,date,date)', 'execute')
       and not has_function_privilege('anon', 'public.apurar_clt(uuid,date,date)', 'execute')
union all
select 'Mudanças nas regras entram no Histórico de alterações',
       exists (select 1 from pg_trigger where tgname = 'historico'
                and tgrelid = 'public.regras_calculo'::regclass and not tgisinternal)
union all
select 'Espelho antigo continua igual (apurar_periodo intacta)',
       to_regprocedure('public.apurar_periodo(uuid,date,date)') is not null;
