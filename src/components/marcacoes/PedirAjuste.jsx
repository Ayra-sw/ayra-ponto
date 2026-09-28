import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useAvisos } from '../../contexts/AvisosContext'
import { traduzirErro } from '../../lib/mensagensErro'
import { hora, nsr } from '../../lib/formatos'
import { TIPOS_MARCACAO, rotuloMarcacao } from '../../lib/marcacoes'
import { OPCOES_SOLICITACAO, diaIso, limitesDoDia } from '../../lib/ajustes'
import Botao from '../ui/Botao'
import Alerta from '../ui/Alerta'
import { AreaTexto, Campo, Selecao } from '../ui/Campo'
import { PainelLateral } from '../ui/Dialogo'

const MAX_MOTIVO = 500

// Formulário para o colaborador pedir ajuste, abono ou folga.
// "inicial": { data: 'AAAA-MM-DD', registros: [...] } quando vem de um dia do histórico.
export default function PedirAjuste({ aberto, aoFechar, aoEnviado, perfilId, inicial }) {
  const avisar = useAvisos()
  const [tipo, setTipo] = useState('')
  const [dia, setDia] = useState(diaIso())
  const [diaFim, setDiaFim] = useState('')
  const [horario, setHorario] = useState('')
  const [tipoMarcacao, setTipoMarcacao] = useState('saida')
  const [registroId, setRegistroId] = useState('')
  const [registrosDoDia, setRegistrosDoDia] = useState([])
  const [motivo, setMotivo] = useState('')
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    if (!aberto) return
    setTipo('')
    setDia(inicial?.data || diaIso())
    setDiaFim('')
    setHorario('')
    setTipoMarcacao('saida')
    setRegistroId('')
    setMotivo('')
    setErro('')
    setRegistrosDoDia(inicial?.registros || [])
  }, [aberto, inicial])

  // Para corrigir uma marcação, lista as do dia escolhido
  useEffect(() => {
    if (!aberto || tipo !== 'correcao_marcacao' || !dia) return
    let cancelado = false
    const [inicio, fim] = limitesDoDia(dia)
    supabase.from('registros_ponto').select('id, nsr, tipo, marcado_em')
      .eq('perfil_id', perfilId).gte('marcado_em', inicio).lt('marcado_em', fim).order('marcado_em')
      .then(({ data }) => {
        if (cancelado) return
        setRegistrosDoDia(data || [])
        setRegistroId((atual) => ((data || []).some((r) => r.id === atual) ? atual : ''))
      })
    return () => { cancelado = true }
  }, [aberto, tipo, dia, perfilId])

  if (!aberto) return null

  const passado = tipo === 'inclusao_esquecida' || tipo === 'correcao_marcacao'
  const hoje = diaIso()

  async function enviar(e) {
    e.preventDefault()
    setErro('')
    if (!tipo) return setErro('Escolha o que você quer pedir.')
    if (!dia) return setErro('Informe o dia.')
    if (motivo.trim().length < 5) return setErro('Conte o motivo com um pouco mais de detalhe.')

    const pedido = { perfil_id: perfilId, tipo, motivo: motivo.trim() }
    if (passado) {
      if (!horario) return setErro('Informe o horário.')
      const quando = new Date(`${dia}T${horario}:00`)
      if (quando > new Date()) return setErro('Esse horário ainda não aconteceu.')
      pedido.marcacao_solicitada = quando.toISOString()
      if (tipo === 'inclusao_esquecida') pedido.tipo_marcacao = tipoMarcacao
      if (tipo === 'correcao_marcacao') {
        if (!registroId) return setErro('Escolha qual marcação você quer corrigir.')
        pedido.registro_original_id = registroId
      }
    } else {
      pedido.data_referencia = dia
      if (diaFim && diaFim !== dia) {
        if (diaFim < dia) return setErro('O último dia não pode ser antes do primeiro.')
        pedido.data_fim = diaFim
      }
    }

    setEnviando(true)
    const { error } = await supabase.from('ajustes_ponto').insert(pedido)
    setEnviando(false)
    if (error) return setErro(traduzirErro(error))
    avisar('Pedido enviado. O RH vai analisar e você vê a resposta em "Meus pedidos".')
    aoEnviado?.()
    aoFechar()
  }

  return (
    <PainelLateral
      aberto
      aoFechar={aoFechar}
      titulo="Pedir ajuste ao RH"
      subtitulo="Sua marcação original nunca é apagada. O RH analisa e responde."
      rodape={
        <>
          <Botao variante="secundario" onClick={aoFechar}>Cancelar</Botao>
          <Botao type="submit" form="form-ajuste" carregando={enviando}>Enviar pedido</Botao>
        </>
      }
    >
      <form id="form-ajuste" className="formulario" onSubmit={enviar}>
        <fieldset className="opcoes">
          <legend className="campo__rotulo" style={{ marginBottom: 8 }}>O que você precisa?</legend>
          {OPCOES_SOLICITACAO.map((o) => (
            <label key={o.valor} className="opcao">
              <input type="radio" name="tipo-ajuste" value={o.valor} checked={tipo === o.valor} onChange={() => setTipo(o.valor)} />
              <span><span className="opcao__titulo">{o.titulo}</span><br /><span className="opcao__desc">{o.descricao}</span></span>
            </label>
          ))}
        </fieldset>

        {tipo && (
          <div className="secao-formulario">
            <div className="grade-campos">
              <Campo
                rotulo={passado ? 'Dia' : 'Primeiro dia'}
                type="date" value={dia} onChange={(e) => setDia(e.target.value)} required
                min={diaIso(-90)} max={passado ? hoje : diaIso(365)}
              />
              {!passado && (
                <Campo rotulo="Último dia" opcional type="date" value={diaFim} onChange={(e) => setDiaFim(e.target.value)}
                  min={dia} max={diaIso(365)} ajuda="Deixe em branco se for só um dia." />
              )}
              {passado && (
                <Campo
                  rotulo={tipo === 'correcao_marcacao' ? 'Horário correto' : 'Horário'}
                  type="time" value={horario} onChange={(e) => setHorario(e.target.value)} required
                />
              )}
            </div>

            {tipo === 'inclusao_esquecida' && (
              <Selecao rotulo="Qual marcação faltou?" value={tipoMarcacao} onChange={(e) => setTipoMarcacao(e.target.value)}
                opcoes={TIPOS_MARCACAO.map((t) => ({ valor: t.valor, rotulo: t.rotulo }))} />
            )}

            {tipo === 'correcao_marcacao' && (
              registrosDoDia.length === 0 ? (
                <Alerta tom="info">Você não tem marcações neste dia. Se você esqueceu de bater o ponto, escolha "Esqueci de bater o ponto".</Alerta>
              ) : (
                <Selecao rotulo="Qual marcação corrigir?" value={registroId} onChange={(e) => setRegistroId(e.target.value)} required>
                  <option value="">Escolha uma marcação</option>
                  {registrosDoDia.map((r) => (
                    <option key={r.id} value={r.id}>{hora(r.marcado_em)} · {rotuloMarcacao(r.tipo)} · NSR {nsr(r.nsr)}</option>
                  ))}
                </Selecao>
              )
            )}

            <AreaTexto
              rotulo="Motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={MAX_MOTIVO} rows={4} required
              placeholder={tipo === 'abono' ? 'Ex.: consulta médica, atestado entregue ao RH' : 'Conte o que aconteceu'}
              ajuda={`${motivo.length}/${MAX_MOTIVO} caracteres`}
            />
          </div>
        )}

        {erro && <Alerta tom="problema">{erro}</Alerta>}
      </form>
    </PainelLateral>
  )
}
