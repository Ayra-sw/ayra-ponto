import { NavLink, Outlet } from 'react-router-dom'
import { House, UserRound } from 'lucide-react'
import TopBar from '../TopBar'
import Marca from './Marca'

const ITENS = [
  { para: '/', texto: 'Início', icone: House, fim: true },
  { para: '/conta', texto: 'Minha conta', icone: UserRound },
]

// Estrutura das telas do colaborador: simples, com a ação de registrar
// ponto sempre na primeira tela. Barra inferior no celular.
export default function ShellColaborador() {
  return (
    <div className="shell shell--colaborador">
      <a href="#conteudo" className="pular-conteudo">Pular para o conteúdo</a>
      <div className="shell__conteudo">
        <TopBar
          esquerda={<Marca />}
          acoes={
            <nav className="navegacao-topo" aria-label="Menu principal">
              {ITENS.map((i) => <NavLink key={i.para} to={i.para} end={i.fim}>{i.texto}</NavLink>)}
            </nav>
          }
        />
        <main id="conteudo" tabIndex={-1}>
          <Outlet />
        </main>
      </div>
      <nav className="barra-inferior" aria-label="Menu principal">
        {ITENS.map(({ para, texto, icone: Icone, fim }) => (
          <NavLink key={para} to={para} end={fim} className="barra-inferior__item">
            <Icone aria-hidden="true" />
            {texto}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
