import { Fragment } from 'react'
import { Link } from 'react-router-dom'
import { CircleAlert, Lightbulb } from 'lucide-react'
import { resolverLink } from '../../lib/ajuda'

// Texto com **negrito** e [link](destino). Link sem destino para quem lê vira negrito.
function Texto({ children, contexto, aoNavegar }) {
  const partes = String(children).split(/(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g)
  return partes.map((p, i) => {
    const negrito = p.match(/^\*\*([^*]+)\*\*$/)
    if (negrito) return <strong key={i}>{negrito[1]}</strong>
    const link = p.match(/^\[([^\]]+)\]\(([^)]+)\)$/)
    if (link) {
      const para = resolverLink(link[2], contexto)
      return para
        ? <Link key={i} to={para} className="link" onClick={aoNavegar}>{link[1]}</Link>
        : <strong key={i}>{link[1]}</strong>
    }
    return <Fragment key={i}>{p}</Fragment>
  })
}

export default function ConteudoArtigo({ artigo, contexto, aoNavegar }) {
  const t = (s) => <Texto contexto={contexto} aoNavegar={aoNavegar}>{s}</Texto>
  return (
    <div className="artigo">
      {artigo.corpo.map((b, i) => {
        if (typeof b === 'string') return <p key={i}>{t(b)}</p>
        if (b.tipo === 'sub') return <h3 key={i} className="artigo__sub">{b.titulo}</h3>
        if (b.tipo === 'passos') return <ol key={i} className="artigo__passos">{b.itens.map((x, j) => <li key={j}>{t(x)}</li>)}</ol>
        if (b.tipo === 'lista') return <ul key={i} className="artigo__lista">{b.itens.map((x, j) => <li key={j}>{t(x)}</li>)}</ul>
        if (b.tipo === 'dica' || b.tipo === 'atencao') {
          const Icone = b.tipo === 'dica' ? Lightbulb : CircleAlert
          return (
            <div key={i} className={`artigo__nota artigo__nota--${b.tipo}`}>
              <Icone aria-hidden="true" />
              <p><span className="sr-only">{b.tipo === 'dica' ? 'Dica: ' : 'Atenção: '}</span>{t(b.texto)}</p>
            </div>
          )
        }
        return null
      })}
    </div>
  )
}
