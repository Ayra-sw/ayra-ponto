import { useCallback, useEffect, useState } from 'react'
import { BedDouble, CalendarRange } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { traduzirErro } from '../../lib/mensagensErro'
import { diaIso } from '../../lib/ajustes'
import { diaCurto } from '../../lib/apuracao'
import { somarDias } from '../../lib/escalas'
import Etiqueta from '../ui/Etiqueta'
import { Esqueleto, EstadoErro, EstadoVazio } from '../ui/Estados'

const DIAS_A_FRENTE = 21

// Os próximos dias da escala de quem trabalha em 12x36 ou por calendário.
export default function MinhaEscala({ perfilId }) {
  const [linhas, setLinhas] = useState(null)
  const [erro, setErro] = useState('')

  const carregar = useCallback(async () => {
    setErro('')
    const hoje = diaIso()
    const { data, error } = await supabase.rpc('apurar_periodo', { p_perfil_id: perfilId, p_inicio: hoje, p_fim: somarDias(hoje, DIAS_A_FRENTE - 1) })
    if (error) { setErro(traduzirErro(error)); setLinhas(null) } else setLinhas(data || [])
  }, [perfilId])

  useEffect(() => { carregar() }, [carregar])

  if (erro) return <EstadoErro aoTentarDeNovo={carregar}>{erro}</EstadoErro>
  if (!linhas) return <Esqueleto linhas={5} blocos={1} />
  const hoje = diaIso()

  if (!linhas.some((l) => l.turno)) {
    return (
      <EstadoVazio icone={CalendarRange} titulo="Nenhum turno nos próximos dias">
        Quando a empresa marcar os seus turnos, eles aparecem aqui.
      </EstadoVazio>
    )
  }

  return (
    <div className="pilha">
      <p className="suave pequeno" style={{ margin: 0 }}>Seus turnos e folgas nos próximos {DIAS_A_FRENTE} dias.</p>
      <div className="lista-cartoes">
        {linhas.map((l) => {
          const folga = !l.turno
          return (
            <div key={l.data} className={`cartao-linha ${folga ? 'linha-suave' : ''}`}>
              <div className="cartao-linha__topo">
                <span className="cartao-linha__titulo">{l.data === hoje ? `Hoje · ${diaCurto(l.data)}` : diaCurto(l.data)}</span>
                {folga
                  ? <Etiqueta tom="neutra" icone={BedDouble}>Folga</Etiqueta>
                  : <Etiqueta tom="info">{l.turno}</Etiqueta>}
              </div>
              {l.situacao === 'afastado' && <span className="pequeno suave">Afastamento registrado</span>}
              {l.situacao === 'feriado' && <span className="pequeno suave">Feriado{l.feriado_nome ? `: ${l.feriado_nome}` : ''}</span>}
            </div>
          )
        })}
      </div>
    </div>
  )
}
