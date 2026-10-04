// Contato do suporte do Ayra Ponto.
// Para mudar, troque os valores abaixo. Vazio = o botão não aparece.
//   whatsapp: só números, com DDD (ex.: '41999998888'). O 55 do Brasil entra sozinho.
//   email: endereço completo (ex.: 'suporte@ayra.com.br').
export const SUPORTE = {
  whatsapp: '',
  email: '',
}

export function numeroWhatsApp(n = SUPORTE.whatsapp) {
  const d = String(n || '').replace(/\D/g, '')
  if (d.length === 10 || d.length === 11) return '55' + d
  if ((d.length === 12 || d.length === 13) && d.startsWith('55')) return d
  return ''
}

export const temSuporte = () => Boolean(numeroWhatsApp() || /.+@.+\..+/.test(SUPORTE.email))

function mensagem({ empresa, tela }) {
  return [
    'Olá! Preciso de ajuda com o Ayra Ponto.',
    empresa ? `Empresa: ${empresa}` : null,
    tela ? `Tela: ${tela}` : null,
    '',
    'Minha dúvida: ',
  ].filter((l) => l !== null).join('\n')
}

export function linkWhatsApp(dados = {}) {
  const n = numeroWhatsApp()
  return n ? `https://wa.me/${n}?text=${encodeURIComponent(mensagem(dados))}` : null
}

export function linkEmail(dados = {}) {
  if (!/.+@.+\..+/.test(SUPORTE.email)) return null
  return `mailto:${SUPORTE.email}?subject=${encodeURIComponent('Ajuda com o Ayra Ponto')}&body=${encodeURIComponent(mensagem(dados))}`
}
