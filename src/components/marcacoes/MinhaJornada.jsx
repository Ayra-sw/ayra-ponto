import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../contexts/AuthContext'
import { horaCurta, resumoHorarios, textoIntervalo } from '../../lib/jornadas'

// A jornada (ou escala) da pessoa logada, numa linha, com os nomes do Ayra.
// Ex.: "Comercial 40h · Seg a Sex 08:00–17:00 · Intervalo 12:00–13:00"
export default function MinhaJornada() {
  const { perfil } = useAuth()
  const [texto, setTexto] = useState(null)
  const tipo = perfil?.tipo_escala || 'semanal'

  useEffect(() => {
    let cancelado = false
    async function carregar() {
      if (tipo === 'horista') return { titulo: 'Horista', detalhe: 'Sem horário fixo' }
      if (tipo === 'calendario') return { titulo: 'Escala por calendário', detalhe: 'Seus turnos estão em Espelho › Minha escala' }
      if (tipo === '12x36') {
        const t = perfil.escala_turno_id
          ? await supabase.from('turnos').select('nome, entrada, saida').eq('id', perfil.escala_turno_id).maybeSingle()
          : { data: null }
        return { titulo: 'Escala 12x36', detalhe: t.data ? `${t.data.nome} ${horaCurta(t.data.entrada)}–${horaCurta(t.data.saida)}` : '' }
      }
      if (!perfil.modelo_jornada_id) return { titulo: 'Jornada', detalhe: 'Sem jornada definida' }
      const [m, d] = await Promise.all([
        supabase.from('modelos_jornada').select('nome').eq('id', perfil.modelo_jornada_id).maybeSingle(),
        supabase.from('modelos_jornada_dias').select('*').eq('modelo_id', perfil.modelo_jornada_id),
      ])
      const dias = d.data || []
      const partes = dias.length ? [resumoHorarios(dias)] : []
      const intervalo = dias.length ? textoIntervalo(dias) : ''
      if (intervalo && intervalo !== 'Sem intervalo') partes.push(`Intervalo ${intervalo}`)
      return { titulo: m.data?.nome ? `Jornada ${m.data.nome}` : 'Jornada', detalhe: partes.join(' · ') }
    }
    carregar().then((r) => { if (!cancelado) setTexto(r) }).catch(() => {})
    return () => { cancelado = true }
  }, [tipo, perfil?.modelo_jornada_id, perfil?.escala_turno_id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!texto) return null
  return (
    <p className="minha-jornada">
      <strong>{texto.titulo}{texto.detalhe ? ':' : ''}</strong>{texto.detalhe ? ` ${texto.detalhe}` : ''}
    </p>
  )
}
