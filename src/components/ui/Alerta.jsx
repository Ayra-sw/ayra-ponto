import { CircleAlert, CircleCheck, Info, TriangleAlert } from 'lucide-react'

const ICONE = { info: Info, atencao: TriangleAlert, problema: CircleAlert, ok: CircleCheck }

// Mensagem dentro da página. tom: 'info' | 'atencao' | 'problema' | 'ok'
export default function Alerta({ tom = 'info', titulo, children, acao }) {
  const Icone = ICONE[tom]
  return (
    <div className={`alerta alerta--${tom}`} role={tom === 'problema' ? 'alert' : 'status'}>
      <Icone aria-hidden="true" />
      <div className="alerta__corpo">
        {titulo && <strong>{titulo}</strong>}
        {children && <div>{children}</div>}
        {acao}
      </div>
    </div>
  )
}
