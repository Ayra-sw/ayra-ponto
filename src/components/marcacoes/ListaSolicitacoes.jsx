import { useCallback, useEffect, useState } from 'react'
import { Inbox } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { dataHora } from '../../lib/formatos'
import { TIPO_SOLICITACAO } from '../../lib/rotulos'
import { STATUS_SOLICITACAO, descreverPedido } from '../../lib/ajustes'
import Etiqueta from '../ui/Etiqueta'
import { Esqueleto, EstadoErro, EstadoVazio } from '../ui/Estados'

// Pedidos de ajuste de uma pessoa, do mais novo para o mais antigo.
export default function ListaSolicitacoes({ perfilId, atualizarEm, aoCarregar, textoVazio }) {
  const [lista, setLista] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(false)

  const carregar = useCallback(async () => {
    setErro(false)
    const { data, error } = await supabase
      .from('ajustes_ponto')
      .select('*, analista:perfis!ajustes_ponto_analisado_por_fkey(nome_completo)')
      .eq('perfil_id', perfilId)
      .order('criado_em', { ascending: false })
      .limit(100)
    if (error) setErro(true)
    setLista(data || [])
    setCarregando(false)
    aoCarregar?.(data || [])
  }, [perfilId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { carregar() }, [carregar, atualizarEm])

  if (carregando) return <Esqueleto linhas={4} />
  if (erro) return <EstadoErro aoTentarDeNovo={carregar} />
  if (lista.length === 0) {
    return (
      <EstadoVazio icone={Inbox} titulo="Nenhuma solicitação por aqui">
        {textoVazio || 'Quando houver um pedido de ajuste, abono ou folga, ele aparece aqui com a resposta.'}
      </EstadoVazio>
    )
  }

  return (
    <div className="lista-cartoes" style={{ display: 'grid', gap: 10 }}>
      {lista.map((a) => {
        const s = STATUS_SOLICITACAO[a.status] || STATUS_SOLICITACAO.pendente
        return (
          <div key={a.id} className="cartao-linha" style={{ cursor: 'default' }}>
            <div className="cartao-linha__topo">
              <span className="cartao-linha__titulo">{TIPO_SOLICITACAO[a.tipo] || a.tipo}</span>
              <Etiqueta tom={s.tom}>{s.rotulo}</Etiqueta>
            </div>
            {descreverPedido(a) && <p><strong>{descreverPedido(a)}</strong></p>}
            <p className="suave">{a.motivo}</p>
            <div className="cartao-linha__detalhes">
              <span>Enviada em {dataHora(a.criado_em)}</span>
              {a.analisado_em && <span>Analisada em {dataHora(a.analisado_em)}{a.analista?.nome_completo ? ` por ${a.analista.nome_completo}` : ''}</span>}
            </div>
          </div>
        )
      })}
    </div>
  )
}
