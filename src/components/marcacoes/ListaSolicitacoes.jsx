import { useCallback, useEffect, useState } from 'react'
import { Inbox, MessageSquareText, Paperclip } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { useAvisos } from '../../contexts/AvisosContext'
import { traduzirErro } from '../../lib/mensagensErro'
import { dataHora } from '../../lib/formatos'
import { TIPO_SOLICITACAO } from '../../lib/rotulos'
import { STATUS_SOLICITACAO, descreverPedido } from '../../lib/ajustes'
import { abrirAtestado } from '../../lib/atestados'
import Botao from '../ui/Botao'
import Etiqueta from '../ui/Etiqueta'
import { Confirmacao } from '../ui/Dialogo'
import { Esqueleto, EstadoErro, EstadoVazio } from '../ui/Estados'

// Busca os nomes que o banco deixa ver (quem analisou pode ser de outro setor)
export async function nomesDe(ids, conhecidos = {}) {
  const faltam = [...new Set(ids.filter((id) => id && !conhecidos[id]))]
  const pares = await Promise.all(faltam.map(async (id) => {
    const { data } = await supabase.rpc('nome_da_pessoa', { p_perfil_id: id })
    return [id, data || null]
  }))
  return { ...conhecidos, ...Object.fromEntries(pares.filter(([, n]) => n)) }
}

// Pedidos de ajuste de uma pessoa, do mais novo para o mais antigo.
//   podeCancelar: a própria pessoa (cancela os que ainda esperam análise)
//   podeAbrirAnexo: a própria pessoa, o RH e o administrador
export default function ListaSolicitacoes({ perfilId, atualizarEm, aoCarregar, textoVazio, podeCancelar = false, podeAbrirAnexo = false, ocultarAbono = false }) {
  const avisar = useAvisos()
  const [lista, setLista] = useState([])
  const [nomes, setNomes] = useState({})
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(false)
  const [cancelando, setCancelando] = useState(null)
  const [salvando, setSalvando] = useState(false)

  const carregar = useCallback(async () => {
    setErro(false)
    let consulta = supabase.from('ajustes_ponto').select('*').eq('perfil_id', perfilId)
    if (ocultarAbono) consulta = consulta.neq('tipo', 'abono')
    const { data, error } = await consulta.order('criado_em', { ascending: false }).limit(100)
    if (error) setErro(true)
    setLista(data || [])
    setCarregando(false)
    aoCarregar?.(data || [])
    const analistas = (data || []).map((a) => a.analisado_por).filter(Boolean)
    if (analistas.length) setNomes(await nomesDe(analistas))
  }, [perfilId, ocultarAbono]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { carregar() }, [carregar, atualizarEm])

  async function cancelar() {
    setSalvando(true)
    const { data, error } = await supabase.from('ajustes_ponto').update({ status: 'cancelado' }).eq('id', cancelando.id).select('id')
    setSalvando(false)
    setCancelando(null)
    if (error) return avisar(traduzirErro(error), 'problema')
    if (!data?.length) return avisar('Este pedido já foi analisado e não pode mais ser cancelado.', 'problema')
    avisar('Pedido cancelado.')
    carregar()
  }

  async function abrir(caminho) {
    const problema = await abrirAtestado(caminho)
    if (problema) avisar(problema, 'problema')
  }

  if (carregando) return <Esqueleto linhas={4} />
  if (erro) return <EstadoErro aoTentarDeNovo={carregar} />
  if (lista.length === 0) {
    return (
      <EstadoVazio icone={Inbox} titulo="Nenhuma solicitação por aqui">
        {textoVazio || 'Quando houver um pedido de ajuste, abono ou folga, ele aparece aqui com a resposta.'}
      </EstadoVazio>
    )
  }

  return (
    <div className="lista-cartoes" style={{ display: 'grid', gap: 10 }}>
      {lista.map((a) => {
        const s = STATUS_SOLICITACAO[a.status] || STATUS_SOLICITACAO.pendente
        const quem = a.status === 'cancelado' ? '' : (nomes[a.analisado_por] ? ` por ${nomes[a.analisado_por]}` : '')
        return (
          <div key={a.id} className="cartao-linha" style={{ cursor: 'default' }}>
            <div className="cartao-linha__topo">
              <span className="cartao-linha__titulo">{TIPO_SOLICITACAO[a.tipo] || a.tipo}</span>
              <Etiqueta tom={s.tom}>{s.rotulo}</Etiqueta>
            </div>
            {descreverPedido(a) && <p><strong>{descreverPedido(a)}</strong></p>}
            <p className="suave">{a.motivo}</p>
            {a.comentario_analise && (
              <p className="resposta-analise"><MessageSquareText aria-hidden="true" /><span><strong>Resposta:</strong> {a.comentario_analise}</span></p>
            )}
            <div className="cartao-linha__detalhes">
              <span>Enviada em {dataHora(a.criado_em)}</span>
              {a.analisado_em && <span>{a.status === 'cancelado' ? 'Cancelada' : 'Analisada'} em {dataHora(a.analisado_em)}{quem}</span>}
            </div>
            {(a.anexo_path || (podeCancelar && a.status === 'pendente')) && (
              <div className="acoes">
                {a.anexo_path && (podeAbrirAnexo
                  ? <Botao variante="secundario" tamanho="pequeno" icone={Paperclip} onClick={() => abrir(a.anexo_path)}>Ver atestado</Botao>
                  : <Etiqueta tom="neutra" icone={Paperclip}>Atestado anexado</Etiqueta>)}
                {podeCancelar && a.status === 'pendente' && (
                  <Botao variante="discreto" tamanho="pequeno" onClick={() => setCancelando(a)}>Cancelar pedido</Botao>
                )}
              </div>
            )}
          </div>
        )
      })}
      <Confirmacao
        aberta={Boolean(cancelando)} titulo="Cancelar este pedido?" textoConfirmar="Cancelar pedido" textoCancelar="Voltar"
        perigo carregando={salvando} aoConfirmar={cancelar} aoCancelar={() => setCancelando(null)}
      >
        O pedido deixa de esperar análise e fica no seu histórico como “Cancelada”. Se precisar, é só fazer outro pedido.
      </Confirmacao>
    </div>
  )
}
