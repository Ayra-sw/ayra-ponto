-- Conferência da Fase 1 (somente leitura). Todas as linhas devem mostrar "ok = true".
select 'Validação de CNPJ alfanumérico instalada' as verificacao,
       public.cnpj_valido('12.ABC.345/01DE-35') and public.cnpj_valido('11.222.333/0001-81')
       and not public.cnpj_valido('11.222.333/0001-82') as ok
union all
select 'Empresa com campos novos (endereço, contato, inscrições)',
       (select count(*) from information_schema.columns
         where table_schema = 'public' and table_name = 'empresas'
           and column_name in ('inscricao_estadual', 'inscricao_municipal', 'telefone', 'email', 'cep', 'logradouro', 'numero', 'complemento', 'bairro', 'cidade', 'uf')) = 11
union all
select 'Unidades com campos novos (ativa, documento, endereço, fuso)',
       (select count(*) from information_schema.columns
         where table_schema = 'public' and table_name = 'filiais'
           and column_name in ('ativa', 'tipo_identificador', 'cep', 'logradouro', 'numero', 'complemento', 'bairro', 'cidade', 'uf', 'fuso_horario')) = 10
union all
select 'Proteção das unidades ativa',
       exists (select 1 from pg_trigger where tgname = 'proteger_unidades')
union all
select 'CNPJ padronizado (sem pontuação)',
       not exists (select 1 from empresas where cnpj ~ '[^0-9A-Z]')
union all
select 'Toda empresa tem unidade ativa',
       not exists (select 1 from empresas e where not exists (select 1 from filiais f where f.empresa_id = e.id and f.ativa))
union all
select 'Fase 0 continua ativa',
       exists (select 1 from pg_trigger where tgname = 'proteger_perfis')
       and not has_function_privilege('anon', 'public.registrar_ponto(uuid, uuid, tipo_marcacao, origem_marcacao, numeric, numeric)', 'execute')
union all
select 'Dados preservados (' || (select count(*) from empresas) || ' empresa, ' || (select count(*) from filiais) || ' unidade, ' || (select count(*) from perfis) || ' usuário)',
       (select count(*) from perfis) > 0;
