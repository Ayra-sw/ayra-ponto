// Apuração das horas (Fase 2B): como mostrar o que a função apurar_periodo
// devolve. A conta em si é feita no banco, para valer igual em todas as telas.
import { AlarmClock, BedDouble, CalendarCheck, Plane, CalendarOff, Check, CircleAlert, CircleX, Clock, Hourglass, Minus, PartyPopper, Plus, UserRoundX } from 'lucide-react'
import { duracao } from './formatos'
import { TIPO_AFASTAMENTO_CURTO } from './bancoHoras'

// "YYYY-MM-DD" do primeiro e do último dia de um mês (mes = 0 a 11)
export function limitesDoMes(ano, mes) {
  const pad = (n) => String(n).padStart(2, '0')
  const ultimo = new Date(ano, mes + 1, 0).getDate()
  return { inicio: `${ano}-${pad(mes + 1)}-01`, fim: `${ano}-${pad(mes + 1)}-${pad(ultimo)}` }
}

// "2026-09" → { ano: 2026, mes: 8 } (ou o mês atual, se o texto não servir)
export function lerMes(texto) {
  const m = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(texto || '')
  if (m) return { ano: Number(m[1]), mes: Number(m[2]) - 1 }
  const hoje = new Date()
  return { ano: hoje.getFullYear(), mes: hoje.getMonth() }
}

export const textoDoMes = ({ ano, mes }) => `${ano}-${String(mes + 1).padStart(2, '0')}`

export function nomeDoMes({ ano, mes }) {
  const t = new Date(ano, mes, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  return t.charAt(0).toUpperCase() + t.slice(1)
}

export function somarMeses({ ano, mes }, n) {
  const d = new Date(ano, mes + n, 1)
  return { ano: d.getFullYear(), mes: d.getMonth() }
}

export function ehMesAtualOuFuturo({ ano, mes }) {
  const h = new Date()
  return ano > h.getFullYear() || (ano === h.getFullYear() && mes >= h.getMonth())
}

// minutos com sinal: "+1h05", "−0h30", "0h00"
export function saldoTexto(minutos) {
  const m = Math.round(minutos || 0)
  if (m === 0) return '0h00'
  return `${m > 0 ? '+' : '−'}${duracao(Math.abs(m))}`
}

export const tomDoSaldo = (m) => (m > 0 ? 'info' : m < 0 ? 'atencao' : 'neutra')

// "Seg 14/09"
export function diaCurto(iso) {
  const d = new Date(`${iso}T12:00:00`)
  const semana = d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')
  return `${semana.charAt(0).toUpperCase()}${semana.slice(1)} ${d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}`
}

// Como cada situação do dia aparece (sempre ícone + texto)
export function situacaoDoDia(linha) {
  switch (linha.situacao) {
    case 'trabalhado':
      if (linha.atraso_min > 0) return { rotulo: 'Horas a menos', tom: 'atencao', icone: Clock }
      if (linha.extra_min > 0) return { rotulo: 'Hora extra', tom: 'info', icone: Plus }
      return { rotulo: 'Em dia', tom: 'ok', icone: Check }
    case 'afastado': return { rotulo: TIPO_AFASTAMENTO_CURTO[linha.afastamento_tipo] || 'Afastado', tom: 'info', icone: Plane }
    case 'folga_escala': return { rotulo: 'Folga da escala', tom: 'neutra', icone: BedDouble }
    case 'falta': return { rotulo: 'Falta', tom: 'problema', icone: CircleX }
    case 'abonado': return { rotulo: 'Abonado', tom: 'ok', icone: CalendarCheck }
    case 'folga': return { rotulo: 'Folga aprovada', tom: 'info', icone: CalendarOff }
    case 'feriado': return { rotulo: linha.feriado_nome ? `Feriado: ${linha.feriado_nome}` : 'Feriado', tom: 'info', icone: PartyPopper }
    case 'incompleto': return { rotulo: 'Incompleto', tom: 'atencao', icone: CircleAlert }
    case 'em_andamento': return { rotulo: 'Em andamento', tom: 'info', icone: Hourglass }
    case 'futuro': return { rotulo: 'A vir', tom: 'neutra', icone: AlarmClock }
    case 'antes_admissao': return { rotulo: 'Antes da admissão', tom: 'neutra', icone: UserRoundX }
    case 'sem_jornada': return { rotulo: 'Sem jornada', tom: 'neutra', icone: Minus }
    default: return { rotulo: 'Sem expediente', tom: 'neutra', icone: Minus }
  }
}

// Totais do período (dias que ainda não chegaram não entram no "previsto")
export function totaisDoPeriodo(linhas) {
  const t = { previsto: 0, trabalhado: 0, atraso: 0, extra: 0, falta: 0, abonado: 0, diasFalta: 0, diasComAlerta: 0, diasTrabalhados: 0 }
  for (const l of linhas) {
    if (l.situacao !== 'futuro') t.previsto += l.previsto_min
    t.trabalhado += l.trabalhado_min
    t.atraso += l.atraso_min
    t.extra += l.extra_min
    t.falta += l.falta_min
    t.abonado += l.abonado_min
    if (l.situacao === 'falta') t.diasFalta += 1
    if ((l.alertas || []).length > 0) t.diasComAlerta += 1
    if (l.trabalhado_min > 0) t.diasTrabalhados += 1
  }
  t.saldo = t.extra - t.atraso - t.falta
  return t
}

// Marcação do dia: selo quando veio de um ajuste aprovado
export function origemDaMarcacao(m) {
  if (m.origem === 'corrigida') return 'Horário corrigido (ajuste aprovado)'
  if (m.origem === 'incluida') return 'Marcação incluída (ajuste aprovado)'
  return null
}

// Planilha (CSV com ; e acentos certos no Excel)
export function baixarCsv(nomeArquivo, cabecalho, linhas) {
  const esc = (v) => {
    const s = String(v ?? '')
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const corpo = [cabecalho, ...linhas].map((l) => l.map(esc).join(';')).join('\r\n')
  const blob = new Blob([`﻿${corpo}`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nomeArquivo
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// Horário no relógio da unidade da pessoa (e não do aparelho de quem olha)
export function horaNoFuso(valor, fuso) {
  if (!valor) return '—'
  try {
    return new Date(valor).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', ...(fuso ? { timeZone: fuso } : {}) })
  } catch {
    return new Date(valor).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  }
}
