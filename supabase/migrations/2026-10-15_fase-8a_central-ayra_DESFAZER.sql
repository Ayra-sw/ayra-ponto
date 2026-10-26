-- ============================================================================
-- Ayra Ponto — DESFAZ a Fase 8A (Central Ayra)
--
-- Tira as funções da Central e a suspensão (toda empresa volta a funcionar
-- normalmente). As tabelas e a coluna "situacao" ficam guardadas, sem uso.
-- Nenhuma marcação, pedido ou cálculo é alterado.
-- ============================================================================

begin;

-- volta as regras de antes (sem suspensão)
create or replace function public.tipo_do_usuario()
returns tipo_perfil
language sql
stable
security definer
set search_path = public
as $$
  select tipo from perfis where id = auth.uid();
$$;

create or replace function public.equipe_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select distinct p.id
    from departamento_gestores dg
    join perfis g on g.id = dg.perfil_id and g.status <> 'desligado'
    join perfis p on p.departamento_id = dg.departamento_id and p.empresa_id = dg.empresa_id
   where dg.perfil_id = auth.uid()
     and p.id <> auth.uid()
     and p.status <> 'desligado';
$$;

drop trigger if exists proteger_situacao_empresa on public.empresas;
drop function if exists public.proteger_situacao_empresa();
drop function if exists public.central_resumo();
drop function if exists public.central_empresa(uuid);
drop function if exists public.central_empresas();
drop function if exists public.central_mudar_situacao(uuid, text, text);
drop function if exists public.central_anotar(text, uuid, jsonb);
drop function if exists public.central_registro(integer);
drop function if exists public.central_salvar_contato(text, text);
drop function if exists public.exigir_dono(integer);
drop function if exists public.registrar_na_central(text, uuid, jsonb);
drop function if exists public.plataforma_tornar_dono(text, text);
drop function if exists public.eh_dono();

commit;

notify pgrst, 'reload schema';
