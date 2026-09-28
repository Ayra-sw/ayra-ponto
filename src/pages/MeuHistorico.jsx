import { useState } from 'react'
import { MessageSquarePlus } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import Botao from '../components/ui/Botao'
import HistoricoMarcacoes from '../components/marcacoes/HistoricoMarcacoes'
import ListaSolicitacoes from '../components/marcacoes/ListaSolicitacoes'
import PedirAjuste from '../components/marcacoes/PedirAjuste'

// Histórico do próprio colaborador: marcações por dia e pedidos de ajuste.
export default function MeuHistorico() {
  const { perfil } = useAuth()
  const [aba, setAba] = useState('marcacoes')
  const [pedido, setPedido] = useState(null) // null = fechado; {} = aberto
  const [versao, setVersao] = useState(0)
  const [pendentes, setPendentes] = useState(0)

  return (
    <div className="pagina" style={{ maxWidth: 760 }}>
      <div className="pagina__cabecalho">
        <div className="pagina__titulo">
          <h1>Meu histórico</h1>
          <p className="suave">Suas marcações, dia a dia, e os pedidos de ajuste que você enviou.</p>
        </div>
        <Botao icone={MessageSquarePlus} onClick={() => setPedido({})}>Pedir ajuste</Botao>
      </div>

      <div className="abas" role="tablist" aria-label="Histórico">
        <button type="button" role="tab" aria-selected={aba === 'marcacoes'} className="abas__item" onClick={() => setAba('marcacoes')}>Marcações</button>
        <button type="button" role="tab" aria-selected={aba === 'pedidos'} className="abas__item" onClick={() => setAba('pedidos')}>
          Meus pedidos {pendentes > 0 && <span className="abas__contador">{pendentes}</span>}
        </button>
      </div>

      {aba === 'marcacoes' ? (
        <HistoricoMarcacoes perfilId={perfil.id} atualizarEm={versao} aoPedirAjuste={(inicial) => setPedido(inicial)} />
      ) : (
        <ListaSolicitacoes
          perfilId={perfil.id}
          atualizarEm={versao}
          aoCarregar={(lista) => setPendentes(lista.filter((a) => a.status === 'pendente').length)}
          textoVazio="Se esqueceu de bater o ponto ou registrou errado, use o botão “Pedir ajuste”."
        />
      )}

      <PedirAjuste
        aberto={Boolean(pedido)}
        inicial={pedido}
        perfilId={perfil.id}
        aoFechar={() => setPedido(null)}
        aoEnviado={() => { setVersao((v) => v + 1); setAba('pedidos') }}
      />
    </div>
  )
}
