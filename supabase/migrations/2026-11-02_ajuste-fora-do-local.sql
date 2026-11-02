-- Novo pedido de ajuste: "Estava fora do local".
-- O colaborador explica que estava fora da unidade (visita a cliente, trabalho externo).
-- Só informa o dia e o motivo. Não muda horário e não entra no cálculo de horas:
-- é um pedido para o RH analisar.

alter type public.tipo_ajuste add value if not exists 'fora_do_local';

create or replace function public.rotulo_pedido(p_tipo text)
returns text
language sql
immutable
as $$
  select case p_tipo
    when 'correcao_marcacao' then 'correção de marcação'
    when 'inclusao_esquecida' then 'marcação esquecida'
    when 'abono' then 'abono'
    when 'folga' then 'folga'
    when 'fora_do_local' then 'fora do local'
    else p_tipo end;
$$;
