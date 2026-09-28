-- Conferência da Fase 2A (somente leitura). Todas as linhas devem mostrar "ok = true".
select 'Tabelas novas criadas (departamentos, cargos, jornadas, dias da jornada, feriados)' as verificacao,
       (select count(*) from information_schema.tables
         where table_schema = 'public'
           and table_name in ('departamentos', 'cargos', 'modelos_jornada', 'modelos_jornada_dias', 'feriados')) = 5 as ok
union all
select 'Todas com proteção por linha (RLS) ligada',
       (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
         where n.nspname = 'public' and c.relrowsecurity
           and c.relname in ('departamentos', 'cargos', 'modelos_jornada', 'modelos_jornada_dias', 'feriados')) = 5
union all
select 'Cadastro das pessoas com campos novos (matrícula, telefone, departamento, cargo, jornada)',
       (select count(*) from information_schema.columns
         where table_schema = 'public' and table_name = 'perfis'
           and column_name in ('matricula', 'telefone', 'departamento_id', 'cargo_id', 'modelo_jornada_id')) = 5
union all
select 'Solicitações com campos novos (tipo da marcação, dia, último dia)',
       (select count(*) from information_schema.columns
         where table_schema = 'public' and table_name = 'ajustes_ponto'
           and column_name in ('tipo_marcacao', 'data_referencia', 'data_fim')) = 3
union all
select 'Regras novas ativas (vínculos, proteção do cadastro, validação e proteção dos pedidos)',
       (select count(*) from pg_trigger
         where tgname in ('validar_vinculos_perfil', 'proteger_perfis_fase2', 'validar_ajuste', 'proteger_ajustes_fase2',
                          'validar_feriado', 'bloquear_exclusao', 'normalizar_nome')) >= 11
union all
select 'Função de salvar jornada instalada e fechada para visitantes',
       to_regprocedure('public.salvar_modelo_jornada(uuid, text, text, integer, boolean, jsonb)') is not null
       and not has_function_privilege('anon', 'public.salvar_modelo_jornada(uuid, text, text, integer, boolean, jsonb)', 'execute')
       and has_function_privilege('authenticated', 'public.salvar_modelo_jornada(uuid, text, text, integer, boolean, jsonb)', 'execute')
union all
select 'Visitantes sem login não acessam as tabelas novas',
       not has_table_privilege('anon', 'public.departamentos', 'select')
       and not has_table_privilege('anon', 'public.cargos', 'select')
       and not has_table_privilege('anon', 'public.modelos_jornada', 'select')
       and not has_table_privilege('anon', 'public.modelos_jornada_dias', 'select')
       and not has_table_privilege('anon', 'public.feriados', 'select')
union all
select 'Fases anteriores continuam ativas (0, 1 e 1.5)',
       exists (select 1 from pg_trigger where tgname = 'proteger_perfis')
       and exists (select 1 from pg_trigger where tgname = 'proteger_unidades')
       and to_regprocedure('public.registrar_ponto_facial(tipo_marcacao, origem_marcacao, numeric, numeric, text, text, uuid, numeric, numeric, numeric, boolean, text, text)') is not null
union all
select 'Dados preservados (' || (select count(*) from empresas) || ' empresa, ' || (select count(*) from filiais) || ' unidade, '
       || (select count(*) from perfis) || ' usuário, ' || (select count(*) from registros_ponto) || ' marcações)',
       (select count(*) from perfis) > 0;
