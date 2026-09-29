// Relatórios (Fase 3B): períodos, rótulos e planilhas.
import { diaIso } from './ajustes'
import { data as formatarData } from './formatos'

export const RELATORIOS = [
  { id: 'frequencia', titulo: 'Frequência', descricao: 'Faltas, atrasos, horas extras e avisos, por pessoa e por dia.' },
  { id: 'pedidos', titulo: 'Pedidos', descricao: 'Ajustes, abonos e folgas: quantos, de que tipo e em quanto tempo foram respondidos.' },
  { id: 'banco', titulo: 'Banco de horas', descricao: 'Saldo, horas a vencer e vencidas de cada pessoa numa data.' },
  { id: 'marcacoes', titulo: 'Marcações', descricao: 'Todas as marcações do período, com NSR, unidade e origem.' },
]

// Limite de dias de cada relatório (igual ao do banco)
export const LIMITE_DIAS = { frequencia: 93, pedidos: 366, marcacoes: 62 }

export const ORIGEM = { web: 'Computador', mobile: 'Celular', mobile_geolocalizacao: 'Celular com localização' }

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export function periodoPronto(qual) {
  const hoje = new Date()
  if (qual === 'mes') return { inicio: iso(new Date(hoje.getFullYear(), hoje.getMonth(), 1)), fim: diaIso() }
  if (qual === 'mes_passado') {
    return { inicio: iso(new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1)), fim: iso(new Date(hoje.getFullYear(), hoje.getMonth(), 0)) }
  }
  if (qual === '7') return { inicio: diaIso(-6), fim: diaIso() }
  if (qual === '30') return { inicio: diaIso(-29), fim: diaIso() }
  return null
}

export const PERIODOS_PRONTOS = [
  { id: 'mes', rotulo: 'Este mês' },
  { id: 'mes_passado', rotulo: 'Mês passado' },
  { id: '7', rotulo: 'Últimos 7 dias' },
  { id: '30', rotulo: 'Últimos 30 dias' },
]

export function diasNoPeriodo(inicio, fim) {
  if (!inicio || !fim) return 0
  return Math.round((new Date(`${fim}T12:00:00`) - new Date(`${inicio}T12:00:00`)) / 86400000) + 1
}

// Confere o período: devolve a mensagem de erro ou ''
export function conferirPeriodo(inicio, fim, relatorio) {
  if (!inicio || !fim) return 'Escolha o primeiro e o último dia.'
  if (fim < inicio) return 'O último dia não pode ser antes do primeiro.'
  const limite = LIMITE_DIAS[relatorio]
  if (limite && diasNoPeriodo(inicio, fim) > limite) {
    return relatorio === 'frequencia' ? 'Este relatório pode ter no máximo 3 meses (93 dias).'
      : relatorio === 'marcacoes' ? 'Este relatório pode ter no máximo 62 dias.'
      : 'Este relatório pode ter no máximo 1 ano.'
  }
  return ''
}

export const textoPeriodo = (inicio, fim) => (inicio === fim ? formatarData(inicio) : `${formatarData(inicio)} a ${formatarData(fim)}`)

// minutos → "1,50" (horas decimais, para a planilha)
export const horasPlanilha = (m) => (Number(m || 0) / 60).toFixed(2).replace('.', ',')

// Busca todas as linhas de uma consulta do Supabase, de 1000 em 1000
export async function buscarTodas(montarConsulta, maximo = 20000) {
  const todas = []
  for (let de = 0; de < maximo; de += 1000) {
    const { data, error } = await montarConsulta().range(de, de + 999)
    if (error) return { error }
    todas.push(...(data || []))
    if (!data || data.length < 1000) break
  }
  return { data: todas }
}
