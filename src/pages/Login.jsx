import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { MailCheck } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../contexts/AuthContext'
import { traduzirErro } from '../lib/mensagensErro'
import { formatarCpf, apenasDigitos } from '../lib/formatos'
import { guardarConvitePendente } from '../lib/convite'
import ShellPublico from '../components/layout/ShellPublico'
import Botao from '../components/ui/Botao'
import Alerta from '../components/ui/Alerta'
import { Campo, CampoSenha } from '../components/ui/Campo'

// Telas de acesso. Os dois caminhos de cadastro são separados:
// "Criar conta da minha empresa" e "Recebi um convite".
// O papel da pessoa NUNCA vem daqui: o banco cria todo cadastro como
// colaborador, e só vira administrador quem cadastra a própria empresa.
const TEXTOS = {
  entrar: {
    titulo: 'Entrar',
    subtitulo: 'Acesse o Ayra Ponto com seu e-mail e senha.',
  },
  criar_empresa: {
    titulo: 'Criar conta da minha empresa',
    subtitulo: 'Você será o administrador. Depois de confirmar o e-mail, é só cadastrar a empresa.',
  },
  convite: {
    titulo: 'Recebi um convite',
    subtitulo: 'Crie sua conta. Depois de confirmar o e-mail, você entra na empresa que te convidou como colaborador.',
  },
  recuperar: {
    titulo: 'Esqueci minha senha',
    subtitulo: 'Informe seu e-mail e enviamos um link para você escolher uma nova senha.',
  },
}

export default function Login({ modo = 'entrar' }) {
  const navigate = useNavigate()
  const { session } = useAuth()
  const { codigo: codigoDaUrl } = useParams()
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [cpf, setCpf] = useState('')
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [enviado, setEnviado] = useState(null) // 'confirmacao' | 'recuperacao'

  const codigoConvite = (codigoDaUrl || '').trim()

  useEffect(() => {
    if (codigoConvite) guardarConvitePendente(codigoConvite)
  }, [codigoConvite])

  useEffect(() => {
    setErro('')
    setEnviado(null)
  }, [modo])

  // Quem já está logado vai direto para o sistema (o convite fica guardado
  // e aparece preenchido no passo seguinte).
  if (session && modo !== 'recuperar') return <Navigate to="/" replace />

  const textos = TEXTOS[modo] || TEXTOS.entrar
  const cadastro = modo === 'criar_empresa' || modo === 'convite'

  async function handleEntrar(e) {
    e.preventDefault()
    setErro('')
    setCarregando(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha })
    setCarregando(false)
    if (error) return setErro(traduzirErro(error))
    navigate('/')
  }

  async function handleCadastrar(e) {
    e.preventDefault()
    setErro('')
    if (apenasDigitos(cpf).length !== 11) return setErro('Informe os 11 números do seu CPF.')
    setCarregando(true)
    const { error } = await supabase.auth.signUp({
      email,
      password: senha,
      options: {
        data: {
          nome_completo: nome.trim(),
          cpf: apenasDigitos(cpf),
          intencao: modo,
          ...(codigoConvite ? { codigo_convite: codigoConvite } : {}),
        },
        emailRedirectTo: `${window.location.origin}/entrar`,
      },
    })
    setCarregando(false)
    if (error) return setErro(traduzirErro(error))
    setEnviado('confirmacao')
  }

  async function handleRecuperar(e) {
    e.preventDefault()
    setErro('')
    setCarregando(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/redefinir-senha`,
    })
    setCarregando(false)
    if (error) return setErro(traduzirErro(error))
    setEnviado('recuperacao')
  }

  if (enviado) {
    return (
      <ShellPublico
        titulo="Verifique seu e-mail"
        rodape={<Link to="/entrar" className="link">Voltar para o login</Link>}
      >
        <Alerta tom="ok" titulo={enviado === 'confirmacao' ? 'Enviamos um link de confirmação' : 'Enviamos um link para criar uma nova senha'}>
          {enviado === 'confirmacao'
            ? <>Abra o e-mail enviado para <strong>{email}</strong> e clique no link. Depois é só entrar com seu e-mail e senha.</>
            : <>Se <strong>{email}</strong> estiver cadastrado, o link chega em alguns minutos.</>}
        </Alerta>
        <p className="suave pequeno" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <MailCheck size={16} aria-hidden="true" /> Não chegou? Confira a caixa de spam ou promoções.
        </p>
      </ShellPublico>
    )
  }

  const rodape = modo === 'entrar' ? (
    <>
      <span>Ainda não usa o Ayra Ponto?</span>
      <span className="linha" style={{ justifyContent: 'center', gap: 16 }}>
        <Link to="/criar-conta" className="link">Criar conta da minha empresa</Link>
        <Link to="/convite" className="link">Recebi um convite</Link>
      </span>
    </>
  ) : (
    <span>Já tem conta? <Link to="/entrar" className="link">Entrar</Link></span>
  )

  return (
    <ShellPublico titulo={textos.titulo} subtitulo={textos.subtitulo} rodape={rodape}>
      {modo === 'convite' && codigoConvite && (
        <Alerta tom="info">
          Código do convite: <span className="mono"><strong>{codigoConvite}</strong></span>. Ele será usado assim que você entrar.
        </Alerta>
      )}

      {modo === 'recuperar' ? (
        <form className="formulario" onSubmit={handleRecuperar} noValidate={false}>
          <Campo rotulo="E-mail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
          {erro && <Alerta tom="problema">{erro}</Alerta>}
          <Botao type="submit" bloco carregando={carregando}>Enviar link</Botao>
        </form>
      ) : (
        <form className="formulario" onSubmit={cadastro ? handleCadastrar : handleEntrar}>
          {cadastro && (
            <>
              <Campo rotulo="Nome completo" value={nome} onChange={(e) => setNome(e.target.value)} autoComplete="name" required />
              <Campo
                rotulo="CPF"
                value={cpf}
                onChange={(e) => setCpf(formatarCpf(e.target.value))}
                inputMode="numeric"
                placeholder="000.000.000-00"
                ajuda="Aparece no comprovante de cada marcação de ponto."
                required
              />
            </>
          )}
          <Campo rotulo="E-mail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
          <CampoSenha
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            autoComplete={cadastro ? 'new-password' : 'current-password'}
            minLength={6}
            ajuda={cadastro ? 'Pelo menos 6 caracteres.' : undefined}
            required
          />
          {modo === 'entrar' && (
            <div style={{ textAlign: 'right', marginTop: -6 }}>
              <Link to="/recuperar-senha" className="link link--suave pequeno">Esqueci minha senha</Link>
            </div>
          )}
          {erro && <Alerta tom="problema">{erro}</Alerta>}
          <Botao type="submit" bloco carregando={carregando}>
            {cadastro ? 'Criar conta' : 'Entrar'}
          </Botao>
        </form>
      )}
    </ShellPublico>
  )
}
