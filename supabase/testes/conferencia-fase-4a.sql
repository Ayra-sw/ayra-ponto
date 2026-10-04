-- Conferência da Fase 4A (somente leitura). Todas as linhas devem mostrar "ok = true".
select 'Anotações de "já vi" criadas, com proteção por linha (RLS)' as verificacao,
       coalesce((select relrowsecurity from pg_class where oid = to_regclass('public.marcos_usuario')), false) as ok
union all
select 'Cada pessoa só lê, cria e apaga as próprias anotações',
       (select count(*) from pg_policies where schemaname = 'public' and tablename = 'marcos_usuario') = 3
       and not has_table_privilege('anon', 'public.marcos_usuario', 'select')
       and not has_table_privilege('authenticated', 'public.marcos_usuario', 'update')
union all
select 'Primeiros passos instalados, fechados para visitantes e vazios sem login',
       to_regprocedure('public.primeiros_passos()') is not null
       and not has_function_privilege('anon', 'public.primeiros_passos()', 'execute')
       and has_function_privilege('authenticated', 'public.primeiros_passos()', 'execute')
       and public.primeiros_passos() is null;
