import { useOutletContext } from 'react-router-dom'
import CentralSolicitacoes from '../../components/solicitacoes/CentralSolicitacoes'

// Central de solicitações da empresa (administrador e RH).
export default function Solicitacoes() {
  const { atualizarPendentes } = useOutletContext()
  return (
    <div className="pagina">
      <div className="pagina__cabecalho">
        <div className="pagina__titulo">
          <span className="pagina__trilha">Gestão</span>
          <h1>Solicitações</h1>
          <p className="suave">Pedidos de ajuste, abono e folga. Os gestores também analisam os da própria equipe (menos abono, que é só com o RH).</p>
        </div>
      </div>
      <CentralSolicitacoes modo="gestao" aoAnalisar={atualizarPendentes} />
    </div>
  )
}
