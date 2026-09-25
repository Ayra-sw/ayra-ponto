import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { Check, Coffee, Inbox, RefreshCw, UserPlus, UserRoundX, Users, Clock } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../contexts/AuthContext'
import { cnpjValido } from '../lib/cnpj'
import { dataPorExtenso, hora, inicioDeHoje } from '../lib/formatos'
import { SITUACAO_AGORA, rotuloMarcacao, situacaoAgora } from '../lib/marcacoes'
import { PAPEL } from '../lib/rotulos'
import Botao from '../components/ui/Botao'
import Etiqueta from '../components/ui/Etiqueta'
import Indicador from '../components/ui/Indicador'
import Alerta from '../components/ui/Alerta'
import { Selecao } from '../components/ui/Campo'
import { Esqueleto, EstadoErro, EstadoVazio } from '../components/ui/Estados'
import ConvidarPessoas from '../components/ConvidarPessoas'

const ORDEM = { trabalhando: 0, intervalo: 1, sem_marcacao: 2, encerrado: 3 }

// Visão geral: "o que está acontecendo na minha empresa hoje?"
// Mostra primeiro o que pede atenção; os números vêm depois.
export default function GestaoDashboard() {
  const { perfil } = useAuth()
  const { empresa, unidades, unidadesAtivas, pendentes } = useOutletContext()
  const [pessoas, setPessoas] = useState([])
  const [registros, setRegistros] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(false)
  const [atualizadoEm, setAtualizadoEm] = useState(null)
  const [filtroUnidade, setFiltroUnidade] = useState('')
  const [convidarAberto, setConvidarAberto] = useState(false)

  const carregar = useCallback(async () => {
    setErro(false)
    const [p, r] = await Promise.all([
      supabase.from('perfis').select('id, nome_completo, tipo, status, filial_id, cargo')
        .eq('empresa_id', perfil.empresa_id).order('nome_completo'),
      supabase.from('registros_ponto').select('perfil_id, tipo, marcado_em, filial_id')
        .gte('marcado_em', inicioDeHoje()).order('marcado_em', { ascending: true }),
    ])
    if (p.error || r.error) setErro(true)
    setPessoas(p.data || [])
    setRegistros(r.data || [])
    setAtualizadoEm(new Date())
    setCarregando(false)
  }, [perfil.empresa_id])

  useEffect(() => { carregar() }, [carregar])
  useEffect(() => {
    const t = setInterval(carregar, 60000) // atualiza sozinho a cada minuto
    return () => clearInterval(t)
  }, [carregar])

  const nomeUnidade = useMemo(() => Object.fromEntries(unidades.map((u) => [u.id, u.nome])), [unidades])

  const equipe = useMemo(() => {
    const porPessoa = {}
    for (const r of registros) (porPessoa[r.perfil_id] ||= []).push(r)
    return pessoas
      .filter((p) => p.status !== 'desligado')
      .filter((p) => !filtroUnidade || p.filial_id === filtroUnidade)
      .map((p) => {
        const regs = porPessoa[p.id] || []
        const agora = p.status === 'afastado' ? 'afastado' : situacaoAgora(regs)
        return { ...p, agora, ultima: regs[regs.length - 1] }
      })
      .sort((a, b) => (ORDEM[a.agora] ?? 9) - (ORDEM[b.agora] ?? 9) || a.nome_completo.localeCompare(b.nome_completo))
  }, [pessoas, registros, filtroUnidade])

  const contagem = (s) => equipe.filter((p) => p.agora === s).length
  const ativos = equipe.filter((p) => p.status === 'ativo').length
  const semMarcacao = contagem('sem_marcacao')

  const cnpjOk = empresa?.cnpj && cnpjValido(empresa.cnpj)
  const passos = [
    { feito: Boolean(empresa?.razao_social && cnpjOk && empresa?.cidade), titulo: 'Complete os dados da empresa', detalhe: 'Razão social, CNPJ e endereço aparecem no espelho de ponto.', link: '/gestao/configuracoes/empresa', acao: 'Abrir' },
    { feito: unidades.some((u) => u.cidade) , titulo: 'Confira suas unidades', detalhe: 'Cada local de trabalho tem sua própria sequência de registros.', link: '/gestao/configuracoes/unidades', acao: 'Abrir' },
    { feito: pessoas.length > 1, titulo: 'Convide sua equipe', detalhe: 'Envie o link de convite. Cada pessoa cria a própria senha.', aoClicar: () => setConvidarAberto(true), acao: 'Convidar' },
  ]
  const feitos = passos.filter((p) => p.feito).length

  const atencao = []
  if (pendentes > 0) atencao.push({ tom: 'atencao', texto: `${pendentes} ${pendentes === 1 ? 'solicitação espera' : 'solicitações esperam'} sua análise.`, link: '/gestao/solicitacoes', acao: 'Analisar' })
  if (empresa?.cnpj && !cnpjOk) atencao.push({ tom: 'problema', texto: 'O CNPJ cadastrado não é válido. Corrija para evitar problemas no espelho de ponto.', link: '/gestao/configuracoes/empresa', acao: 'Corrigir' })

  return (
    <div className="pagina">
      <div className="pagina__cabecalho">
        <div className="pagina__titulo">
          <h1>Hoje</h1>
          <p className="suave">{empresa?.nome ? `${empresa.nome} · ` : ''}{dataPorExtenso()}</p>
        </div>
        <div className="linha">
          {unidadesAtivas.length > 1 && (
            <div style={{ minWidth: 200 }}>
              <Selecao rotulo="Unidade" value={filtroUnidade} onChange={(e) => setFiltroUnidade(e.target.value)}
                opcoes={[{ valor: '', rotulo: 'Todas as unidades' }, ...unidadesAtivas.map((u) => ({ valor: u.id, rotulo: u.nome }))]} />
            </div>
          )}
          <Botao variante="secundario" icone={RefreshCw} onClick={carregar} title="Atualizar agora">
            {atualizadoEm ? `Atualizado às ${hora(atualizadoEm)}` : 'Atualizar'}
          </Botao>
        </div>
      </div>

      {atencao.length > 0 && (
        <section aria-labelledby="t-atencao" className="pilha">
          <h2 id="t-atencao" className="sr-only">Precisa da sua atenção</h2>
          {atencao.map((a) => (
            <Alerta key={a.texto} tom={a.tom} acao={<Link to={a.link} className="link">{a.acao}</Link>}>{a.texto}</Alerta>
          ))}
        </section>
      )}

      {feitos < passos.length && (
        <section className="cartao" aria-labelledby="t-config">
          <div className="cartao__cabecalho">
            <div>
              <h2 id="t-config">Vamos configurar seu Ayra Ponto</h2>
              <p className="suave pequeno">{feitos} de {passos.length} etapas concluídas. Você pode fazer na ordem que preferir.</p>
            </div>
          </div>
          <div className="progresso" style={{ marginBottom: 16 }} aria-hidden="true"><span style={{ width: `${(feitos / passos.length) * 100}%` }} /></div>
          <ul className="checklist">
            {passos.map((p) => (
              <li key={p.titulo} className={`checklist__item${p.feito ? ' checklist__item--feito' : ''}`}>
                <span className="checklist__marca" aria-hidden="true">{p.feito && <Check />}</span>
                <span className="checklist__texto">
                  <strong>{p.titulo}</strong><span className="suave pequeno">{p.feito ? 'Concluído' : p.detalhe}</span>
                </span>
                {!p.feito && (p.link
                  ? <Link to={p.link} className="btn btn--secundario btn--pequeno">{p.acao}</Link>
                  : <Botao variante="secundario" tamanho="pequeno" onClick={p.aoClicar}>{p.acao}</Botao>)}
              </li>
            ))}
          </ul>
        </section>
      )}

      {carregando ? (
        <Esqueleto blocos={2} linhas={4} />
      ) : erro ? (
        <EstadoErro aoTentarDeNovo={carregar} />
      ) : (
        <>
          <section className="indicadores" aria-label="Resumo de hoje">
            <Indicador icone={Clock} rotulo="Trabalhando agora" valor={contagem('trabalhando')} detalhe={`de ${ativos} ${ativos === 1 ? 'ativo' : 'ativos'}`} />
            <Indicador icone={Coffee} rotulo="Em intervalo" valor={contagem('intervalo')} />
            <Indicador icone={UserRoundX} rotulo="Sem marcação hoje" valor={semMarcacao} detalhe="Ainda não registraram o ponto" />
            <Indicador icone={Inbox} rotulo="Solicitações pendentes" valor={pendentes} para="/gestao/solicitacoes" detalhe={pendentes ? 'Ver e analisar' : 'Nada pendente'} />
          </section>

          <section aria-labelledby="t-equipe" className="pilha">
            <div className="linha linha--espacada">
              <h2 id="t-equipe">Equipe agora</h2>
              <Link to="/gestao/pessoas" className="link pequeno">Ver todos os colaboradores</Link>
            </div>
            {equipe.length <= 1 ? (
              <EstadoVazio icone={Users} titulo="Você ainda é a única pessoa por aqui"
                acao={<Botao icone={UserPlus} onClick={() => setConvidarAberto(true)}>Convidar colaboradores</Botao>}>
                Envie o link de convite para a sua equipe. Quem entrar aparece aqui com a situação do dia.
              </EstadoVazio>
            ) : (
              <>
                <div className="so-computador">
                  <div className="tabela-envoltorio">
                    <table className="tabela">
                      <thead><tr><th>Colaborador</th><th>Unidade</th><th>Agora</th><th style={{ textAlign: 'right' }}>Última marcação</th></tr></thead>
                      <tbody>
                        {equipe.map((p) => (
                          <tr key={p.id}>
                            <td>{p.nome_completo || '—'}<span className="tabela__secundario">{p.cargo || PAPEL[p.tipo]}</span></td>
                            <td>{nomeUnidade[p.filial_id] || '—'}</td>
                            <td><EtiquetaAgora agora={p.agora} /></td>
                            <td style={{ textAlign: 'right' }}>{p.ultima ? <><span className="mono">{hora(p.ultima.marcado_em)}</span> · {rotuloMarcacao(p.ultima.tipo)}</> : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div className="so-celular lista-cartoes">
                  {equipe.map((p) => (
                    <div key={p.id} className="cartao-linha">
                      <div className="cartao-linha__topo">
                        <span className="cartao-linha__titulo">{p.nome_completo || '—'}</span>
                        <EtiquetaAgora agora={p.agora} />
                      </div>
                      <div className="cartao-linha__detalhes">
                        <span>{nomeUnidade[p.filial_id] || 'Sem unidade'}</span>
                        <span>{p.ultima ? <><span className="mono">{hora(p.ultima.marcado_em)}</span> · {rotuloMarcacao(p.ultima.tipo)}</> : 'Sem marcação hoje'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>
        </>
      )}

      <ConvidarPessoas aberto={convidarAberto} aoFechar={() => setConvidarAberto(false)} empresa={empresa} />
    </div>
  )
}

function EtiquetaAgora({ agora }) {
  if (agora === 'afastado') return <Etiqueta tom="neutra">Afastado</Etiqueta>
  const s = SITUACAO_AGORA[agora]
  const icone = agora === 'intervalo' ? Coffee : agora === 'trabalhando' ? Check : undefined
  return <Etiqueta tom={s.tom} icone={icone}>{s.rotulo}</Etiqueta>
}
