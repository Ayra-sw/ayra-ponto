// Fechamento do mês (Fase 7B): meses, textos e a planilha do contador.
// A planilha é montada com a "foto" guardada no fechamento: mudar uma
// jornada ou uma regra depois não muda o que foi entregue ao contador.
import { dataHora, formatarCpf, duracao } from './formatos'
import { diaCurto, horaNoFuso, situacaoDoDia } from './apuracao'
import { rotuloMarcacao } from './marcacoes'
import { normalizarRegras } from './regrasCalculo'
import { gerarXlsx } from './xlsx'

const pad = (n) => String(n).padStart(2, '0')

// O mês que normalmente se fecha: o anterior ao de hoje
export function mesAnterior(hoje = new Date()) {
  const d = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1)
  return { ano: d.getFullYear(), mes: d.getMonth() }
}

// { ano: 2026, mes: 8 } → "2026-09-01" (como o banco guarda a competência)
export const competenciaIso = ({ ano, mes }) => `${ano}-${pad(mes + 1)}-01`

// "2026-09-01" → { ano: 2026, mes: 8 }
export function lerCompetencia(iso) {
  const m = /^(\d{4})-(\d{2})/.exec(iso || '')
  return m ? { ano: Number(m[1]), mes: Number(m[2]) - 1 } : null
}

// Saldo com sinal, no formato da planilha: "+3:15", "-0:40", "0:00"
export function saldoPlanilha(minutos) {
  const m = Math.round(Number(minutos) || 0)
  const abs = Math.abs(m)
  const t = `${Math.floor(abs / 60)}:${pad(abs % 60)}`
  return m > 0 ? `+${t}` : m < 0 ? `-${t}` : '0:00'
}

const horasDecimais = (m) => Math.round(((Number(m) || 0) / 60) * 100) / 100

// "Rita RH" → "rita-rh" (para o nome do arquivo)
export function semAcento(texto) {
  return String(texto || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40)
}

export function nomeDoArquivo(empresa, competencia) {
  const c = lerCompetencia(competencia)
  const nome = semAcento(empresa?.nome || empresa?.razao_social) || 'empresa'
  return `ayra-fechamento-${c.ano}-${pad(c.mes + 1)}-${nome}.xlsx`
}

// Totais de uma foto, com as horas noturnas já como a folha usa
export function totaisDaFoto(t, regras) {
  const r = normalizarRegras(regras)
  const n = (k) => Number(t?.[k]) || 0
  return {
    previsto: n('previsto'), trabalhado: n('trabalhado'), atraso: n('atraso'), falta: n('falta'), abonado: n('abonado'),
    extra: n('extra'), extraNormal: n('extra_normal'), extraEspecial: n('extra_especial'),
    noturno: r.hora_noturna_reduzida ? n('noturno_reduzido') : n('noturno'), noturnoRelogio: n('noturno'),
    intervaloPagar: n('intervalo_pagar'), descansoPagar: n('descanso_pagar'), dsrPerdidos: n('dsr_perdidos'),
    saldo: n('saldo'), diasTrabalhados: n('dias_trabalhados'), diasFalta: n('dias_falta'),
    diasIncompletos: n('dias_incompletos'), diasAlerta: n('dias_alerta'), banco: Boolean(t?.banco),
  }
}

function marcacoesDoDia(linha, fuso) {
  return (linha.marcacoes || []).map((m) => `${horaNoFuso(m.em, fuso)} ${rotuloMarcacao(m.tipo).toLowerCase()}`).join(' · ')
}

function rotuloDaSituacao(linha) {
  try { return situacaoDoDia(linha).rotulo } catch { return linha.situacao || '' }
}

const sn = (v) => (v ? 'Sim' : 'Não')

