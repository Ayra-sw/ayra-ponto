import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../contexts/AuthContext'
import { data, duracao } from '../lib/formatos'
import { cargaSemanal, diasParaFormulario, resumoHorarios, textoIntervalo } from '../lib/jornadas'

// Cartão só de leitura: onde a pessoa trabalha e qual é a sua jornada.
export default function MeuTrabalho() {
  const { perfil } = useAuth()
  const [info, setInfo] = useState(null)

  useEffect(() => {
    let cancelado = false
    async function carregar() {
      const [dep, mod, dias] = await Promise.all([
        perfil.departamento_id ? supabase.from('departamentos').select('nome').eq('id', perfil.departamento_id).maybeSingle() : { data: null },
        perfil.modelo_jornada_id ? supabase.from('modelos_jornada').select('nome, tolerancia_minutos').eq('id', perfil.modelo_jornada_id).maybeSingle() : { data: null },
        perfil.modelo_jornada_id ? supabase.from('modelos_jornada_dias').select('*').eq('modelo_id', perfil.modelo_jornada_id) : { data: [] },
      ])
      if (!cancelado) setInfo({ departamento: dep.data, modelo: mod.data, dias: dias.data || [] })
    }
    carregar()
    return () => { cancelado = true }
  }, [perfil.departamento_id, perfil.modelo_jornada_id])

  if (!info) return null
  const { departamento, modelo, dias } = info

  return (
    <section className="cartao" aria-labelledby="t-trabalho">
      <div className="cartao__cabecalho"><h2 id="t-trabalho">Meu trabalho</h2></div>
      <dl className="lista-definicoes">
        <dt>Cargo</dt><dd>{perfil.cargo || '—'}</dd>
        <dt>Departamento</dt><dd>{departamento?.nome || '—'}</dd>
        {perfil.matricula && (<><dt>Matrícula</dt><dd className="mono">{perfil.matricula}</dd></>)}
        {perfil.data_admissao && (<><dt>Admissão</dt><dd>{data(perfil.data_admissao)}</dd></>)}
        <dt>Jornada</dt>
        <dd>
          {modelo ? (
            <>
              <strong>{modelo.nome}</strong><br />
              <span className="mono">{resumoHorarios(dias)}</span><br />
              <span className="suave">{textoIntervalo(dias) === 'Sem intervalo' ? 'Sem intervalo' : `Intervalo ${textoIntervalo(dias)}`} · {duracao(cargaSemanal(diasParaFormulario(dias)))} por semana · tolerância de {modelo.tolerancia_minutos} min</span>
            </>
          ) : 'Ainda não definida. O RH define a sua jornada.'}
        </dd>
      </dl>
      <p className="suave pequeno" style={{ marginTop: 12 }}>Departamento, cargo e jornada são definidos pelo RH ou pelo administrador.</p>
    </section>
  )
}
