-- ============================================================================
-- Ayra Ponto — DESFAZ a Fase 5C (comprovante por e-mail)
--
-- Para o envio: tira o agendamento, o gatilho da fila e as funções do servidor.
-- O comprovante continua na tela e no Meu histórico, como na Fase 5B.
-- As tabelas (preferências e fila) ficam guardadas, sem uso: ao instalar a 5C
-- de novo, as escolhas de cada pessoa voltam como estavam.
-- ============================================================================

do $$
begin
  if to_regnamespace('cron') is not null and exists (select 1 from cron.job where jobname = 'ayra-comprovantes-email') then
    perform cron.unschedule('ayra-comprovantes-email');
  end if;
end $$;

drop trigger if exists fila_comprovante_email on public.registros_ponto;
drop function if exists public.fila_comprovante_entrar();
drop function if exists public.fila_comprovantes_chamar();
drop function if exists public.fila_comprovantes_preparar(text, text);
drop function if exists public.fila_comprovantes_token_ok(text);
drop function if exists public.fila_comprovantes_pegar(uuid, int);
drop function if exists public.fila_comprovantes_concluir(uuid, text, text, text);

-- dados_comprovante volta a ser a da Fase 5B (sem depender de comprovante_montar)
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

drop function if exists public.comprovante_montar(uuid);

notify pgrst, 'reload schema';
