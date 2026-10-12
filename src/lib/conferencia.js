// Conferência e assinatura do espelho (Fase 7C).
// Para assinar, a pessoa confirma quem é (digital ou senha) logo antes: o banco
// confere no próprio login que a confirmação aconteceu há poucos minutos.
import { supabase } from './supabaseClient'
import { dataHora } from './formatos'
import { marcarAtivadaAqui, marcarSaida, mensagemDigital } from './digital'

export const STATUS_CONFERENCIA = {
  pendente: { rotulo: 'Falta assinar', tom: 'neutra' },
  assinado: { rotulo: 'Assinou', tom: 'ok' },
  com_problema: { rotulo: 'Encontrou um problema', tom: 'atencao' },
}

// "com a digital", "com a senha"
export function comoConfirmou(metodo) {
  if (metodo === 'digital') return 'com a digital'
  if (metodo === 'senha') return 'com a senha'
  return metodo ? `com ${metodo}` : ''
}

// "Assinado em 12/10/2026 10:30, com a digital"
export function textoAssinatura(c) {
  if (!c?.assinado_em) return ''
  return `Assinado em ${dataHora(c.assinado_em)}${c.metodo ? `, ${comoConfirmou(c.metodo)}` : ''}`
}

// Confirma que é a própria pessoa. jeito: 'digital' | 'senha'
export async function confirmarIdentidade({ jeito, email, senha, perfilId }) {
  if (jeito === 'digital') {
    const { data, error } = await supabase.auth.signInWithPasskey()
    if (error) return { ok: false, mensagem: mensagemDigital(error, { acao: 'assinar' })?.replace('Tente de novo ou entre com e-mail e senha.', 'Tente de novo ou use a senha.') || null }
    const id = data?.user?.id || data?.session?.user?.id
    if (id && perfilId && id !== perfilId) {
      // a digital escolhida é de outra conta guardada neste aparelho: sai, sem
      // abrir a digital sozinha na tela de entrar
      marcarSaida()
      await supabase.auth.signOut()
      return { ok: false, outraConta: true, mensagem: 'Essa digital é de outra conta. Entre de novo com a sua conta para assinar.' }
    }
    marcarAtivadaAqui()
    return { ok: true }
  }
  if (!senha) return { ok: false, mensagem: 'Digite a sua senha.' }
  const { error } = await supabase.auth.signInWithPassword({ email, password: senha })
  if (error) {
    const codigo = error.code || ''
    if (codigo === 'invalid_credentials' || /invalid login credentials/i.test(error.message || '')) return { ok: false, mensagem: 'Senha incorreta. Confira e tente de novo.' }
    if (/failed to fetch|networkerror|load failed/i.test(error.message || '')) return { ok: false, mensagem: 'Não conseguimos falar com o servidor. Confira sua internet e tente de novo.' }
    if (error.status === 429) return { ok: false, mensagem: 'Muitas tentativas seguidas. Espere um minuto e tente de novo.' }
    return { ok: false, mensagem: 'Não foi possível confirmar a senha agora. Tente de novo.' }
  }
  return { ok: true }
}

export async function assinarEspelho(competencia, hash) {
  return supabase.rpc('assinar_espelho', { p_competencia: competencia, p_hash: hash })
}
