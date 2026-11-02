-- Conferência do bloqueio de ponto fora da cerca. Deve mostrar 4 linhas com "t".
select 'Bloqueio: chave da empresa e trabalho externo existem e começam desligados' as verificacao,
       exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'empresas'
                 and column_name = 'bloquear_fora_cerca' and column_default = 'false')
       and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'perfis'
                 and column_name = 'trabalho_externo' and column_default = 'false') as ok
union all
select 'Bloqueio: nenhuma empresa foi ligada sozinha',
       not exists (select 1 from public.empresas where bloquear_fora_cerca)
union all
select 'Bloqueio: o banco confere antes de cada marcação e protege o trabalho externo',
       exists (select 1 from pg_trigger where tgname = 'bloquear_ponto_fora_cerca' and not tgisinternal)
       and exists (select 1 from pg_trigger where tgname = 'proteger_trabalho_externo' and not tgisinternal)
union all
select 'Bloqueio: a tela pode conferir, visitantes (anon) não',
       has_function_privilege('authenticated', 'public.conferir_local_ponto(numeric, numeric)', 'execute')
       and not has_function_privilege('anon', 'public.conferir_local_ponto(numeric, numeric)', 'execute')
       and not has_function_privilege('authenticated', 'public.motivo_bloqueio_cerca(uuid, uuid, numeric, numeric)', 'execute');
