// Contato do suporte do Ayra Ponto.
// Desde a Fase 8A, o contato é preenchido na Central Ayra (Contato do suporte) e
// vale para todos os clientes. Os valores abaixo só são usados se a Central
// ainda não tiver contato. Vazio = o botão não aparece.
//   whatsapp: só números, com DDD (ex.: '41999998888'). O 55 do Brasil entra sozinho.
//   email: endereço completo (ex.: 'suporte@ayra.com.br').
export const SUPORTE = {
  whatsapp: '',
  email: '',
}

// Busca o contato salvo na Central Ayra (uma vez, quando o app abre)
let carregado = null
export function carregarSuporte(supabase) {
  if (!carregado) {
    carregado = supabase.from('plataforma_config').select('whatsapp, email').eq('id', 1).maybeSingle()
      .then(({ data, error }) => {
        if (error || !data) return
        if (data.whatsapp) SUPORTE.whatsapp = data.whatsapp
        if (data.email) SUPORTE.email = data.email
      })
      .catch(() => {})
  }
  return carregado
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
