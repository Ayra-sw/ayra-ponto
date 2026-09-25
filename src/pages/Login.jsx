import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { traduzirErro } from '../lib/mensagensErro'

// Dois caminhos de cadastro separados. O papel de cada pessoa NUNCA vem daqui:
// o banco cria todo cadastro como colaborador, e só vira administrador quem
// cadastra a própria empresa. A "intenção" só decide qual tela aparece depois.
const CADASTROS = {
  criar_empresa: {
    titulo: 'Criar conta da minha empresa',
    subtitulo: 'Você será o administrador. Depois de confirmar o e-mail, é só cadastrar a empresa.',
  },
  convite: {
    titulo: 'Recebi um convite',
    subtitulo: 'Crie sua conta. Depois de confirmar o e-mail, digite o código de convite que a sua empresa enviou.',
  },
}

export default function Login() {
  const navigate = useNavigate()
  const [modo, setModo] = useState('entrar') // 'entrar' | 'criar_empresa' | 'convite' | 'recuperar'
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [cpf, setCpf] = useState('')
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [avisoConfirmacao, setAvisoConfirmacao] = useState(false)
  const [mostrarSenha, setMostrarSenha] = useState(false)
  const [avisoRecuperacao, setAvisoRecuperacao] = useState(false)

  async function handleEntrar(e) {
    e.preventDefault()
    setErro('')
    setCarregando(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha })
    setCarregando(false)
    if (error) {
      setErro(traduzirErro(error))
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
        data: { nome_completo: nome, cpf, intencao: modo },
      },
    })

    setCarregando(false)

    if (error) {
      setErro(traduzirErro(error))
      return
    }

    setAvisoConfirmacao(true)
  }

  async function handleRecuperar(e) {
    e.preventDefault()
    setErro('')
    setCarregando(true)

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/redefinir-senha`,
    })

    setCarregando(false)

    if (error) {
      setErro(traduzirErro(error))
      return
    }

    setAvisoRecuperacao(true)
  }

  if (avisoRecuperacao) {
    return (
      <div className="container">
        <div className="card">
          <h2>Verifique seu e-mail</h2>
          <p>
            Se <strong>{email}</strong> estiver cadastrado, você vai receber um
            link para escolher uma nova senha. Confira também a caixa de spam.
          </p>
          <button
            className="btn-primary"
            onClick={() => { setAvisoRecuperacao(false); setModo('entrar') }}
          >
            Voltar para o login
          </button>
        </div>
      </div>
    )
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

  if (modo === 'recuperar') {
    return (
      <div className="container">
        <div className="card">
          <h1><span className="brand">Ayra</span> Ponto</h1>
          <p style={{ color: 'var(--text-muted)' }}>
            Esqueceu sua senha? Informe seu e-mail e enviamos um link para você
            escolher uma nova.
          </p>

          <form onSubmit={handleRecuperar}>
            <label htmlFor="email-recuperar">E-mail</label>
            <input
              id="email-recuperar"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            {erro && <p className="error-text" role="alert">{erro}</p>}

            <button className="btn-primary" type="submit" disabled={carregando}>
              {carregando ? 'Enviando…' : 'Enviar link de recuperação'}
            </button>
          </form>

          <p style={{ textAlign: 'center', marginTop: 16 }}>
            <button type="button" className="link-btn" onClick={() => { setErro(''); setModo('entrar') }}>
              Voltar para o login
            </button>
          </p>
        </div>
      </div>
    )
  }

  const cadastro = CADASTROS[modo]

  function irPara(novoModo) {
    setErro('')
    setModo(novoModo)
  }

  return (
    <div className="container">
      <div className="card">
        <h1><span className="brand">Ayra</span> Ponto</h1>
        {cadastro ? (
          <>
            <h2 style={{ marginBottom: 4 }}>{cadastro.titulo}</h2>
            <p style={{ color: 'var(--text-muted)', marginTop: 0 }}>{cadastro.subtitulo}</p>
          </>
        ) : (
          <p style={{ color: 'var(--text-muted)' }}>Entre com sua conta</p>
        )}

        <form onSubmit={cadastro ? handleCadastrar : handleEntrar}>
          {cadastro && (
            <>
              <label htmlFor="nome">Nome completo</label>
              <input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} autoComplete="name" required />

              <label htmlFor="cpf">CPF</label>
              <input id="cpf" value={cpf} onChange={(e) => setCpf(e.target.value)} placeholder="000.000.000-00" inputMode="numeric" required />
            </>
          )}

          <label htmlFor="email">E-mail</label>
          <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />

          <label htmlFor="senha">Senha</label>
          <div className="campo-senha">
            <input
              id="senha"
              type={mostrarSenha ? 'text' : 'password'}
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              autoComplete={cadastro ? 'new-password' : 'current-password'}
              minLength={6}
              required
            />
            <button
              type="button"
              className="botao-olho"
              onClick={() => setMostrarSenha((v) => !v)}
              aria-label={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}
              aria-pressed={mostrarSenha}
            >
              {mostrarSenha ? '🙈' : '👁️'}
            </button>
          </div>

          {modo === 'entrar' && (
            <p style={{ textAlign: 'right', marginTop: 8 }}>
              <button
                type="button"
                className="link-btn link-btn--discreto"
                onClick={() => irPara('recuperar')}
              >
                Esqueci minha senha
              </button>
            </p>
          )}

          {erro && <p className="error-text" role="alert">{erro}</p>}

          <button className="btn-primary" type="submit" disabled={carregando}>
            {carregando ? 'Um momento…' : cadastro ? 'Criar conta' : 'Entrar'}
          </button>
        </form>

        {modo === 'entrar' ? (
          <div style={{ marginTop: 20, textAlign: 'center' }}>
            <p style={{ color: 'var(--text-muted)', margin: '0 0 8px' }}>Ainda não usa o Ayra Ponto?</p>
            <p style={{ margin: 0, display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button type="button" className="link-btn" onClick={() => irPara('criar_empresa')}>Criar conta da minha empresa</button>
              <button type="button" className="link-btn" onClick={() => irPara('convite')}>Recebi um convite</button>
            </p>
          </div>
        ) : (
          <p style={{ textAlign: 'center', marginTop: 16 }}>
            Já tem conta? <button type="button" className="link-btn" onClick={() => irPara('entrar')}>Entrar</button>
          </p>
        )}
      </div>
    </div>
  )
}
