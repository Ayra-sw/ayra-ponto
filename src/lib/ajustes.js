// Solicitações de ajuste de ponto: como cada tipo aparece na tela.
import { data, dataHora } from './formatos'
import { rotuloMarcacao } from './marcacoes'

export const OPCOES_SOLICITACAO = [
  { valor: 'inclusao_esquecida', titulo: 'Esqueci de bater o ponto', descricao: 'Peça para incluir uma marcação que faltou.' },
  { valor: 'correcao_marcacao', titulo: 'Bati no horário errado', descricao: 'Peça para corrigir o horário de uma marcação que você fez.' },
  { valor: 'abono', titulo: 'Abonar falta ou atraso', descricao: 'Atestado, declaração ou outro motivo justificado. Pode ser mais de um dia.' },
  { valor: 'folga', titulo: 'Pedir folga', descricao: 'Dias em que você não vai trabalhar.' },
]

export const STATUS_SOLICITACAO = {
  pendente: { rotulo: 'Aguardando análise', tom: 'atencao' },
  aprovado: { rotulo: 'Aprovada', tom: 'ok' },
  rejeitado: { rotulo: 'Recusada', tom: 'problema' },
}

// Uma frase com o que a pessoa pediu
export function descreverPedido(a) {
  if (a.tipo === 'inclusao_esquecida' && a.marcacao_solicitada) {
    return `${rotuloMarcacao(a.tipo_marcacao)} em ${dataHora(a.marcacao_solicitada)}`
  }
  if (a.tipo === 'correcao_marcacao' && a.marcacao_solicitada) {
    return `Corrigir para ${dataHora(a.marcacao_solicitada)}`
  }
  if (a.data_referencia) {
    return a.data_fim && a.data_fim !== a.data_referencia
      ? `De ${data(a.data_referencia)} a ${data(a.data_fim)}`
      : data(a.data_referencia)
  }
  return a.marcacao_solicitada ? dataHora(a.marcacao_solicitada) : ''
}

// "YYYY-MM-DD" de hoje (ou de daqui a n dias) no horário do aparelho
export function diaIso(deslocamento = 0) {
  const d = new Date()
  d.setDate(d.getDate() + deslocamento)
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mes}-${dia}`
}

// Início e fim (ISO) do dia 'YYYY-MM-DD' no horário do aparelho
export function limitesDoDia(diaIsoTexto) {
  const inicio = new Date(`${diaIsoTexto}T00:00:00`)
  const fim = new Date(inicio)
  fim.setDate(fim.getDate() + 1)
  return [inicio.toISOString(), fim.toISOString()]
}
