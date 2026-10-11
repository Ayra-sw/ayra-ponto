import { useCallback, useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { FileArchive, LifeBuoy, BarChart3, BriefcaseBusiness, Building2, CalendarClock, CalendarRange, CalendarDays, Clock, FileClock, History, Inbox, LayoutDashboard, LogOut, ScrollText, MapPin, Network, PiggyBank, ScanFace, UserRound, Users, Calculator } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../contexts/AuthContext'
import useEmpresa from '../../hooks/useEmpresa'
import Marca from './Marca'
import TopBar from '../TopBar'
import ErroNaTela from '../app/ErroNaTela'
import { Suspense } from 'react'
import { Esqueleto } from '../ui/Estados'

const TITULOS = [
  ['/gestao/pessoas', 'Pessoas'],
  ['/gestao/departamentos', 'Departamentos'],
  ['/gestao/cargos', 'Cargos'],
  ['/gestao/jornadas', 'Jornadas'],
  ['/gestao/escalas', 'Escalas'],
  ['/gestao/feriados', 'Feriados'],
  ['/gestao/espelhos', 'Horas da equipe'],
  ['/gestao/banco-de-horas', 'Banco de horas'],
  ['/gestao/meu-historico', 'Meu histórico'],
  ['/gestao/meu-espelho', 'Meu espelho'],
  ['/gestao/solicitacoes', 'Solicitações'],
  ['/gestao/relatorios', 'Relatórios'],
  ['/gestao/historico', 'Histórico de alterações'],
  ['/gestao/arquivos-fiscais', 'Arquivos fiscais'],
  ['/gestao/reconhecimento', 'Reconhecimento facial'],
  ['/gestao/configuracoes/empresa', 'Empresa'],
  ['/gestao/configuracoes/unidades', 'Unidades'],
  ['/gestao/configuracoes/regras', 'Regras de cálculo'],
  ['/gestao/meu-ponto', 'Meu ponto'],
  ['/gestao/conta', 'Minha conta'],
  ['/gestao/ajuda', 'Central de ajuda'],
  ['/gestao', 'Visão geral'],
]

function ItemMenu({ para, icone: Icone, texto, contador, fim, aoClicar }) {
  return (
    <NavLink
      to={para}
      end={fim}
      className="menu-lateral__item"
      title={texto}
      data-contador={contador > 0 ? contador : undefined}
      onClick={aoClicar}
    >
      <Icone aria-hidden="true" />
      <span className="menu-lateral__texto">{texto}</span>
      {contador > 0 && <span className="menu-lateral__contador" aria-label={`${contador} pendentes`}>{contador}</span>}
    </NavLink>
  )
}

function Menu({ pendentes, pendentesFacial, aoNavegar }) {
  const { signOut } = useAuth()
  return (
    <nav className="menu-lateral" aria-label="Menu principal">
      <Link to="/gestao" className="menu-lateral__marca" onClick={aoNavegar} aria-label="Ayra Ponto, visão geral">
        <Marca clara />
      </Link>
      <ItemMenu para="/gestao" fim icone={LayoutDashboard} texto="Visão geral" aoClicar={aoNavegar} />
      <span className="menu-lateral__grupo">Pessoas</span>
      <ItemMenu para="/gestao/pessoas" icone={Users} texto="Colaboradores" aoClicar={aoNavegar} />
      <ItemMenu para="/gestao/departamentos" icone={Network} texto="Departamentos" aoClicar={aoNavegar} />
      <ItemMenu para="/gestao/cargos" icone={BriefcaseBusiness} texto="Cargos" aoClicar={aoNavegar} />
      <span className="menu-lateral__grupo">Jornada</span>
      <ItemMenu para="/gestao/jornadas" icone={CalendarClock} texto="Jornadas" aoClicar={aoNavegar} />
      <ItemMenu para="/gestao/escalas" icone={CalendarRange} texto="Escalas" aoClicar={aoNavegar} />
      <ItemMenu para="/gestao/feriados" icone={CalendarDays} texto="Feriados" aoClicar={aoNavegar} />
      <ItemMenu para="/gestao/espelhos" icone={FileClock} texto="Horas da equipe" aoClicar={aoNavegar} />
      <ItemMenu para="/gestao/banco-de-horas" icone={PiggyBank} texto="Banco de horas" aoClicar={aoNavegar} />
      <span className="menu-lateral__grupo">Gestão</span>
      <ItemMenu para="/gestao/solicitacoes" icone={Inbox} texto="Solicitações" contador={pendentes} aoClicar={aoNavegar} />
      <ItemMenu para="/gestao/relatorios" icone={BarChart3} texto="Relatórios" aoClicar={aoNavegar} />
      <ItemMenu para="/gestao/historico" icone={ScrollText} texto="Histórico de alterações" aoClicar={aoNavegar} />
      <ItemMenu para="/gestao/arquivos-fiscais" icone={FileArchive} texto="Arquivos fiscais" aoClicar={aoNavegar} />
      <ItemMenu para="/gestao/reconhecimento" icone={ScanFace} texto="Reconhecimento facial" contador={pendentesFacial} aoClicar={aoNavegar} />
      <span className="menu-lateral__grupo">Configurações</span>
      <ItemMenu para="/gestao/configuracoes/empresa" icone={Building2} texto="Empresa" aoClicar={aoNavegar} />
      <ItemMenu para="/gestao/configuracoes/unidades" icone={MapPin} texto="Unidades" aoClicar={aoNavegar} />
      <ItemMenu para="/gestao/configuracoes/regras" icone={Calculator} texto="Regras de cálculo" aoClicar={aoNavegar} />
      <div className="menu-lateral__rodape">
        <ItemMenu para="/gestao/meu-ponto" icone={Clock} texto="Meu ponto" aoClicar={aoNavegar} />
        <ItemMenu para="/gestao/meu-historico" icone={History} texto="Meu histórico" aoClicar={aoNavegar} />
        <ItemMenu para="/gestao/meu-espelho" icone={FileClock} texto="Meu espelho" aoClicar={aoNavegar} />
        <ItemMenu para="/gestao/conta" icone={UserRound} texto="Minha conta" aoClicar={aoNavegar} />
        <ItemMenu para="/gestao/ajuda" icone={LifeBuoy} texto="Central de ajuda" aoClicar={aoNavegar} />
        <button type="button" className="menu-lateral__item" onClick={signOut} title="Sair" style={{ background: 'none', border: 'none', width: '100%', font: 'inherit', cursor: 'pointer' }}>
          <LogOut aria-hidden="true" />
          <span className="menu-lateral__texto">Sair</span>
        </button>
      </div>
    </nav>
  )
}

// Estrutura das telas de gestão (administrador e RH): menu lateral fixo no
// computador, recolhido em ícones no tablet e em gaveta no celular.
export default function ShellGestao() {
  const { perfil } = useAuth()
  const local = useLocation()
  const dadosEmpresa = useEmpresa()
  const [pendentes, setPendentes] = useState(0)
  const [facial, setFacial] = useState({ fotos: 0, marcacoes: 0 })
  const [gavetaAberta, setGavetaAberta] = useState(false)

  const atualizarPendentes = useCallback(async () => {
    const { count } = await supabase
      .from('ajustes_ponto')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pendente')
      .neq('perfil_id', perfil.id)
    setPendentes(count || 0)
    const [fotos, marcacoes] = await Promise.all([
      supabase.from('rostos_referencia').select('id', { count: 'exact', head: true }).eq('status', 'pendente'),
      supabase.from('verificacoes_faciais').select('id', { count: 'exact', head: true }).eq('conferencia', 'pendente'),
    ])
    setFacial({ fotos: fotos.count || 0, marcacoes: marcacoes.count || 0 })
  }, [perfil.id])

  useEffect(() => { atualizarPendentes() }, [atualizarPendentes, local.pathname])
  useEffect(() => { setGavetaAberta(false) }, [local.pathname])

  useEffect(() => {
    if (!gavetaAberta) return
    function tecla(e) { if (e.key === 'Escape') setGavetaAberta(false) }
    document.addEventListener('keydown', tecla)
    return () => document.removeEventListener('keydown', tecla)
  }, [gavetaAberta])

  const titulo = TITULOS.find(([caminho]) => local.pathname.startsWith(caminho))?.[1] || ''
  const naTelaDePonto = local.pathname.startsWith('/gestao/meu-ponto')
  // Título da aba do navegador (e do que o leitor de tela anuncia)
  useEffect(() => { document.title = titulo ? `${titulo} · Ayra Ponto` : 'Ayra Ponto' }, [titulo])

  return (
    <div className="shell shell--gestao">
      <a href="#conteudo" className="pular-conteudo">Pular para o conteúdo</a>
      <Menu pendentes={pendentes} pendentesFacial={facial.fotos + facial.marcacoes} />
      {gavetaAberta && (
        <div className="gaveta">
          <Menu pendentes={pendentes} pendentesFacial={facial.fotos + facial.marcacoes} aoNavegar={() => setGavetaAberta(false)} />
          <button type="button" className="gaveta__fundo" aria-label="Fechar menu" onClick={() => setGavetaAberta(false)} />
        </div>
      )}
      <div className="shell__conteudo">
        <TopBar
          titulo={titulo}
          aoAbrirMenu={() => setGavetaAberta(true)}
          linkConta="/gestao/conta"
          ajuda={{ contexto: 'gestao', empresa: dadosEmpresa.empresa?.nome }}
          acoes={!naTelaDePonto && (
            <Link to="/gestao/meu-ponto" className="btn btn--primario btn--pequeno" aria-label="Registrar ponto">
              <Clock aria-hidden="true" /> <span>Registrar ponto</span>
            </Link>
          )}
        />
        <main id="conteudo" tabIndex={-1}>
          <ErroNaTela chave={local.pathname}>
            <Suspense fallback={<div className="pagina"><Esqueleto blocos={1} linhas={4} /></div>}>
              <Outlet context={{ ...dadosEmpresa, pendentes, pendentesFacial: facial, atualizarPendentes }} />
            </Suspense>
          </ErroNaTela>
        </main>
      </div>
    </div>
  )
}

