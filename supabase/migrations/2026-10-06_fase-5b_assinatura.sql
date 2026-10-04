-- ============================================================================
-- Ayra Ponto — Fase 5B: assinatura digital (Portaria 671, arts. 79, 80, 87 e 88)
--
-- O que esta migração faz (nada existente é alterado ou apagado):
--   1. Cria o cofre "certificados" (Storage, privado). Lá fica o certificado
--      A1 da Ayra Soluções (arquivo certificado-a1.pfx). Ninguém do app lê ou
--      escreve nele: só a função de assinatura, pelo servidor.
--   2. dados_comprovante(): devolve o que vai no Comprovante de Registro de
--      Ponto do Trabalhador (art. 79), para a própria pessoa ou para o
--      administrador e o RH da empresa.
--
-- A assinatura em si é feita pela Edge Function "assinar" (supabase/functions).
-- Pode ser executada mais de uma vez sem problema.
-- Para desligar: 2026-10-06_fase-5b_assinatura_DESFAZER.sql
-- ============================================================================

do $$
begin
  if to_regprocedure('public.gerar_afd(uuid,date,date)') is null then
    raise exception 'Antes desta migração é preciso aplicar a Fase 5A.';
  end if;
end $$;

-- 1. Cofre do certificado (sem nenhuma política: só o servidor acessa)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('certificados', 'certificados', false, 102400, null)
on conflict (id) do update set public = false;

-- 2. Dados do comprovante de uma marcação
create or replace function public.dados_comprovante(p_registro uuid)
returns jsonb
language plpgsql stable security definer
set search_path = public
as $$
declare
  r    registros_ponto;
  v    record;
  f    filiais;
  p    perfis;
  v_sis ayra_sistema;
  v_local timestamp;
begin
  select * into r from registros_ponto where id = p_registro;
  if r.id is null then
    raise exception 'Marcação não encontrada.';
  end if;
  select * into p from perfis where id = r.perfil_id;
  select * into f from filiais where id = r.filial_id;
  if auth.uid() is null
     or not (r.perfil_id = auth.uid()
             or ((select tipo_do_usuario()) in ('administrador', 'rh') and f.empresa_id = (select empresa_do_usuario()))) then
    raise exception 'Você só pode ver os comprovantes das suas próprias marcações.';
  end if;

  select * into v from afd_empregador(r.filial_id);
  select * into v_sis from ayra_sistema limit 1;
  v_local := r.marcado_em at time zone coalesce(f.fuso_horario, 'America/Sao_Paulo');

  return jsonb_build_object(
    'registro_id', r.id,
    'nsr',         r.nsr,
    'tipo',        r.tipo,
    'data',        to_char(v_local, 'DD/MM/YYYY'),
    'hora',        to_char(v_local, 'HH24:MI:SS'),
    'fuso',        substr(afd_dh(r.marcado_em, f.fuso_horario), 20, 5),
    'data_hora_iso', afd_dh(r.marcado_em, f.fuso_horario),
    'empregador',  jsonb_build_object('tipo_id', v.tipo_id, 'documento', v.id_empregador, 'cno_caepf', nullif(v.cno_caepf, ''),
                                      'razao_social', v.razao, 'local', v.local),
    'unidade',     f.nome,
    'trabalhador', jsonb_build_object('nome', p.nome_completo, 'cpf', p.cpf),
    'inpi',        v_sis.inpi_registro,
    'programa',    v_sis.nome_programa,
    'hash',        (select substr(a.linha, 74, 64) from afd_registros a where a.registro_id = r.id),
    'origem',      r.origem
  );
end;
$$;
comment on function public.dados_comprovante(uuid) is
  'Dados do Comprovante de Registro de Ponto do Trabalhador (art. 79). A própria pessoa, o administrador e o RH.';

revoke execute on function public.dados_comprovante(uuid) from public, anon;
grant  execute on function public.dados_comprovante(uuid) to authenticated;

notify pgrst, 'reload schema';
