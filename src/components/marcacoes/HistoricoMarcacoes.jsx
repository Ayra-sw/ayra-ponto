import { useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarX2, ChevronLeft, ChevronRight, MapPin, MapPinOff, Pencil } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { duracao, hora, nsr } from '../../lib/formatos'
import { minutosTrabalhados, rotuloMarcacao } from '../../lib/marcacoes'
import { diaIso } from '../../lib/ajustes'
import Botao from '../ui/Botao'
import Etiqueta from '../ui/Etiqueta'
import { Esqueleto, EstadoErro, EstadoVazio } from '../ui/Estados'
import BotaoComprovantePdf from '../ponto/BotaoComprovantePdf'
import MapaDaMarcacao from '../geo/MapaDaMarcacao'
import { comCoordenadas, formatarDistancia } from '../../lib/geo'

const nomeDoMes = (d) => {
  const t = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  return t.charAt(0).toUpperCase() + t.slice(1)
}

function diaLocal(valor) {
  const d = new Date(valor)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function tituloDoDia(chave) {
  const t = new Date(`${chave}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' })
  return t.charAt(0).toUpperCase() + t.slice(1)
}

// Marcações de uma pessoa, mês a mês e dia a dia. Com "aoPedirAjuste" aparecem
// os botões para pedir correção (só na tela da própria pessoa).
// Com "mostrarLocal" (administrador e RH vendo outra pessoa) aparecem o selo
// "fora do local" e o botão "Ver no mapa".
export default function HistoricoMarcacoes({ perfilId, aoPedirAjuste, atualizarEm, mostrarLocal = false }) {
  const [mes, setMes] = useState(() => { const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d })
  const [registros, setRegistros] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(false)
  const [locais, setLocais] = useState({}) // registro_id -> situação do local (Fase 6A)
  const [mapa, setMapa] = useState(null)

  const carregar = useCallback(async () => {
    setErro(false)
    setCarregando(true)
    const proximo = new Date(mes)
    proximo.setMonth(proximo.getMonth() + 1)
    const { data, error } = await supabase
      .from('registros_ponto')
      .select(mostrarLocal ? 'id, nsr, tipo, marcado_em, origem, latitude, longitude' : 'id, nsr, tipo, marcado_em, origem')
      .eq('perfil_id', perfilId)
      .gte('marcado_em', mes.toISOString())
      .lt('marcado_em', proximo.toISOString())
      .order('marcado_em', { ascending: true })
      .limit(1500)
    if (error) setErro(true)
    setRegistros(data || [])
    if (mostrarLocal) {
      // sem a Fase 6A no banco a tabela não existe: simplesmente não há selos
      const l = await supabase.from('marcacao_local')
        .select('registro_id, situacao, distancia_m, raio_m, filial_latitude, filial_longitude')
        .eq('perfil_id', perfilId)
        .gte('criado_em', mes.toISOString())
        .lt('criado_em', proximo.toISOString())
        .limit(1500)
      setLocais(l.error ? {} : Object.fromEntries((l.data || []).map((x) => [x.registro_id, x])))
    }
    setCarregando(false)
  }, [perfilId, mes, mostrarLocal])

  useEffect(() => { carregar() }, [carregar, atualizarEm])

  const dias = useMemo(() => {
    const grupos = new Map()
    for (const r of registros) {
      const chave = diaLocal(r.marcado_em)
      if (!grupos.has(chave)) grupos.set(chave, [])
      grupos.get(chave).push(r)
    }
    const hoje = diaIso()
    return [...grupos.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([chave, regs]) => {
        const ehHoje = chave === hoje
        const ultimo = regs[regs.length - 1]
        const minutos = minutosTrabalhados(regs, ehHoje ? new Date() : new Date(ultimo.marcado_em))
        return { chave, regs, minutos, ehHoje, incompleto: !ehHoje && ultimo.tipo !== 'saida' }
      })
  }, [registros])

  const mesAtual = mes.getFullYear() === new Date().getFullYear() && mes.getMonth() === new Date().getMonth()
  const mudarMes = (n) => setMes((m) => { const d = new Date(m); d.setMonth(d.getMonth() + n); return d })

  return (
    <div className="pilha">
      <div className="linha linha--espacada">
        <div className="linha">
          <Botao variante="secundario" tamanho="pequeno" className="btn--icone" aria-label="Mês anterior" icone={ChevronLeft} onClick={() => mudarMes(-1)} />
          <strong style={{ minWidth: 150, textAlign: 'center' }} aria-live="polite">{nomeDoMes(mes)}</strong>
          <Botao variante="secundario" tamanho="pequeno" className="btn--icone" aria-label="Próximo mês" icone={ChevronRight} onClick={() => mudarMes(1)} disabled={mesAtual} />
        </div>
        {!mesAtual && <Botao variante="discreto" tamanho="pequeno" onClick={() => { const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); setMes(d) }}>Voltar para este mês</Botao>}
      </div>

      {carregando ? <Esqueleto linhas={5} /> : erro ? <EstadoErro aoTentarDeNovo={carregar} /> : dias.length === 0 ? (
        <EstadoVazio icone={CalendarX2} titulo={`Nenhuma marcação em ${nomeDoMes(mes).toLowerCase()}`}>
          As marcações de ponto aparecem aqui, dia a dia, com o horário e o número de registro (NSR).
        </EstadoVazio>
      ) : (
        dias.map((dia) => (
          <section key={dia.chave} className="cartao cartao--compacto" aria-label={tituloDoDia(dia.chave)}>
            <div className="linha linha--espacada" style={{ marginBottom: 4 }}>
              <div className="linha">
                <h2 style={{ fontSize: '1rem' }}>{tituloDoDia(dia.chave)}</h2>
                {dia.incompleto && <Etiqueta tom="atencao">Falta a saída</Etiqueta>}
                {dia.ehHoje && <Etiqueta tom="info" icone={false}>Hoje</Etiqueta>}
              </div>
              <span className="suave pequeno">
                Trabalhado: <strong className="mono" style={{ color: 'var(--texto)' }}>{duracao(dia.minutos)}</strong>
              </span>
            </div>
            <ul className="linha-tempo">
              {dia.regs.map((r) => (
                <li key={r.id}>
                  <span className="linha-tempo__hora">{hora(r.marcado_em)}</span>
                  <span className="linha-tempo__tipo">
                    {rotuloMarcacao(r.tipo)}
                    {mostrarLocal && locais[r.id]?.situacao === 'fora' && (
                      <Etiqueta tom="atencao" icone={MapPinOff}>Fora do local · {formatarDistancia(locais[r.id].distancia_m)}</Etiqueta>
                    )}
                    {mostrarLocal && locais[r.id]?.situacao === 'sem_localizacao' && (
                      <Etiqueta tom="neutra" icone={MapPinOff}>Sem localização</Etiqueta>
                    )}
                  </span>
                  <span className="linha-tempo__fim">
                    {mostrarLocal && comCoordenadas(r) && (
                      <Botao variante="discreto" className="btn--icone" icone={MapPin} aria-label={`Ver no mapa a marcação das ${hora(r.marcado_em)}`}
                        title="Ver no mapa" onClick={() => setMapa(r)} />
                    )}
                    <span className="linha-tempo__nsr" title="Número de registro">NSR {nsr(r.nsr)}</span>
                    <BotaoComprovantePdf registroId={r.id} nsr={r.nsr} compacto />
                  </span>
                </li>
              ))}
            </ul>
            {aoPedirAjuste && (
              <div className="acoes" style={{ marginTop: 8 }}>
                <Botao variante="secundario" tamanho="pequeno" icone={Pencil} onClick={() => aoPedirAjuste({ data: dia.chave, registros: dia.regs })}>
                  Pedir ajuste deste dia
                </Botao>
              </div>
            )}
          </section>
        ))
      )}
      {mapa && <MapaDaMarcacao registro={mapa} local={locais[mapa.id] || null} aoFechar={() => setMapa(null)} />}
    </div>
  )
}
