// Histórico de alterações (Fase 3C): como cada anotação do banco vira uma frase.
import { data as formatarData, dataHora, duracao } from './formatos'
import { CATEGORIA, CONFERENCIA_FACIAL, PAPEL, SITUACAO, TIPO_SOLICITACAO } from './rotulos'
import { STATUS_SOLICITACAO } from './ajustes'
import { DIAS_SEMANA, TIPO_FERIADO, horaCurta } from './jornadas'
import { rotuloMarcacao } from './marcacoes'
import { ROTULO_LANCAMENTO, TIPO_AFASTAMENTO } from './bancoHoras'
import { ROTULO_ESCALA } from './escalas'

// Grupos que aparecem no filtro "O que mudou"
export const GRUPOS = [
  { id: 'pessoas', rotulo: 'Cadastro de pessoas', tabelas: ['perfis'] },
  { id: 'pedidos', rotulo: 'Pedidos', tabelas: ['ajustes_ponto'] },
  { id: 'jornadas', rotulo: 'Jornadas e feriados', tabelas: ['modelos_jornada', 'modelos_jornada_dias', 'feriados'] },
  { id: 'escalas', rotulo: 'Escalas e turnos', tabelas: ['escala_dias', 'turnos'] },
  { id: 'afastamentos', rotulo: 'Afastamentos', tabelas: ['afastamentos'] },
  { id: 'banco', rotulo: 'Banco de horas', tabelas: ['banco_horas_lancamentos'] },
  { id: 'organizacao', rotulo: 'Departamentos, cargos e gestores', tabelas: ['departamentos', 'cargos', 'departamento_gestores'] },
  { id: 'empresa', rotulo: 'Empresa e unidades', tabelas: ['empresas', 'filiais'] },
  { id: 'facial', rotulo: 'Reconhecimento facial', tabelas: ['rostos_referencia', 'verificacoes_faciais'] },
]

// Campos que não aparecem (técnicos ou repetidos)
const ESCONDIDOS = new Set([
  'id', 'empresa_id', 'perfil_id', 'modelo_id', 'criado_por', 'analisado_por', 'analisado_em', 'analisada_por', 'analisada_em',
  'conferida_por', 'conferida_em', 'cancelado_por', 'registro_original_id', 'registro_id', 'referencia_id', 'foto_path',
  'modelo', 'qualidade', 'similaridade', 'limiar', 'antispoof', 'vivacidade', 'piscou', 'motor', 'versao_hash',
])

const NOMES = {
  nome_completo: 'Nome', nome: 'Nome', cpf: 'CPF', telefone: 'Telefone', matricula: 'Matrícula', cargo: 'Cargo (texto)',
  cargo_id: 'Cargo', departamento_id: 'Departamento', modelo_jornada_id: 'Jornada', categoria: 'Categoria',
  data_admissao: 'Data de admissão', filial_id: 'Unidade', status: 'Situação', tipo: 'Tipo', tipo_escala: 'Como trabalha',
  escala_turno_id: 'Turno da 12x36', escala_referencia: 'Primeiro dia da 12x36', descricao: 'Descrição', ativo: 'Ativo',
  ativa: 'Ativa', tolerancia_minutos: 'Tolerância (minutos)', usa_banco_horas: 'Usa banco de horas',
  banco_horas_validade_meses: 'Prazo do banco (meses)', banco_horas_inicio: 'Início do banco', dia_semana: 'Dia',
  trabalha: 'Trabalha', entrada: 'Entrada', saida: 'Saída', intervalo_inicio: 'Início do intervalo', intervalo_fim: 'Fim do intervalo',
  data: 'Dia', sigla: 'Sigla', turno_id: 'Turno', motivo: 'Motivo', comentario_analise: 'Resposta', data_referencia: 'Dia',
  data_fim: 'Último dia', marcacao_solicitada: 'Horário pedido', tipo_marcacao: 'Marcação', anexo_path: 'Atestado',
  data_inicio: 'Primeiro dia', observacao: 'Observação', cancelado_em: 'Cancelado em', motivo_cancelamento: 'Motivo do cancelamento',
  minutos: 'Horas', motivo_recusa: 'Motivo da recusa', conferencia: 'Conferência', razao_social: 'Razão social', cnpj: 'CNPJ',
  codigo_convite: 'Código de convite', reconhecimento_facial: 'Reconhecimento facial', fuso_horario: 'Fuso horário',
  cidade: 'Cidade', uf: 'UF', cep: 'CEP', logradouro: 'Endereço', numero: 'Número', bairro: 'Bairro', complemento: 'Complemento',
  empresa: 'Empresa',
}
const nomeDoCampo = (c) => NOMES[c] || (c.charAt(0).toUpperCase() + c.slice(1)).replace(/_/g, ' ')

