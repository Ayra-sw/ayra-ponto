-- Conferência da Fase 0 (somente leitura). Todas as linhas devem mostrar "ok = true".
select 'Bater ponto exige login' as verificacao,
       not has_function_privilege('anon', 'public.registrar_ponto(uuid, uuid, tipo_marcacao, origem_marcacao, numeric, numeric)', 'execute') as ok
union all
select 'Criar empresa exige login',
       not has_function_privilege('anon', 'public.criar_empresa(text, text)', 'execute')
union all
select 'Convite exige login',
       not has_function_privilege('anon', 'public.entrar_por_codigo(text)', 'execute')
union all
select 'Proteção dos cadastros ativa',
       exists (select 1 from pg_trigger where tgname = 'proteger_perfis')
union all
select 'Proteção do NSR ativa',
       exists (select 1 from pg_trigger where tgname = 'proteger_nsr_filial')
union all
select 'Proteção das solicitações ativa',
       exists (select 1 from pg_trigger where tgname = 'proteger_ajustes')
union all
select 'Colaborador não vê dados dos colegas',
       exists (select 1 from pg_policies where tablename = 'perfis' and policyname = 'perfis: ver o próprio')
       and not exists (select 1 from pg_policies where tablename = 'perfis' and policyname = 'perfis: mesma empresa')
union all
select 'Todos com empresa têm unidade',
       not exists (select 1 from perfis where empresa_id is not null and filial_id is null)
union all
select 'Dados preservados (' || (select count(*) from empresas) || ' empresa, ' || (select count(*) from filiais) || ' unidade, ' || (select count(*) from perfis) || ' usuário)',
       (select count(*) from perfis) > 0;
