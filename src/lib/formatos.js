// Formatos brasileiros usados em todo o Ayra Ponto.

export const FUSO_PADRAO = 'America/Sao_Paulo'

export function hora(valor, { segundos = false } = {}) {
  if (!valor) return '—'
  return new Date(valor).toLocaleTimeString('pt-BR', {
    hour: '2-digit', minute: '2-digit', ...(segundos ? { second: '2-digit' } : {}),
  })
}

export function data(valor) {
  if (!valor) return '—'
  const d = typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(valor) ? new Date(valor + 'T12:00:00') : new Date(valor)
  return d.toLocaleDateString('pt-BR')
}

export function dataHora(valor) {
  if (!valor) return '—'
  return new Date(valor).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

// "quinta-feira, 25 de setembro"
export function dataPorExtenso(valor = new Date()) {
  const t = new Date(valor).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
  return t.charAt(0).toUpperCase() + t.slice(1)
}

// minutos → "7h48" / "0h05"
export function duracao(minutos) {
  const m = Math.max(0, Math.round(minutos || 0))
  return `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}`
}

export function nsr(valor) {
  return valor == null ? '—' : String(valor).padStart(9, '0')
}

export function apenasDigitos(valor) {
  return (valor || '').replace(/\D/g, '')
}

export function formatarCpf(valor) {
  const v = apenasDigitos(valor).slice(0, 11)
  return v
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d{1,2})$/, '.$1-$2')
}

// "***.456.789-**" — mostra só o miolo, como nos comprovantes
export function mascararCpf(valor) {
  const v = apenasDigitos(valor)
  if (v.length !== 11) return null
  return `***.${v.slice(3, 6)}.${v.slice(6, 9)}-**`
}

export function formatarTelefone(valor) {
  const v = apenasDigitos(valor).slice(0, 11)
  if (v.length <= 2) return v ? `(${v}` : ''
  if (v.length <= 6) return `(${v.slice(0, 2)}) ${v.slice(2)}`
  if (v.length <= 10) return `(${v.slice(0, 2)}) ${v.slice(2, 6)}-${v.slice(6)}`
  return `(${v.slice(0, 2)}) ${v.slice(2, 7)}-${v.slice(7)}`
}

export function formatarCep(valor) {
  const v = apenasDigitos(valor).slice(0, 8)
  return v.length > 5 ? `${v.slice(0, 5)}-${v.slice(5)}` : v
}

// Início do dia de hoje no horário do aparelho, em ISO (para consultas)
export function inicioDeHoje() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

export function primeiroNome(nome) {
  return (nome || '').trim().split(/\s+/)[0] || ''
}

export function iniciais(nome) {
  const partes = (nome || '').trim().split(/\s+/).filter(Boolean)
  if (!partes.length) return '?'
  return ((partes[0][0] || '') + (partes.length > 1 ? partes[partes.length - 1][0] : '')).toUpperCase()
}

export const UFS = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO']

export const FUSOS = [
  { valor: 'America/Sao_Paulo', rotulo: 'Horário de Brasília (UTC−3)' },
  { valor: 'America/Manaus', rotulo: 'Amazonas, Mato Grosso, Rondônia e Roraima (UTC−4)' },
  { valor: 'America/Rio_Branco', rotulo: 'Acre e sudoeste do Amazonas (UTC−5)' },
  { valor: 'America/Noronha', rotulo: 'Fernando de Noronha (UTC−2)' },
]
