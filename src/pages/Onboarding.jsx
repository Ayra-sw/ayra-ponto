import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../contexts/AuthContext'

// Mostrada logo após o cadastro/primeiro login, quando o usuário ainda não
// está vinculado a nenhuma empresa (perfil.empresa_id é nulo).
export default function Onboarding() {
  const { perfil, recarregarPerfil } = useAuth()
  const navigate = useNavigate()
  const [nomeEmpresa, setNomeEmpresa] = useState('')
  const [cnpj, setCnpj] = useState('')
  const [codigo, setCodigo] = useState('')
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(false)

  const ehAdministrador = perfil?.tipo === 'administrador'

  async function handleCriarEmpresa(e) {
    e.preventDefault()
    setErro('')
    setCarregando(true)
    const { error } = await supabase.rpc('criar_empresa', { p_nome: nomeEmpresa, p_cnpj: cnpj || null })
    setCarregando(false)
    if (error) {
      setErro(error.message)
      return
    }
    await recarregarPerfil()
    navigate('/')
  }

  async function handleEntrarComCodigo(e) {
    e.preventDefault()
    setErro('')
    setCarregando(true)
    const { error } = await supabase.rpc('entrar_por_codigo', { p_codigo: codigo.trim() })
    setCarregando(false)
    if (error) {
      setErro('Código de convite inválido. Confira com o administrador da sua empresa.')
      return
    }
    await recarregarPerfil()
    navigate('/')
  }

  return (
    <div className="container">
      <div className="card">
        {ehAdministrador ? (
          <>
            <h2>Cadastre sua empresa</h2>
            <p style={{ color: 'var(--text-muted)' }}>
              Você vai ser o administrador dela. Depois de criada, um código de
              convite aparece pra você compartilhar com seu RH e colaboradores.
            </p>
            <form onSubmit={handleCriarEmpresa}>
              <label htmlFor="nomeEmpresa">Nome da empresa</label>
              <input id="nomeEmpresa" value={nomeEmpresa} onChange={(e) => setNomeEmpresa(e.target.value)} required />

              <label htmlFor="cnpj">CNPJ (opcional por agora)</label>
              <input id="cnpj" value={cnpj} onChange={(e) => setCnpj(e.target.value)} placeholder="00.000.000/0000-00" />

              {erro && <p className="error-text">{erro}</p>}

              <button className="btn-primary" type="submit" disabled={carregando}>
                {carregando ? 'Um momento…' : 'Criar empresa'}
              </button>
            </form>
          </>
        ) : (
          <>
            <h2>Entre na sua empresa</h2>
            <p style={{ color: 'var(--text-muted)' }}>
              Peça o código de convite para o administrador ou RH da sua empresa.
            </p>
            <form onSubmit={handleEntrarComCodigo}>
              <label htmlFor="codigo">Código de convite</label>
              <input id="codigo" value={codigo} onChange={(e) => setCodigo(e.target.value)} required />

              {erro && <p className="error-text">{erro}</p>}

              <button className="btn-primary" type="submit" disabled={carregando}>
                {carregando ? 'Um momento…' : 'Entrar'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
