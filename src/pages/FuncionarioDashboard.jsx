import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../contexts/AuthContext'
import TopBar from '../components/TopBar'

const TIPOS_MARCACAO = [
  { valor: 'entrada', rotulo: 'Entrada' },
  { valor: 'inicio_intervalo', rotulo: 'Início do intervalo' },
  { valor: 'fim_intervalo', rotulo: 'Fim do intervalo' },
  { valor: 'saida', rotulo: 'Saída' },
]

export default function FuncionarioDashboard() {
  const { perfil } = useAuth()
  const [horaAtual, setHoraAtual] = useState(new Date())
  const [registros, setRegistros] = useState([])
  const [carregando, setCarregando] = useState(false)
  const [mensagem, setMensagem] = useState('')

  useEffect(() => {
    const t = setInterval(() => setHoraAtual(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  async function carregarRegistrosDeHoje() {
    const inicioDoDia = new Date()
    inicioDoDia.setHours(0, 0, 0, 0)

    const { data, error } = await supabase
      .from('registros_ponto')
      .select('*')
      .eq('perfil_id', perfil.id)
      .gte('marcado_em', inicioDoDia.toISOString())
      .order('marcado_em', { ascending: true })

    if (!error) setRegistros(data)
  }

  useEffect(() => {
    if (perfil) carregarRegistrosDeHoje()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perfil])

  async function marcarPonto(tipo) {
    setMensagem('')
    setCarregando(true)

    if (!perfil.filial_id) {
      setMensagem('Você ainda não está vinculado a uma filial. Peça pro seu administrador/RH te vincular.')
      setCarregando(false)
      return
    }

    let coords = {}
    try {
      const pos = await new Promise((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 })
      )
      coords = { p_latitude: pos.coords.latitude, p_longitude: pos.coords.longitude }
    } catch {
      // geolocalização opcional — segue sem coordenadas se não tiver permissão
    }

    const { error } = await supabase.rpc('registrar_ponto', {
      p_filial_id: perfil.filial_id,
      p_perfil_id: perfil.id,
      p_tipo: tipo,
      p_origem: 'web',
      ...coords,
    })

    setCarregando(false)

    if (error) {
      setMensagem('Não deu pra registrar: ' + error.message)
      return
    }

    setMensagem('Ponto registrado!')
    carregarRegistrosDeHoje()
  }

  return (
    <>
      <TopBar />
      <div className="container">
        <div className="card">
          <div className="ponto-relogio">{horaAtual.toLocaleTimeString('pt-BR')}</div>
          <div className="ponto-data">
            {horaAtual.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {TIPOS_MARCACAO.map((t) => (
              <button
                key={t.valor}
                className="btn-accent"
                disabled={carregando}
                onClick={() => marcarPonto(t.valor)}
              >
                {t.rotulo}
              </button>
            ))}
          </div>

          {mensagem && <p style={{ marginTop: 16, textAlign: 'center' }}>{mensagem}</p>}
        </div>

        <div className="card" style={{ marginTop: 16 }}>
          <h3>Marcações de hoje</h3>
          {registros.length === 0 ? (
            <p style={{ color: 'var(--text-muted)' }}>Nenhuma marcação ainda hoje.</p>
          ) : (
            <table>
              <tbody>
                {registros.map((r) => (
                  <tr key={r.id}>
                    <td>{TIPOS_MARCACAO.find((t) => t.valor === r.tipo)?.rotulo ?? r.tipo}</td>
                    <td>{new Date(r.marcado_em).toLocaleTimeString('pt-BR')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  )
}
