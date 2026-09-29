import { useSearchParams } from 'react-router-dom'
import { lerMes, textoDoMes } from '../../lib/apuracao'
import Turnos from '../../components/escalas/Turnos'
import CalendarioMes from '../../components/escalas/CalendarioMes'

const ABAS = [
  { id: 'calendario', rotulo: 'Calendário do mês' },
  { id: 'turnos', rotulo: 'Turnos' },
]

// Escalas: os turnos e a grade do mês da escala por calendário.
// (Quem trabalha em 12x36 aparece na grade, mas é configurado na ficha da pessoa.)
export default function Escalas() {
  const [busca, setBusca] = useSearchParams()
  const aba = busca.get('aba') === 'turnos' ? 'turnos' : 'calendario'
  const mes = lerMes(busca.get('mes'))
  const irPara = (nova, extra = {}) => setBusca({ aba: nova, ...(nova === 'calendario' ? { mes: textoDoMes(mes) } : {}), ...extra }, { replace: true })

  return (
    <div className="pagina">
      <div className="pagina__cabecalho">
        <div className="pagina__titulo">
          <span className="pagina__trilha">Jornada</span>
          <h1>Escalas</h1>
          <p className="suave">Turnos e escala por calendário. Para a 12x36, escolha o turno na ficha da pessoa.</p>
        </div>
      </div>

      <div className="abas" role="tablist" aria-label="Seções das escalas">
        {ABAS.map((a) => (
          <button key={a.id} type="button" role="tab" aria-selected={aba === a.id} className="abas__item" onClick={() => irPara(a.id)}>{a.rotulo}</button>
        ))}
      </div>

      {aba === 'turnos'
        ? <Turnos />
        : <CalendarioMes mes={mes} aoMudarMes={(m) => setBusca({ aba: 'calendario', mes: textoDoMes(m) }, { replace: true })} aoIrParaTurnos={() => irPara('turnos')} />}
    </div>
  )
}
