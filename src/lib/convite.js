// Link e código de convite da empresa.

export function linkConvite(codigo) {
  return `${window.location.origin}/convite/${codigo}`
}

// 8 caracteres hexadecimais, no mesmo formato gerado pelo banco
export function novoCodigoConvite() {
  const bytes = new Uint8Array(4)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

const CHAVE = 'ayra-convite'

export function guardarConvitePendente(codigo) {
  try { localStorage.setItem(CHAVE, codigo) } catch { /* sem armazenamento: segue */ }
}

export function lerConvitePendente() {
  try { return localStorage.getItem(CHAVE) || '' } catch { return '' }
}

export function limparConvitePendente() {
  try { localStorage.removeItem(CHAVE) } catch { /* nada a fazer */ }
}
