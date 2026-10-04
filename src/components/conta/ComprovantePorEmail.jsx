import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../contexts/AuthContext'
import { useAvisos } from '../../contexts/AvisosContext'
import { traduzirErro } from '../../lib/mensagensErro'
import Alerta from '../ui/Alerta'

// Fase 5C: a pessoa escolhe se recebe o comprovante de cada marcação por e-mail.
// Sem linha na tabela = ligado. Se a Fase 5C não estiver no banco, o cartão não aparece.
export default function ComprovantePorEmail({ email }) {
  const { perfil } = useAuth()
  const avisar = useAvisos()
  const [ligado, setLigado] = useState(null) // null = carregando ou indisponível
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => {
    let cancelado = false
    supabase.from('preferencias_email').select('comprovante_ponto').eq('perfil_id', perfil.id).maybeSingle()
      .then(({ data, error }) => {
        if (cancelado) return
        setLigado(error ? null : (data ? data.comprovante_ponto : true))
      })
    return () => { cancelado = true }
  }, [perfil.id])

  if (ligado === null) return null

  async function mudar(e) {
    const novo = e.target.checked
    setErro('')
    setSalvando(true)
    setLigado(novo)
    const { error } = await supabase.from('preferencias_email')
      .upsert({ perfil_id: perfil.id, comprovante_ponto: novo }, { onConflict: 'perfil_id' })
    setSalvando(false)
    if (error) { setLigado(!novo); setErro(traduzirErro(error)); return }
    avisar(novo ? 'Você vai receber o comprovante por e-mail.' : 'Comprovante por e-mail desligado.')
  }

  return (
    <section className="cartao" aria-labelledby="t-comprovante-email">
      <div className="cartao__cabecalho"><h2 id="t-comprovante-email">Comprovante por e-mail</h2></div>
      <label className="opcao" style={{ alignItems: 'center' }}>
        <input type="checkbox" checked={ligado} onChange={mudar} disabled={salvando} aria-describedby="d-comprovante-email" />
        <span>
          <span className="opcao__titulo">Receber o comprovante de cada marcação</span><br />
          <span className="opcao__desc" id="d-comprovante-email">
            O PDF assinado vai para <strong>{email || 'o seu e-mail de login'}</strong> logo depois de cada marcação.
          </span>
        </span>
      </label>
      {erro && <Alerta tom="problema">{erro}</Alerta>}
      <p className="suave pequeno" style={{ marginBottom: 0 }}>
        Desligado, o comprovante continua na tela e no Meu histórico.
      </p>
    </section>
  )
}
