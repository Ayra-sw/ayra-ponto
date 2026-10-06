-- Conferência da Fase 6A (somente leitura). Todas as linhas devem mostrar "ok = true".
select 'A unidade guarda o local e o raio da cerca' as verificacao,
       (select count(*) from information_schema.columns
         where table_schema = 'public' and table_name = 'filiais'
           and column_name in ('latitude', 'longitude', 'raio_cerca_m')) = 3 as ok
union all
select 'Cálculo de distância funcionando (Praça da Sé a Av. Paulista ≈ 2,3 km)',
       public.distancia_metros(-23.5505, -46.6333, -23.5614, -46.6559) between 2000 and 2800
union all
select 'Registro do local de cada marcação criado e protegido',
       to_regclass('public.marcacao_local') is not null
       and (select relrowsecurity from pg_class where oid = 'public.marcacao_local'::regclass)
       and not has_table_privilege('authenticated', 'public.marcacao_local', 'insert')
       and not has_table_privilege('anon', 'public.marcacao_local', 'select')
union all
select 'Cada marcação nova tem o local conferido',
       exists (select 1 from pg_trigger where tgname = 'marcacao_local_registrar'
                and tgrelid = 'public.registros_ponto'::regclass and not tgisinternal)
union all
select 'Função do gatilho fechada para o app',
       not has_function_privilege('authenticated', 'public.marcacao_local_registrar()', 'execute');