const SITUACAO_FOTO = { pendente: 'Esperando aprovação', aprovada: 'Aprovada', recusada: 'Recusada', substituida: 'Substituída' }

// Valor legível de um campo
export function valorDoCampo(tabela, campo, v, mapas) {
  if (v === null || v === undefined || v === '') return '(vazio)'
  if (v === '***') return '(alterado)'
  if (typeof v === 'boolean') return v ? 'Sim' : 'Não'
  if (campo === 'anexo_path') return 'Anexado'
  if (campo === 'departamento_id') return mapas.departamentos[v] || 'departamento excluído'
  if (campo === 'cargo_id') return mapas.cargos[v] || 'cargo excluído'
  if (campo === 'modelo_jornada_id') return mapas.jornadas[v] || 'jornada excluída'
  if (campo === 'filial_id') return mapas.unidades[v] || 'unidade excluída'
  if (campo === 'turno_id' || campo === 'escala_turno_id') return mapas.turnos[v] || 'turno excluído'
  if (campo === 'status') {
    if (tabela === 'perfis') return SITUACAO[v] || v
    if (tabela === 'ajustes_ponto') return STATUS_SOLICITACAO[v]?.rotulo || v
    if (tabela === 'rostos_referencia') return SITUACAO_FOTO[v] || v
  }
  if (campo === 'tipo') {
    if (tabela === 'perfis') return PAPEL[v] || v
    if (tabela === 'ajustes_ponto') return TIPO_SOLICITACAO[v] || v
    if (tabela === 'afastamentos') return TIPO_AFASTAMENTO[v] || v
    if (tabela === 'banco_horas_lancamentos') return ROTULO_LANCAMENTO[v] || v
    if (tabela === 'feriados') return TIPO_FERIADO[v] || v
  }
  if (campo === 'categoria') return CATEGORIA[v] || v
  if (campo === 'tipo_escala') return ROTULO_ESCALA[v] || v
  if (campo === 'tipo_marcacao') return rotuloMarcacao(v)
  if (campo === 'conferencia') return CONFERENCIA_FACIAL[v]?.rotulo || v
  if (campo === 'dia_semana') return DIAS_SEMANA.find((d) => d.valor === Number(v))?.longo || v
  if (campo === 'minutos') return `${Number(v) > 0 ? '+' : '−'}${duracao(Math.abs(Number(v)))}`
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) return formatarData(v)
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v)) return dataHora(v)
  if (typeof v === 'string' && /^\d{2}:\d{2}(:\d{2})?$/.test(v)) return horaCurta(v)
  if (Array.isArray(v) || typeof v === 'object') return '(alterado)'
  return String(v)
}

// Mudanças de uma anotação: [{ campo, antes, depois }]
export function mudancas(item, mapas) {
  const campos = (item.campos || []).filter((c) => !ESCONDIDOS.has(c))
  return campos.map((c) => ({
    campo: nomeDoCampo(c),
    antes: item.acao === 'criou' ? null : valorDoCampo(item.tabela, c, item.antes?.[c], mapas),
    depois: item.acao === 'excluiu' ? null : valorDoCampo(item.tabela, c, item.depois?.[c], mapas),
  }))
    // Esconde linhas em que o antes e o depois ficam iguais na tela (ex.: dois nomes de uma unidade excluída).
    // CPF e telefone mudados aparecem sempre como "(alterado)".
    .filter((m) => item.acao !== 'alterou' || m.antes !== m.depois || m.depois === '(alterado)')
}

