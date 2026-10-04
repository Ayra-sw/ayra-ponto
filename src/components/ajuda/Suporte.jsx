import { Mail, MessageCircle } from 'lucide-react'
import { linkEmail, linkWhatsApp } from '../../lib/suporte'

// Quem ajuda depende de quem lê:
//   gestao e publico: o suporte do Ayra Ponto (WhatsApp e e-mail)
//   colaborador: o RH da própria empresa (é quem cuida de horas, jornada e pedidos)
export default function Suporte({ contexto, empresa, tela, compacto = false }) {
  if (contexto === 'colaborador') {
    return (
      <div className={`suporte${compacto ? ' suporte--compacto' : ''}`}>
        <strong>Ainda com dúvida?</strong>
        <p className="suave pequeno">Para dúvidas sobre suas horas, jornada, escala ou pedidos, fale com o RH da sua empresa.</p>
      </div>
    )
  }
  const whats = linkWhatsApp({ empresa, tela })
  const email = linkEmail({ empresa, tela })
  if (!whats && !email) return null
  return (
    <div className={`suporte${compacto ? ' suporte--compacto' : ''}`}>
      <strong>{contexto === 'publico' ? 'Não conseguiu resolver?' : 'Ainda com dúvida?'}</strong>
      <p className="suave pequeno">Fale com o suporte do Ayra Ponto.</p>
      <div className="linha">
        {whats && (
          <a className="btn btn--secundario btn--pequeno" href={whats} target="_blank" rel="noopener noreferrer">
            <MessageCircle aria-hidden="true" /> WhatsApp
          </a>
        )}
        {email && (
          <a className="btn btn--secundario btn--pequeno" href={email}>
            <Mail aria-hidden="true" /> E-mail
          </a>
        )}
      </div>
    </div>
  )
}
