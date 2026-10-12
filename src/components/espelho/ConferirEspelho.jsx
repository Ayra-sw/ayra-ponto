import { useEffect, useMemo, useState } from 'react'
import { BadgeCheck, Fingerprint, FileSignature, MessageSquareWarning } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useAvisos } from '../../contexts/AvisosContext'
import { traduzirErro } from '../../lib/mensagensErro'
import { data as formatarData } from '../../lib/formatos'
import { diaCurto, situacaoDoDia } from '../../lib/apuracao'
import { aparelhoTemDigital, ativadaAqui } from '../../lib/digital'
import { assinarEspelho, confirmarIdentidade, textoAssinatura } from '../../lib/conferencia'
import Botao from '../ui/Botao'
import Alerta from '../ui/Alerta'
import { CampoSenha, Selecao } from '../ui/Campo'
import { Dialogo } from '../ui/Dialogo'

// Fase 7C: no espelho de um mês fechado, a própria pessoa confere e assina
// ("Está certo") ou aponta o dia com problema ("Encontrei um problema").
export default function ConferirEspelho({ nomeMes, competencia, hash, conferencia, linhas, aoAssinar, aoApontarProblema }) {
  const { perfil, session } = useAuth()
  const avisar = useAvisos()
  const [assinar, setAssinar] = useState(false)
  const [problema, setProblema] = useState(false)
  const [temDigital, setTemDigital] = useState(false)
  const [usarSenha, setUsarSenha] = useState(false)
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [dia, setDia] = useState('')

  useEffect(() => {
    let vivo = true
    if (ativadaAqui()) aparelhoTemDigital().then((sim) => { if (vivo) setTemDigital(sim) })
    return () => { vivo = false }
  }, [])

  const dias = useMemo(() => (linhas || []).filter((l) => !['futuro', 'antes_admissao'].includes(l.situacao)), [linhas])
  const mes = (nomeMes || '').toLowerCase()
  const status = conferencia?.status || 'pendente'

  function abrirAssinar() { setErro(''); setSenha(''); setUsarSenha(!temDigital); setAssinar(true) }
  function abrirProblema() {
    const comAviso = dias.find((l) => l.situacao === 'falta' || l.situacao === 'incompleto' || (l.alertas || []).length > 0)
    setDia((comAviso || dias[0])?.data || '')
    setProblema(true)
  }

  async function confirmarEAssinar(e) {
    e?.preventDefault?.()
    setErro('')
    const jeito = usarSenha ? 'senha' : 'digital'
    if (jeito === 'senha' && !senha) return setErro('Digite a sua senha.')
    setEnviando(true)
    const c = await confirmarIdentidade({ jeito, email: session?.user?.email || perfil.email, senha, perfilId: perfil.id })
    if (!c.ok) {
      setEnviando(false)
      if (c.mensagem) setErro(c.mensagem)
      return
    }
    const { data, error } = await assinarEspelho(competencia, hash)
    setEnviando(false)
    if (error) return setErro(traduzirErro(error))
    setAssinar(false)
    avisar(`Espelho de ${mes} assinado. Obrigado por conferir!`)
    aoAssinar?.(data)
  }

  function continuarProblema(e) {
    e?.preventDefault?.()
    if (!dia) return
    setProblema(false)
    aoApontarProblema?.({ data: dia })
  }

  if (status === 'assinado') {
    return (
      <section className="cartao conferir conferir--assinado" aria-labelledby="t-conferir">
        <BadgeCheck className="conferir__icone" aria-hidden="true" />
        <div className="conferir__texto">
          <h2 id="t-conferir">Você assinou o espelho de {mes}</h2>
          <p className="suave">{textoAssinatura(conferencia)}.</p>
        </div>
      </section>
    )
  }

  return (
    <section className="cartao conferir" aria-labelledby="t-conferir">
      <FileSignature className="conferir__icone" aria-hidden="true" />
      <div className="conferir__texto">
        <h2 id="t-conferir">Confira e assine seu espelho de {mes}</h2>
        {status === 'com_problema' ? (
          <p className="suave">
            Você apontou um problema{conferencia?.problema_data ? ` no dia ${formatarData(conferencia.problema_data).slice(0, 5)}` : ''}. O RH vai analisar o seu pedido.
            Se estiver tudo certo agora, você ainda pode assinar.
          </p>
        ) : (
          <p className="suave">Olhe os dias abaixo. Se estiver tudo certo, toque em <strong>Está certo</strong> e confirme com a sua digital ou senha.</p>
        )}
      </div>
      <div className="acoes conferir__acoes">
        <Botao icone={BadgeCheck} onClick={abrirAssinar}>Está certo</Botao>
        <Botao variante="secundario" icone={MessageSquareWarning} onClick={abrirProblema} disabled={!dias.length}>Encontrei um problema</Botao>
      </div>

      <Dialogo
        aberto={assinar}
        aoFechar={enviando ? undefined : () => setAssinar(false)}
        titulo={`Assinar o espelho de ${mes}`}
        acoes={usarSenha ? (
          <>
            <Botao variante="secundario" onClick={() => setAssinar(false)} disabled={enviando}>Cancelar</Botao>
            <Botao type="submit" form="form-assinar" icone={FileSignature} carregando={enviando}>Assinar</Botao>
          </>
        ) : (
          <>
            <Botao variante="secundario" onClick={() => setAssinar(false)} disabled={enviando}>Cancelar</Botao>
            <Botao icone={Fingerprint} onClick={confirmarEAssinar} carregando={enviando} data-foco-inicial>Assinar com a digital</Botao>
          </>
        )}
      >
        <div className="pilha">
          <p className="suave" style={{ margin: 0 }}>
            Ao assinar, você confirma que as marcações e as horas de {mes} estão corretas. Para sua segurança, confirme que é você.
          </p>
          {usarSenha ? (
            <form id="form-assinar" onSubmit={confirmarEAssinar} noValidate>
              <CampoSenha rotulo="Sua senha do Ayra Ponto" value={senha} onChange={(e) => { setSenha(e.target.value); setErro('') }} autoComplete="current-password" />
            </form>
          ) : null}
          {temDigital && (
            <button type="button" className="link conferir__trocar" onClick={() => { setUsarSenha((x) => !x); setErro('') }} disabled={enviando}>
              {usarSenha ? 'Usar a digital' : 'Usar a senha'}
            </button>
          )}
          {erro && <Alerta tom="problema">{erro}</Alerta>}
        </div>
      </Dialogo>

      <Dialogo
        aberto={problema}
        aoFechar={() => setProblema(false)}
        titulo="Em qual dia está o problema?"
        acoes={(
          <>
            <Botao variante="secundario" onClick={() => setProblema(false)}>Cancelar</Botao>
            <Botao type="submit" form="form-problema">Continuar</Botao>
          </>
        )}
      >
        <form id="form-problema" className="pilha" onSubmit={continuarProblema} noValidate>
          <Selecao rotulo="Dia" value={dia} onChange={(e) => setDia(e.target.value)}
            opcoes={dias.map((l) => ({ valor: l.data, rotulo: `${diaCurto(l.data)} · ${situacaoDoDia(l).rotulo}` }))} />
          <p className="suave pequeno" style={{ margin: 0 }}>
            No próximo passo, conte o que está errado (esqueceu de marcar, horário errado, atestado…). O pedido vai para o RH, e o espelho fica marcado como &quot;com problema&quot; até ser resolvido.
          </p>
        </form>
      </Dialogo>
    </section>
  )
}
