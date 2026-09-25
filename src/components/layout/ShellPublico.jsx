import { Link } from 'react-router-dom'
import Marca from './Marca'
import BotaoTema from './BotaoTema'

// Telas sem login: entrar, criar conta, convite, senha, onboarding.
export default function ShellPublico({ titulo, subtitulo, children, rodape }) {
  return (
    <main className="publico" id="conteudo">
      <div className="publico__caixa">
        <Link to="/" className="marca" aria-label="Ayra Ponto, início"><Marca /></Link>
        <div className="publico__cartao">
          {(titulo || subtitulo) && (
            <div className="publico__cabecalho">
              {titulo && <h1>{titulo}</h1>}
              {subtitulo && <p className="suave">{subtitulo}</p>}
            </div>
          )}
          {children}
        </div>
        {rodape && <div className="publico__rodape">{rodape}</div>}
        <div className="publico__tema"><BotaoTema comTexto /></div>
      </div>
    </main>
  )
}
