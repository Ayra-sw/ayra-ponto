import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Check, Inbox, MessageSquareText, Paperclip, Search, X } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../contexts/AuthContext'
import { useAvisos } from '../../contexts/AvisosContext'
import { traduzirErro } from '../../lib/mensagensErro'
import { dataHora } from '../../lib/formatos'
import { TIPO_SOLICITACAO } from '../../lib/rotulos'
import { STATUS_SOLICITACAO, descreverPedido } from '../../lib/ajustes'
import { abrirAtestado } from '../../lib/atestados'
import { nomesDe } from '../marcacoes/ListaSolicitacoes'
import Botao from '../ui/Botao'
import Etiqueta from '../ui/Etiqueta'
import Alerta from '../ui/Alerta'
import { AreaTexto, Selecao } from '../ui/Campo'
import { Dialogo } from '../ui/Dialogo'
import { Esqueleto, EstadoErro, EstadoVazio } from '../ui/Estados'

const FILTROS = [
  { id: 'pendente', rotulo: 'Pendentes' },
  { id: 'aprovado', rotulo: 'Aprovadas' },
  { id: 'rejeitado', rotulo: 'Recusadas' },
  { id: 'cancelado', rotulo: 'Canceladas' },
  { id: 'todas', rotulo: 'Todas' },
]
const LIMITE = 200
const MAX_COMENTARIO = 500

