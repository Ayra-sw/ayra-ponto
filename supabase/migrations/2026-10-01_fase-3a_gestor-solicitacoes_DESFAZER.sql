-- ============================================================================
-- Ayra Ponto — DESFAZER da Fase 3A
--
-- Desliga o gestor da equipe, as regras novas das solicitações e o envio de
-- atestados. NÃO apaga nenhuma tabela nem dado: os gestores escolhidos, os
-- comentários, os pedidos cancelados e os arquivos continuam guardados.
--
-- O espelho e o banco de horas continuam funcionando normalmente para a
-- própria pessoa, o RH e o administrador (não é preciso rodar outro arquivo).
-- Para ligar tudo de novo, rode 2026-10-01_fase-3a_gestor-solicitacoes.sql.
-- ============================================================================

-- ninguém mais tem equipe: o gestor deixa de ver e de aprovar
create or replace function public.equipe_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select null::uuid where false;
$$;

drop policy if exists "registros: gestor vê a equipe"      on public.registros_ponto;
drop policy if exists "ajustes: gestor vê a equipe"         on public.ajustes_ponto;
drop policy if exists "ajustes: gestor analisa a equipe"    on public.ajustes_ponto;
drop policy if exists "ajustes: dono cancela o pendente"    on public.ajustes_ponto;
drop policy if exists "afastamentos: gestor vê a equipe"    on public.afastamentos;
drop policy if exists "banco: gestor vê a equipe"           on public.banco_horas_lancamentos;
drop policy if exists "escala: gestor vê a equipe"          on public.escala_dias;

drop trigger if exists regras_solicitacao_fase3   on public.ajustes_ponto;
drop trigger if exists regras_anexo_afastamento   on public.afastamentos;
drop trigger if exists validar_departamento_gestor on public.departamento_gestores;
drop function if exists public.regras_solicitacao_fase3();
drop function if exists public.regras_anexo_afastamento();
drop function if exists public.validar_departamento_gestor();
drop function if exists public.resumo_minha_equipe(date, date);
drop function if exists public.minha_equipe();

-- gestores só podem ser vistos (não se escolhem novos enquanto estiver desligado)
drop policy if exists "gestores: admin/rh definem" on public.departamento_gestores;

drop policy if exists "atestados: enviar o próprio"            on storage.objects;
drop policy if exists "atestados: admin/rh enviam da empresa"  on storage.objects;

notify pgrst, 'reload schema';
