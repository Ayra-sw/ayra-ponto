-- ============================================================================
-- Ayra Ponto — Ajuste: administrador único aprova o próprio pedido
--
-- O que muda (nenhuma marcação, pedido ou cálculo antigo muda):
--   1. Quem é a única pessoa da gestão (administrador ou RH ativo) na empresa
--      pode aprovar o próprio pedido. Com outro administrador ou RH ativo,
--      continua como antes: outra pessoa analisa. Fica no Histórico de
--      alterações como "aprovou o próprio pedido".
--   2. Fechamento do mês: a lista de pedidos esperando resposta mostra de
--      quem é cada pedido (e marca o seu).
--
-- Precisa das Fases 3A e 7B. Pode ser executada mais de uma vez sem problema.
-- Para desligar: 2026-10-13_ajuste_aprovar-proprio-pedido_DESFAZER.sql
-- ============================================================================

do $$
begin
  if to_regprocedure('public.pendencias_fechamento(date)') is null
     or to_regprocedure('public.regras_solicitacao_fase3()') is null then
    raise exception 'Antes deste ajuste é preciso aplicar as Fases 3A e 7B.';
  end if;
end $$;

begin;

-- 1. A pessoa é a única da gestão na empresa?
create or replace function public.pode_aprovar_proprio()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(tipo_do_usuario()::text in ('administrador', 'rh'), false)
     and not exists (select 1 from perfis p
                      where p.empresa_id = empresa_do_usuario()
                        and p.id <> auth.uid()
                        and p.tipo::text in ('administrador', 'rh')
                        and p.status::text = 'ativo');
$$;
revoke execute on function public.pode_aprovar_proprio() from public, anon;
grant  execute on function public.pode_aprovar_proprio() to authenticated;

-- 2. Regras da análise (Fase 3A), agora com a exceção acima
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
    -- a própria pessoa pode cancelar; o administrador (ou RH) que é a única
    -- pessoa da gestão na empresa também pode aprovar o próprio pedido
    if new.status::text = 'aprovado' and public.pode_aprovar_proprio() then
      return new;
    end if;
    if new.status::text <> 'cancelado' then
      if public.tipo_do_usuario() in ('administrador', 'rh') then
        raise exception 'O seu próprio pedido precisa ser analisado por outra pessoa da gestão (outro administrador ou o RH). Você pode cancelá-lo.';
      end if;
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

-- 3. Pendências do fechamento (Fase 7B), agora com o nome de quem fez cada pedido
create or replace function public.pendencias_fechamento(p_competencia date)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_emp   uuid := empresa_do_usuario();
  v_comp  date := date_trunc('month', p_competencia)::date;
  v_fim   date := (date_trunc('month', p_competencia) + interval '1 month - 1 day')::date;
  v_hoje  date;
  v_f     fechamentos;
  v_inc   jsonb := '[]'::jsonb;
  v_semj  jsonb := '[]'::jsonb;
  v_dias  jsonb;
  v_ped   integer;
  v_peds  jsonb := '[]'::jsonb;
  v_total integer := 0;
  v_n     integer := 0;
  p       record;
begin
  if auth.uid() is null or tipo_do_usuario() not in ('administrador', 'rh') then
    raise exception 'Somente o administrador ou o RH podem ver o fechamento do mês.';
  end if;
  v_hoje := hoje_da_empresa(v_emp);
  select * into v_f from fechamentos where empresa_id = v_emp and competencia = v_comp;

  for p in select * from pessoas_do_fechamento(v_emp, v_comp) loop
    v_n := v_n + 1;
    v_dias := null;
    if v_comp <= v_hoje then
      select jsonb_agg(a.data order by a.data) into v_dias
        from apurar_clt(p.perfil_id, v_comp, least(v_fim, v_hoje)) a
       where a.situacao = 'incompleto';
    end if;
    if v_dias is not null then
      v_inc := v_inc || jsonb_build_object('perfil_id', p.perfil_id, 'nome', p.nome_completo, 'dias', v_dias);
      v_total := v_total + jsonb_array_length(v_dias);
    end if;
    if exists (select 1 from perfis x where x.id = p.perfil_id and x.modelo_jornada_id is null
                 and coalesce(x.tipo_escala, 'semanal') = 'semanal') then
      v_semj := v_semj || jsonb_build_object('perfil_id', p.perfil_id, 'nome', p.nome_completo);
      v_total := v_total + 1;
    end if;
  end loop;

  select count(*) into v_ped
    from ajustes_ponto a
    join perfis x on x.id = a.perfil_id
   where x.empresa_id = v_emp
     and a.status::text = 'pendente'
     and coalesce(a.data_referencia, (a.marcacao_solicitada at time zone 'America/Sao_Paulo')::date) <= v_fim
     and coalesce(a.data_fim, a.data_referencia, (a.marcacao_solicitada at time zone 'America/Sao_Paulo')::date) >= v_comp;
  v_total := v_total + v_ped;

  -- de quem são os pedidos (o próprio pedido aparece marcado)
  select coalesce(jsonb_agg(jsonb_build_object('perfil_id', q.perfil_id, 'nome', q.nome, 'quantidade', q.n,
                                               'proprio', q.perfil_id = auth.uid()) order by q.nome), '[]'::jsonb)
    into v_peds
    from (select a.perfil_id, x.nome_completo as nome, count(*) as n
            from ajustes_ponto a
            join perfis x on x.id = a.perfil_id
           where x.empresa_id = v_emp
             and a.status::text = 'pendente'
             and coalesce(a.data_referencia, (a.marcacao_solicitada at time zone 'America/Sao_Paulo')::date) <= v_fim
             and coalesce(a.data_fim, a.data_referencia, (a.marcacao_solicitada at time zone 'America/Sao_Paulo')::date) >= v_comp
           group by a.perfil_id, x.nome_completo) q;

  return jsonb_build_object(
    'competencia', v_comp,
    'nome', nome_do_mes(v_comp),
    'mes_terminou', v_fim < v_hoje,
    'pode_fechar_em', (v_fim + 1),
    'pessoas', v_n,
    'incompletos', v_inc,
    'sem_jornada', v_semj,
    'pedidos_pendentes', v_ped,
    'pedidos', v_peds,
    'pode_aprovar_proprio', pode_aprovar_proprio(),
    'total_pendencias', v_total,
    'fechamento', case when v_f.id is null then null else jsonb_build_object(
      'id', v_f.id, 'status', v_f.status, 'fechado_em', v_f.fechado_em, 'fechado_por_nome', v_f.fechado_por_nome,
      'pendencias', v_f.pendencias, 'pessoas', v_f.pessoas, 'reaberto_em', v_f.reaberto_em,
      'motivo_reabertura', v_f.motivo_reabertura) end);
end;
$$;

commit;

notify pgrst, 'reload schema';

-- Pronto. Rode em seguida supabase/testes/conferencia-ajuste-aprovar-proprio.sql.