// Linhas de detalhe de um grupo de anotações
export function detalhes(g, mapas) {
  if (g.itens.length <= 1) return mudancas(g, mapas)
  if (g.tabela === 'escala_dias') {
    return g.itens.map((i) => {
      const v = i.depois || i.antes || {}
      return { campo: valorDoCampo('escala_dias', 'data', v.data, mapas), antes: null,
        depois: i.acao === 'excluiu' ? 'folga' : (mapas.turnos[i.depois?.turno_id] || 'turno') }
    }).sort((a, b) => (a.campo < b.campo ? -1 : 1))
  }
  if (g.tabela === 'modelos_jornada_dias') {
    const dias = g.itens.filter((i) => i.acao !== 'excluiu' && i.depois)
    const fonte = (dias.length ? dias : g.itens).slice()
      .sort((a, b) => ((((a.depois || a.antes || {}).dia_semana + 6) % 7) - (((b.depois || b.antes || {}).dia_semana + 6) % 7)))
    return fonte.map((i) => {
      const v = i.depois || i.antes || {}
      const dia = valorDoCampo('modelos_jornada_dias', 'dia_semana', v.dia_semana, mapas)
      const horario = v.trabalha === false ? 'folga'
        : [v.entrada && v.saida ? `${valorDoCampo('', 'entrada', v.entrada, mapas)}–${valorDoCampo('', 'saida', v.saida, mapas)}` : null,
           v.intervalo_inicio ? `intervalo ${valorDoCampo('', 'x', v.intervalo_inicio, mapas)}–${valorDoCampo('', 'x', v.intervalo_fim, mapas)}` : null].filter(Boolean).join(', ') || 'alterado'
      return { campo: dia, antes: null, depois: horario }
    })
  }
  return g.itens.flatMap((i) => mudancas(i, mapas))
}

// Junta as anotações feitas de uma vez só (mesma transação, mesmo cadastro)
export function agrupar(lista) {
  const grupos = []
  for (const item of lista) {
    const ultimo = grupos[grupos.length - 1]
    // Dias de uma jornada (mesmo modelo) ou da escala de uma pessoa, mudados juntos, viram uma linha só
    const mesmoDono = item.tabela === 'escala_dias'
      ? (item.pessoa_id && ultimo?.pessoa_id === item.pessoa_id)
      : ultimo?.registro_id === item.registro_id
    if (ultimo && ultimo.transacao === item.transacao && ultimo.tabela === item.tabela && mesmoDono
        && ['modelos_jornada_dias', 'escala_dias'].includes(item.tabela)) {
      ultimo.itens.push(item)
      if (ultimo.acao !== item.acao) ultimo.acao = 'alterou'
    } else {
      grupos.push({ ...item, itens: [item] })
    }
  }
  return grupos
}

const pedido = (t) => (TIPO_SOLICITACAO[t] || 'pedido').toLowerCase()

