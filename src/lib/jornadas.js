// Jornadas de trabalho e feriados: nomes, contas e modelos prontos.
// As contas de minutos repetem as do banco (função minutos_previstos_dia).

export const DIAS_SEMANA = [
  { valor: 0, curto: 'Dom', longo: 'Domingo' },
  { valor: 1, curto: 'Seg', longo: 'Segunda-feira' },
  { valor: 2, curto: 'Ter', longo: 'Terça-feira' },
  { valor: 3, curto: 'Qua', longo: 'Quarta-feira' },
  { valor: 4, curto: 'Qui', longo: 'Quinta-feira' },
  { valor: 5, curto: 'Sex', longo: 'Sexta-feira' },
  { valor: 6, curto: 'Sáb', longo: 'Sábado' },
]

// Na tela a semana começa na segunda-feira
export const ORDEM_DIAS = [1, 2, 3, 4, 5, 6, 0]

const dia = (valor) => DIAS_SEMANA.find((d) => d.valor === valor)

// "09:00:00" → "09:00"
export function horaCurta(valor) {
  return valor ? String(valor).slice(0, 5) : ''
}

function minutosDe(hhmm) {
  const [h, m] = String(hhmm).split(':').map(Number)
  return h * 60 + m
}

// Minutos de trabalho previstos no dia (entrada → saída, menos o intervalo).
// Saída antes da entrada significa que o turno termina no dia seguinte.
export function minutosPrevistos(d) {
  if (!d?.trabalha || !d.entrada || !d.saida) return 0
  const total = (minutosDe(d.saida) - minutosDe(d.entrada) + 1440) % 1440
  const intervalo = d.intervalo_inicio && d.intervalo_fim
    ? (minutosDe(d.intervalo_fim) - minutosDe(d.intervalo_inicio) + 1440) % 1440
    : 0
  return total - intervalo
}

export function cargaSemanal(dias) {
  return (dias || []).reduce((soma, d) => soma + minutosPrevistos(d), 0)
}

export function diaFolga(valor) {
  return { dia_semana: valor, trabalha: false, entrada: '', saida: '', intervalo_inicio: '', intervalo_fim: '' }
}

export function diaTrabalho(valor, entrada, saida, intervaloInicio = '', intervaloFim = '') {
  return { dia_semana: valor, trabalha: true, entrada, saida, intervalo_inicio: intervaloInicio, intervalo_fim: intervaloFim }
}

// Sete dias, todos de folga (ponto de partida de uma jornada nova)
export function diasEmBranco() {
  return DIAS_SEMANA.map((d) => diaFolga(d.valor))
}

// Linhas do banco → sete dias para o formulário (dias que faltam viram folga)
export function diasParaFormulario(linhas) {
  return DIAS_SEMANA.map((d) => {
    const l = (linhas || []).find((x) => x.dia_semana === d.valor)
    if (!l || !l.trabalha) return diaFolga(d.valor)
    return {
      dia_semana: d.valor, trabalha: true,
      entrada: horaCurta(l.entrada), saida: horaCurta(l.saida),
      intervalo_inicio: horaCurta(l.intervalo_inicio), intervalo_fim: horaCurta(l.intervalo_fim),
    }
  })
}

// Mensagem de erro do dia ('' quando está tudo certo)
export function validarDia(d) {
  if (!d.trabalha) return ''
  if (!d.entrada || !d.saida) return 'Informe a entrada e a saída.'
  if (d.entrada === d.saida) return 'A entrada e a saída não podem ser iguais.'
  const temIni = Boolean(d.intervalo_inicio)
  const temFim = Boolean(d.intervalo_fim)
  if (temIni !== temFim) return 'Preencha o início e o fim do intervalo, ou deixe os dois em branco.'
  if (temIni) {
    if (d.intervalo_inicio === d.intervalo_fim) return 'O intervalo precisa ter duração.'
    const mesmoDia = minutosDe(d.saida) > minutosDe(d.entrada)
    if (mesmoDia && (minutosDe(d.intervalo_inicio) < minutosDe(d.entrada) || minutosDe(d.intervalo_fim) > minutosDe(d.saida)
        || minutosDe(d.intervalo_fim) < minutosDe(d.intervalo_inicio))) {
      return 'O intervalo precisa acontecer entre a entrada e a saída.'
    }
  }
  if (minutosPrevistos(d) <= 0) return 'O intervalo não pode ser maior que o expediente.'
  return ''
}

// Formato enviado ao banco (função salvar_modelo_jornada)
export function diasParaBanco(dias) {
  return dias.map((d) => ({
    dia_semana: d.dia_semana,
    trabalha: d.trabalha,
    entrada: d.trabalha ? d.entrada : null,
    saida: d.trabalha ? d.saida : null,
    intervalo_inicio: d.trabalha && d.intervalo_inicio ? d.intervalo_inicio : null,
    intervalo_fim: d.trabalha && d.intervalo_fim ? d.intervalo_fim : null,
  }))
}

// "Seg a sex" / "Seg e ter" / "Sáb" / "Seg, qua e sex"
function nomesDosDias(valores) {
  const posicoes = valores.map((v) => ORDEM_DIAS.indexOf(v)).sort((a, b) => a - b)
  const nomes = posicoes.map((p) => dia(ORDEM_DIAS[p]).curto)
  const seguidos = posicoes.every((p, i) => i === 0 || p === posicoes[i - 1] + 1)
  if (nomes.length === 1) return nomes[0]
  if (seguidos && nomes.length >= 3) return `${nomes[0]} a ${nomes[nomes.length - 1].toLowerCase()}`
  if (nomes.length === 2) return `${nomes[0]} e ${nomes[1].toLowerCase()}`
  return `${nomes.slice(0, -1).join(', ')} e ${nomes[nomes.length - 1].toLowerCase()}`
}

