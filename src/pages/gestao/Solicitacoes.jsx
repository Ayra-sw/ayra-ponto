import { useCallback, useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { Inbox } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../contexts/AuthContext'
import { useAvisos } from '../../contexts/AvisosContext'
import { traduzirErro } from '../../lib/mensagensErro'
import { dataHora } from '../../lib/formatos'
import { TIPO_SOLICITACAO } from '../../lib/rotulos'
import Botao from '../../components/ui/Botao'
import Etiqueta from '../../components/ui/Etiqueta'
import { Confirmacao } from '../../components/ui/Dialogo'
import { Esqueleto, EstadoErro, EstadoVazio } from '../../components/ui/Estados'

// Solicitações pendentes (a central completa, com histórico e novos status,
// chega na Fase 3). Ninguém analisa a própria solicitação: o banco garante.
export default function Solicitacoes() {
  const { perfil } = useAuth()
  const { atualizarPendentes } = useOutletContext()
  const avisar = useAvisos()
  const [lista, setLista] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(false)
  const [confirmando, setConfirmando] = useState(null) // { item, status }
  const [salvando, setSalvando] = useState(false)

  const carregar = useCallback(async () => {
    setErro(false)
    // ajustes_ponto tem duas ligações com perfis: indicamos a de quem pediu
    const { data, error } = await supabase
      .from('ajustes_ponto')
      .select('*, solicitante:perfis!ajustes_ponto_perfil_id_fkey(nome_completo)')
      .eq('status', 'pendente')
      .order('criado_em', { ascending: true })
    if (error) setErro(true)
    setLista(data || [])
    setCarregando(false)
  }, [])

  useEffect(() => { carregar() }, [carregar])

  async function analisar() {
    const { item, status } = confirmando
    setSalvando(true)
    const { data, error } = await supabase.from('ajustes_ponto').update({ status }).eq('id', item.id).select('id')
    setSalvando(false)
    setConfirmando(null)
    if (error) return avisar(traduzirErro(error), 'problema')
    if (!data?.length) return avisar('Não foi possível analisar. A solicitação pode já ter sido analisada por outra pessoa.', 'problema')
    setLista((l) => l.filter((a) => a.id !== item.id))
    atualizarPendentes()
    avisar(status === 'aprovado' ? 'Solicitação aprovada.' : 'Solicitação recusada.')
  }

  function Acoes({ item }) {
    if (item.perfil_id === perfil.id) return <span className="suave pequeno">Sua solicitação: outra pessoa precisa analisar</span>
    return (
      <div className="acoes">
        <Botao tamanho="pequeno" onClick={() => setConfirmando({ item, status: 'aprovado' })}>Aprovar</Botao>
        <Botao tamanho="pequeno" variante="secundario" onClick={() => setConfirmando({ item, status: 'rejeitado' })}>Recusar</Botao>
      </div>
    )
  }

  return (
    <div className="pagina">
      <div className="pagina__cabecalho">
        <div className="pagina__titulo">
          <h1>Solicitações</h1>
          <p className="suave">Pedidos de ajuste, abono e folga esperando análise.</p>
        </div>
      </div>

      {carregando ? <Esqueleto linhas={5} /> : erro ? <EstadoErro aoTentarDeNovo={carregar} /> : lista.length === 0 ? (
        <EstadoVazio icone={Inbox} titulo="Nenhuma solicitação pendente">
          Quando alguém pedir um ajuste de ponto, abono ou folga, o pedido aparece aqui para você analisar.
        </EstadoVazio>
      ) : (
        <>
          <div className="so-computador">
            <div className="tabela-envoltorio">
              <table className="tabela">
                <thead><tr><th>Colaborador</th><th>Tipo</th><th>Horário pedido</th><th>Motivo</th><th>Enviada em</th><th></th></tr></thead>
                <tbody>
                  {lista.map((a) => (
                    <tr key={a.id}>
                      <td>{a.solicitante?.nome_completo || '—'}</td>
                      <td><Etiqueta tom="atencao">{TIPO_SOLICITACAO[a.tipo] || a.tipo}</Etiqueta></td>
                      <td className="mono">{a.marcacao_solicitada ? dataHora(a.marcacao_solicitada) : '—'}</td>
                      <td style={{ maxWidth: 320 }}>{a.motivo}</td>
                      <td className="mono">{dataHora(a.criado_em)}</td>
                      <td><Acoes item={a} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="so-celular lista-cartoes">
            {lista.map((a) => (
              <div key={a.id} className="cartao-linha">
                <div className="cartao-linha__topo">
                  <span className="cartao-linha__titulo">{a.solicitante?.nome_completo || '—'}</span>
                  <Etiqueta tom="atencao">{TIPO_SOLICITACAO[a.tipo] || a.tipo}</Etiqueta>
                </div>
                <p>{a.motivo}</p>
                <div className="cartao-linha__detalhes">
                  {a.marcacao_solicitada && <span className="mono">Pedido: {dataHora(a.marcacao_solicitada)}</span>}
                  <span className="mono">Enviada: {dataHora(a.criado_em)}</span>
                </div>
                <Acoes item={a} />
              </div>
            ))}
          </div>
        </>
      )}

      <Confirmacao
        aberta={Boolean(confirmando)}
        titulo={confirmando?.status === 'aprovado' ? 'Aprovar solicitação?' : 'Recusar solicitação?'}
        textoConfirmar={confirmando?.status === 'aprovado' ? 'Aprovar' : 'Recusar'}
        perigo={confirmando?.status === 'rejeitado'}
        carregando={salvando}
        aoConfirmar={analisar}
        aoCancelar={() => setConfirmando(null)}
      >
        A análise é definitiva e fica registrada com o seu nome e o horário.
        {confirmando?.status === 'aprovado' && ' Por enquanto a aprovação fica registrada na solicitação; o ajuste passa a entrar no cálculo da jornada na próxima etapa do sistema.'}
      </Confirmacao>
    </div>
  )
}
