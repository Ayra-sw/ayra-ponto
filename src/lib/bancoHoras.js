// Banco de horas e afastamentos (Fase 2C): rótulos e pequenos cálculos.
// A conta do saldo é feita no banco (função banco_horas).
import { CalendarClock, Clock, HandCoins, Scale, Sparkles, TimerOff } from 'lucide-react'
import { duracao } from './formatos'

export const TIPOS_LANCAMENTO = [
  { valor: 'saldo_inicial', rotulo: 'Saldo inicial', descricao: 'Horas que a pessoa já tinha antes de usar o Ayra Ponto (pode ser positivo ou negativo).', sinal: 'livre' },
  { valor: 'compensacao', rotulo: 'Compensação', descricao: 'Folga ou horas compensadas: tira horas do saldo.', sinal: 'sai' },
  { valor: 'pagamento', rotulo: 'Pagamento em folha', descricao: 'Horas pagas em dinheiro. Quita primeiro as horas vencidas.', sinal: 'sai' },
  { valor: 'ajuste', rotulo: 'Ajuste', descricao: 'Corrige um erro: entra ou sai do saldo. Lançamentos não são apagados; para corrigir, faça outro ajuste.', sinal: 'livre' },
]

export const ROTULO_LANCAMENTO = Object.fromEntries(TIPOS_LANCAMENTO.map((t) => [t.valor, t.rotulo]))

// O que aparece em cada linha do extrato
export const MOVIMENTO = {
  dia: { rotulo: 'Saldo do dia', icone: Clock },
  vencimento: { rotulo: 'Vencimento', icone: TimerOff },
  saldo_inicial: { rotulo: 'Saldo inicial', icone: Sparkles },
  compensacao: { rotulo: 'Compensação', icone: CalendarClock },
  pagamento: { rotulo: 'Pagamento', icone: HandCoins },
  ajuste: { rotulo: 'Ajuste', icone: Scale },
}

export const TIPO_AFASTAMENTO = {
  ferias: 'Férias',
  atestado: 'Atestado médico',
  licenca: 'Licença',
  inss: 'Afastamento pelo INSS',
  outro: 'Outro afastamento',
}

// Nome curto usado na etiqueta do espelho
export const TIPO_AFASTAMENTO_CURTO = {
  ferias: 'Férias', atestado: 'Atestado', licenca: 'Licença', inss: 'Afastado (INSS)', outro: 'Afastado',
}

// horas e minutos digitados → total de minutos (ou null se não servir)
export function minutosDeCampos(horas, minutos) {
  const h = horas === '' ? 0 : Number(horas)
  const m = minutos === '' ? 0 : Number(minutos)
  if (!Number.isInteger(h) || !Number.isInteger(m) || h < 0 || m < 0 || m > 59) return null
  const total = h * 60 + m
  return total > 0 && total <= 14400 ? total : null
}

// "+2h30" / "−0h45" (com sinal); para vencido e compensação usa o mesmo formato
export function minutosComSinal(minutos) {
  const m = Math.round(minutos || 0)
  if (m === 0) return '0h00'
  return `${m > 0 ? '+' : '−'}${duracao(Math.abs(m))}`
}

export const tomDoSaldoBanco = (m) => (m > 0 ? 'ok' : m < 0 ? 'atencao' : 'neutra')

export function situacaoDoAfastamento(a, hoje) {
  if (a.cancelado_em) return { rotulo: 'Cancelado', tom: 'neutra' }
  if (a.data_fim < hoje) return { rotulo: 'Encerrado', tom: 'neutra' }
  if (a.data_inicio > hoje) return { rotulo: 'Programado', tom: 'info' }
  return { rotulo: 'Em andamento', tom: 'ok' }
}
