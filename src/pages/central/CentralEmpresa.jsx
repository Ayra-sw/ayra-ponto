import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useOutletContext, useParams } from 'react-router-dom'
import { ArrowLeft, BadgeCheck, CircleCheck, KeyRound, Lock, LockOpen, Mail, ShieldCheck, Undo2 } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { useAvisos } from '../../contexts/AvisosContext'
import { useAuth } from '../../contexts/AuthContext'
import { traduzirErro } from '../../lib/mensagensErro'
import { data as formatarData, dataHora, formatarTelefone } from '../../lib/formatos'
import { SITUACAO_EMPRESA, formatarCnpj, quandoFoi, textoDoRegistro } from '../../lib/central'
import { PAPEL } from '../../lib/rotulos'
import Etiqueta from '../../components/ui/Etiqueta'
import Indicador from '../../components/ui/Indicador'
import Botao from '../../components/ui/Botao'
import BotaoCopiar from '../../components/ui/BotaoCopiar'
import Alerta from '../../components/ui/Alerta'
import { AreaTexto } from '../../components/ui/Campo'
import { Confirmacao, Dialogo } from '../../components/ui/Dialogo'
import { Esqueleto, EstadoErro } from '../../components/ui/Estados'

// Uma empresa cliente: números, situação no Ayra e quem cuida dela (para ajudar a entrar).
export default function CentralEmpresa() {
  const { id } = useParams()
  const { chamar } = useOutletContext()
  const avisar = useAvisos()
  const [e, setE] = useState(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [suspender, setSuspender] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [erroMotivo, setErroMotivo] = useState('')
  const [mudar, setMudar] = useState(null) // 'ativa' | 'teste'
  const [linkPara, setLinkPara] = useState(null) // pessoa da gestão
  const [salvando, setSalvando] = useState(false)
  const [erroAcao, setErroAcao] = useState('')
  const [suporte, setSuporte] = useState(null) // Fase 8B: suporte liberado pela empresa
  const [entrando, setEntrando] = useState(false)
  const navegar = useNavigate()
  const { recarregarPerfil } = useAuth()

  const carregar = useCallback(async () => {
    setErro(''); setCarregando(true)
    const r = await chamar('central_empresa', { p_empresa: id })
    if (r.error) setErro(r.error.cancelada ? 'Para ver a empresa, confirme que é você.' : traduzirErro(r.error))
    else setE(r.data)
    const sp = await chamar('central_suporte', { p_empresa: id })
    if (!sp.error) setSuporte(sp.data)
    setCarregando(false)
  }, [chamar, id])

  // Fase 8B: entra como suporte (só se a empresa liberou) e vai para a gestão dela
  async function entrarNoSuporte() {
    setEntrando(true); setErroAcao('')
    const r = await chamar('suporte_entrar', { p_empresa: id })
    setEntrando(false)
    if (r.error) { if (!r.error.cancelada) setErroAcao(traduzirErro(r.error)); return }
    await recarregarPerfil()
    navegar('/gestao', { replace: true })
  }

  useEffect(() => { carregar() }, [carregar])

  async function mudarSituacao(situacao, textoMotivo) {
    setSalvando(true); setErroAcao('')
    const r = await chamar('central_mudar_situacao', { p_empresa: id, p_situacao: situacao, p_motivo: textoMotivo || null })
    setSalvando(false)
    if (r.error) {
      if (situacao === 'suspensa') setErroMotivo(r.error.cancelada ? '' : traduzirErro(r.error))
      else setErroAcao(r.error.cancelada ? '' : traduzirErro(r.error))
      return false
    }
    avisar(situacao === 'suspensa' ? `${e.nome} suspensa. A gestão vê o aviso; os funcionários continuam batendo ponto.`
      : situacao === 'ativa' ? (e.situacao === 'suspensa' ? `${e.nome} liberada. Tudo volta a funcionar.` : `${e.nome} marcada como ativa.`)
        : `${e.nome} voltou para teste.`)
    await carregar()
    return true
  }

  async function confirmarSuspensao(ev) {
    ev?.preventDefault?.()
    if (motivo.trim().length < 3) return setErroMotivo('Conte em poucas palavras o motivo (fica só na Central).')
    if (await mudarSituacao('suspensa', motivo.trim())) { setSuspender(false); setMotivo('') }
  }

  async function enviarLink() {
    const p = linkPara
    setSalvando(true); setErroAcao('')
    // primeiro anota (o banco confere se o e-mail é mesmo da gestão desta empresa), depois envia
    const anot = await chamar('central_anotar', { p_acao: 'enviou_link_senha', p_empresa: id, p_detalhe: { email: p.email, nome: p.nome } })
    if (anot.error) { setSalvando(false); setLinkPara(null); if (!anot.error.cancelada) setErroAcao(traduzirErro(anot.error)); return }
    const { error } = await supabase.auth.resetPasswordForEmail(p.email, { redirectTo: `${window.location.origin}/redefinir-senha` })
    setSalvando(false); setLinkPara(null)
    if (error) return setErroAcao(error.status === 429 ? 'Muitos e-mails enviados em pouco tempo. Espere alguns minutos e tente de novo.' : 'Não foi possível enviar o e-mail agora. Tente de novo em instantes.')
    avisar(`Link de nova senha enviado para ${p.email}.`)
    carregar()
  }

  const voltar = <Link to="/central" className="link link--suave pequeno"><ArrowLeft aria-hidden="true" style={{ width: 14, height: 14, verticalAlign: '-2px' }} /> Empresas</Link>

  if (carregando) return <div className="pagina">{voltar}<Esqueleto blocos={3} linhas={3} /></div>
  if (erro || !e) return <div className="pagina">{voltar}<EstadoErro aoTentarDeNovo={carregar}>{erro || 'Empresa não encontrada.'}</EstadoErro></div>

  const s = SITUACAO_EMPRESA[e.situacao] || SITUACAO_EMPRESA.ativa
  const gestao = e.gestao || []
  const registro = e.registro || []

  return (
    <div className="pagina" style={{ maxWidth: 980 }}>
      {voltar}
      <div className="pagina__cabecalho">
        <div className="pagina__titulo">
          <h1>{e.nome}</h1>
          <p className="suave">{[e.razao_social, e.cnpj ? `CNPJ ${formatarCnpj(e.cnpj)}` : null].filter(Boolean).join(' · ') || 'Sem razão social e CNPJ cadastrados'}</p>
        </div>
        <Etiqueta tom={s.tom}>{s.rotulo}</Etiqueta>
      </div>

      {erroAcao && <Alerta tom="problema">{erroAcao}</Alerta>}

      <div className="indicadores">
        <Indicador rotulo="Pessoas ativas" valor={e.pessoas_ativas} detalhe={`${e.pessoas_total} no cadastro`} />
        <Indicador rotulo="Unidades" valor={e.unidades} detalhe="Locais de trabalho" />
        <Indicador rotulo="Marcações (30 dias)" valor={e.marcacoes_30d} detalhe={`Último ponto: ${quandoFoi(e.ultima_marcacao).toLowerCase()}`} />
        <Indicador rotulo="Cliente desde" valor={formatarData(e.criado_em)} detalhe={[e.cidade, e.uf].filter(Boolean).join('/') || 'Cidade não informada'} />
      </div>

      <section className={`cartao central-situacao central-situacao--${e.situacao}`} aria-labelledby="t-situacao">
        <div className="cartao__cabecalho"><h2 id="t-situacao">Situação no Ayra</h2></div>
        {e.situacao === 'suspensa' ? (
          <>
            <p style={{ margin: 0 }}>
              <strong>Suspensa{e.situacao_em ? ` desde ${dataHora(e.situacao_em)}` : ''}.</strong> A gestão vê só um aviso pedindo para entrar em contato. Os funcionários continuam batendo ponto.
            </p>
            {e.suspensa_motivo && <p className="suave" style={{ margin: 0 }}>Motivo (só a Central vê): {e.suspensa_motivo}</p>}
            <div className="acoes"><Botao icone={LockOpen} onClick={() => setMudar('ativa')}>Liberar a empresa</Botao></div>
          </>
        ) : (
          <>
            <p className="suave" style={{ margin: 0 }}>
              {e.situacao === 'teste'
                ? 'Em teste: a empresa usa o Ayra normalmente e ainda não paga. Quando virar cliente pagante, marque como ativa.'
                : 'Ativa: cliente pagante, com tudo liberado.'}
            </p>
            <div className="acoes">
              {e.situacao === 'teste'
                ? <Botao icone={BadgeCheck} onClick={() => setMudar('ativa')}>Marcar como ativa</Botao>
                : <Botao variante="secundario" icone={Undo2} onClick={() => setMudar('teste')}>Voltar para teste</Botao>}
              <Botao variante="perigo" icone={Lock} onClick={() => { setSuspender(true); setErroMotivo('') }}>Suspender</Botao>
            </div>
          </>
        )}
      </section>

      <section className="cartao" aria-labelledby="t-contato">
        <div className="cartao__cabecalho"><h2 id="t-contato">Contato da empresa</h2></div>
        <dl className="central-dados">
          <div><dt>Telefone</dt><dd>{e.telefone ? formatarTelefone(e.telefone) : '—'}</dd></div>
          <div><dt>E-mail</dt><dd>{e.email || '—'}</dd></div>
          <div><dt>Cidade</dt><dd>{[e.cidade, e.uf].filter(Boolean).join('/') || '—'}</dd></div>
        </dl>
      </section>

      <section className="cartao" aria-labelledby="t-gestao">
        <div className="cartao__cabecalho">
          <h2 id="t-gestao">Quem cuida do Ayra nesta empresa</h2>
          <span className="suave pequeno">Administradores e RH. Use para ajudar quem não consegue entrar.</span>
        </div>
        {gestao.length === 0 ? <p className="suave">Ninguém da gestão cadastrado.</p> : (
          <ul className="central-gestao">
            {gestao.map((p) => (
              <li key={p.perfil_id}>
                <div className="central-gestao__quem">
                  <strong>{p.nome || 'Sem nome'}</strong>
                  <span className="suave pequeno">{PAPEL[p.tipo] || p.tipo}{p.status !== 'ativo' ? ` · ${p.status}` : ''}</span>
                </div>
                <div className="central-gestao__email">
                  <span className="mono pequeno">{p.email}</span>
                  <BotaoCopiar texto={p.email} rotulo="Copiar" tamanho="pequeno" variante="discreto" />
                </div>
                <div className="central-gestao__acesso pequeno">
                  <span>Último acesso: <strong>{quandoFoi(p.ultimo_acesso)}</strong></span>
                  {p.email_confirmado
                    ? <span className="suave"><CircleCheck aria-hidden="true" className="central-gestao__ok" /> E-mail confirmado</span>
                    : <Etiqueta tom="atencao">E-mail não confirmado</Etiqueta>}
                </div>
                <Botao variante="secundario" tamanho="pequeno" icone={KeyRound} onClick={() => setLinkPara(p)} aria-label={`Enviar link de nova senha para ${p.nome}`}>
                  Enviar link de nova senha
                </Botao>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="cartao" aria-labelledby="t-registro">
        <div className="cartao__cabecalho"><h2 id="t-registro">O que a Central fez nesta empresa</h2></div>
        {registro.length === 0 ? <p className="suave">Nada ainda.</p> : (
          <ul className="central-registro">
            {registro.map((r, i) => (
              <li key={i}><span>{textoDoRegistro(r)}</span><span className="suave pequeno">{dataHora(r.em)}{r.dono_nome ? ` · ${r.dono_nome}` : ''}</span></li>
            ))}
          </ul>
        )}
      </section>

      <section className="cartao" aria-labelledby="t-suporte-ayra">
        <div className="cartao__cabecalho"><h2 id="t-suporte-ayra">Suporte da empresa</h2></div>
        {suporte?.liberado && e.situacao !== 'suspensa' ? (
          <>
            <p style={{ margin: 0 }}>
              Liberado até <strong>{dataHora(suporte.ate)}</strong>{suporte.liberado_nome ? `, por ${suporte.liberado_nome}` : ''}.
              Ao entrar, você age como suporte: vê e ajusta cadastros, sem bater ponto, aprovar pedidos ou fechar o mês.
            </p>
            <div className="acoes">
              <Botao icone={ShieldCheck} onClick={entrarNoSuporte} carregando={entrando} disabled={entrando}>Entrar como suporte</Botao>
            </div>
          </>
        ) : (
          <p className="suave" style={{ margin: 0 }}>
            {e.situacao === 'suspensa'
              ? 'Empresa suspensa: o suporte não entra enquanto estiver suspensa.'
              : 'A empresa não liberou o suporte agora. Quando ela liberar, o botão para entrar aparece aqui.'}
          </p>
        )}
      </section>

      <Dialogo
        aberto={suspender}
        aoFechar={salvando ? undefined : () => setSuspender(false)}
        titulo={`Suspender ${e.nome}?`}
        acoes={(
          <>
            <Botao variante="secundario" onClick={() => setSuspender(false)} disabled={salvando}>Cancelar</Botao>
            <Botao variante="perigo" icone={Lock} onClick={confirmarSuspensao} carregando={salvando}>Suspender</Botao>
          </>
        )}
      >
        <form className="pilha" onSubmit={confirmarSuspensao} noValidate>
          <p className="suave" style={{ margin: 0 }}>
            O administrador, o RH e os gestores passam a ver só um aviso pedindo para entrar em contato com a Ayra. Os funcionários continuam batendo ponto normalmente.
          </p>
          <AreaTexto rotulo="Motivo" rows={2} maxLength={300} value={motivo} onChange={(ev) => { setMotivo(ev.target.value); setErroMotivo('') }}
            erro={erroMotivo} ajuda="Fica só na Central (o cliente não vê). Ex.: mensalidade de outubro em aberto." data-foco-inicial />
        </form>
      </Dialogo>

      <Confirmacao
        aberta={Boolean(mudar)}
        titulo={mudar === 'ativa' ? (e.situacao === 'suspensa' ? `Liberar ${e.nome}?` : `Marcar ${e.nome} como ativa?`) : `Voltar ${e.nome} para teste?`}
        textoConfirmar={mudar === 'ativa' ? (e.situacao === 'suspensa' ? 'Liberar' : 'Marcar como ativa') : 'Voltar para teste'}
        carregando={salvando}
        aoConfirmar={async () => { if (await mudarSituacao(mudar)) setMudar(null); else setMudar(null) }}
        aoCancelar={() => setMudar(null)}
      >
        {mudar === 'ativa' && e.situacao === 'suspensa'
          ? 'A gestão volta a usar o Ayra normalmente, na hora.'
          : mudar === 'ativa' ? 'Use quando a empresa virar cliente pagante.' : 'A empresa continua funcionando normalmente; só muda a etiqueta na Central.'}
      </Confirmacao>

      <Confirmacao
        aberta={Boolean(linkPara)}
        titulo="Enviar link de nova senha?"
        textoConfirmar="Enviar"
        carregando={salvando}
        aoConfirmar={enviarLink}
        aoCancelar={() => setLinkPara(null)}
      >
        {linkPara && <>Chega um e-mail para <strong>{linkPara.email}</strong> com um link para criar uma senha nova. A senha atual continua valendo até a pessoa trocar.</>}
        <span className="central-nota"><Mail aria-hidden="true" /> Fica anotado no registro da Central.</span>
      </Confirmacao>
    </div>
  )
}
