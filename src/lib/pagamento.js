// Fase 9A: pagamento por hora (horista). A conta é feita no banco
// (pagamento_por_hora); aqui ficam só os formatos.

export const reais = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

// "25,50" ou "25.50" → 25.5 (ou null se não for número)
export function lerValor(texto) {
  const limpo = String(texto || '').trim().replace(/\s|R\$/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.')
  if (!limpo) return null
  const n = Number(limpo)
  return Number.isFinite(n) ? n : null
}

// 360 → "06:00" e "06:00" → 360
export const minutosParaHora = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
export function horaParaMinutos(texto) {
  const r = /^(\d{1,2}):(\d{2})$/.exec(texto || '')
  return r ? Number(r[1]) * 60 + Number(r[2]) : null
}

// As linhas do pagamento, na ordem em que aparecem (só as que têm valor)
export function linhasDoPagamento(p) {
  if (!p) return []
  const m = p.minutos || {}
  const v = p.valores || {}
  const r = p.regras || {}
  const linhas = [
    { id: 'normais', rotulo: 'Horas normais', minutos: m.normais, valor: v.normais, sempre: true },
    { id: 'extra_normal', rotulo: `Horas extras ${r.extra_normal_pct ?? 50}%`, minutos: m.extra_normal, valor: v.extra_normal },
    { id: 'extra_especial', rotulo: `Horas extras ${r.extra_especial_pct ?? 100}% (domingo, feriado e folga)`, minutos: m.extra_especial, valor: v.extra_especial },
    { id: 'noturno', rotulo: `Adicional noturno ${r.noturno_pct ?? 20}%`, minutos: r.hora_noturna_reduzida ? m.noturno_reduzido : m.noturno, valor: v.adicional_noturno },
    { id: 'reduzida', rotulo: 'Hora noturna reduzida (tempo a mais)', minutos: Math.max((m.noturno_reduzido || 0) - (m.noturno || 0), 0), valor: v.hora_reduzida },
    { id: 'a_pagar', rotulo: 'Intervalo e descanso a pagar (+50%)', minutos: m.a_pagar_50, valor: v.a_pagar_50 },
  ]
  return linhas.filter((l) => l.sempre || Number(l.valor) > 0 || Number(l.minutos) > 0)
}