// Central de solicitações.
//   modo "gestao": administrador e RH, a empresa toda (com atestado e abono)
//   modo "gestor": o gestor, só a equipe dele e sem abono (abono é com o RH)
// Ninguém analisa o próprio pedido: o banco garante.
export default function CentralSolicitacoes({ modo = 'gestao', aoAnalisar, linkDaPessoa }) {
  const { perfil } = useAuth()
  const avisar = useAvisos()
  const [busca, setBusca] = useSearchParams()
  const status = FILTROS.some((f) => f.id === busca.get('status')) ? busca.get('status') : 'pendente'
  const [lista, setLista] = useState([])
  const [pessoas, setPessoas] = useState({})      // id → { nome, departamento_id }
  const [nomes, setNomes] = useState({})          // id → nome (de quem analisou)
  const [departamentos, setDepartamentos] = useState([])
  const [termo, setTermo] = useState('')
  const [tipo, setTipo] = useState('')
  const [departamento, setDepartamento] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [analisando, setAnalisando] = useState(null) // { item, status }
  const gestor = modo === 'gestor'

  const carregar = useCallback(async () => {
    setErro('')
    setCarregando(true)
    let consulta = supabase.from('ajustes_ponto').select('*')
    if (status !== 'todas') consulta = consulta.eq('status', status)
    if (gestor) consulta = consulta.neq('tipo', 'abono').neq('perfil_id', perfil.id)
    consulta = consulta.order('criado_em', { ascending: status === 'pendente' }).limit(LIMITE)

    const [pedidos, quem, deps] = await Promise.all([
      consulta,
      gestor
        ? supabase.rpc('minha_equipe')
        : supabase.from('perfis').select('id, nome_completo, departamento_id').eq('empresa_id', perfil.empresa_id),
      gestor ? Promise.resolve({ data: [] }) : supabase.from('departamentos').select('id, nome').eq('empresa_id', perfil.empresa_id).order('nome'),
    ])
    if (pedidos.error || quem.error) {
      setErro(traduzirErro(pedidos.error || quem.error))
      setLista([])
      setCarregando(false)
      return
    }
    const mapa = Object.fromEntries((quem.data || []).map((p) => [p.perfil_id || p.id, { nome: p.nome_completo, departamento_id: p.departamento_id }]))
    // o gestor vê só a equipe (o banco já filtra; aqui garante que a lista não mostra mais ninguém)
    const itens = (pedidos.data || []).filter((a) => !gestor || mapa[a.perfil_id])
    setPessoas(mapa)
    setLista(itens)
    setDepartamentos(deps.data || [])
    setCarregando(false)
    const conhecidos = Object.fromEntries(Object.entries(mapa).map(([id, p]) => [id, p.nome]))
    setNomes(await nomesDe(itens.map((a) => a.analisado_por).filter(Boolean), conhecidos))
  }, [status, gestor, perfil.id, perfil.empresa_id])

  useEffect(() => { carregar() }, [carregar])

  const visiveis = useMemo(() => {
    const t = termo.trim().toLowerCase()
    return lista.filter((a) => (!tipo || a.tipo === tipo)
      && (!departamento || pessoas[a.perfil_id]?.departamento_id === departamento)
      && (!t || (pessoas[a.perfil_id]?.nome || '').toLowerCase().includes(t)))
  }, [lista, termo, tipo, departamento, pessoas])

  const mudarStatus = (novo) => setBusca(novo === 'pendente' ? {} : { status: novo }, { replace: true })
  const nome = (a) => pessoas[a.perfil_id]?.nome || 'Pessoa'
  const link = (a) => (linkDaPessoa ? linkDaPessoa(a.perfil_id) : `/gestao/pessoas/${a.perfil_id}?aba=solicitacoes`)
  const tiposDoFiltro = Object.entries(TIPO_SOLICITACAO).filter(([valor]) => !gestor || valor !== 'abono')

  async function abrir(caminho) {
    const problema = await abrirAtestado(caminho)
    if (problema) avisar(problema, 'problema')
  }

  function Acoes({ item }) {
    if (item.status !== 'pendente') return null
    if (item.perfil_id === perfil.id) return <span className="suave pequeno">Seu pedido: outra pessoa precisa analisar</span>
    return (
      <div className="acoes">
        <Botao tamanho="pequeno" icone={Check} onClick={() => setAnalisando({ item, status: 'aprovado' })}>Aprovar</Botao>
        <Botao tamanho="pequeno" variante="secundario" icone={X} onClick={() => setAnalisando({ item, status: 'rejeitado' })}>Recusar</Botao>
      </div>
    )
  }

  function Pedido({ a }) {
    const s = STATUS_SOLICITACAO[a.status] || STATUS_SOLICITACAO.pendente
    return (
      <article className="cartao-linha pedido" aria-label={`${TIPO_SOLICITACAO[a.tipo]} de ${nome(a)}`}>
        <div className="cartao-linha__topo">
          <Link to={link(a)} className="cartao-linha__titulo link">{nome(a)}</Link>
          <div className="linha" style={{ gap: 6 }}>
            <Etiqueta tom="info" icone={false}>{TIPO_SOLICITACAO[a.tipo] || a.tipo}</Etiqueta>
            {status === 'todas' && <Etiqueta tom={s.tom}>{s.rotulo}</Etiqueta>}
          </div>
        </div>
        {descreverPedido(a) && <p><strong>{descreverPedido(a)}</strong></p>}
        <p className="suave">{a.motivo}</p>
        {a.comentario_analise && (
          <p className="resposta-analise"><MessageSquareText aria-hidden="true" /><span><strong>Resposta:</strong> {a.comentario_analise}</span></p>
        )}
        <div className="cartao-linha__detalhes">
          <span>Enviada em <span className="mono">{dataHora(a.criado_em)}</span></span>
          {a.analisado_em && (
            <span>
              {a.status === 'cancelado' ? 'Cancelada pela pessoa em ' : 'Analisada em '}
              <span className="mono">{dataHora(a.analisado_em)}</span>
              {a.status !== 'cancelado' && nomes[a.analisado_por] ? ` por ${nomes[a.analisado_por]}` : ''}
            </span>
          )}
        </div>
        {(a.anexo_path || a.status === 'pendente') && (
          <div className="linha linha--espacada" style={{ flexWrap: 'wrap' }}>
            {a.anexo_path && !gestor
              ? <Botao variante="secundario" tamanho="pequeno" icone={Paperclip} onClick={() => abrir(a.anexo_path)}>Ver atestado</Botao>
              : <span />}
            <Acoes item={a} />
          </div>
        )}
      </article>
    )
  }

  return (
    <div className="pilha">
      <div className="abas" role="tablist" aria-label="Situação dos pedidos">
        {FILTROS.map((f) => (
          <button key={f.id} type="button" role="tab" aria-selected={status === f.id} className="abas__item" onClick={() => mudarStatus(f.id)}>{f.rotulo}</button>
        ))}
      </div>

      <div className="filtros">
        <div className="campo campo--busca">
          <label className="campo__rotulo" htmlFor={`busca-pedidos-${modo}`}>Buscar pessoa</label>
          <div className="entrada-grupo">
            <input id={`busca-pedidos-${modo}`} className="entrada" type="search" placeholder="Nome" value={termo} onChange={(e) => setTermo(e.target.value)} />
            <span className="entrada-grupo__botao" aria-hidden="true"><Search /></span>
          </div>
        </div>
        <Selecao rotulo="Tipo" value={tipo} onChange={(e) => setTipo(e.target.value)}
          opcoes={[{ valor: '', rotulo: 'Todos' }, ...tiposDoFiltro.map(([valor, rotulo]) => ({ valor, rotulo }))]} />
        {!gestor && departamentos.length > 0 && (
          <Selecao rotulo="Departamento" value={departamento} onChange={(e) => setDepartamento(e.target.value)}
            opcoes={[{ valor: '', rotulo: 'Todos' }, ...departamentos.map((d) => ({ valor: d.id, rotulo: d.nome }))]} />
        )}
      </div>

      {gestor && status === 'pendente' && (
        <p className="suave pequeno" style={{ margin: 0 }}>Pedidos de abono (com atestado) vão direto para o RH e não aparecem aqui.</p>
      )}

      {carregando ? <Esqueleto linhas={5} /> : erro ? <EstadoErro aoTentarDeNovo={carregar}>{erro}</EstadoErro> : lista.length === 0 ? (
        <EstadoVazio icone={Inbox} titulo={status === 'pendente' ? 'Nenhum pedido esperando análise' : 'Nenhum pedido nesta lista'}>
          {status === 'pendente'
            ? (gestor ? 'Quando alguém da sua equipe pedir um ajuste ou uma folga, o pedido aparece aqui.' : 'Quando alguém pedir um ajuste de ponto, abono ou folga, o pedido aparece aqui para você analisar.')
            : 'Troque o filtro no alto para ver outros pedidos.'}
        </EstadoVazio>
      ) : visiveis.length === 0 ? (
        <EstadoVazio icone={Search} titulo="Nenhum pedido encontrado"
          acao={<Botao variante="secundario" onClick={() => { setTermo(''); setTipo(''); setDepartamento('') }}>Limpar filtros</Botao>}>
          Confira o nome, o tipo ou o departamento.
        </EstadoVazio>
      ) : (
        <>
          <div className="lista-cartoes pedidos">
            {visiveis.map((a) => <Pedido key={a.id} a={a} />)}
          </div>
          {lista.length === LIMITE && (
            <p className="suave pequeno">Mostrando os {LIMITE} pedidos mais {status === 'pendente' ? 'antigos' : 'recentes'}.</p>
          )}
        </>
      )}

      <JanelaAnalise
        analise={analisando} nomePessoa={analisando ? nome(analisando.item) : ''}
        aoFechar={() => setAnalisando(null)}
        aoConcluir={(id, novo) => {
          setAnalisando(null)
          setLista((l) => (status === 'todas' ? l.map((a) => (a.id === id ? { ...a, status: novo } : a)) : l.filter((a) => a.id !== id)))
          aoAnalisar?.()
          avisar(novo === 'aprovado' ? 'Pedido aprovado.' : 'Pedido recusado. A pessoa vai ver a sua resposta.')
          if (status === 'todas') carregar()
        }}
      />
    </div>
  )
}

