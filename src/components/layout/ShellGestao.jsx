import { useCallback, useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { Building2, Clock, Inbox, LayoutDashboard, LogOut, MapPin, ScanFace, UserRound, Users } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../contexts/AuthContext'
import useEmpresa from '../../hooks/useEmpresa'
import Marca from './Marca'
import TopBar from '../TopBar'

const TITULOS = [
  ['/gestao/pessoas', 'Pessoas'],
  ['/gestao/solicitacoes', 'Solicitações'],
  ['/gestao/reconhecimento', 'Reconhecimento facial'],
  ['/gestao/configuracoes/empresa', 'Empresa'],
  ['/gestao/configuracoes/unidades', 'Unidades'],
  ['/gestao/meu-ponto', 'Meu ponto'],
  ['/gestao/conta', 'Minha conta'],
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
      <span className="menu-lateral__grupo">Gestão</span>
      <ItemMenu para="/gestao/solicitacoes" icone={Inbox} texto="Solicitações" contador={pendentes} aoClicar={aoNavegar} />
      <ItemMenu para="/gestao/reconhecimento" icone={ScanFace} texto="Reconhecimento facial" contador={pendentesFacial} aoClicar={aoNavegar} />
      <span className="menu-lateral__grupo">Configurações</span>
      <ItemMenu para="/gestao/configuracoes/empresa" icone={Building2} texto="Empresa" aoClicar={aoNavegar} />
      <ItemMenu para="/gestao/configuracoes/unidades" icone={MapPin} texto="Unidades" aoClicar={aoNavegar} />
      <div className="menu-lateral__rodape">
        <ItemMenu para="/gestao/meu-ponto" icone={Clock} texto="Meu ponto" aoClicar={aoNavegar} />
        <ItemMenu para="/gestao/conta" icone={UserRound} texto="Minha conta" aoClicar={aoNavegar} />
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
          acoes={!naTelaDePonto && (
            <Link to="/gestao/meu-ponto" className="btn btn--primario btn--pequeno">
              <Clock aria-hidden="true" /> <span>Registrar ponto</span>
            </Link>
          )}
        />
        <main id="conteudo" tabIndex={-1}>
          <Outlet context={{ ...dadosEmpresa, pendentes, pendentesFacial: facial, atualizarPendentes }} />
        </main>
      </div>
    </div>
  )
}

