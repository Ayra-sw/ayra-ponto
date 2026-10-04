-- Conferência da Fase 5B (somente leitura). Todas as linhas devem mostrar "ok = true".
select 'Cofre do certificado criado e privado' as verificacao,
       exists (select 1 from storage.buckets where id = 'certificados' and not public) as ok
union all
select 'Ninguém do app lê o cofre (nenhuma regra de acesso aberta)',
       not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects'
                    and (qual ilike '%certificados%' or with_check ilike '%certificados%'))
union all
select 'Dados do comprovante instalados, fechados para visitantes',
       to_regprocedure('public.dados_comprovante(uuid)') is not null
       and not has_function_privilege('anon', 'public.dados_comprovante(uuid)', 'execute')
       and has_function_privilege('authenticated', 'public.dados_comprovante(uuid)', 'execute');
