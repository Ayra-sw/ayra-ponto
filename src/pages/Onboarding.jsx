import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../contexts/AuthContext'
import { traduzirErro } from '../lib/mensagensErro'

// Mostrada logo após o cadastro/primeiro login, quando o usuário ainda não
// está vinculado a nenhuma empresa (perfil.empresa_id é nulo).
//
// São dois caminhos: cadastrar a própria empresa (vira administrador) ou
// entrar numa empresa com o código de convite (entra como colaborador).
// O banco é quem garante essas regras; aqui a tela só abre no caminho que a
// pessoa escolheu no cadastro, e deixa trocar se ela tiver se enganado.
export default function Onboarding() {
  const { session, recarregarPerfil, signOut } = useAuth()
  const navigate = useNavigate()
  const intencao = session?.user?.user_metadata?.intencao
  const [caminho, setCaminho] = useState(intencao === 'criar_empresa' ? 'criar_empresa' : 'convite')
  const [nomeEmpresa, setNomeEmpresa] = useState('')
  const [cnpj, setCnpj] = useState('')
  const [codigo, setCodigo] = useState('')
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(false)

  function trocarCaminho(novo) {
    setErro('')
    setCaminho(novo)
  }

  async function handleCriarEmpresa(e) {
    e.preventDefault()
    setErro('')
    setCarregando(true)
    const { error } = await supabase.rpc('criar_empresa', { p_nome: nomeEmpresa, p_cnpj: cnpj || null })
    setCarregando(false)
    if (error) {
      setErro(traduzirErro(error))
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
      const mensagem = /convite inválido/i.test(error.message || '')
        ? 'Código de convite inválido. Confira com o administrador ou o RH da sua empresa.'
        : traduzirErro(error)
      setErro(mensagem)
      return
    }
    await recarregarPerfil()
    navigate('/')
  }

  return (
    <div className="container">
      <div className="card">
        {caminho === 'criar_empresa' ? (
          <>
            <h2>Cadastre sua empresa</h2>
            <p style={{ color: 'var(--text-muted)' }}>
              Você vai ser o administrador dela. Depois de criada, um código de
              convite aparece para você compartilhar com seu RH e colaboradores.
            </p>
            <form onSubmit={handleCriarEmpresa}>
              <label htmlFor="nomeEmpresa">Nome da empresa</label>
              <input id="nomeEmpresa" value={nomeEmpresa} onChange={(e) => setNomeEmpresa(e.target.value)} required />

              <label htmlFor="cnpj">CNPJ (opcional por agora)</label>
              <input id="cnpj" value={cnpj} onChange={(e) => setCnpj(e.target.value)} placeholder="00.000.000/0000-00" />

              {erro && <p className="error-text" role="alert">{erro}</p>}

              <button className="btn-primary" type="submit" disabled={carregando}>
                {carregando ? 'Um momento…' : 'Criar empresa'}
              </button>
            </form>
            <p style={{ textAlign: 'center', marginTop: 16 }}>
              Recebeu um convite?{' '}
              <button type="button" className="link-btn" onClick={() => trocarCaminho('convite')}>Usar código de convite</button>
            </p>
          </>
        ) : (
          <>
            <h2>Entre na sua empresa</h2>
            <p style={{ color: 'var(--text-muted)' }}>
              Digite o código de convite que o administrador ou o RH da sua
              empresa enviou. Você entra como colaborador.
            </p>
            <form onSubmit={handleEntrarComCodigo}>
              <label htmlFor="codigo">Código de convite</label>
              <input
                id="codigo"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                required
              />

              {erro && <p className="error-text" role="alert">{erro}</p>}

              <button className="btn-primary" type="submit" disabled={carregando}>
                {carregando ? 'Um momento…' : 'Entrar na empresa'}
              </button>
            </form>
            <p style={{ textAlign: 'center', marginTop: 16 }}>
              Vai cadastrar a sua própria empresa?{' '}
              <button type="button" className="link-btn" onClick={() => trocarCaminho('criar_empresa')}>Cadastrar empresa</button>
            </p>
          </>
        )}
        <p style={{ textAlign: 'center', marginTop: 8 }}>
          <button type="button" className="link-btn link-btn--discreto" onClick={signOut}>Sair</button>
        </p>
      </div>
    </div>
  )
}