// Monta as abas da planilha a partir do que planilha_fechamento() devolve
export function abasDaPlanilha(dados, { geradoEm = new Date() } = {}) {
  const r = normalizarRegras(dados.fechamento?.regras)
  const pctN = `${r.extra_normal_pct}%`
  const pctE = `${r.extra_especial_pct}%`
  const noturnoTitulo = r.hora_noturna_reduzida ? 'Horas noturnas (hora reduzida)' : 'Horas noturnas'
  const espelhos = dados.espelhos || []

  const resumo = {
    nome: 'Resumo',
    congelarColunas: 1,
    colunas: [
      { titulo: 'Nome', largura: 30 },
      { titulo: 'CPF', largura: 15 },
      { titulo: 'Matrícula', largura: 11 },
      { titulo: 'Unidade', largura: 18 },
      { titulo: 'Departamento', largura: 18 },
      { titulo: 'Cargo', largura: 18 },
      { titulo: 'Jornada', largura: 20 },
      { titulo: 'Dias trabalhados', largura: 11, tipo: 'inteiro' },
      { titulo: 'Faltas (dias)', largura: 9, tipo: 'inteiro' },
      { titulo: 'Horas previstas', largura: 11, tipo: 'duracao' },
      { titulo: 'Horas trabalhadas', largura: 11, tipo: 'duracao' },
      { titulo: 'Atrasos e saídas antes', largura: 12, tipo: 'duracao' },
      { titulo: 'Faltas (horas)', largura: 10, tipo: 'duracao' },
      { titulo: 'Abonos', largura: 10, tipo: 'duracao' },
      { titulo: `Extras ${pctN}`, largura: 10, tipo: 'duracao' },
      { titulo: `Extras ${pctE} (domingo, feriado e folga)`, largura: 14, tipo: 'duracao' },
      { titulo: `${noturnoTitulo} · adicional ${r.noturno_pct}%`, largura: 15, tipo: 'duracao' },
      { titulo: 'Intervalo a pagar (art. 71)', largura: 12, tipo: 'duracao' },
      { titulo: 'Descanso entre dias a pagar (art. 66)', largura: 13, tipo: 'duracao' },
      { titulo: 'DSR perdidos', largura: 9, tipo: 'inteiro' },
      { titulo: 'Usa banco de horas', largura: 10 },
      { titulo: 'Saldo do mês', largura: 10, tipo: 'direita' },
      { titulo: 'Dias com aviso', largura: 9, tipo: 'inteiro' },
      { titulo: 'Dias sem saída marcada', largura: 10, tipo: 'inteiro' },
      { titulo: 'Código de integridade', largura: 20 },
    ],
    linhas: espelhos.map((e) => {
      const p = e.pessoa || {}
      const t = totaisDaFoto(e.totais, r)
      return [
        p.nome || '', p.cpf ? formatarCpf(p.cpf) : '', p.matricula || '', p.unidade || '', p.departamento || '', p.cargo || '',
        p.jornada || (p.tipo_escala && p.tipo_escala !== 'semanal' ? 'Escala' : ''),
        t.diasTrabalhados, t.diasFalta, t.previsto, t.trabalhado, t.atraso, t.falta, t.abonado,
        t.extraNormal, t.extraEspecial, t.noturno, t.intervaloPagar, t.descansoPagar, t.dsrPerdidos,
        sn(t.banco), saldoPlanilha(t.saldo), t.diasAlerta, t.diasIncompletos, e.hash || '',
      ]
    }),
  }

  const decimais = {
    nome: 'Horas decimais',
    congelarColunas: 1,
    colunas: [
      { titulo: 'Nome', largura: 30 },
      { titulo: 'CPF', largura: 15 },
      { titulo: 'Matrícula', largura: 11 },
      { titulo: 'Horas previstas', largura: 11, tipo: 'decimal' },
      { titulo: 'Horas trabalhadas', largura: 11, tipo: 'decimal' },
      { titulo: 'Atrasos e saídas antes', largura: 12, tipo: 'decimal' },
      { titulo: 'Faltas (horas)', largura: 10, tipo: 'decimal' },
      { titulo: 'Abonos', largura: 10, tipo: 'decimal' },
      { titulo: `Extras ${pctN}`, largura: 10, tipo: 'decimal' },
      { titulo: `Extras ${pctE}`, largura: 10, tipo: 'decimal' },
      { titulo: `${noturnoTitulo}`, largura: 13, tipo: 'decimal' },
      { titulo: 'Intervalo a pagar', largura: 11, tipo: 'decimal' },
      { titulo: 'Descanso entre dias a pagar', largura: 12, tipo: 'decimal' },
      { titulo: 'Saldo do mês', largura: 10, tipo: 'decimal' },
    ],
    linhas: espelhos.map((e) => {
      const p = e.pessoa || {}
      const t = totaisDaFoto(e.totais, r)
      return [
        p.nome || '', p.cpf ? formatarCpf(p.cpf) : '', p.matricula || '',
        ...[t.previsto, t.trabalhado, t.atraso, t.falta, t.abonado, t.extraNormal, t.extraEspecial, t.noturno, t.intervaloPagar, t.descansoPagar, t.saldo].map(horasDecimais),
      ]
    }),
  }

  const diaADia = {
    nome: 'Dia a dia',
    congelarColunas: 1,
    colunas: [
      { titulo: 'Nome', largura: 26 },
      { titulo: 'Matrícula', largura: 10 },
      { titulo: 'Data', largura: 11, tipo: 'data' },
      { titulo: 'Dia', largura: 11 },
      { titulo: 'Situação', largura: 18 },
      { titulo: 'Marcações', largura: 46 },
      { titulo: 'Previsto', largura: 9, tipo: 'duracao' },
      { titulo: 'Trabalhado', largura: 10, tipo: 'duracao' },
      { titulo: 'Atraso', largura: 8, tipo: 'duracao' },
      { titulo: 'Falta', largura: 8, tipo: 'duracao' },
      { titulo: `Extra ${pctN}`, largura: 9, tipo: 'duracao' },
      { titulo: `Extra ${pctE}`, largura: 9, tipo: 'duracao' },
      { titulo: 'Noturno', largura: 9, tipo: 'duracao' },
      { titulo: 'Intervalo a pagar', largura: 10, tipo: 'duracao' },
      { titulo: 'Descanso a pagar', largura: 10, tipo: 'duracao' },
      { titulo: 'Saldo', largura: 8, tipo: 'direita' },
      { titulo: 'DSR perdido', largura: 8 },
      { titulo: 'Avisos', largura: 50 },
    ],
    linhas: espelhos.flatMap((e) => {
      const p = e.pessoa || {}
      return (e.linhas || []).filter((l) => l.situacao !== 'futuro').map((l) => [
        p.nome || '', p.matricula || '', l.data, diaCurto(l.data).split(' ')[0], rotuloDaSituacao(l), marcacoesDoDia(l, p.fuso),
        l.previsto_min || null, l.trabalhado_min || null, l.atraso_min || null, l.falta_min || null,
        l.extra_normal_min || null, l.extra_especial_min || null,
        (r.hora_noturna_reduzida ? l.noturno_reduzido_min : l.noturno_min) || null,
        l.intervalo_a_pagar_min || null, l.interjornada_a_pagar_min || null,
        l.situacao === 'incompleto' ? '?' : (l.saldo_min ? saldoPlanilha(l.saldo_min) : ''),
        l.dsr_perdido ? 'Sim' : '', (l.alertas || []).join(' · '),
      ])
    }),
  }

  const f = dados.fechamento || {}
  const emp = dados.empresa || {}
  const nomeMes = dados.nome || ''
  const negrito = (v) => ({ v, negrito: true })
  const sobre = {
    nome: 'Sobre',
    larguraA: 38,
    larguraB: 70,
    titulo: [`Fechamento de ${nomeMes}`, emp.razao_social || emp.nome || ''],
    linhas: [
      [negrito('Empresa'), emp.razao_social || emp.nome || ''],
      [negrito('CNPJ'), emp.cnpj || ''],
      [negrito('Mês'), nomeMes],
      [negrito('Fechado em'), f.fechado_em ? dataHora(f.fechado_em) : ''],
      [negrito('Fechado por'), f.fechado_por_nome || ''],
      [negrito('Pessoas no fechamento'), String(espelhos.length)],
      [negrito('Pendências no momento do fechamento'), String(f.pendencias ?? 0)],
      [''],
      [negrito('Regras de cálculo usadas'), ''],
      ['Hora extra em dias normais', pctN],
      ['Hora extra em domingo de descanso, feriado e folga', r.extra_especial_folgas ? pctE : `Não usado (todas com ${pctN})`],
      ['Horário noturno', `${r.noturno_inicio} às ${r.noturno_fim}, adicional de ${r.noturno_pct}%`],
      ['Hora noturna reduzida (52min30s)', sn(r.hora_noturna_reduzida)],
      ['Noturno continua depois das 5h (Súmula 60)', sn(r.prorrogar_noturno)],
      ['Intervalo pré-assinalado', sn(r.intervalo_pre_assinalado)],
      ['Descanso mínimo entre um dia e outro', duracao(r.interjornada_min)],
      ['Perde o DSR por falta sem justificativa', sn(r.dsr_perde_falta)],
      ['Perde o DSR por atraso', sn(r.dsr_perde_atraso)],
      ['Limite de horas por semana', duracao(r.limite_semanal_min)],
      [''],
      [negrito('Como ler esta planilha'), ''],
      ['Resumo', 'Uma linha por pessoa, com os totais do mês. Horas no formato horas:minutos (12:30 = doze horas e meia).'],
      ['Horas decimais', 'Os mesmos totais em horas decimais (12,50 = doze horas e meia), para sistemas de folha que pedem assim.'],
      ['Dia a dia', 'Cada dia de cada pessoa, com as marcações no horário da unidade.'],
      ['Saldo do mês', 'Extras menos atrasos e faltas. Com banco de horas, o saldo vai para o banco em vez de ser pago ou descontado.'],
      ['Código de integridade', 'Calculado no fechamento sobre o espelho de cada pessoa. Se o mês for reaberto e fechado de novo, o código muda.'],
      [''],
      ['Gerado pelo Ayra Ponto', dataHora(geradoEm)],
    ],
  }

  return [resumo, decimais, diaADia, sobre]
}

export function gerarPlanilhaFechamento(dados, opcoes) {
  return gerarXlsx(abasDaPlanilha(dados, opcoes), { autor: 'Ayra Ponto' })
}
