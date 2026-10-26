import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { Building2, Fingerprint, LogOut, MessageCircle, ScrollText, ShieldCheck } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../contexts/AuthContext'
import { aparelhoTemDigital, ativadaAqui } from '../../lib/digital'
import { confirmarIdentidade } from '../../lib/conferencia'
import { pedeConfirmacao } from '../../lib/central'
import ErroNaTela from '../app/ErroNaTela'
import BotaoTema from './BotaoTema'
import Marca from './Marca'
import Botao from '../ui/Botao'
import Alerta from '../ui/Alerta'
import { CampoSenha } from '../ui/Campo'
import { Dialogo } from '../ui/Dialogo'
import { Esqueleto } from '../ui/Estados'

const ITENS = [
  { para: '/central', texto: 'Empresas', icone: Building2, fim: true },
  { para: '/central/registro', texto: 'Registro', icone: ScrollText },
  { para: '/central/contato', texto: 'Contato do suporte', icone: MessageCircle },
]
const TITULOS = [['/central/empresas', 'Empresa'], ['/central/registro', 'Registro'], ['/central/contato', 'Contato do suporte'], ['/central', 'Empresas']]

// Janela "Confirme que é você": a Central pede a digital ou a senha de novo
// de tempos em tempos (o banco confere a hora da confirmação).
function ConfirmarIdentidade({ aberta, aoConfirmar, aoCancelar }) {
  const { perfil, session } = useAuth()
  const [temDigital, setTemDigital] = useState(false)
  const [usarSenha, setUsarSenha] = useState(true)
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    if (!aberta) return
    setSenha(''); setErro('')
    if (ativadaAqui()) aparelhoTemDigital().then((sim) => { setTemDigital(sim); setUsarSenha(!sim) })
  }, [aberta])

  async function confirmar(e) {
    e?.preventDefault?.()
    setErro('')
    const jeito = usarSenha ? 'senha' : 'digital'
    if (jeito === 'senha' && !senha) return setErro('Digite a sua senha.')
    setEnviando(true)
    const r = await confirmarIdentidade({ jeito, email: session?.user?.email, senha, perfilId: perfil.id })
    setEnviando(false)
    if (!r.ok) { if (r.mensagem) setErro(r.mensagem); return }
    aoConfirmar()
  }

  return (
    <Dialogo
      aberto={aberta}
      aoFechar={enviando ? undefined : aoCancelar}
      titulo="Confirme que é você"
      acoes={usarSenha ? (
        <>
          <Botao variante="secundario" onClick={aoCancelar} disabled={enviando}>Cancelar</Botao>
          <Botao type="submit" form="form-central-confirmar" icone={ShieldCheck} carregando={enviando}>Confirmar</Botao>
        </>
      ) : (
        <>
          <Botao variante="secundario" onClick={aoCancelar} disabled={enviando}>Cancelar</Botao>
          <Botao icone={Fingerprint} onClick={confirmar} carregando={enviando} data-foco-inicial>Confirmar com a digital</Botao>
        </>
      )}
    >
      <div className="pilha">
        <p className="suave" style={{ margin: 0 }}>Por segurança, a Central Ayra pede a sua digital ou a sua senha de novo de tempos em tempos.</p>
        {usarSenha && (
          <form id="form-central-confirmar" onSubmit={confirmar} noValidate>
            <CampoSenha rotulo="Sua senha da Central" value={senha} onChange={(e) => { setSenha(e.target.value); setErro('') }} autoComplete="current-password" />
          </form>
        )}
        {temDigital && (
          <button type="button" className="link conferir__trocar" onClick={() => { setUsarSenha((x) => !x); setErro('') }} disabled={enviando}>
            {usarSenha ? 'Usar a digital' : 'Usar a senha'}
          </button>
        )}
        {erro && <Alerta tom="problema">{erro}</Alerta>}
      </div>
    </Dialogo>
  )
}

// Estrutura da Central Ayra: barra própria (azul-escuro com dourado), sem o menu dos clientes.
export default function ShellCentral() {
  const { perfil, signOut } = useAuth()
  const local = useLocation()
  const [confirmando, setConfirmando] = useState(false)
  const pendente = useRef(null)

  const titulo = TITULOS.find(([c]) => local.pathname.startsWith(c))?.[1] || 'Central'
  useEffect(() => { document.title = `${titulo} · Central Ayra` }, [titulo])

  // Chama uma função da Central; se ela pedir confirmação, abre a janela e tenta de novo.
  const chamar = useCallback(async (nome, args) => {
    const r = await supabase.rpc(nome, args)
    if (!pedeConfirmacao(r.error)) return r
    const ok = await new Promise((resolve) => { pendente.current = resolve; setConfirmando(true) })
    if (!ok) return { data: null, error: { message: 'Confirmação cancelada.', cancelada: true } }
    return supabase.rpc(nome, args)
  }, [])

  const contexto = useMemo(() => ({ chamar }), [chamar])
  const fechar = (ok) => { setConfirmando(false); pendente.current?.(ok); pendente.current = null }

  return (
    <div className="shell shell--central">
      <a href="#conteudo" className="pular-conteudo">Pular para o conteúdo</a>
      <header className="central-barra">
        <Link to="/central" className="central-barra__marca" aria-label="Central Ayra, empresas">
          <Marca clara />
          <span className="central-barra__selo">Central</span>
        </Link>
        <nav className="central-barra__menu" aria-label="Menu da Central">
          {ITENS.map(({ para, texto, icone: Icone, fim }) => (
            <NavLink key={para} to={para} end={fim} className="central-barra__item">
              <Icone aria-hidden="true" /><span>{texto}</span>
            </NavLink>
          ))}
        </nav>
        <div className="central-barra__acoes">
          <span className="central-barra__quem" title={perfil?.nome_completo}>{perfil?.nome_completo}</span>
          <BotaoTema />
          <Botao variante="discreto" className="btn--icone central-barra__sair" icone={LogOut} onClick={signOut} aria-label="Sair da Central" title="Sair" />
        </div>
      </header>
      <main id="conteudo" tabIndex={-1} className="central-conteudo">
        <ErroNaTela chave={local.pathname}>
          <Suspense fallback={<div className="pagina"><Esqueleto blocos={1} linhas={4} /></div>}>
            <Outlet context={contexto} />
          </Suspense>
        </ErroNaTela>
      </main>
      <ConfirmarIdentidade aberta={confirmando} aoConfirmar={() => fechar(true)} aoCancelar={() => fechar(false)} />
    </div>
  )
}