// A frase de cada anotação (ou grupo): "Rita RH alterou o cadastro de Caio"
export function frase(g, mapas) {
  const quem = g.feito_por_nome || 'Alguém'
  const v = g.depois || g.antes || {}
  const pessoa = mapas.pessoas[g.pessoa_id] || v.nome_completo || 'uma pessoa'
  const proprio = g.feito_por && g.feito_por === g.pessoa_id
  const verbo = { criou: 'criou', alterou: 'alterou', excluiu: 'excluiu' }[g.acao]
  switch (g.tabela) {
    case 'perfis':
      if (g.acao === 'alterou' && (g.campos || []).includes('empresa_id') && !g.antes?.empresa_id) return `${pessoa} entrou na empresa pelo convite`
      return proprio ? `${quem} alterou o próprio cadastro` : `${quem} ${verbo} o cadastro de ${pessoa}`
    case 'ajustes_ponto': {
      const t = pedido(v.tipo || g.antes?.tipo)
      if (g.acao === 'criou') return `${quem} pediu ${t}`
      if (g.depois?.status === 'aprovado') return `${quem} aprovou o pedido de ${t} de ${pessoa}`
      if (g.depois?.status === 'rejeitado') return `${quem} recusou o pedido de ${t} de ${pessoa}`
      if (g.depois?.status === 'cancelado') return `${quem} cancelou o próprio pedido de ${t}`
      return `${quem} ${verbo} um pedido de ${pessoa}`
    }
    case 'afastamentos': {
      const t = (TIPO_AFASTAMENTO[v.tipo || g.antes?.tipo] || 'afastamento').toLowerCase()
      if (g.acao === 'criou') return `${quem} registrou ${t} de ${pessoa}`
      if (g.depois?.cancelado_em) return `${quem} cancelou o afastamento (${t}) de ${pessoa}`
      return `${quem} ${verbo} um afastamento de ${pessoa}`
    }
    case 'banco_horas_lancamentos':
      return `${quem} lançou ${valorDoCampo(g.tabela, 'minutos', v.minutos, mapas)} (${(ROTULO_LANCAMENTO[v.tipo] || 'lançamento').toLowerCase()}) no banco de horas de ${pessoa}`
    case 'escala_dias': {
      const n = g.itens?.length || 1
      if (n > 1) return `${quem} mudou ${n} dias da escala de ${pessoa}`
      const dia = valorDoCampo(g.tabela, 'data', v.data, mapas)
      if (g.acao === 'excluiu') return `${quem} deixou ${dia} como folga na escala de ${pessoa}`
      return `${quem} colocou ${mapas.turnos[g.depois?.turno_id] || 'um turno'} em ${dia} na escala de ${pessoa}`
    }
    case 'modelos_jornada_dias':
      return `${quem} alterou os horários da jornada ${mapas.jornadas[g.registro_id] || ''}`.trim()
    case 'modelos_jornada': return `${quem} ${verbo} a jornada ${v.nome || mapas.jornadas[g.registro_id] || ''}`.trim()
    case 'departamentos': return `${quem} ${verbo} o departamento ${v.nome || mapas.departamentos[g.registro_id] || ''}`.trim()
    case 'cargos': return `${quem} ${verbo} o cargo ${v.nome || mapas.cargos[g.registro_id] || ''}`.trim()
    case 'feriados': return `${quem} ${verbo} o feriado ${v.nome || ''}`.trim()
    case 'turnos': return `${quem} ${verbo} o turno ${v.nome || mapas.turnos[g.registro_id] || ''}`.trim()
    case 'filiais': return `${quem} ${verbo} a unidade ${v.nome || mapas.unidades[g.registro_id] || ''}`.trim()
    case 'empresas': return `${quem} alterou os dados da empresa`
    case 'departamento_gestores': {
      const dep = mapas.departamentos[v.departamento_id] || 'um departamento'
      return g.acao === 'criou' ? `${quem} colocou ${pessoa} como gestor(a) de ${dep}` : `${quem} tirou ${pessoa} da gestão de ${dep}`
    }
    case 'rostos_referencia':
      if (g.acao === 'criou') return `${quem} enviou a foto de cadastro do rosto`
      if (g.depois?.status === 'aprovada') return `${quem} aprovou a foto de rosto de ${pessoa}`
      if (g.depois?.status === 'recusada') return `${quem} recusou a foto de rosto de ${pessoa}`
      return `${quem} atualizou a foto de rosto de ${pessoa}`
    case 'verificacoes_faciais':
      return `${quem} conferiu uma marcação com reconhecimento facial de ${pessoa}`
    default:
      return `${quem} ${verbo} um registro`
  }
}

// Ícone/tom da ação
export const TOM_ACAO = { criou: 'ok', alterou: 'info', excluiu: 'problema' }
export const ROTULO_ACAO = { criou: 'Criou', alterou: 'Alterou', excluiu: 'Excluiu' }
