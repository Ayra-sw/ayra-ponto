import { Link } from 'react-router-dom'
import { Clock, Lock, Mail, MessageCircle } from 'lucide-react'
import { linkEmail, linkWhatsApp } from '../../lib/suporte'

// Fase 8A: empresa suspensa pela Central Ayra. A gestão vê só este aviso;
// os funcionários continuam batendo ponto normalmente.
export default function EmpresaSuspensa({ empresa }) {
  const whats = linkWhatsApp({ empresa, tela: 'Acesso suspenso' })
  const email = linkEmail({ empresa, tela: 'Acesso suspenso' })
  return (
    <div className="pagina" style={{ maxWidth: 720 }}>
      <section className="cartao suspensa" aria-labelledby="t-suspensa">
        <Lock className="suspensa__icone" aria-hidden="true" />
        <h1 id="t-suspensa">O acesso da gestão está suspenso</h1>
        <p>
          Para voltar a usar o Ayra Ponto, entre em contato com a <strong>Ayra Soluções</strong>.
        </p>
        <p className="suave">
          Fique tranquilo: os funcionários continuam batendo ponto normalmente, e nenhuma marcação se perde.
        </p>
        <div className="acoes suspensa__acoes">
          {whats && <a className="btn btn--primario" href={whats} target="_blank" rel="noopener noreferrer"><MessageCircle aria-hidden="true" /> Falar no WhatsApp</a>}
          {email && <a className="btn btn--secundario" href={email}><Mail aria-hidden="true" /> Mandar e-mail</a>}
          <Link to="/gestao/meu-ponto" className="btn btn--secundario"><Clock aria-hidden="true" /> Registrar meu ponto</Link>
        </div>
      </section>
    </div>
  )
}
