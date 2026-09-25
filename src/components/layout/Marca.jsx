import { Clock } from 'lucide-react'

export default function Marca({ clara = false, somenteSimbolo = false }) {
  return (
    <span className={`marca${clara ? ' marca--clara' : ''}`}>
      <span className="marca__simbolo" aria-hidden="true"><Clock /></span>
      {!somenteSimbolo && <span className="marca__nome"><b>Ayra</b> Ponto</span>}
    </span>
  )
}
