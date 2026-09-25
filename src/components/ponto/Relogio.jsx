import { useEffect, useState } from 'react'
import { dataPorExtenso } from '../../lib/formatos'

// Componente isolado: só ele se redesenha a cada segundo.
export default function Relogio() {
  const [agora, setAgora] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setAgora(new Date()), 1000)
    return () => clearInterval(t)
  }, [])
  return (
    <div>
      <div className="ponto__relogio" aria-hidden="true">{agora.toLocaleTimeString('pt-BR')}</div>
      <p className="ponto__data">{dataPorExtenso(agora)}</p>
    </div>
  )
}
