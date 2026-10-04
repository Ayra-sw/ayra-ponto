-- Conferência da Fase 5A (somente leitura). Todas as linhas devem mostrar "ok = true".
select 'Linhas do AFD gravadas e protegidas (ninguém altera nem apaga)' as verificacao,
       coalesce((select relrowsecurity from pg_class where oid = to_regclass('public.afd_registros')), false)
       and exists (select 1 from pg_trigger where tgname = 'proteger_afd')
       and not has_table_privilege('authenticated', 'public.afd_registros', 'insert') as ok
union all
select 'Toda marcação de ponto tem a sua linha no AFD',
       not exists (select 1 from registros_ponto r where not exists (select 1 from afd_registros a where a.registro_id = r.id))
union all
select 'Cada unidade tem o registro da empresa (tipo 2) no AFD',
       not exists (select 1 from filiais f where not exists (select 1 from afd_registros a where a.filial_id = f.id and a.tipo = 2))
union all
select 'Gravação automática ligada (marcações, empresa, unidades e pessoas)',
       (select count(*) from pg_trigger where tgname in ('afd_marcacao', 'afd_filial', 'afd_empresa', 'afd_pessoa')) = 4
union all
select 'AFD e AEJ instalados, fechados para visitantes',
       to_regprocedure('public.gerar_afd(uuid,date,date)') is not null
       and to_regprocedure('public.gerar_aej(uuid,date,date)') is not null
       and not has_function_privilege('anon', 'public.gerar_afd(uuid,date,date)', 'execute')
       and not has_function_privilege('anon', 'public.gerar_aej(uuid,date,date)', 'execute')
union all
select 'Cálculo do código de verificação (CRC-16) conforme o leiaute',
       public.afd_crc16('123456789') = '2189';
