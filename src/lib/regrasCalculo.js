// Regras de cálculo (Fase 7A): o padrão da CLT e como mostrar cada regra.
export const PADRAO_CLT = {
  extra_normal_pct: 50,
  extra_especial_pct: 100,
  extra_especial_folgas: true,
  noturno_inicio: '22:00',
  noturno_fim: '05:00',
  noturno_pct: 20,
  hora_noturna_reduzida: true,
  prorrogar_noturno: true,
  intervalo_pre_assinalado: false,
  interjornada_min: 660,
  dsr_perde_falta: true,
  dsr_perde_atraso: false,
  limite_semanal_min: 2640,
}

export const CAMPOS_REGRAS = Object.keys(PADRAO_CLT)

// "22:00:00" → "22:00"
export const horaCurta = (t) => (t ? String(t).slice(0, 5) : '')

export function normalizarRegras(linha) {
  const r = { ...PADRAO_CLT }
  if (linha) for (const c of CAMPOS_REGRAS) if (linha[c] !== undefined && linha[c] !== null) r[c] = linha[c]
  r.noturno_inicio = horaCurta(r.noturno_inicio)
  r.noturno_fim = horaCurta(r.noturno_fim)
  return r
}

export function ehPadraoClt(r) {
  return CAMPOS_REGRAS.every((c) => String(normalizarRegras(r)[c]) === String(PADRAO_CLT[c]))
}
