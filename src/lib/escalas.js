// Escalas (Fase 2D): turnos, 12x36 e escala por calendário.
// A conta do espelho é feita no banco; aqui ficam rótulos e o cálculo de quais dias
// são de trabalho na 12x36, só para mostrar na tela (o banco refaz a mesma conta).
import { horaCurta, minutosPrevistos } from './jornadas'
import { diaIso } from './ajustes'
import { CalendarRange, Moon, Sun } from 'lucide-react'

export const TIPOS_ESCALA = [
  { valor: 'semanal', rotulo: 'Jornada semanal', curto: 'Semanal', descricao: 'Horários fixos por dia da semana (o que já existia).' },
  { valor: '12x36', rotulo: 'Escala 12x36', curto: '12x36', descricao: 'Trabalha um dia e folga o seguinte, de dois em dois dias.' },
  { valor: 'calendario', rotulo: 'Escala por calendário', curto: 'Calendário', descricao: 'Você marca, dia a dia, quem faz qual turno.' },
]
export const ROTULO_ESCALA = Object.fromEntries(TIPOS_ESCALA.map((t) => [t.valor, t.rotulo]))
export const CURTO_ESCALA = Object.fromEntries(TIPOS_ESCALA.map((t) => [t.valor, t.curto]))

// "07:00–19:00"
export const horarioDoTurno = (t) => `${horaCurta(t.entrada)}–${horaCurta(t.saida)}`

export function intervaloDoTurno(t) {
  return t.intervalo_inicio && t.intervalo_fim ? `${horaCurta(t.intervalo_inicio)}–${horaCurta(t.intervalo_fim)}` : ''
}

// minutos de trabalho previstos no turno (já sem o intervalo)
export const cargaDoTurno = (t) => minutosPrevistos({ trabalha: true, ...t })

// Turnos prontos para começar (o gestor pode ajustar antes de salvar)
export const TURNOS_PRONTOS = [
  { id: 'manha', nome: 'Manhã', sigla: 'M', entrada: '06:00', saida: '14:00', intervalo_inicio: '', intervalo_fim: '' },
  { id: 'tarde', nome: 'Tarde', sigla: 'T', entrada: '14:00', saida: '22:00', intervalo_inicio: '', intervalo_fim: '' },
  { id: 'noite', nome: 'Noite', sigla: 'N', entrada: '22:00', saida: '06:00', intervalo_inicio: '', intervalo_fim: '' },
  { id: 'plantao-dia', nome: 'Plantão 12h dia', sigla: 'PD', entrada: '07:00', saida: '19:00', intervalo_inicio: '12:00', intervalo_fim: '13:00' },
  { id: 'plantao-noite', nome: 'Plantão 12h noite', sigla: 'PN', entrada: '19:00', saida: '07:00', intervalo_inicio: '00:00', intervalo_fim: '01:00' },
]

// Cores dos turnos na grade (classe turno-cor-0 a 5 no styles.css), sempre com a sigla junto
export const corDoTurno = (indice) => `turno-cor-${indice % 6}`

export function iconeDoTurno(t) {
  const h = Number(String(t.entrada).slice(0, 2))
  if (h >= 18 || h < 5) return Moon
  return Sun
}
export const IconeCalendario = CalendarRange

// ---------- dias da 12x36 ----------
const paraUtc = (iso) => Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)))
export const diasEntre = (a, b) => Math.round((paraUtc(a) - paraUtc(b)) / 86400000)

// Na 12x36 a pessoa trabalha de dois em dois dias, a partir do primeiro dia (e também antes dele)
export function trabalhaNo12x36(dia, referencia) {
  if (!referencia) return false
  return ((diasEntre(dia, referencia) % 2) + 2) % 2 === 0
}

export function somarDias(iso, n) {
  const d = new Date(paraUtc(iso) + n * 86400000)
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
}

// Próximos dias de plantão a partir de hoje (para mostrar na ficha)
export function proximosPlantoes12x36(referencia, quantidade = 3, desde = diaIso()) {
  if (!referencia) return []
  const lista = []
  let dia = trabalhaNo12x36(desde, referencia) ? desde : somarDias(desde, 1)
  while (lista.length < quantidade) { lista.push(dia); dia = somarDias(dia, 2) }
  return lista
}

// dias do mês "AAAA-MM" → ['AAAA-MM-01', ...]
export function diasDoMes(ano, mes) {
  const total = new Date(ano, mes + 1, 0).getDate()
  return Array.from({ length: total }, (_, i) => `${ano}-${String(mes + 1).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`)
}

// 0 (domingo) a 6 (sábado) de uma data "AAAA-MM-DD"
export const diaDaSemana = (iso) => new Date(paraUtc(iso)).getUTCDay()
