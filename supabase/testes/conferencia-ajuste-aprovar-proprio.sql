-- Conferência do ajuste "administrador único aprova o próprio pedido" (somente leitura).
-- Todas as linhas devem mostrar "ok = true".
select 'Função que diz se a pessoa é a única da gestão' as verificacao,
       has_function_privilege('authenticated', 'public.pode_aprovar_proprio()', 'execute')
       and not has_function_privilege('anon', 'public.pode_aprovar_proprio()', 'execute') as ok
union all
select 'Regra da análise com a exceção do administrador único',
       pg_get_functiondef('public.regras_solicitacao_fase3()'::regprocedure) like '%pode_aprovar_proprio%'
union all
select 'Fechamento do mês mostra de quem é cada pedido',
       pg_get_functiondef('public.pendencias_fechamento(date)'::regprocedure) like '%''pedidos'', v_peds%';