function JanelaAnalise({ analise, nomePessoa, aoFechar, aoConcluir }) {
  const [comentario, setComentario] = useState('')
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)

  useEffect(() => { setComentario(''); setErro('') }, [analise])

  const aprovar = analise?.status === 'aprovado'

  async function confirmar() {
    setErro('')
    const texto = comentario.trim()
    if (!aprovar && texto.length < 3) return setErro('Para recusar, explique o motivo. A pessoa vai ler a resposta.')
    setSalvando(true)
    const { data, error } = await supabase.from('ajustes_ponto')
      .update({ status: analise.status, comentario_analise: texto || null })
      .eq('id', analise.item.id).select('id')
    setSalvando(false)
    if (error) return setErro(traduzirErro(error))
    if (!data?.length) return setErro('Não foi possível analisar. O pedido pode já ter sido analisado por outra pessoa, ou não é da sua alçada.')
    aoConcluir(analise.item.id, analise.status)
  }

  return (
    <Dialogo
      aberto={Boolean(analise)} aoFechar={salvando ? undefined : aoFechar}
      titulo={aprovar ? `Aprovar o pedido de ${nomePessoa}?` : `Recusar o pedido de ${nomePessoa}?`}
      acoes={
        <>
          <Botao variante="secundario" onClick={aoFechar} disabled={salvando}>Voltar</Botao>
          <Botao variante={aprovar ? 'primario' : 'perigo'} onClick={confirmar} carregando={salvando}>{aprovar ? 'Aprovar' : 'Recusar'}</Botao>
        </>
      }
    >
      <div className="formulario">
        {analise && (
          <p className="suave">
            <strong>{TIPO_SOLICITACAO[analise.item.tipo]}</strong>{descreverPedido(analise.item) ? `: ${descreverPedido(analise.item)}` : ''}.{' '}
            {aprovar
              ? 'Depois de aprovado, o pedido passa a valer no espelho de ponto. A marcação original nunca é apagada.'
              : 'O pedido não vai valer no espelho. A análise é definitiva e fica registrada com o seu nome e o horário.'}
          </p>
        )}
        <AreaTexto
          rotulo={aprovar ? 'Comentário' : 'Motivo da recusa'} opcional={aprovar}
          value={comentario} onChange={(e) => { setComentario(e.target.value); setErro('') }}
          maxLength={MAX_COMENTARIO} rows={3} data-foco-inicial
          placeholder={aprovar ? 'Ex.: conferido com a câmera da loja' : 'Ex.: nesse dia a loja não abriu'}
          ajuda={`A pessoa vê esta resposta. ${comentario.length}/${MAX_COMENTARIO}`}
        />
        {erro && <Alerta tom="problema">{erro}</Alerta>}
      </div>
    </Dialogo>
  )
}
