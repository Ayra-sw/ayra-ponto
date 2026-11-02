import { useEffect, useMemo, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../contexts/AuthContext'
import { lerMes, limitesDoMes, nomeDoMes, somarMeses, textoDoMes } from '../../lib/apuracao'
import { diaIso } from '../../lib/ajustes'
import { hhmm } from '../marcacoes/MeusDias'
import Botao from '../ui/Botao'
import Etiqueta from '../ui/Etiqueta'

const MES_CURTO = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const dataCurta = (iso) => `${iso.slice(8, 10)} ${MES_CURTO[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`
const LIMITE_MESES = 24

const SELO = {
  assinado: { texto: 'Assinado', tom: 'ok' },
  pendente: { texto: 'Aguardando sua assinatura', tom: 'atencao' },
  com_problema: { texto: 'Problema apontado', tom: 'problema' },
  aberto: { texto: 'Mês em aberto', tom: 'neutra' },
}

// Soma do mês: horas normais (trabalhadas sem as extras), faltantes e extras
function somar(linhas) {
  const t = { trabalhado: 0, extra: 0, atraso: 0, falta: 0 }
  for (const l of linhas || []) {
    t.trabalhado += l.trabalhado_min || 0
    t.extra += l.extra_min || 0
    t.atraso += l.atraso_min || 0
    t.falta += l.falta_min || 0
  }
  return t
}

// Meu espelho: um mês por linha, do mais recente para o mais antigo.
// A seta abre o mês com todos os dias.
export default function MesesDoEspelho({ perfilId, aoAbrir }) {
  const { perfil } = useAuth()
  const [quantos, setQuantos] = useState(6)
  const [dados, setDados] = useState({}) // "2026-09" -> { normais, faltantes, extras, status }
  const hoje = diaIso()

  // do mês atual para trás, até a admissão (ou o cadastro), no máximo 24 meses
  const todos = useMemo(() => {
    const inicio = (perfil?.data_admissao || perfil?.criado_em || '').slice(0, 7)
    const lista = []
    let m = lerMes(null)
    for (let i = 0; i < LIMITE_MESES; i++) {
      const texto = textoDoMes(m)
      lista.push({ ...m, texto })
      if (inicio && texto <= inicio) break
      m = somarMeses(m, -1)
    }
    return lista
  }, [perfil?.data_admissao, perfil?.criado_em])
  const meses = todos.slice(0, quantos)

  useEffect(() => {
    let cancelado = false
    async function carregar() {
      const [fotos, conf] = await Promise.all([
        supabase.from('fechamento_espelhos').select('competencia, totais').eq('perfil_id', perfilId),
        supabase.rpc('minhas_conferencias'),
      ])
      const fotoPorMes = Object.fromEntries((fotos.data || []).map((f) => [String(f.competencia).slice(0, 7), f.totais]))
      const statusPorMes = Object.fromEntries((Array.isArray(conf.data) ? conf.data : []).map((c) => [String(c.competencia).slice(0, 7), c.status]))
      await Promise.all(meses.filter((m) => !dados[m.texto]).map(async (m) => {
        const { inicio, fim } = limitesDoMes(m.ano, m.mes)
        let t = fotoPorMes[m.texto]
        if (!t) {
          const ate = fim < hoje ? fim : hoje
          const r = await supabase.rpc('apurar_periodo', { p_perfil_id: perfilId, p_inicio: inicio, p_fim: ate })
          t = somar(r.data)
        }
        // mês fechado: assinado, com problema ou aguardando (a lista de assinaturas cobre os últimos 12 meses)
        const recente = m.texto >= textoDoMes(somarMeses(lerMes(null), -12))
        const status = !fotoPorMes[m.texto] ? 'aberto'
          : statusPorMes[m.texto] || (!conf.error && recente ? 'pendente' : null)
        const valores = {
          normais: Math.max((t.trabalhado || 0) - (t.extra || 0), 0),
          faltantes: (t.atraso || 0) + (t.falta || 0),
          extras: t.extra || 0,
          status,
        }
        if (!cancelado) setDados((d) => ({ ...d, [m.texto]: valores }))
      }))
    }
    carregar().catch(() => {})
    return () => { cancelado = true }
  }, [perfilId, quantos]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="pilha">
      <ul className="dias-lista" aria-label="Seus espelhos de ponto, mês a mês">
        {meses.map((m) => {
          const { inicio, fim } = limitesDoMes(m.ano, m.mes)
          const ate = fim < hoje ? fim : hoje
          const v = dados[m.texto]
          const selo = v?.status ? SELO[v.status] : null
          const nome = nomeDoMes(m).replace(/ de \d{4}$/, '')
          return (
            <li key={m.texto}>
              <button type="button" className="dia-linha" onClick={() => aoAbrir(m.texto)}
                aria-label={`${nomeDoMes(m)}${v ? `. Horas normais ${hhmm(v.normais)}, horas faltantes ${hhmm(v.faltantes)}, horas extras ${hhmm(v.extras)}` : ''}${selo ? `. ${selo.texto}` : ''}. Abrir o mês`}>
                <span className="dia-linha__topo">
                  <span>
                    <span className="mes-linha__nome">{nome}</span>
                    <span className="mes-linha__periodo">Período | {dataCurta(inicio)} - {dataCurta(ate)}</span>
                  </span>
                  <ChevronRight className="dia-linha__seta" aria-hidden="true" />
                </span>
                <span className="dia-linha__numeros">
                  <span><span className="dia-linha__rotulo">H. normais</span><span className="dia-linha__valor">{v ? hhmm(v.normais) : '··:··'}</span></span>
                  <span><span className="dia-linha__rotulo">H. faltantes</span><span className="dia-linha__valor">{v ? hhmm(v.faltantes) : '··:··'}</span></span>
                  <span><span className="dia-linha__rotulo">H. extras</span><span className="dia-linha__valor">{v ? hhmm(v.extras) : '··:··'}</span></span>
                </span>
                {selo && <span className="mes-linha__rodape"><Etiqueta tom={selo.tom} icone={false}>{selo.texto}</Etiqueta></span>}
              </button>
            </li>
          )
        })}
      </ul>
      {todos.length > quantos && (
        <div className="acoes" style={{ justifyContent: 'center' }}>
          <Botao variante="secundario" tamanho="pequeno" onClick={() => setQuantos((q) => q + 6)}>Mostrar meses anteriores</Botao>
        </div>
      )}
    </div>
  )
}