// Ex.: "Seg a sex 09:00–18:00 · Sáb 08:00–12:00"
export function resumoHorarios(linhas) {
  const dias = diasParaFormulario(linhas).filter((d) => d.trabalha)
  if (!dias.length) return 'Sem dias de trabalho'
  const grupos = new Map()
  for (const d of dias) {
    const chave = `${d.entrada}–${d.saida}`
    if (!grupos.has(chave)) grupos.set(chave, [])
    grupos.get(chave).push(d.dia_semana)
  }
  return [...grupos.entries()].map(([horario, valores]) => `${nomesDosDias(valores)} ${horario}`).join(' · ')
}

export function textoIntervalo(linhas) {
  const dias = diasParaFormulario(linhas).filter((d) => d.trabalha)
  const comIntervalo = dias.filter((d) => d.intervalo_inicio)
  if (!comIntervalo.length) return 'Sem intervalo'
  const iguais = comIntervalo.every((d) => d.intervalo_inicio === comIntervalo[0].intervalo_inicio && d.intervalo_fim === comIntervalo[0].intervalo_fim)
  return iguais ? `${comIntervalo[0].intervalo_inicio}–${comIntervalo[0].intervalo_fim}` : 'Varia conforme o dia'
}

// Modelos prontos para começar sem digitar tudo
export const MODELOS_PRONTOS = [
  {
    id: 'comercial-40',
    nome: 'Comercial 40h',
    descricao: 'Segunda a sexta, 8 horas por dia, com 1 hora de almoço.',
    tolerancia: 10,
    dias: () => [
      ...[1, 2, 3, 4, 5].map((v) => diaTrabalho(v, '09:00', '18:00', '12:00', '13:00')),
      diaFolga(6), diaFolga(0),
    ],
  },
  {
    id: 'comercial-44',
    nome: 'Comercial 44h',
    descricao: 'Segunda a sexta com 8 horas e sábado de manhã (44 horas na semana).',
    tolerancia: 10,
    dias: () => [
      ...[1, 2, 3, 4, 5].map((v) => diaTrabalho(v, '08:00', '17:00', '12:00', '13:00')),
      diaTrabalho(6, '08:00', '12:00'),
      diaFolga(0),
    ],
  },
  {
    id: 'estagio-30',
    nome: 'Estágio 30h',
    descricao: 'Segunda a sexta, 6 horas por dia, sem intervalo (30 horas na semana).',
    tolerancia: 10,
    dias: () => [
      ...[1, 2, 3, 4, 5].map((v) => diaTrabalho(v, '09:00', '15:00')),
      diaFolga(6), diaFolga(0),
    ],
  },
]

// ---------------------------------------------------------------- Feriados

export const TIPO_FERIADO = {
  nacional: 'Nacional',
  estadual: 'Estadual',
  municipal: 'Municipal',
  facultativo: 'Ponto facultativo',
  empresa: 'Da empresa',
}

const TOM_FERIADO = { nacional: 'info', estadual: 'info', municipal: 'info', facultativo: 'neutra', empresa: 'atencao' }
export const tomFeriado = (tipo) => TOM_FERIADO[tipo] || 'neutra'

// Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher), em UTC ao meio-dia
function pascoa(ano) {
  const a = ano % 19
  const b = Math.floor(ano / 100)
  const c = ano % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const mes = Math.floor((h + l - 7 * m + 114) / 31)
  const diaDoMes = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(Date.UTC(ano, mes - 1, diaDoMes, 12))
}

const iso = (d) => d.toISOString().slice(0, 10)
const somar = (d, n) => new Date(d.getTime() + n * 86400000)

// Feriados nacionais do ano. Carnaval e Corpus Christi são pontos facultativos.
export function feriadosNacionais(ano, { facultativos = false } = {}) {
  const p = pascoa(ano)
  const fixos = [
    ['01-01', 'Confraternização Universal'],
    ['04-21', 'Tiradentes'],
    ['05-01', 'Dia do Trabalho'],
    ['09-07', 'Independência do Brasil'],
    ['10-12', 'Nossa Senhora Aparecida'],
    ['11-02', 'Finados'],
    ['11-15', 'Proclamação da República'],
    ['11-20', 'Dia da Consciência Negra'],
    ['12-25', 'Natal'],
  ].map(([md, nome]) => ({ data: `${ano}-${md}`, nome, tipo: 'nacional' }))
  const lista = [...fixos, { data: iso(somar(p, -2)), nome: 'Sexta-feira Santa', tipo: 'nacional' }]
  if (facultativos) {
    lista.push(
      { data: iso(somar(p, -48)), nome: 'Carnaval (segunda-feira)', tipo: 'facultativo' },
      { data: iso(somar(p, -47)), nome: 'Carnaval (terça-feira)', tipo: 'facultativo' },
      { data: iso(somar(p, 60)), nome: 'Corpus Christi', tipo: 'facultativo' },
    )
  }
  return lista.sort((x, y) => x.data.localeCompare(y.data))
}

// "qui" para uma data 'YYYY-MM-DD'
export function diaDaSemanaCurto(dataIso) {
  return dia(new Date(`${dataIso}T12:00:00`).getDay()).curto
}
