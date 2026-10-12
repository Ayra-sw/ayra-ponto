import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { FileSignature } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'

// Fase 7C: na tela inicial, lembra a pessoa de conferir e assinar o espelho
// dos meses já fechados pela empresa. Sem a 7C no banco, não aparece nada.
export default function AvisoAssinar({ base = '' }) {
  const [pendentes, setPendentes] = useState([])

  useEffect(() => {
    let vivo = true
    supabase.rpc('minhas_conferencias').then(({ data, error }) => {
      if (!vivo || error || !Array.isArray(data)) return
      setPendentes(data.filter((c) => c.status === 'pendente'))
    })
    return () => { vivo = false }
  }, [])

  if (!pendentes.length) return null
  const c = pendentes[0]
  const mes = String(c.competencia).slice(0, 7)
  const outros = pendentes.length - 1
  return (
    <section className="cartao conferir aviso-assinar-cartao" aria-labelledby="t-aviso-assinar">
      <FileSignature className="conferir__icone" aria-hidden="true" />
      <div className="conferir__texto">
        <h2 id="t-aviso-assinar">Seu espelho de {c.nome} está pronto</h2>
        <p className="suave">
          Confira os dias e as horas e assine com a sua digital ou senha.
          {outros > 0 && ` Há mais ${outros === 1 ? '1 mês' : `${outros} meses`} esperando.`}
        </p>
      </div>
      <div className="acoes conferir__acoes">
        <Link to={`${base}?mes=${mes}`} className="btn btn--primario">Conferir e assinar</Link>
      </div>
    </section>
  )
}
