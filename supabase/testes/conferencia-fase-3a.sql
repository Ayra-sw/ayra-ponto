-- Conferência da Fase 3A (somente leitura). Todas as linhas devem mostrar "ok = true".
select 'Tabela de gestores criada, com proteção por linha (RLS)' as verificacao,
       (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
         where n.nspname = 'public' and c.relname = 'departamento_gestores' and c.relrowsecurity) = 1 as ok
union all
select 'Solicitações com comentário, anexo e o status "cancelado"',
       (select count(*) from information_schema.columns
         where table_schema = 'public' and table_name = 'ajustes_ponto'
           and column_name in ('comentario_analise', 'anexo_path')) = 2
       and exists (select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid
                    where t.typname = 'status_ajuste' and e.enumlabel = 'cancelado')
union all
select 'Regras novas ativas (análise, anexo, gestor da mesma empresa)',
       (select count(*) from pg_trigger
         where tgname in ('regras_solicitacao_fase3', 'regras_anexo_afastamento', 'validar_departamento_gestor')) = 3
union all
select 'Gestor vê só a equipe (5 regras de leitura) e analisa só os pedidos dela',
       (select count(*) from pg_policies
         where schemaname = 'public'
           and policyname in ('registros: gestor vê a equipe', 'ajustes: gestor vê a equipe', 'afastamentos: gestor vê a equipe',
                              'banco: gestor vê a equipe', 'escala: gestor vê a equipe', 'ajustes: gestor analisa a equipe')) = 6
union all
select 'Armazenamento de atestados privado, com 5 regras de acesso',
       exists (select 1 from storage.buckets where id = 'atestados' and public = false)
       and (select count(*) from pg_policies where schemaname = 'storage' and policyname like 'atestados:%') = 5
union all
select 'Funções novas instaladas, fechadas para visitantes, e o espelho roda sem erro',
       to_regprocedure('public.minha_equipe()') is not null
       and to_regprocedure('public.resumo_minha_equipe(date, date)') is not null
       and not has_function_privilege('anon', 'public.minha_equipe()', 'execute')
       and not has_function_privilege('anon', 'public.apurar_periodo(uuid, date, date)', 'execute')
       and has_function_privilege('authenticated', 'public.resumo_minha_equipe(date, date)', 'execute')
       and (select count(*) from public.apurar_periodo(
              (select id from public.perfis limit 1), current_date - 6, current_date)) = 7;
