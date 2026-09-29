import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import { FileClock, History, House, UserRound, Users } from 'lucide-react'
import useEquipe from '../../hooks/useEquipe'
import TopBar from '../TopBar'
import Marca from './Marca'

const ITENS = [
  { para: '/', texto: 'Início', icone: House, fim: true },
  { para: '/historico', texto: 'Histórico', icone: History },
  { para: '/espelho', texto: 'Espelho', icone: FileClock },
  { para: '/conta', texto: 'Minha conta', icone: UserRound },
]
const EQUIPE = { para: '/equipe', texto: 'Equipe', icone: Users }

// Estrutura das telas do colaborador: simples, com a ação de registrar
// ponto sempre na primeira tela. Barra inferior no celular.
// Quem é gestor de algum departamento ganha o item "Equipe".
export default function ShellColaborador() {
  const equipe = useEquipe()
  const local = useLocation()
  const { recarregar } = equipe
  useEffect(() => { recarregar() }, [local.pathname, recarregar])

  const itens = equipe.ehGestor ? [...ITENS.slice(0, 3), EQUIPE, ITENS[3]] : ITENS
  const contador = (i) => (i.para === '/equipe' && equipe.pendentes > 0 ? equipe.pendentes : 0)

  return (
    <div className="shell shell--colaborador">
      <a href="#conteudo" className="pular-conteudo">Pular para o conteúdo</a>
      <div className="shell__conteudo">
        <TopBar
          esquerda={<Marca />}
          acoes={
            <nav className="navegacao-topo" aria-label="Menu principal">
              {itens.map((i) => (
                <NavLink key={i.para} to={i.para} end={i.fim}>
                  {i.texto}
                  {contador(i) > 0 && <span className="navegacao-topo__contador" aria-label={`${contador(i)} pedidos esperando`}>{contador(i)}</span>}
                </NavLink>
              ))}
            </nav>
          }
        />
        <main id="conteudo" tabIndex={-1}>
          <Outlet context={{ equipe }} />
        </main>
      </div>
      <nav className={`barra-inferior${itens.length > 4 ? ' barra-inferior--5' : ''}`} aria-label="Menu principal">
        {itens.map(({ para, texto, icone: Icone, fim }) => (
          <NavLink key={para} to={para} end={fim} className="barra-inferior__item">
            <span className="barra-inferior__icone">
              <Icone aria-hidden="true" />
              {contador({ para }) > 0 && <span className="barra-inferior__contador" aria-label={`${contador({ para })} pedidos esperando`}>{contador({ para })}</span>}
            </span>
            {texto}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
