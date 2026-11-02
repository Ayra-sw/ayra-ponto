-- Conferência da Fase 9A (horista). Deve mostrar 5 linhas com "t".
select 'Horista: novo jeito de trabalhar, limite diário e pago por hora na ficha' as verificacao,
       (select pg_get_constraintdef(oid) like '%horista%' from pg_constraint where conname = 'perfis_tipo_escala_check')
       and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'perfis' and column_name = 'limite_diario_min')
       and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'perfis' and column_name = 'pago_por_hora') as ok
union all
select 'Horista: as contas do espelho conhecem o horista',
       (select prosrc like '%horista%' from pg_proc where proname = 'apurar_periodo' and pronamespace = 'public'::regnamespace)
       and (select prosrc like '%horista%' from pg_proc where proname = 'apurar_clt' and pronamespace = 'public'::regnamespace)
union all
select 'Valor da hora: o app só lê; gravar é pelas funções',
       has_table_privilege('authenticated', 'public.valores_hora', 'select')
       and not has_table_privilege('authenticated', 'public.valores_hora', 'insert')
       and not has_table_privilege('authenticated', 'public.valores_hora', 'update')
       and not has_table_privilege('authenticated', 'public.valores_hora', 'delete')
union all
select 'Valor da hora e relatório: visitantes (anon) não chamam',
       not has_function_privilege('anon', 'public.definir_valor_hora(uuid, numeric, date)', 'execute')
       and not has_function_privilege('anon', 'public.pagamento_por_hora(uuid, date, date)', 'execute')
       and not has_function_privilege('anon', 'public.relatorio_horistas(date, date, uuid, boolean)', 'execute')
union all
select 'Ficha: pagamento por hora e limite protegidos',
       exists (select 1 from pg_trigger where tgname = 'proteger_dados_horista' and not tgisinternal)
       and exists (select 1 from pg_trigger where tgname = 'ajustar_horista' and not tgisinternal);
