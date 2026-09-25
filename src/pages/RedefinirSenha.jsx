import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { traduzirErro } from '../lib/mensagensErro'

// Página acessada pelo link que o Supabase manda por e-mail (handleRecuperar,
// em Login.jsx). O próprio Supabase, ao abrir esse link, cria uma sessão
// temporária de recuperação — não exigimos login normal aqui (por isso essa
// rota NÃO fica dentro de ProtectedRoute lá no App.jsx).
export default function RedefinirSenha() {
  const navigate = useNavigate()
  const [novaSenha, setNovaSenha] = useState('')
  const [confirmarSenha, setConfirmarSenha] = useState('')
  const [mostrarSenha, setMostrarSenha] = useState(false)
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [sucesso, setSucesso] = useState(false)
  const [linkValido, setLinkValido] = useState(null) // null = checando, true/false depois

  useEffect(() => {
    // Quando o Supabase processa o link de recuperação, ele cria uma sessão.
    // Se não houver sessão nenhuma, o link é inválido/expirado.
    supabase.auth.getSession().then(({ data }) => {
      setLinkValido(!!data.session)
    })
  }, [])

  async function handleSalvar(e) {
    e.preventDefault()
    setErro('')

    if (novaSenha.length < 6) {
      setErro('A senha precisa ter pelo menos 6 caracteres.')
      return
    }

    if (novaSenha !== confirmarSenha) {
      setErro('As senhas digitadas não são iguais.')
      return
    }

    setCarregando(true)
    const { error } = await supabase.auth.updateUser({ password: novaSenha })
    setCarregando(false)

    if (error) {
      setErro(traduzirErro(error))
      return
    }

    setSucesso(true)
  }

  if (linkValido === null) {
    return (
      <div className="container">
        <div className="card">
          <p>Verificando o link…</p>
        </div>
      </div>
    )
  }

  if (linkValido === false) {
    return (
      <div className="container">
        <div className="card">
          <h2>Link inválido ou expirado</h2>
          <p>
            Esse link de recuperação de senha não é mais válido. Volte para o
            login e peça um novo.
          </p>
          <button className="btn-primary" onClick={() => navigate('/login')}>
            Voltar para o login
          </button>
        </div>
      </div>
    )
  }

  if (sucesso) {
    return (
      <div className="container">
        <div className="card">
          <h2>Senha alterada!</h2>
          <p>Sua senha foi redefinida com sucesso. Agora é só entrar.</p>
          <button className="btn-primary" onClick={() => navigate('/login')}>
            Ir para o login
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="container">
      <div className="card">
        <h1><span className="brand">Ayra</span> Ponto</h1>
        <p style={{ color: 'var(--text-muted)' }}>Escolha sua nova senha</p>

        <form onSubmit={handleSalvar}>
          <label htmlFor="nova-senha">Nova senha</label>
          <div className="campo-senha">
            <input
              id="nova-senha"
              type={mostrarSenha ? 'text' : 'password'}
              value={novaSenha}
              onChange={(e) => setNovaSenha(e.target.value)}
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

          <label htmlFor="confirmar-senha">Confirme a nova senha</label>
          <input
            id="confirmar-senha"
            type={mostrarSenha ? 'text' : 'password'}
            value={confirmarSenha}
            onChange={(e) => setConfirmarSenha(e.target.value)}
            minLength={6}
            required
          />

          {erro && <p className="error-text" role="alert">{erro}</p>}

          <button className="btn-primary" type="submit" disabled={carregando}>
            {carregando ? 'Salvando…' : 'Salvar nova senha'}
          </button>
        </form>
      </div>
    </div>
  )
}
