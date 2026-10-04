import { supabase } from './supabaseClient'

// Fala com a Edge Function "assinar" (Fase 5B): AFD e AEJ com .p7s e o
// comprovante em PDF assinado. Se a função ainda não estiver instalada no
// Supabase, devolve { indisponivel: true } e quem chamou segue sem assinatura.
export async function chamarAssinatura(corpo) {
  try {
    const { data, error } = await supabase.functions.invoke('assinar', { body: corpo })
    if (!error) return { dados: data }
    const status = error.context?.status
    if (error.name === 'FunctionsFetchError' || error.name === 'FunctionsRelayError' || status === 404) {
      return { indisponivel: true }
    }
    if (status === 401) return { erro: 'A função de assinatura recusou o login (verificação de JWT). Veja o item "Se algo der errado" do guia da Fase 5B.' }
    let mensagem = 'Não foi possível assinar agora. Tente de novo em instantes.'
    try { const j = await error.context.json(); if (j?.erro) mensagem = j.erro } catch { /* sem corpo */ }
    return { erro: mensagem }
  } catch {
    return { indisponivel: true }
  }
}

// Fase 5C: pede ao servidor para mandar já o comprovante por e-mail.
// Não espera nem mostra erro: se falhar, o agendamento do banco envia em até 5 minutos.
export function enviarComprovantePorEmail() {
  try {
    supabase.functions.invoke('assinar', { body: { acao: 'processar_fila' } }).catch(() => {})
  } catch { /* o agendamento cuida */ }
}

export function base64ParaBytes(b64) {
  const s = atob(b64)
  const b = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i)
  return b
}

export function baixarBytes(bytes, nome, tipo) {
  const url = URL.createObjectURL(new Blob([bytes], { type: tipo }))
  const a = document.createElement('a')
  a.href = url
  a.download = nome
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1500)
}

// ---- ZIP simples (sem compressão) para entregar o arquivo junto com o .p7s
const TABELA_CRC = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()
export function crc32(b) {
  let c = 0xffffffff
  for (let i = 0; i < b.length; i++) c = TABELA_CRC[(c ^ b[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

export function montarZip(arquivos, quando = new Date()) {
  const enc = new TextEncoder()
  const hora = ((quando.getHours() << 11) | (quando.getMinutes() << 5) | Math.floor(quando.getSeconds() / 2)) & 0xffff
  const data = (((quando.getFullYear() - 1980) << 9) | ((quando.getMonth() + 1) << 5) | quando.getDate()) & 0xffff
  const partes = []
  const central = []
  let deslocamento = 0
  for (const { nome, bytes } of arquivos) {
    const n = enc.encode(nome)
    const crc = crc32(bytes)
    const local = new DataView(new ArrayBuffer(30))
    local.setUint32(0, 0x04034b50, true); local.setUint16(4, 20, true); local.setUint16(6, 0x0800, true)
    local.setUint16(8, 0, true); local.setUint16(10, hora, true); local.setUint16(12, data, true)
    local.setUint32(14, crc, true); local.setUint32(18, bytes.length, true); local.setUint32(22, bytes.length, true)
    local.setUint16(26, n.length, true); local.setUint16(28, 0, true)
    partes.push(new Uint8Array(local.buffer), n, bytes)
    const c = new DataView(new ArrayBuffer(46))
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true)
    c.setUint16(10, 0, true); c.setUint16(12, hora, true); c.setUint16(14, data, true); c.setUint32(16, crc, true)
    c.setUint32(20, bytes.length, true); c.setUint32(24, bytes.length, true); c.setUint16(28, n.length, true)
    c.setUint32(42, deslocamento, true)
    central.push(new Uint8Array(c.buffer), n)
    deslocamento += 30 + n.length + bytes.length
  }
  const tamCentral = central.reduce((s, x) => s + x.length, 0)
  const fim = new DataView(new ArrayBuffer(22))
  fim.setUint32(0, 0x06054b50, true); fim.setUint16(8, arquivos.length, true); fim.setUint16(10, arquivos.length, true)
  fim.setUint32(12, tamCentral, true); fim.setUint32(16, deslocamento, true)
  const tudo = [...partes, ...central, new Uint8Array(fim.buffer)]
  const saida = new Uint8Array(tudo.reduce((s, x) => s + x.length, 0))
  let p = 0
  for (const x of tudo) { saida.set(x, p); p += x.length }
  return saida
}

export function textoCertificado(c) {
  if (!c) return ''
  const validade = c.valido_ate ? new Date(c.valido_ate).toLocaleDateString('pt-BR') : ''
  return `${c.titular}${validade ? `, válido até ${validade}` : ''}`
}
