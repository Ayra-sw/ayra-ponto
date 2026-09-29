import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import EspelhoMensal from '../components/espelho/EspelhoMensal'
import BancoHoras from '../components/banco/BancoHoras'
import PedirAjuste from '../components/marcacoes/PedirAjuste'

const ABAS = [
  { id: 'espelho', rotulo: 'Espelho do mês' },
  { id: 'banco', rotulo: 'Banco de horas' },
]

// Espelho de ponto do próprio usuário (colaborador em /espelho, gestão em /gestao/meu-espelho).
export default function MeuEspelho() {
  const { perfil } = useAuth()
  const [busca, setBusca] = useSearchParams()
  const [pedido, setPedido] = useState(null)
  const [versao, setVersao] = useState(0)
  const aba = busca.get('aba') === 'banco' ? 'banco' : 'espelho'

  return (
    <div className="pagina" style={{ maxWidth: 980 }}>
      <div className="pagina__cabecalho nao-imprimir">
        <div className="pagina__titulo">
          <h1>Meu espelho de ponto</h1>
          <p className="suave">Suas horas do mês, dia a dia: marcações, atrasos, horas extras e faltas.</p>
        </div>
      </div>
      <div className="abas nao-imprimir" role="tablist" aria-label="Seções do espelho">
        {ABAS.map((a) => (
          <button key={a.id} type="button" role="tab" aria-selected={aba === a.id} className="abas__item"
            onClick={() => setBusca(a.id === 'espelho' ? {} : { aba: a.id }, { replace: true })}>{a.rotulo}</button>
        ))}
      </div>
      {aba === 'banco' ? (
        <BancoHoras perfilId={perfil.id} nomePessoa={perfil.nome_completo} podeLancar={false} />
      ) : (
        <EspelhoMensal
          perfilId={perfil.id}
          mesInicial={busca.get('mes')}
          aoMudarMes={(m) => setBusca({ mes: m }, { replace: true })}
          aoPedirAjuste={(inicial) => setPedido(inicial)}
          atualizarEm={versao}
        />
      )}
      <PedirAjuste
        aberto={Boolean(pedido)}
        inicial={pedido}
        perfilId={perfil.id}
        aoFechar={() => setPedido(null)}
        aoEnviado={() => setVersao((v) => v + 1)}
      />
    </div>
  )
}
