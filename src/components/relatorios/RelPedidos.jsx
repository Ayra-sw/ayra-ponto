import { useCallback, useEffect, useMemo, useState } from 'react'
import { Inbox } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { traduzirErro } from '../../lib/mensagensErro'
import { dataHora } from '../../lib/formatos'
import { TIPO_SOLICITACAO } from '../../lib/rotulos'
import { STATUS_SOLICITACAO, descreverPedido } from '../../lib/ajustes'
import { baixarCsv } from '../../lib/apuracao'
import { buscarTodas } from '../../lib/relatorios'
import { nomesDe } from '../marcacoes/ListaSolicitacoes'
import Etiqueta from '../ui/Etiqueta'
import Indicador from '../ui/Indicador'
import { Esqueleto, EstadoErro, EstadoVazio } from '../ui/Estados'
import { AcoesRelatorio, Visoes, usePaginas } from './Comum'

// tempo entre o pedido e a resposta, em minutos
const minutosDeResposta = (a) => (a.analisado_em && a.status !== 'cancelado' && a.status !== 'pendente'
  ? Math.max(0, Math.round((new Date(a.analisado_em) - new Date(a.criado_em)) / 60000)) : null)

export function textoTempo(minutos) {
  if (minutos == null) return '—'
  if (minutos < 60) return `${minutos} min`
  if (minutos < 48 * 60) return `${Math.floor(minutos / 60)}h${String(minutos % 60).padStart(2, '0')}`
  return `${Math.round(minutos / 1440)} dias`
}

const media = (lista) => {
  const v = lista.map(minutosDeResposta).filter((m) => m != null)
  return v.length ? Math.round(v.reduce((t, m) => t + m, 0) / v.length) : null
}

