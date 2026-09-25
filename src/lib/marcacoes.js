// Regras das marcações de ponto na tela.
// A sugestão da próxima marcação só facilita: a pessoa pode sempre escolher
// outro tipo (a Portaria 671 proíbe restringir a marcação).

export const TIPOS_MARCACAO = [
  { valor: 'entrada', rotulo: 'Entrada', acao: 'Registrar entrada' },
  { valor: 'inicio_intervalo', rotulo: 'Início do intervalo', acao: 'Registrar início do intervalo' },
  { valor: 'fim_intervalo', rotulo: 'Fim do intervalo', acao: 'Registrar fim do intervalo' },
  { valor: 'saida', rotulo: 'Saída', acao: 'Registrar saída' },
]

export function rotuloMarcacao(tipo) {
  return TIPOS_MARCACAO.find((t) => t.valor === tipo)?.rotulo ?? tipo
}

export function acaoMarcacao(tipo) {
  return TIPOS_MARCACAO.find((t) => t.valor === tipo)?.acao ?? 'Registrar ponto'
}

// registros em ordem crescente de horário
export function sugerirProximaMarcacao(registros) {
  const ultimo = registros[registros.length - 1]
  if (!ultimo || ultimo.tipo === 'saida') return 'entrada'
  if (ultimo.tipo === 'inicio_intervalo') return 'fim_intervalo'
  if (ultimo.tipo === 'fim_intervalo') return 'saida'
  // último foi uma entrada: sugere intervalo se ainda não houve intervalo neste turno
  const idxEntrada = registros.map((r) => r.tipo).lastIndexOf('entrada')
  const teveIntervalo = registros.slice(idxEntrada + 1).some((r) => r.tipo === 'inicio_intervalo')
  return teveIntervalo ? 'saida' : 'inicio_intervalo'
}

// 'trabalhando' | 'intervalo' | 'encerrado' | 'sem_marcacao'
export function situacaoAgora(registros) {
  const ultimo = registros[registros.length - 1]
  if (!ultimo) return 'sem_marcacao'
  if (ultimo.tipo === 'inicio_intervalo') return 'intervalo'
  if (ultimo.tipo === 'saida') return 'encerrado'
  return 'trabalhando'
}

export const SITUACAO_AGORA = {
  trabalhando: { rotulo: 'Trabalhando', tom: 'ok' },
  intervalo: { rotulo: 'Em intervalo', tom: 'info' },
  encerrado: { rotulo: 'Encerrou o dia', tom: 'neutra' },
  sem_marcacao: { rotulo: 'Sem marcação hoje', tom: 'atencao' },
}

// Minutos trabalhados: soma dos trechos entre entrada/fim de intervalo e
// início de intervalo/saída. Se ainda está trabalhando, conta até agora.
export function minutosTrabalhados(registros, agora = new Date()) {
  let total = 0
  let inicio = null
  for (const r of registros) {
    const t = new Date(r.marcado_em)
    if (r.tipo === 'entrada' || r.tipo === 'fim_intervalo') {
      inicio = t
    } else if (inicio) {
      total += (t - inicio) / 60000
      inicio = null
    }
  }
  if (inicio) total += (agora - inicio) / 60000
  return total
}
