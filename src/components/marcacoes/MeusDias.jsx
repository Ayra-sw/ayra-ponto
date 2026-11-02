import { useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarX2, ChevronLeft, ChevronRight, Pencil } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { traduzirErro } from '../../lib/mensagensErro'
import { duracao, hora, nsr } from '../../lib/formatos'
import { rotuloMarcacao } from '../../lib/marcacoes'
import { ehMesAtualOuFuturo, lerMes, limitesDoMes, nomeDoMes, situacaoDoDia, somarMeses } from '../../lib/apuracao'
import { diaIso } from '../../lib/ajustes'
import Botao from '../ui/Botao'
import Etiqueta from '../ui/Etiqueta'
import Alerta from '../ui/Alerta'
import { PainelLateral } from '../ui/Dialogo'
import { Esqueleto, EstadoErro, EstadoVazio } from '../ui/Estados'
import BotaoComprovantePdf from '../ponto/BotaoComprovantePdf'

// "00:21" e "-00:09" (como num relógio)
export function hhmm(minutos, comSinal = false) {
  const m = Math.abs(Math.round(minutos || 0))
  const texto = `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
  return comSinal && minutos < 0 ? `-${texto}` : texto
}

const SEMANA = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado']
const dataBr = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`

// Situações especiais do dia, em texto discreto ao lado da data
const NOTA_DO_DIA = { feriado: 'Feriado', folga: 'Folga aprovada', folga_escala: 'Folga da escala', afastado: 'Afastamento', abonado: 'Abonado' }

// Selos só quando o dia pede atenção
function selosDoDia(d, temPedido) {
  const selos = []
  if (temPedido) selos.push({ texto: 'Pedido aguardando resposta', tom: 'info' })
  if (d.situacao === 'incompleto') selos.push({ texto: 'Falta uma marcação', tom: 'atencao' })
  if (d.situacao === 'falta') selos.push({ texto: 'Falta no dia', tom: 'problema' })
  if (d.situacao === 'trabalhado' && d.atraso_min > 0) selos.push({ texto: 'Horas a menos', tom: 'atencao' })
  if (d.extra_min > 0 && d.situacao !== 'em_andamento') selos.push({ texto: 'Horas extras', tom: 'info' })
  return selos
}

// Uma linha da lista de dias (Meu histórico e Espelho do mês)
export function LinhaDoDia({ d, temPedido = false, hoje = '', aoAbrir }) {
  const semana = SEMANA[d.dia_semana]
  const selos = selosDoDia(d, temPedido)
  const nota = d.data === hoje ? 'hoje' : NOTA_DO_DIA[d.situacao]
  return (
    <li>
      <button type="button" className="dia-linha" onClick={aoAbrir}
        aria-label={`${dataBr(d.data)}, ${semana}. Horas extras ${hhmm(d.extra_min)}, horas faltantes ${hhmm(d.atraso_min + d.falta_min)}, saldo ${hhmm(d.saldo_min, true)}. Ver detalhes do dia`}>
        {selos.length > 0 && (
          <span className="dia-linha__selos">
            {selos.map((s) => <Etiqueta key={s.texto} tom={s.tom} icone={false}>{s.texto}</Etiqueta>)}
          </span>
        )}
        <span className="dia-linha__topo">
          <span className="dia-linha__data">{dataBr(d.data)} <span className="dia-linha__sep">|</span> {semana}{nota && <span className="dia-linha__nota"> · {nota}</span>}</span>
          <ChevronRight className="dia-linha__seta" aria-hidden="true" />
        </span>
        <span className="dia-linha__numeros">
          <span><span className="dia-linha__rotulo">H. extra</span><span className="dia-linha__valor">{hhmm(d.extra_min)}</span></span>
          <span><span className="dia-linha__rotulo">H. faltantes</span><span className="dia-linha__valor">{hhmm(d.atraso_min + d.falta_min)}</span></span>
          <span><span className="dia-linha__rotulo">Saldo</span><span className={`dia-linha__valor${d.saldo_min < 0 ? ' dia-linha__valor--negativo' : ''}`}>{hhmm(d.saldo_min, true)}</span></span>
        </span>
      </button>
    </li>
  )
}

// "Meu histórico" do colaborador: um dia por linha, com horas extras, horas que
// faltaram e saldo. A seta (ou a linha toda) abre os detalhes do dia.
export default function MeusDias({ perfilId, aoPedirAjuste, atualizarEm }) {
  const [mes, setMes] = useState(() => lerMes(null))
  const [dias, setDias] = useState([])
  const [pedidos, setPedidos] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [aberto, setAberto] = useState(null)

  const carregar = useCallback(async () => {
    setErro('')
    setCarregando(true)
    const hoje = diaIso()
    const { inicio, fim } = limitesDoMes(mes.ano, mes.mes)
    const ate = fim < hoje ? fim : hoje
    if (inicio > ate) { setDias([]); setCarregando(false); return }
    const [ap, pd] = await Promise.all([
      supabase.rpc('apurar_periodo', { p_perfil_id: perfilId, p_inicio: inicio, p_fim: ate }),
      supabase.from('ajustes_ponto').select('data_referencia, data_fim, marcacao_solicitada')
        .eq('perfil_id', perfilId).eq('status', 'pendente'),
    ])
    if (ap.error) setErro(traduzirErro(ap.error))
    setDias((ap.data || []).filter((d) => !['futuro', 'antes_admissao'].includes(d.situacao)).reverse())
    setPedidos(pd.data || [])
    setCarregando(false)
  }, [perfilId, mes])

  useEffect(() => { carregar() }, [carregar, atualizarEm])

  // dias com pedido esperando resposta
  const comPedido = useMemo(() => {
    const s = new Set()
    for (const p of pedidos) {
      if (p.marcacao_solicitada) s.add(new Date(p.marcacao_solicitada).toLocaleDateString('sv-SE'))
      if (p.data_referencia) {
        const fim = p.data_fim || p.data_referencia
        for (let d = new Date(`${p.data_referencia}T12:00:00`); d.toLocaleDateString('sv-SE') <= fim; d.setDate(d.getDate() + 1)) s.add(d.toLocaleDateString('sv-SE'))
      }
    }
    return s
  }, [pedidos])

  const noMesAtual = ehMesAtualOuFuturo(mes)
  const hoje = diaIso()

  return (
    <div className="pilha">
      <div className="linha linha--espacada">
        <div className="linha">
          <Botao variante="secundario" tamanho="pequeno" className="btn--icone" aria-label="Mês anterior" icone={ChevronLeft} onClick={() => setMes((m) => somarMeses(m, -1))} />
          <strong style={{ minWidth: 150, textAlign: 'center' }} aria-live="polite">{nomeDoMes(mes)}</strong>
          <Botao variante="secundario" tamanho="pequeno" className="btn--icone" aria-label="Próximo mês" icone={ChevronRight} onClick={() => setMes((m) => somarMeses(m, 1))} disabled={noMesAtual} />
        </div>
        {!noMesAtual && <Botao variante="discreto" tamanho="pequeno" onClick={() => setMes(lerMes(null))}>Voltar para este mês</Botao>}
      </div>

      {carregando ? <Esqueleto linhas={6} /> : erro ? <EstadoErro aoTentarDeNovo={carregar}>{erro}</EstadoErro> : dias.length === 0 ? (
        <EstadoVazio icone={CalendarX2} titulo={`Nada para mostrar em ${nomeDoMes(mes).toLowerCase()}`}>
          Os seus dias aparecem aqui, com as horas extras, as horas que faltaram e o saldo.
        </EstadoVazio>
      ) : (
        <ul className="dias-lista" aria-label={`Seus dias em ${nomeDoMes(mes).toLowerCase()}`}>
          {dias.map((d) => (
            <LinhaDoDia key={d.data} d={d} temPedido={comPedido.has(d.data)} hoje={hoje} aoAbrir={() => setAberto(d)} />
          ))}
        </ul>
      )}

      {aberto && (
        <DetalhesDoDia dia={aberto} temPedido={comPedido.has(aberto.data)} aoFechar={() => setAberto(null)}
          aoPedirAjuste={aoPedirAjuste ? (inicial) => { setAberto(null); aoPedirAjuste(inicial) } : null} />
      )}
    </div>
  )
}

export function DetalhesDoDia({ dia, temPedido, aoFechar, aoPedirAjuste }) {
  const sit = situacaoDoDia(dia)
  const marcacoes = Array.isArray(dia.marcacoes) ? dia.marcacoes : []
  const registros = marcacoes.filter((m) => m.nsr != null)
    .map((m) => ({ id: m.id, nsr: m.nsr, tipo: m.tipo, marcado_em: m.em_original || m.em }))
  return (
    <PainelLateral aberto aoFechar={aoFechar} titulo={`${dataBr(dia.data)} | ${SEMANA[dia.dia_semana]}`}
      subtitulo={`Trabalhado: ${duracao(dia.trabalhado_min)} · Previsto: ${duracao(dia.previsto_min)}`}
      rodape={aoPedirAjuste ? (
        <Botao icone={Pencil} onClick={() => aoPedirAjuste({ data: dia.data, registros })}>Pedir ajuste deste dia</Botao>
      ) : null}>
      <div className="pilha">
        <div className="linha" style={{ flexWrap: 'wrap', gap: 6 }}>
          <Etiqueta tom={sit.tom} icone={sit.icone}>{sit.rotulo}</Etiqueta>
          {temPedido && <Etiqueta tom="info" icone={false}>Pedido aguardando resposta</Etiqueta>}
        </div>
        <div className="dia-linha__numeros dia-linha__numeros--painel">
          <span><span className="dia-linha__rotulo">H. extra</span><span className="dia-linha__valor">{hhmm(dia.extra_min)}</span></span>
          <span><span className="dia-linha__rotulo">H. faltantes</span><span className="dia-linha__valor">{hhmm(dia.atraso_min + dia.falta_min)}</span></span>
          <span><span className="dia-linha__rotulo">Saldo</span><span className={`dia-linha__valor${dia.saldo_min < 0 ? ' dia-linha__valor--negativo' : ''}`}>{hhmm(dia.saldo_min, true)}</span></span>
        </div>
        <h3 className="pequeno" style={{ margin: 0 }}>Marcações</h3>
        {marcacoes.length === 0 ? (
          <p className="suave pequeno" style={{ margin: 0 }}>Nenhuma marcação neste dia.</p>
        ) : (
          <ul className="linha-tempo">
            {marcacoes.map((m) => (
              <li key={`${m.id}-${m.em}`}>
                <span className="linha-tempo__hora">{hora(m.em)}</span>
                <span className="linha-tempo__tipo">
                  {rotuloMarcacao(m.tipo)}
                  {m.origem === 'corrigida' && <Etiqueta tom="info" icone={false}>Corrigida (era {hora(m.em_original)})</Etiqueta>}
                  {m.origem === 'incluida' && <Etiqueta tom="info" icone={false}>Incluída por pedido</Etiqueta>}
                </span>
                <span className="linha-tempo__fim">
                  {m.nsr != null && <span className="linha-tempo__nsr" title="Número de registro">NSR {nsr(m.nsr)}</span>}
                  {m.nsr != null && <BotaoComprovantePdf registroId={m.id} nsr={m.nsr} compacto />}
                </span>
              </li>
            ))}
          </ul>
        )}
        {dia.alertas?.length > 0 && (
          <Alerta tom="atencao">
            {dia.alertas.length === 1 ? dia.alertas[0] : <ul className="lista-simples" style={{ margin: 0 }}>{dia.alertas.map((a) => <li key={a}>{a}</li>)}</ul>}
          </Alerta>
        )}
      </div>
    </PainelLateral>
  )
}
