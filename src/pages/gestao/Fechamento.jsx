import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { BellRing, Check, ChevronLeft, ChevronRight, FileSignature, FileSpreadsheet, Lock, LockOpen, CalendarClock } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../contexts/AuthContext'
import { useAvisos } from '../../contexts/AvisosContext'
import { traduzirErro } from '../../lib/mensagensErro'
import { data as formatarData, dataHora, duracao } from '../../lib/formatos'
import { ehMesAtualOuFuturo, nomeDoMes, saldoTexto, somarMeses, textoDoMes, lerMes } from '../../lib/apuracao'
import { normalizarRegras } from '../../lib/regrasCalculo'
import { competenciaIso, gerarPlanilhaFechamento, mesAnterior, nomeDoArquivo, totaisDaFoto } from '../../lib/fechamento'
import { baixarArquivo } from '../../lib/xlsx'
import { STATUS_CONFERENCIA, comoConfirmou } from '../../lib/conferencia'
import Botao from '../../components/ui/Botao'
import Alerta from '../../components/ui/Alerta'
import Etiqueta from '../../components/ui/Etiqueta'
import { AreaTexto } from '../../components/ui/Campo'
import { Confirmacao, Dialogo } from '../../components/ui/Dialogo'
import { Esqueleto, EstadoErro } from '../../components/ui/Estados'

const faltaInstalar = (e) => e && (e.code === 'PGRST202' || e.code === '42P01' || e.code === 'PGRST205'
  || /could not find the function|does not exist|schema cache/i.test(e.message || ''))

