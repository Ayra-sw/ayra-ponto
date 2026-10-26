-- Conferência da Fase 8B (suporte autorizado). Deve mostrar 6 linhas com "t".
select 'Suporte: tabelas internas não são lidas direto pelo app' as verificacao,
       (not has_table_privilege('authenticated', 'public.suporte_autorizacoes', 'select')
        and not has_table_privilege('authenticated', 'public.suporte_sessoes', 'select')
        and not has_table_privilege('authenticated', 'public.suporte_eventos', 'select')) as ok
union all
select 'Suporte: 10 tabelas sensíveis e as pessoas têm barreira (ponto, pedidos, mês, banco, afastamento, rosto, cadastro de pessoas)',
       (select count(*) = 10 from pg_trigger where tgname = 'bloquear_suporte' and not tgisinternal)
       and exists (select 1 from pg_trigger where tgname = 'proteger_perfis_suporte' and not tgisinternal)
union all
select 'Suporte: funções da Central e da empresa não são chamadas por visitantes (anon)',
       not has_function_privilege('anon', 'public.suporte_entrar(uuid)', 'execute')
       and not has_function_privilege('anon', 'public.suporte_liberar(integer)', 'execute')
       and not has_function_privilege('anon', 'public.suporte_da_empresa()', 'execute')
       and not has_function_privilege('anon', 'public.central_suporte(uuid)', 'execute')
union all
select 'Suporte: a empresa de quem está logado e o papel passam pela sessão de suporte',
       (select prosrc like '%empresa_em_suporte%' from pg_proc where proname = 'empresa_do_usuario' and pronamespace = 'public'::regnamespace)
       and (select prosrc like '%empresa_em_suporte%' from pg_proc where proname = 'tipo_do_usuario' and pronamespace = 'public'::regnamespace)
union all
select 'Histórico: ação do suporte aparece como Suporte Ayra (sem nome de pessoa)',
       (select prosrc like '%Suporte Ayra%' from pg_proc where proname = 'registrar_historico' and pronamespace = 'public'::regnamespace)
union all
select 'Prazo: só 1, 3 ou 7 dias, e no máximo um suporte aberto por empresa',
       (select pg_get_constraintdef(oid) like '%1, 3, 7%' from pg_constraint where conname = 'suporte_autorizacoes_dias_check' or (conrelid = 'public.suporte_autorizacoes'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%dias%'))
       and exists (select 1 from pg_indexes where indexname = 'suporte_uma_aberta');
