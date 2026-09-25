import { Link } from 'react-router-dom'
import { Menu } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { iniciais } from '../lib/formatos'
import BotaoTema from './layout/BotaoTema'
import Botao from './ui/Botao'

// Barra superior compartilhada pelas áreas de gestão e do colaborador.
export default function TopBar({ titulo, aoAbrirMenu, esquerda, acoes, linkConta = '/conta' }) {
  const { perfil } = useAuth()
  return (
    <header className="barra-superior">
      {aoAbrirMenu && (
        <span className="barra-superior__menu">
          <Botao variante="discreto" className="btn--icone" icone={Menu} onClick={aoAbrirMenu} aria-label="Abrir menu" />
        </span>
      )}
      {esquerda}
      {titulo && <div className="barra-superior__titulo">{titulo}</div>}
      <div className="barra-superior__acoes">
        {acoes}
        <BotaoTema />
        <Link to={linkConta} className="avatar" title="Minha conta" aria-label={`Minha conta (${perfil?.nome_completo || ''})`}>
          {iniciais(perfil?.nome_completo)}
        </Link>
      </div>
    </header>
  )
}