const diaMes = (iso) => formatarData(iso).slice(0, 5)
const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`

// As três etapas do fechamento, sempre visíveis no topo
function Etapas({ atual }) {
  const etapas = ['Conferir', 'Fechar', 'Enviar ao contador']
  return (
    <ol className="etapas-fechamento" aria-label="Etapas do fechamento">
      {etapas.map((t, i) => {
        const estado = i < atual ? 'feita' : i === atual ? 'atual' : 'proxima'
        return (
          <li key={t} className={`etapas-fechamento__item etapas-fechamento__item--${estado}`} aria-current={estado === 'atual' ? 'step' : undefined}>
            <span className="etapas-fechamento__numero" aria-hidden="true">{estado === 'feita' ? <Check /> : i + 1}</span>
            <span>{t}<span className="sr-only">{estado === 'feita' ? ' (feito)' : estado === 'atual' ? ' (agora)' : ''}</span></span>
          </li>
        )
      })}
    </ol>
  )
}

function ItemConferencia({ feito, titulo, detalhe, children, acao }) {
  return (
    <li className={`checklist__item checklist__item--fechamento${feito ? ' checklist__item--feito' : ''}`}>
      <span className="checklist__marca" aria-hidden="true">{feito && <Check />}</span>
      <span className="checklist__texto">
        <strong>{titulo}</strong>
        {detalhe && <span className="suave pequeno">{detalhe}</span>}
        {children}
        <span className="sr-only">{feito ? '(tudo certo)' : '(pendente)'}</span>
      </span>
      {acao && <span className="checklist__acoes">{acao}</span>}
    </li>
  )
}

function Conferencia({ p, mesTexto }) {
  const incompletos = p.incompletos || []
  const semJornada = p.sem_jornada || []
  const totalDias = incompletos.reduce((s, i) => s + (i.dias || []).length, 0)
  return (
    <ol className="checklist">
      <ItemConferencia
        feito={totalDias === 0}
        titulo={totalDias === 0 ? 'Todos os dias têm entrada e saída' : `${plural(totalDias, 'dia', 'dias')} sem saída marcada`}
        detalhe={totalDias === 0 ? null : 'Peça à pessoa que solicite o ajuste, ou confira no espelho dela.'}
      >
        {incompletos.length > 0 && (
          <ul className="pendencias-pessoas">
            {incompletos.map((i) => (
              <li key={i.perfil_id}>
                <Link className="link" to={`/gestao/pessoas/${i.perfil_id}?aba=espelho&mes=${mesTexto}`}>{i.nome}</Link>
                <span className="suave pequeno"> · {(i.dias || []).map(diaMes).join(', ')}</span>
              </li>
            ))}
          </ul>
        )}
      </ItemConferencia>
      <ItemConferencia
        feito={!p.pedidos_pendentes}
        titulo={p.pedidos_pendentes ? `${plural(p.pedidos_pendentes, 'pedido esperando', 'pedidos esperando')} resposta` : 'Nenhum pedido esperando resposta'}
        detalhe={p.pedidos_pendentes ? 'Ajustes, abonos e folgas deste mês que ainda não foram aprovados ou recusados.' : null}
        acao={p.pedidos_pendentes ? <Link to="/gestao/solicitacoes" className="btn btn--secundario btn--pequeno">Ver pedidos</Link> : null}
      />
      <ItemConferencia
        feito={semJornada.length === 0}
        titulo={semJornada.length === 0 ? 'Todas as pessoas têm jornada' : `${plural(semJornada.length, 'pessoa', 'pessoas')} sem jornada`}
        detalhe={semJornada.length ? 'Sem jornada, o Ayra não sabe quantas horas eram previstas.' : null}
      >
        {semJornada.length > 0 && (
          <ul className="pendencias-pessoas">
            {semJornada.map((i) => (
              <li key={i.perfil_id}><Link className="link" to={`/gestao/pessoas/${i.perfil_id}?aba=trabalho`}>{i.nome}</Link></li>
            ))}
          </ul>
        )}
      </ItemConferencia>
    </ol>
  )
}

function SeloAssinatura({ c }) {
  if (c === undefined) return null
  const s = STATUS_CONFERENCIA[c?.status || 'pendente']
  return <Etiqueta tom={s.tom}>{c?.status === 'com_problema' ? 'Problema' : s.rotulo}</Etiqueta>
}

function TotaisDoFechamento({ linhas, regras, mesTexto, conferencias }) {
  const r = normalizarRegras(regras)
  if (!linhas.length) return <p className="suave">Nenhuma pessoa entrou neste fechamento.</p>
  return (
    <>
      <div className="so-computador">
        <div className="tabela-envoltorio">
          <table className="tabela">
            <thead>
              <tr>
                <th scope="col">Pessoa</th>
                <th scope="col" className="num">Trabalhadas</th>
                <th scope="col" className="num">Extras {r.extra_normal_pct}%</th>
                <th scope="col" className="num">Extras {r.extra_especial_pct}%</th>
                <th scope="col" className="num">Noturnas</th>
                <th scope="col" className="num">Faltas</th>
                <th scope="col" className="num">Saldo</th>
                {conferencias && <th scope="col">Assinatura</th>}
              </tr>
            </thead>
            <tbody>
              {linhas.map(({ perfil_id: id, nome, t }) => (
                <tr key={id}>
                  <td>
                    <Link className="link" to={`/gestao/pessoas/${id}?aba=espelho&mes=${mesTexto}`}>{nome}</Link>
                    {t.banco && <span className="tabela__secundario">Banco de horas</span>}
                  </td>
                  <td className="num">{duracao(t.trabalhado)}</td>
                  <td className="num">{t.extraNormal ? duracao(t.extraNormal) : '—'}</td>
                  <td className="num">{t.extraEspecial ? duracao(t.extraEspecial) : '—'}</td>
                  <td className="num">{t.noturno ? duracao(t.noturno) : '—'}</td>
                  <td className="num">{t.diasFalta || '—'}</td>
                  <td className="num">{saldoTexto(t.saldo)}</td>
                  {conferencias && <td><SeloAssinatura c={conferencias[id] || null} /></td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="so-celular lista-cartoes">
        {linhas.map(({ perfil_id: id, nome, t }) => (
          <section key={id} className="cartao-linha" aria-label={nome}>
            <div className="cartao-linha__topo">
              <Link className="cartao-linha__titulo link" to={`/gestao/pessoas/${id}?aba=espelho&mes=${mesTexto}`}>{nome}</Link>
              <strong className="mono">{saldoTexto(t.saldo)}</strong>
            </div>
            <div className="cartao-linha__detalhes">
              <span>Trabalhadas <strong className="mono">{duracao(t.trabalhado)}</strong></span>
              {t.extraNormal > 0 && <span>Extras {r.extra_normal_pct}% <strong className="mono">{duracao(t.extraNormal)}</strong></span>}
              {t.extraEspecial > 0 && <span>Extras {r.extra_especial_pct}% <strong className="mono">{duracao(t.extraEspecial)}</strong></span>}
              {t.noturno > 0 && <span>Noturnas <strong className="mono">{duracao(t.noturno)}</strong></span>}
              {t.diasFalta > 0 && <span>Faltas <strong className="mono">{t.diasFalta}</strong></span>}
            </div>
            {conferencias && <div><SeloAssinatura c={conferencias[id] || null} /></div>}
          </section>
        ))}
      </div>
    </>
  )
}

// Fase 7C: quem já conferiu e assinou o espelho do mês
function Assinaturas({ linhas, conferencias, mesTexto, aoLembrar, lembrando }) {
  const total = linhas.length
  const lista = linhas.map((l) => ({ ...l, c: conferencias[l.perfil_id] || null }))
  const assinaram = lista.filter((l) => l.c?.status === 'assinado').length
  const problemas = lista.filter((l) => l.c?.status === 'com_problema')
  const faltam = lista.filter((l) => !l.c).length
  const pct = total ? Math.round((assinaram / total) * 100) : 0
  return (
    <section className="cartao assinaturas" aria-labelledby="t-assinaturas">
      <div className="cartao__cabecalho">
        <h2 id="t-assinaturas">Assinaturas dos colaboradores</h2>
        <span className="suave pequeno">Cada pessoa confere e assina pelo próprio Ayra</span>
      </div>
      <div className="assinaturas__resumo">
        <FileSignature className="fechamento__cadeado" aria-hidden="true" />
        <div className="assinaturas__numeros">
          <strong>{assinaram} de {total} {total === 1 ? 'assinou' : 'assinaram'}</strong>
          <div className="progresso" role="progressbar" aria-label="Assinaturas" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
            <span style={{ width: `${pct}%` }} />
          </div>
          <span className="suave pequeno">
            {faltam > 0 ? `${plural(faltam, 'pessoa ainda não conferiu', 'pessoas ainda não conferiram')}` : 'Todo mundo já conferiu.'}
            {problemas.length > 0 && ` · ${plural(problemas.length, 'encontrou um problema', 'encontraram um problema')}`}
          </span>
        </div>
        {faltam > 0 && (
          <Botao variante="secundario" icone={BellRing} onClick={aoLembrar} carregando={lembrando}>Lembrar quem falta</Botao>
        )}
      </div>
      {problemas.length > 0 && (
        <ul className="assinaturas__problemas">
          {problemas.map((l) => (
            <li key={l.perfil_id}>
              <Link className="link" to={`/gestao/pessoas/${l.perfil_id}?aba=espelho&mes=${mesTexto}`}>{l.nome}</Link>
              {l.c.problema_data && <span className="suave"> · dia {diaMes(l.c.problema_data)}</span>}
              {l.c.problema_texto && <span className="assinaturas__texto">“{l.c.problema_texto}”</span>}
            </li>
          ))}
          <li className="suave pequeno">
            O pedido está em <Link className="link" to="/gestao/solicitacoes">Solicitações</Link>. Com o mês fechado, só dá para aprovar depois de reabrir; ao fechar de novo, quem tinha assinado e não teve mudança continua assinado.
          </li>
        </ul>
      )}
      {assinaram > 0 && (
        <p className="suave pequeno" style={{ margin: 0 }}>
          Última assinatura: {(() => { const u = lista.filter((l) => l.c?.assinado_em).sort((a, b) => (a.c.assinado_em < b.c.assinado_em ? 1 : -1))[0]; return u ? `${u.nome}, ${dataHora(u.c.assinado_em)} ${comoConfirmou(u.c.metodo)}` : '' })()}.
        </p>
      )}
    </section>
  )
}

// Fechamento do mês (Fase 7B): conferir o que falta, fechar (trava o mês) e
// baixar a planilha do contador. Administrador e RH fecham; só o administrador reabre.
export default function Fechamento() {
  const { perfil } = useAuth()
  const avisar = useAvisos()
  const [busca, setBusca] = useSearchParams()
  const mes = busca.get('mes') ? lerMes(busca.get('mes')) : mesAnterior()
  const mesTexto = textoDoMes(mes)
  const competencia = competenciaIso(mes)
  const nome = nomeDoMes(mes)
  const ehAdmin = perfil.tipo === 'administrador'

  const [p, setP] = useState(null)
  const [fotos, setFotos] = useState([])
  const [regras, setRegras] = useState(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [semInstalar, setSemInstalar] = useState(false)
  const [confirmar, setConfirmar] = useState(false)
  const [fechando, setFechando] = useState(false)
  const [baixando, setBaixando] = useState(false)
  const [reabrir, setReabrir] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [erroMotivo, setErroMotivo] = useState('')
  const [reabrindo, setReabrindo] = useState(false)
  const [erroAcao, setErroAcao] = useState('')
  const [conferencias, setConferencias] = useState(null)
  const [lembrando, setLembrando] = useState(false)

  const carregar = useCallback(async () => {
    setErro(''); setErroAcao(''); setCarregando(true)
    const res = await supabase.rpc('pendencias_fechamento', { p_competencia: competencia })
    if (res.error) {
      if (faltaInstalar(res.error)) setSemInstalar(true)
      else setErro(traduzirErro(res.error))
      setP(null); setCarregando(false); return
    }
    const dados = res.data || {}
    setP(dados)
    if (dados.fechamento?.status === 'fechado') {
      const [f, fs, cf] = await Promise.all([
        supabase.from('fechamentos').select('regras').eq('id', dados.fechamento.id).maybeSingle(),
        supabase.from('fechamento_espelhos').select('perfil_id, totais').eq('fechamento_id', dados.fechamento.id),
        // Fase 7C: assinaturas (sem a 7C no banco, a tela segue sem esta parte)
        supabase.from('espelho_conferencias').select('perfil_id, status, assinado_em, metodo, problema_data, problema_texto')
          .eq('fechamento_id', dados.fechamento.id).is('substituida_em', null),
      ])
      setConferencias(cf.error || !Array.isArray(cf.data) ? null : Object.fromEntries(cf.data.map((c) => [c.perfil_id, c])))
      const lista = fs.data || []
      const ids = lista.map((x) => x.perfil_id)
      const nomes = ids.length
        ? (await supabase.from('perfis').select('id, nome_completo').in('id', ids)).data || []
        : []
      const mapa = Object.fromEntries(nomes.map((n) => [n.id, n.nome_completo]))
      setRegras(f.data?.regras || null)
      setFotos(lista.map((x) => ({ ...x, nome: mapa[x.perfil_id] || 'Pessoa' })))
    } else { setFotos([]); setRegras(null); setConferencias(null) }
    setCarregando(false)
  }, [competencia])

  useEffect(() => { carregar() }, [carregar])

  const linhas = useMemo(() => fotos
    .map((x) => ({ ...x, t: totaisDaFoto(x.totais, regras) }))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')), [fotos, regras])

  const irPara = (novo) => setBusca({ mes: textoDoMes(novo) }, { replace: true })
  const noMesAtual = ehMesAtualOuFuturo(mes)

  async function fechar() {
    setFechando(true); setErroAcao('')
    const { error } = await supabase.rpc('fechar_mes', { p_competencia: competencia, p_forcar: (p?.total_pendencias || 0) > 0 })
    setFechando(false); setConfirmar(false)
    if (error) return setErroAcao(traduzirErro(error))
    avisar(`${nome} fechado. A planilha do contador já pode ser baixada.`)
    carregar()
  }

  async function baixar() {
    setBaixando(true); setErroAcao('')
    const { data, error } = await supabase.rpc('planilha_fechamento', { p_competencia: competencia })
    if (error) { setBaixando(false); return setErroAcao(traduzirErro(error)) }
    try {
      const bytes = gerarPlanilhaFechamento(data)
      baixarArquivo(bytes, nomeDoArquivo(data.empresa, data.competencia))
      avisar('Planilha baixada. Ela está na pasta de downloads do seu aparelho.')
    } catch {
      setErroAcao('Não conseguimos montar a planilha. Tente de novo em instantes.')
    }
    setBaixando(false)
  }

  async function lembrar() {
    setLembrando(true); setErroAcao('')
    const { data, error } = await supabase.rpc('lembrar_assinaturas', { p_competencia: competencia })
    setLembrando(false)
    if (error) return setErroAcao(traduzirErro(error))
    avisar(data > 0 ? `Lembrete enviado para ${plural(data, 'pessoa', 'pessoas')}. Aparece no sininho do Ayra.` : 'Todo mundo que falta já recebeu um lembrete hoje.')
  }

  async function confirmarReabertura(e) {
    e?.preventDefault?.()
    if (motivo.trim().length < 5) return setErroMotivo('Conte em poucas palavras por que o mês está sendo reaberto.')
    setReabrindo(true)
    const { error } = await supabase.rpc('reabrir_mes', { p_competencia: competencia, p_motivo: motivo.trim() })
    setReabrindo(false)
    if (error) return setErroMotivo(traduzirErro(error))
    setReabrir(false); setMotivo('')
    avisar(`${nome} reaberto. Feche de novo quando terminar os ajustes.`)
    carregar()
  }

  const cabecalho = (
    <div className="pagina__cabecalho">
      <div className="pagina__titulo">
        <span className="pagina__trilha">Gestão</span>
        <h1>Fechamento do mês</h1>
        <p className="suave">Confira o que falta, feche o mês e baixe a planilha para o contador.</p>
      </div>
    </div>
  )

  if (semInstalar) {
    return (
      <div className="pagina" style={{ maxWidth: 920 }}>
        {cabecalho}
        <Alerta tom="info" titulo="Ainda não instalado">O fechamento do mês chega com a atualização do banco da Fase 7B. Rode a migração no Supabase (passo a passo no guia da fase).</Alerta>
      </div>
    )
  }

  const f = p?.fechamento
  const fechado = f?.status === 'fechado'
  const terminou = Boolean(p?.mes_terminou)
  const etapa = fechado ? 2 : terminou ? 1 : 0
  const total = p?.total_pendencias || 0

  return (
    <div className="pagina fechamento" style={{ maxWidth: 920 }}>
      {cabecalho}

      <div className="linha linha--espacada">
        <div className="linha">
          <Botao variante="secundario" tamanho="pequeno" className="btn--icone" aria-label="Mês anterior" icone={ChevronLeft} onClick={() => irPara(somarMeses(mes, -1))} />
          <strong style={{ minWidth: 150, textAlign: 'center' }} aria-live="polite">{nome}</strong>
          <Botao variante="secundario" tamanho="pequeno" className="btn--icone" aria-label="Próximo mês" icone={ChevronRight} onClick={() => irPara(somarMeses(mes, 1))} disabled={noMesAtual} />
        </div>
        {!carregando && p && (
          fechado ? <Etiqueta tom="ok" icone={Lock}>Fechado</Etiqueta>
            : f?.status === 'reaberto' ? <Etiqueta tom="atencao" icone={LockOpen}>Reaberto</Etiqueta>
            : <Etiqueta tom="neutra" icone={LockOpen}>Aberto</Etiqueta>
        )}
      </div>

      {carregando ? <Esqueleto blocos={2} linhas={3} /> : erro ? (
        <EstadoErro aoTentarDeNovo={carregar}>{erro}</EstadoErro>
      ) : p && (
        <>
          <Etapas atual={etapa} />

          {erroAcao && <Alerta tom="problema">{erroAcao}</Alerta>}

          {fechado ? (
            <>
              <section className="cartao fechamento__pronto" aria-labelledby="t-fechado">
                <Lock className="fechamento__cadeado" aria-hidden="true" />
                <div className="fechamento__pronto-texto">
                  <h2 id="t-fechado">{nome} está fechado</h2>
                  <p className="suave">
                    Fechado em {dataHora(f.fechado_em)}{f.fechado_por_nome ? ` por ${f.fechado_por_nome}` : ''} · {plural(f.pessoas, 'pessoa', 'pessoas')}.
                    {f.pendencias > 0 && ` Fechado com ${plural(f.pendencias, 'pendência', 'pendências')}.`}
                  </p>
                  <p className="suave pequeno">O espelho de cada pessoa foi guardado como estava. Pedidos, afastamentos, banco de horas, escalas e feriados deste mês ficam travados.</p>
                </div>
                <div className="acoes">
                  <Botao icone={FileSpreadsheet} onClick={baixar} carregando={baixando}>Baixar planilha para o contador</Botao>
                  {ehAdmin && <Botao variante="secundario" icone={LockOpen} onClick={() => { setReabrir(true); setErroMotivo('') }}>Reabrir o mês</Botao>}
                </div>
                {!ehAdmin && <p className="suave pequeno fechamento__nota">Só o administrador pode reabrir um mês fechado.</p>}
              </section>

              {conferencias && linhas.length > 0 && (
                <Assinaturas linhas={linhas} conferencias={conferencias} mesTexto={mesTexto} aoLembrar={lembrar} lembrando={lembrando} />
              )}

              <section className="cartao" aria-labelledby="t-totais">
                <div className="cartao__cabecalho"><h2 id="t-totais">Totais de {nome.toLowerCase()}</h2></div>
                <TotaisDoFechamento linhas={linhas} regras={regras} mesTexto={mesTexto} conferencias={conferencias} />
              </section>
            </>
          ) : (
            <>
              {f?.status === 'reaberto' && (
                <Alerta tom="atencao" titulo={`Mês reaberto em ${dataHora(f.reaberto_em)}`}>
                  Motivo: {f.motivo_reabertura}. Depois dos ajustes, feche de novo para gerar a planilha atualizada.
                </Alerta>
              )}
              {!terminou && (
                <Alerta tom="info" titulo={`${nome} ainda não terminou`}>
                  Você poderá fechar a partir de {formatarData(p.pode_fechar_em)}. Enquanto isso, já dá para ir resolvendo o que aparece abaixo.
                </Alerta>
              )}

              <section className="cartao" aria-labelledby="t-conferir">
                <div className="cartao__cabecalho">
                  <h2 id="t-conferir">{terminou ? 'Antes de fechar, confira' : 'O que já dá para conferir'}</h2>
                  <span className="suave pequeno">{plural(p.pessoas || 0, 'pessoa entra', 'pessoas entram')} neste fechamento</span>
                </div>
                <Conferencia p={p} mesTexto={mesTexto} />
              </section>

              {terminou && (
                <section className="cartao fechamento__acao" aria-labelledby="t-fechar">
                  <CalendarClock className="fechamento__cadeado" aria-hidden="true" />
                  <div className="fechamento__pronto-texto">
                    <h2 id="t-fechar">{total === 0 ? 'Tudo certo para fechar' : `${plural(total, 'pendência', 'pendências')} em aberto`}</h2>
                    <p className="suave">
                      {total === 0
                        ? 'Ao fechar, o espelho de cada pessoa é guardado e a planilha do contador fica pronta.'
                        : 'O ideal é resolver antes. Se precisar, dá para fechar mesmo assim: o mês fica como está agora.'}
                    </p>
                  </div>
                  <div className="acoes">
                    <Botao icone={Lock} onClick={() => setConfirmar(true)}>Fechar {nome.toLowerCase()}</Botao>
                  </div>
                </section>
              )}
            </>
          )}
        </>
      )}

      <Confirmacao
        aberta={confirmar}
        titulo={total > 0 ? 'Fechar mesmo assim?' : `Fechar ${nome.toLowerCase()}?`}
        textoConfirmar={total > 0 ? 'Fechar mesmo assim' : 'Fechar o mês'}
        carregando={fechando}
        aoConfirmar={fechar}
        aoCancelar={() => setConfirmar(false)}
      >
        {total > 0 && <p>Ainda há <strong>{plural(total, 'pendência', 'pendências')}</strong>. O espelho será guardado como está agora.</p>}
        <p>Depois de fechado, ninguém aprova pedidos nem muda afastamentos, banco de horas, escalas ou feriados deste mês. Só o administrador pode reabrir.</p>
      </Confirmacao>

      <Dialogo
        aberto={reabrir}
        aoFechar={reabrindo ? undefined : () => setReabrir(false)}
        titulo={`Reabrir ${nome.toLowerCase()}?`}
        acoes={(
          <>
            <Botao variante="secundario" onClick={() => setReabrir(false)} disabled={reabrindo}>Cancelar</Botao>
            <Botao variante="perigo" icone={LockOpen} onClick={confirmarReabertura} carregando={reabrindo}>Reabrir o mês</Botao>
          </>
        )}
      >
        <form className="pilha" onSubmit={confirmarReabertura} noValidate>
          <p className="suave" style={{ margin: 0 }}>O mês volta a aceitar ajustes e a planilha guardada deixa de valer. Se a planilha já foi para o contador, avise que vai sair uma nova. As assinaturas ficam guardadas; ao fechar de novo, quem teve o espelho mudado assina outra vez.</p>
          <AreaTexto rotulo="Por que reabrir?" rows={3} maxLength={300} value={motivo}
            onChange={(e) => { setMotivo(e.target.value); setErroMotivo('') }} erro={erroMotivo}
            ajuda="Fica registrado no Histórico de alterações." data-foco-inicial />
        </form>
      </Dialogo>
    </div>
  )
}
