import { useEffect, useId, useRef, useState } from 'react'
import { CircleHelp } from 'lucide-react'

// Ajuda contextual: um "?" que explica a opção em linguagem simples.
export default function Dica({ texto, rotulo = 'Ajuda' }) {
  const [aberta, setAberta] = useState(false)
  const id = useId()
  const ref = useRef(null)

  useEffect(() => {
    if (!aberta) return
    function fora(e) { if (ref.current && !ref.current.contains(e.target)) setAberta(false) }
    function tecla(e) { if (e.key === 'Escape') setAberta(false) }
    document.addEventListener('pointerdown', fora)
    document.addEventListener('keydown', tecla)
    return () => {
      document.removeEventListener('pointerdown', fora)
      document.removeEventListener('keydown', tecla)
    }
  }, [aberta])

  return (
    <span className="dica" ref={ref}>
      <button
        type="button"
        className="dica__botao"
        aria-label={rotulo}
        aria-expanded={aberta}
        aria-describedby={aberta ? id : undefined}
        onClick={() => setAberta((v) => !v)}
      >
        <CircleHelp aria-hidden="true" />
      </button>
      {aberta && <span role="tooltip" id={id} className="dica__balao">{texto}</span>}
    </span>
  )
}
