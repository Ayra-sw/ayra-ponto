-- Conferência da Fase 1.5 (somente leitura). Todas as linhas devem mostrar "ok = true".
select 'Interruptor de reconhecimento facial na empresa' as verificacao,
       exists (select 1 from information_schema.columns
                where table_schema = 'public' and table_name = 'empresas' and column_name = 'reconhecimento_facial') as ok
union all
select 'Tabelas do reconhecimento facial criadas',
       to_regclass('public.consentimentos_biometria') is not null
       and to_regclass('public.rostos_referencia') is not null
       and to_regclass('public.verificacoes_faciais') is not null
union all
select 'Tabelas protegidas (RLS ligado)',
       (select bool_and(relrowsecurity) from pg_class
         where oid in ('public.consentimentos_biometria'::regclass, 'public.rostos_referencia'::regclass, 'public.verificacoes_faciais'::regclass))
union all
select 'Armazenamento privado "rostos" criado',
       exists (select 1 from storage.buckets where id = 'rostos' and public = false)
union all
select 'Regras de acesso às fotos (4)',
       (select count(*) from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname like 'rostos:%') = 4
union all
select 'Corrente de integridade instalada',
       exists (select 1 from information_schema.columns
                where table_schema = 'public' and table_name = 'registros_ponto' and column_name = 'hash_anterior')
       and to_regprocedure('public.verificar_cadeia_integridade(uuid)') is not null
union all
select 'Ponto com rosto exige login',
       not has_function_privilege('anon', 'public.registrar_ponto_facial(tipo_marcacao, origem_marcacao, numeric, numeric, text, text, uuid, numeric, numeric, numeric, boolean, text, text)', 'execute')
       and has_function_privilege('authenticated', 'public.registrar_ponto_facial(tipo_marcacao, origem_marcacao, numeric, numeric, text, text, uuid, numeric, numeric, numeric, boolean, text, text)', 'execute')
union all
select 'Função interna fechada para o app',
       not has_function_privilege('authenticated', 'public.registrar_marcacao_interna(tipo_marcacao, origem_marcacao, numeric, numeric, text)', 'execute')
union all
select 'Fases 0 e 1 continuam ativas',
       exists (select 1 from pg_trigger where tgname = 'proteger_perfis')
       and exists (select 1 from pg_trigger where tgname = 'proteger_unidades')
union all
select 'Marcações preservadas (' || (select count(*) from registros_ponto) || ' marcação, ' || (select count(*) from perfis) || ' usuário)',
       (select count(*) from registros_ponto where versao_hash = 1) >= 1;
