// Central Ayra (Fase 8A): a área da dona da plataforma.
import { dataHora, data as formatarData } from './formatos'

export const SITUACAO_EMPRESA = {
  teste: { rotulo: 'Em teste', tom: 'info' },
  ativa: { rotulo: 'Ativa', tom: 'ok' },
  suspensa: { rotulo: 'Suspensa', tom: 'problema' },
}

export const ACOES_CENTRAL = {
  suspendeu: 'Suspendeu a empresa',
  liberou: 'Liberou a empresa',
  ativou: 'Marcou a empresa como ativa',
  voltou_para_teste: 'Voltou a empresa para teste',
  enviou_link_senha: 'Enviou link de nova senha',
  mudou_contato: 'Mudou o contato do suporte',
}

// A função da Central pediu para confirmar a identidade?
export const pedeConfirmacao = (erro) => /confirme que é você/i.test(erro?.message || '')

// "12.345.678/0001-90"
export function formatarCnpj(v) {
  const d = String(v || '').replace(/\D/g, '')
  if (d.length !== 14) return v || ''
  return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
}

// "hoje 14:05", "ontem", "há 5 dias", "12/09/2026", "nunca"
export function quandoFoi(valor, agora = new Date()) {
  if (!valor) return 'Nunca'
  const d = new Date(valor)
  const dias = Math.floor((new Date(agora.getFullYear(), agora.getMonth(), agora.getDate()) - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / 86400000)
  if (dias <= 0) return `Hoje, ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
  if (dias === 1) return 'Ontem'
  if (dias < 30) return `Há ${dias} dias`
  return formatarData(d)
}

export function textoDoRegistro(r) {
  const base = ACOES_CENTRAL[r.acao] || r.acao
  const d = r.detalhe || {}
  if (r.acao === 'enviou_link_senha' && d.email) return `${base} para ${d.email}`
  if (r.acao === 'suspendeu' && d.motivo) return `${base}. Motivo: ${d.motivo}`
  return base
}

export const quandoRegistro = (r) => dataHora(r.em)
