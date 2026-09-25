import { Check, CircleAlert, Clock, Coffee, Minus, Plus, TriangleAlert, CircleX, Info } from 'lucide-react'

// Status sempre com ícone e texto, nunca só cor.
const ICONES = {
  ok: Check,
  atencao: CircleAlert,
  problema: CircleX,
  info: Info,
  neutra: Minus,
  atraso: Clock,
  intervalo: Coffee,
  extra: Plus,
  inconsistencia: TriangleAlert,
}

// tom: 'ok' | 'atencao' | 'problema' | 'info' | 'neutra'
export default function Etiqueta({ tom = 'neutra', icone, children }) {
  const Icone = icone === false ? null : icone || ICONES[tom] || Minus
  return (
    <span className={`etiqueta etiqueta--${tom}`}>
      {Icone && <Icone aria-hidden="true" />}
      {children}
    </span>
  )
}

export { ICONES }
