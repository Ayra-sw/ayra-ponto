import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Search } from 'lucide-react'
import { diaIso } from '../../lib/ajustes'
import { GRUPOS } from '../../lib/historico'
import { conferirPeriodo } from '../../lib/relatorios'
import ListaHistorico from '../../components/historico/ListaHistorico'
import Alerta from '../../components/ui/Alerta'
import { Campo, Selecao } from '../../components/ui/Campo'

// Histórico de alterações da empresa (administrador e RH)
export default function Historico() {
  const [busca, setBusca] = useSearchParams()
  const inicio = busca.get('inicio') || diaIso(-29)
  const fim = busca.get('fim') || diaIso()
  const grupo = busca.get('grupo') || ''
  const [termo, setTermo] = useState('')
  const erro = conferirPeriodo(inicio, fim, 'pedidos')

  function mudar(k, v) {
    const n = new URLSearchParams(busca)
    if (v) n.set(k, v); else n.delete(k)
    setBusca(n, { replace: true })
  }

  return (
    <div className="pagina" style={{ maxWidth: 980 }}>
      <div className="pagina__cabecalho">
        <div className="pagina__titulo">
          <span className="pagina__trilha">Gestão</span>
          <h1>Histórico de alterações</h1>
          <p className="suave">Quem criou, alterou ou excluiu o quê, e quando. Ninguém consegue apagar nem editar este histórico.</p>
        </div>
      </div>
      <div className="filtros">
        <Campo rotulo="De" type="date" value={inicio} max={fim} onChange={(e) => mudar('inicio', e.target.value)} />
        <Campo rotulo="Até" type="date" value={fim} max={diaIso()} onChange={(e) => mudar('fim', e.target.value)} />
        <Selecao rotulo="O que mudou" value={grupo} onChange={(e) => mudar('grupo', e.target.value)}
          opcoes={[{ valor: '', rotulo: 'Tudo' }, ...GRUPOS.map((g) => ({ valor: g.id, rotulo: g.rotulo }))]} />
        <div className="campo campo--busca">
          <label className="campo__rotulo" htmlFor="busca-historico">Buscar</label>
          <div className="entrada-grupo">
            <input id="busca-historico" className="entrada" type="search" placeholder="Nome de quem fez ou de quem mudou" value={termo} onChange={(e) => setTermo(e.target.value)} />
            <span className="entrada-grupo__botao" aria-hidden="true"><Search /></span>
          </div>
        </div>
      </div>
      {erro ? <Alerta tom="atencao">{erro}</Alerta> : <ListaHistorico inicio={inicio} fim={fim} grupo={grupo} termo={termo} />}
      <p className="suave pequeno">CPF e telefone aparecem só como “(alterado)”, sem o número. As marcações de ponto não aparecem aqui: elas têm o próprio registro, com NSR, que nunca muda.</p>
    </div>
  )
}
