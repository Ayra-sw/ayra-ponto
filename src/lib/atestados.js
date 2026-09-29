// Atestados e declarações anexados (Fase 3A). Ficam num armazenamento privado:
// só a própria pessoa, o RH e o administrador abrem o arquivo.
import { supabase } from './supabaseClient'

export const TAMANHO_MAXIMO = 5 * 1024 * 1024
const TIPOS = { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }
export const ACEITOS = Object.keys(TIPOS).join(',')

// Confere o arquivo antes de enviar: devolve a mensagem de erro, ou '' se estiver tudo certo
export function conferirArquivo(arquivo) {
  if (!arquivo) return ''
  if (!TIPOS[arquivo.type]) return 'Envie o atestado em PDF ou foto (JPG, PNG ou WEBP).'
  if (arquivo.size > TAMANHO_MAXIMO) return 'O arquivo passou de 5 MB. Tire uma foto com menos qualidade ou envie o PDF.'
  if (arquivo.size === 0) return 'O arquivo está vazio. Escolha outro.'
  return ''
}

function nomeAleatorio() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID().replace(/-/g, '')
  return `${Date.now()}${Math.random().toString(36).slice(2, 10)}`
}

// Envia o arquivo para a pasta da pessoa e devolve { caminho } ou { erro }
export async function enviarAtestado(arquivo, empresaId, perfilId) {
  const problema = conferirArquivo(arquivo)
  if (problema) return { erro: problema }
  const caminho = `${empresaId}/${perfilId}/${nomeAleatorio()}.${TIPOS[arquivo.type]}`
  const { error } = await supabase.storage.from('atestados').upload(caminho, arquivo, { contentType: arquivo.type, upsert: false })
  if (error) {
    const msg = String(error.message || '')
    if (/bucket not found/i.test(msg)) return { erro: 'O envio de atestados ainda não foi instalado. Rode a migração da Fase 3A no Supabase.' }
    if (/too large|maximum allowed size/i.test(msg)) return { erro: 'O arquivo passou de 5 MB. Tire uma foto com menos qualidade ou envie o PDF.' }
    if (/mime|not supported/i.test(msg)) return { erro: 'Envie o atestado em PDF ou foto (JPG, PNG ou WEBP).' }
    if (/failed to fetch|network/i.test(msg)) return { erro: 'Não conseguimos enviar o arquivo. Confira sua internet e tente de novo.' }
    console.error(error)
    return { erro: 'Não conseguimos enviar o arquivo. Tente de novo em instantes.' }
  }
  return { caminho }
}

// Abre o arquivo numa aba nova com um link que vale por 2 minutos
export async function abrirAtestado(caminho) {
  const janela = window.open('', '_blank')
  const { data, error } = await supabase.storage.from('atestados').createSignedUrl(caminho, 120)
  if (error || !data?.signedUrl) {
    janela?.close()
    return 'Não foi possível abrir o arquivo. Você pode não ter permissão para vê-lo.'
  }
  if (janela) janela.location.href = data.signedUrl
  else window.location.href = data.signedUrl
  return ''
}
