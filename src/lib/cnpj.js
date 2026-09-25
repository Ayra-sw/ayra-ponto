// CNPJ alfanumérico (Receita Federal, novas inscrições desde julho/2026).
// 12 caracteres de 0-9 ou A-Z + 2 dígitos verificadores numéricos.
// Valor de cada caractere = código ASCII − 48 (0-9 valem 0-9; A=17 … Z=42).
// Vale também para os CNPJs antigos, só com números.

const PESOS_1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
const PESOS_2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]

// Remove pontuação e deixa em maiúsculas: "12.abc.345/01de-35" → "12ABC34501DE35"
export function normalizarCnpj(valor) {
  return (valor || '').replace(/[^0-9a-zA-Z]/g, '').toUpperCase().slice(0, 14)
}

function digito(base, pesos) {
  const soma = base.split('').reduce((total, c, i) => total + (c.charCodeAt(0) - 48) * pesos[i], 0)
  const resto = soma % 11
  return resto < 2 ? 0 : 11 - resto
}

export function cnpjValido(valor) {
  const v = normalizarCnpj(valor)
  if (!/^[0-9A-Z]{12}[0-9]{2}$/.test(v)) return false
  if (/^(.)\1{13}$/.test(v)) return false
  const dv1 = digito(v.slice(0, 12), PESOS_1)
  const dv2 = digito(v.slice(0, 12) + dv1, PESOS_2)
  return v.slice(12) === `${dv1}${dv2}`
}

// Máscara visual 00.000.000/0000-00, aceitando letras nas 12 primeiras posições
export function formatarCnpj(valor) {
  const v = normalizarCnpj(valor)
  let r = v.slice(0, 2)
  if (v.length > 2) r += '.' + v.slice(2, 5)
  if (v.length > 5) r += '.' + v.slice(5, 8)
  if (v.length > 8) r += '/' + v.slice(8, 12)
  if (v.length > 12) r += '-' + v.slice(12, 14)
  return r
}

// Mensagem para o campo (vazio = sem erro)
export function erroCnpj(valor, { obrigatorio = false } = {}) {
  const v = normalizarCnpj(valor)
  if (!v) return obrigatorio ? 'Informe o CNPJ.' : ''
  if (v.length < 14) return 'O CNPJ tem 14 caracteres. Confira se faltou algum.'
  if (!/^[0-9A-Z]{12}[0-9]{2}$/.test(v)) return 'Os dois últimos caracteres do CNPJ são sempre números.'
  if (!cnpjValido(v)) return 'Esse CNPJ não é válido. Confira as letras e os números.'
  return ''
}
