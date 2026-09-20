import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

export default function Login() {
  const navigate = useNavigate()
  const [modo, setModo] = useState('entrar') // 'entrar' | 'cadastrar'
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [cpf, setCpf] = useState('')
  const [tipo, setTipo] = useState('funcionario')
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [avisoConfirmacao, setAvisoConfirmacao] = useState(false)

  async function handleEntrar(e) {
    e.preventDefault()
    setErro('')
    setCarregando(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha })
    setCarregando(false)
    if (error) {
      setErro('E-mail ou senha incorretos.')
      return
    }
    navigate('/')
  }

  async function handleCadastrar(e) {
    e.preventDefault()
    setErro('')
    setCarregando(true)

    const { error } = await supabase.auth.signUp({
      email,
      password: senha,
      options: {
        data: { nome_completo: nome, cpf, tipo },
      },
    })

    setCarregando(false)

    if (error) {
      setErro(error.message)
      return
    }

    setAvisoConfirmacao(true)
  }

  if (avisoConfirmacao) {
    return (
      <div className="container">
        <div className="card">
          <h2>Quase lá!</h2>
          <p>
            Enviamos um e-mail de confirmação para <strong>{email}</strong>. Clique
            no link do e-mail e depois volte aqui para entrar.
          </p>
          <button className="btn-primary" onClick={() => { setAvisoConfirmacao(false); setModo('entrar') }}>
            Voltar para o login
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="container">
      <div className="card">
        <h1><span className="brand">Ayra</span> Ponto</h1>
        <p style={{ color: 'var(--text-muted)' }}>
          {modo === 'entrar' ? 'Entre com sua conta' : 'Crie sua conta'}
        </p>

        <form onSubmit={modo === 'entrar' ? handleEntrar : handleCadastrar}>
          {modo === 'cadastrar' && (
            <>
              <label htmlFor="nome">Nome completo</label>
              <input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} required />

              <label htmlFor="cpf">CPF</label>
              <input id="cpf" value={cpf} onChange={(e) => setCpf(e.target.value)} placeholder="000.000.000-00" required />

              <label htmlFor="tipo">Você é</label>
              <select id="tipo" value={tipo} onChange={(e) => setTipo(e.target.value)}>
                <option value="administrador">Administrador (vou cadastrar minha empresa)</option>
                <option value="rh">RH</option>
                <option value="funcionario">Funcionário</option>
              </select>
            </>
          )}

          <label htmlFor="email">E-mail</label>
          <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />

          <label htmlFor="senha">Senha</label>
          <input id="senha" type="password" value={senha} onChange={(e) => setSenha(e.target.value)} minLength={6} required />

          {erro && <p className="error-text">{erro}</p>}

          <button className="btn-primary" type="submit" disabled={carregando}>
            {carregando ? 'Um momento…' : modo === 'entrar' ? 'Entrar' : 'Criar conta'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: 16 }}>
          {modo === 'entrar' ? (
            <>Não tem conta? <button className="link-btn" onClick={() => setModo('cadastrar')}>Cadastre-se</button></>
          ) : (
            <>Já tem conta? <button className="link-btn" onClick={() => setModo('entrar')}>Entrar</button></>
          )}
        </p>
      </div>
    </div>
  )
}