export default function RelPedidos({ filtros }) {
  const { inicio, fim, departamento, termo, gestor, perfil } = filtros
  const [pedidos, setPedidos] = useState([])
  const [pessoas, setPessoas] = useState({})
  const [nomes, setNomes] = useState({})
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [visao, setVisao] = useState('resumo')

  const carregar = useCallback(async () => {
    setErro('')
    setCarregando(true)
    const de = new Date(`${inicio}T00:00:00`).toISOString()
    const ate = new Date(new Date(`${fim}T00:00:00`).getTime() + 86400000).toISOString()
    const [lista, quem] = await Promise.all([
      buscarTodas(() => {
        let q = supabase.from('ajustes_ponto').select('*').gte('criado_em', de).lt('criado_em', ate)
        if (gestor) q = q.neq('tipo', 'abono').neq('perfil_id', perfil.id)
        return q.order('criado_em', { ascending: true })
      }),
      gestor
        ? supabase.rpc('minha_equipe')
        : supabase.from('perfis').select('id, nome_completo, matricula, departamento_id').eq('empresa_id', perfil.empresa_id),
    ])
    if (lista.error || quem.error) {
      setErro(traduzirErro(lista.error || quem.error)); setPedidos([]); setCarregando(false); return
    }
    const mapa = Object.fromEntries((quem.data || []).map((p) => [p.perfil_id || p.id, { nome: p.nome_completo, matricula: p.matricula, departamento_id: p.departamento_id }]))
    const itens = (lista.data || []).filter((a) => !gestor || mapa[a.perfil_id])
    setPessoas(mapa)
    setPedidos(itens)
    setCarregando(false)
    setNomes(await nomesDe(itens.map((a) => a.analisado_por).filter(Boolean), Object.fromEntries(Object.entries(mapa).map(([id, p]) => [id, p.nome]))))
  }, [inicio, fim, gestor, perfil.id, perfil.empresa_id])

  useEffect(() => { carregar() }, [carregar])

  const visiveis = useMemo(() => pedidos.filter((a) => (!departamento || pessoas[a.perfil_id]?.departamento_id === departamento)
    && (!termo || `${pessoas[a.perfil_id]?.nome || ''} ${pessoas[a.perfil_id]?.matricula || ''}`.toLowerCase().includes(termo))), [pedidos, pessoas, departamento, termo])
  const paginas = usePaginas(visiveis.length)
  const conta = (status) => visiveis.filter((a) => a.status === status).length
  const porTipo = useMemo(() => Object.keys(TIPO_SOLICITACAO).filter((t) => !gestor || t !== 'abono').map((tipo) => {
    const l = visiveis.filter((a) => a.tipo === tipo)
    return { tipo, total: l.length, pendente: l.filter((a) => a.status === 'pendente').length, aprovado: l.filter((a) => a.status === 'aprovado').length,
      rejeitado: l.filter((a) => a.status === 'rejeitado').length, cancelado: l.filter((a) => a.status === 'cancelado').length, media: media(l) }
  }), [visiveis, gestor])

  function baixar() {
    baixarCsv(`pedidos-${inicio}-a-${fim}.csv`,
      ['Enviado em', 'Nome', 'Matrícula', 'Tipo', 'Pedido', 'Motivo', 'Situação', 'Respondido em', 'Respondido por', 'Tempo de resposta (h)', 'Resposta', 'Atestado anexado'],
      visiveis.map((a) => {
        const m = minutosDeResposta(a)
        return [dataHora(a.criado_em), pessoas[a.perfil_id]?.nome || '', pessoas[a.perfil_id]?.matricula || '', TIPO_SOLICITACAO[a.tipo] || a.tipo,
          descreverPedido(a), a.motivo, STATUS_SOLICITACAO[a.status]?.rotulo || a.status, a.analisado_em ? dataHora(a.analisado_em) : '',
          a.status === 'cancelado' ? '' : (nomes[a.analisado_por] || ''), m == null ? '' : (m / 60).toFixed(2).replace('.', ','),
          a.comentario_analise || '', a.anexo_path ? 'Sim' : 'Não']
      }))
  }

  if (carregando) return <Esqueleto linhas={6} blocos={1} />
  if (erro) return <EstadoErro aoTentarDeNovo={carregar}>{erro}</EstadoErro>
  if (visiveis.length === 0) {
    return <EstadoVazio icone={Inbox} titulo="Nenhum pedido no período">Nenhum pedido de ajuste, abono ou folga foi enviado nesses dias{termo || departamento ? ' com esses filtros' : ''}.</EstadoVazio>
  }

  return (
    <div className="pilha">
      <div className="indicadores">
        <Indicador rotulo="Pedidos no período" valor={visiveis.length} detalhe={`${conta('cancelado')} cancelados pela pessoa`} />
        <Indicador rotulo="Esperando resposta" valor={conta('pendente')} detalhe={conta('pendente') ? 'Veja em Solicitações' : 'Nenhum'} />
        <Indicador rotulo="Aprovados / recusados" valor={`${conta('aprovado')} / ${conta('rejeitado')}`} detalhe="Respondidos no sistema" />
        <Indicador rotulo="Tempo médio de resposta" valor={textoTempo(media(visiveis))} detalhe="Do envio à resposta" />
      </div>

      <AcoesRelatorio aoBaixar={baixar} desativado={visiveis.length === 0}>
        <Visoes valor={visao} aoMudar={(v) => { setVisao(v); paginas.reiniciar() }}
          opcoes={[{ id: 'resumo', rotulo: 'Por tipo' }, { id: 'lista', rotulo: 'Lista de pedidos' }]} />
      </AcoesRelatorio>

      {visao === 'resumo' ? (
        <div className="tabela-envoltorio">
          <table className="tabela tabela--relatorio">
            <thead><tr>
              <th scope="col">Tipo</th><th scope="col" className="num">Total</th><th scope="col" className="num">Aprovados</th>
              <th scope="col" className="num">Recusados</th><th scope="col" className="num">Esperando</th><th scope="col" className="num">Cancelados</th>
              <th scope="col" className="num">Tempo médio</th>
            </tr></thead>
            <tbody>
              {porTipo.map((l) => (
                <tr key={l.tipo}>
                  <td>{TIPO_SOLICITACAO[l.tipo]}</td>
                  <td className="num">{l.total}</td><td className="num">{l.aprovado}</td><td className="num">{l.rejeitado}</td>
                  <td className="num">{l.pendente}</td><td className="num">{l.cancelado}</td><td className="num">{textoTempo(l.media)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <>
          <div className="so-computador tabela-envoltorio">
            <table className="tabela tabela--relatorio">
              <thead><tr>
                <th scope="col">Enviado</th><th scope="col">Pessoa</th><th scope="col">Pedido</th><th scope="col">Situação</th>
                <th scope="col">Respondido</th><th scope="col" className="num">Tempo</th>
              </tr></thead>
              <tbody>
                {visiveis.slice(0, paginas.visiveis).map((a) => {
                  const s = STATUS_SOLICITACAO[a.status] || STATUS_SOLICITACAO.pendente
                  return (
                    <tr key={a.id}>
                      <td className="mono" style={{ whiteSpace: 'nowrap' }}>{dataHora(a.criado_em)}</td>
                      <td>{pessoas[a.perfil_id]?.nome || '—'}</td>
                      <td>{TIPO_SOLICITACAO[a.tipo]}<span className="tabela__secundario">{descreverPedido(a)}</span></td>
                      <td><Etiqueta tom={s.tom}>{s.rotulo}</Etiqueta></td>
                      <td className="pequeno">{a.analisado_em ? `${dataHora(a.analisado_em)}${a.status !== 'cancelado' && nomes[a.analisado_por] ? ` · ${nomes[a.analisado_por]}` : ''}` : '—'}</td>
                      <td className="num">{textoTempo(minutosDeResposta(a))}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="so-celular lista-cartoes">
            {visiveis.slice(0, paginas.visiveis).map((a) => {
              const s = STATUS_SOLICITACAO[a.status] || STATUS_SOLICITACAO.pendente
              return (
                <div key={a.id} className="cartao-linha">
                  <div className="cartao-linha__topo">
                    <span className="cartao-linha__titulo">{pessoas[a.perfil_id]?.nome || '—'}</span>
                    <Etiqueta tom={s.tom}>{s.rotulo}</Etiqueta>
                  </div>
                  <span>{TIPO_SOLICITACAO[a.tipo]}{descreverPedido(a) ? `: ${descreverPedido(a)}` : ''}</span>
                  <div className="cartao-linha__detalhes">
                    <span>Enviado <strong className="mono">{dataHora(a.criado_em)}</strong></span>
                    <span>Tempo <strong className="mono">{textoTempo(minutosDeResposta(a))}</strong></span>
                  </div>
                </div>
              )
            })}
          </div>
          <paginas.Mais />
        </>
      )}
    </div>
  )
}
