// Entrar com a digital (Fase 6B), usando "passkeys" (chaves de acesso).
//
// Como funciona: quem lê a digital (ou o rosto) é o próprio celular. O Ayra
// Ponto NUNCA recebe nem guarda a digital: o aparelho cria uma chave secreta
// que não sai dele, e o Supabase guarda só a parte pública dessa chave.
// A senha continua funcionando sempre.
import { supabase } from './supabaseClient'

const CHAVE_ATIVADA = 'ayra-digital-ativada'
const CHAVE_OFERTA = 'ayra-digital-oferta'

function ler(chave) { try { return localStorage.getItem(chave) } catch { return null } }
function gravar(chave, valor) { try { if (valor == null) localStorage.removeItem(chave); else localStorage.setItem(chave, valor) } catch { /* sem armazenamento: tudo bem */ } }

// Este aparelho tem leitor de digital/rosto que o navegador deixa usar?
let promessaSuporte = null
export function aparelhoTemDigital() {
  if (!promessaSuporte) {
    promessaSuporte = (async () => {
      try {
        if (typeof window === 'undefined' || !window.PublicKeyCredential) return false
        if (typeof window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable !== 'function') return false
        return await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
      } catch {
        return false
      }
    })()
  }
  return promessaSuporte
}

// Lembra, só neste aparelho, que a digital foi ativada aqui (para o botão
// "Entrar com a digital" aparecer em primeiro lugar no login).
export const ativadaAqui = () => ler(CHAVE_ATIVADA) === 'sim'
export const marcarAtivadaAqui = (sim = true) => gravar(CHAVE_ATIVADA, sim ? 'sim' : null)
export const ofertaDispensada = () => ler(CHAVE_OFERTA) === 'dispensada'
export const dispensarOferta = () => gravar(CHAVE_OFERTA, 'dispensada')

// O recurso está ligado no Supabase? (Authentication → Passkeys)
export function recursoDesligado(error) {
  if (!error) return false
  const codigo = error.code || error.error_code || ''
  return codigo === 'passkey_disabled' || error.status === 404 || /passkey.*(disabled|not enabled)/i.test(error.message || '')
}

// Erro → frase simples. Devolve null quando a pessoa só cancelou.
export function mensagemDigital(error, { acao = 'entrar' } = {}) {
  if (!error) return null
  const codigo = error.code || error.error_code || ''
  const msg = error.message || ''
  if (codigo === 'ERROR_CEREMONY_ABORTED') return null
  if (codigo === 'ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY' || error.cause?.name === 'NotAllowedError' || /NotAllowedError|not allowed|timed out|cancel/i.test(msg)) {
    return acao === 'ativar'
      ? 'A digital não foi confirmada (cancelado ou o tempo acabou). Tente de novo quando quiser.'
      : 'A digital não foi confirmada (cancelado ou o tempo acabou). Tente de novo ou entre com e-mail e senha.'
  }
  if (codigo === 'ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED') return 'A digital já está ativada neste aparelho.'
  if (codigo === 'ERROR_INVALID_DOMAIN' || codigo === 'ERROR_INVALID_RP_ID') return 'A entrada com digital ainda não foi configurada para este endereço. Use e-mail e senha.'
  if (recursoDesligado(error)) return 'A entrada com digital ainda não está ligada no Ayra Ponto. Use e-mail e senha.'
  if (codigo === 'too_many_passkeys') return 'Você chegou ao limite de aparelhos com digital. Remova um em Minha conta e tente de novo.'
  if (codigo === 'webauthn_challenge_expired') return 'Demorou demais para confirmar. Tente de novo.'
  if (codigo === 'user_banned') return 'O acesso desta conta está bloqueado. Fale com o RH da sua empresa.'
  if (codigo === 'email_not_confirmed') return 'Seu e-mail ainda não foi confirmado. Abra o link que enviamos e tente de novo.'
  if (/does not support webauthn/i.test(msg)) return 'Este navegador não permite usar a digital. Use e-mail e senha.'
  if (/failed to fetch|networkerror|load failed/i.test(msg)) return 'Não conseguimos falar com o servidor. Confira sua internet e tente de novo.'
  if (codigo.startsWith('webauthn_')) {
    return acao === 'ativar'
      ? 'Não foi possível ativar a digital neste aparelho. Tente de novo.'
      : 'Esta digital não está ligada a nenhuma conta (talvez tenha sido removida). Entre com e-mail e senha e ative de novo em Minha conta.'
  }
  return acao === 'ativar'
    ? 'Não foi possível ativar a digital agora. Tente de novo.'
    : 'Não foi possível entrar com a digital. Entre com e-mail e senha.'
}

export async function entrarComDigital() {
  const { data, error } = await supabase.auth.signInWithPasskey()
  if (error) return { ok: false, mensagem: mensagemDigital(error), error }
  marcarAtivadaAqui()
  return { ok: true, data }
}

export async function ativarDigital() {
  const { data, error } = await supabase.auth.registerPasskey()
  if (error) {
    if (error.code === 'ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED') marcarAtivadaAqui()
    return { ok: false, mensagem: mensagemDigital(error, { acao: 'ativar' }), error }
  }
  marcarAtivadaAqui()
  return { ok: true, data }
}

export async function listarDigitais() {
  const { data, error } = await supabase.auth.passkey.list()
  if (error) return { lista: null, desligado: recursoDesligado(error), error }
  return { lista: Array.isArray(data) ? data : (data?.passkeys || []), desligado: false }
}

export async function removerDigital(id) {
  const { error } = await supabase.auth.passkey.delete({ passkeyId: id })
  return { ok: !error, mensagem: error ? 'Não foi possível remover. Tente de novo.' : null }
}

// "iCloud Keychain" → "iCloud (iPhone, iPad ou Mac)" etc.
export function nomeDoAparelho(nome) {
  const n = (nome || '').trim()
  if (!n) return 'Aparelho'
  if (/icloud/i.test(n)) return 'iPhone, iPad ou Mac (iCloud)'
  if (/google/i.test(n)) return 'Android ou Chrome (Google)'
  if (/windows hello/i.test(n)) return 'Computador com Windows Hello'
  if (/samsung/i.test(n)) return 'Celular Samsung'
  return n
}
