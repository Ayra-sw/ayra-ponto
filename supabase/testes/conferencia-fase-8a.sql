-- Conferência da Fase 8A (somente leitura). Todas as linhas devem mostrar "ok = true".
select 'Central Ayra: donos e registro protegidos' as verificacao,
       to_regclass('public.plataforma_donos') is not null and to_regclass('public.plataforma_registro') is not null
       and not has_table_privilege('authenticated', 'public.plataforma_donos', 'select')
       and not has_table_privilege('authenticated', 'public.plataforma_registro', 'select') as ok
union all
select 'Situação das empresas (teste, ativa, suspensa) só muda pela Central',
       exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'empresas' and column_name = 'situacao')
       and exists (select 1 from pg_trigger where tgname = 'proteger_situacao_empresa' and not tgisinternal)
       and not exists (select 1 from public.empresas where situacao not in ('teste', 'ativa', 'suspensa'))
union all
select 'Empresa suspensa: gestão bloqueada, ponto continua',
       pg_get_functiondef('public.tipo_do_usuario()'::regprocedure) like '%suspensa%'
       and pg_get_functiondef('public.equipe_ids()'::regprocedure) like '%suspensa%'
union all
select 'Funções da Central só para a dona (e não para visitantes)',
       has_function_privilege('authenticated', 'public.central_empresas()', 'execute')
       and not has_function_privilege('anon', 'public.central_empresas()', 'execute')
       and not has_function_privilege('authenticated', 'public.plataforma_tornar_dono(text,text)', 'execute')
union all
select 'Contato do suporte pronto para preencher',
       exists (select 1 from public.plataforma_config where id = 1);
