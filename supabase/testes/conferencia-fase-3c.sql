-- Conferência da Fase 3C (somente leitura). Todas as linhas devem mostrar "ok = true".
select 'Tabelas de avisos e de histórico criadas, com proteção por linha (RLS)' as verificacao,
       (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
         where n.nspname = 'public' and c.relrowsecurity
           and c.relname in ('avisos', 'historico_alteracoes', 'avisos_verificados')) = 3 as ok
union all
select 'Avisos automáticos ligados (pedidos, pessoa nova, fotos)',
       (select count(*) from pg_trigger where tgname in ('avisos_pedido', 'avisos_pessoa_nova', 'avisos_foto')) = 3
union all
select 'Histórico anotando 16 tabelas',
       (select count(*) from pg_trigger t join pg_class c on c.oid = t.tgrelid
         where t.tgname = 'historico' and c.relnamespace = 'public'::regnamespace) = 16
union all
select 'Histórico protegido (ninguém edita nem apaga)',
       exists (select 1 from pg_trigger where tgname = 'proteger_historico')
       and not has_table_privilege('authenticated', 'public.historico_alteracoes', 'insert')
       and not has_table_privilege('authenticated', 'public.historico_alteracoes', 'delete')
union all
select 'Sininho instalado, fechado para visitantes e aberto para quem está logado',
       to_regprocedure('public.atualizar_meus_avisos()') is not null
       and not has_function_privilege('anon', 'public.atualizar_meus_avisos()', 'execute')
       and has_function_privilege('authenticated', 'public.atualizar_meus_avisos()', 'execute')
       and public.atualizar_meus_avisos() = 0;
