-- ============================================================================
-- Ayra Ponto — DESFAZ o ajuste "administrador único aprova o próprio pedido"
--
-- Volta a regra da Fase 3A: ninguém aprova o próprio pedido.
-- Os pedidos já aprovados continuam aprovados. Nada é apagado.
-- ============================================================================

begin;

create or replace function public.regras_solicitacao_fase3()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.comentario_analise := null;
    if new.anexo_path is not null then
      if new.tipo <> 'abono' then
        raise exception 'Só o pedido de abono pode ter atestado anexado.';
      end if;
      if not public.anexo_valido(new.anexo_path, new.perfil_id) then
        raise exception 'O arquivo anexado não foi encontrado. Envie o arquivo de novo.';
      end if;
    end if;
    return new;
  end if;

  -- alteração
  if new.anexo_path is distinct from old.anexo_path then
    raise exception 'O anexo de um pedido não pode ser trocado. Cancele e envie outro pedido.';
  end if;
  new.comentario_analise := nullif(btrim(new.comentario_analise), '');

  if old.perfil_id = v_uid then
    -- a própria pessoa só pode cancelar
    if new.status::text <> 'cancelado' then
      raise exception 'Você não pode analisar o seu próprio pedido. Você só pode cancelá-lo.';
    end if;
    new.comentario_analise := null;
    return new;
  end if;

  if new.status::text = 'cancelado' then
    raise exception 'Só quem fez o pedido pode cancelá-lo.';
  end if;
  if new.status::text = 'rejeitado' and new.comentario_analise is null then
    raise exception 'Para recusar, explique o motivo no comentário. A pessoa vai ler a resposta.';
  end if;
  if old.tipo = 'abono' and public.tipo_do_usuario() not in ('administrador', 'rh') then
    raise exception 'Pedidos de abono são analisados pelo RH ou pelo administrador.';
  end if;
  return new;
end;
$$;

-- a função pode_aprovar_proprio() fica: o Fechamento do mês ainda a consulta

commit;

notify pgrst, 'reload schema';
