import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { traduzirErro } from '../lib/mensagensErro'
import ShellPublico from '../components/layout/ShellPublico'
import Botao from '../components/ui/Botao'
import Alerta from '../components/ui/Alerta'
import { CampoSenha } from '../components/ui/Campo'
import { Esqueleto } from '../components/ui/Estados'

// Página aberta pelo link de recuperação enviado por e-mail. O Supabase cria
// uma sessão temporária ao abrir o link, por isso esta rota não exige login.
export default function RedefinirSenha() {
  const navigate = useNavigate()
  const [novaSenha, setNovaSenha] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [sucesso, setSucesso] = useState(false)
  const [linkValido, setLinkValido] = useState(null) // null = conferindo

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setLinkValido(!!data.session))
  }, [])

  async function salvar(e) {
    e.preventDefault()
    setErro('')
    if (novaSenha.length < 6) return setErro('A senha precisa ter pelo menos 6 caracteres.')
    if (novaSenha !== confirmar) return setErro('As duas senhas digitadas não são iguais.')
    setCarregando(true)
    const { error } = await supabase.auth.updateUser({ password: novaSenha })
    setCarregando(false)
    if (error) return setErro(traduzirErro(error))
    setSucesso(true)
  }

  if (linkValido === null) {
    return <ShellPublico titulo="Conferindo o link…"><Esqueleto linhas={2} /></ShellPublico>
  }

  if (!linkValido) {
    return (
      <ShellPublico titulo="Link inválido ou expirado" rodape={<Link to="/entrar" className="link">Voltar para o login</Link>}>
        <p className="suave">Esse link de recuperação não vale mais. Peça um novo na tela de login, em "Esqueci minha senha".</p>
        <Botao bloco onClick={() => navigate('/recuperar-senha')}>Pedir um novo link</Botao>
      </ShellPublico>
    )
  }

  if (sucesso) {
    return (
      <ShellPublico titulo="Senha alterada">
        <Alerta tom="ok">Sua senha foi redefinida. Você já pode usar o Ayra Ponto.</Alerta>
        <Botao bloco onClick={() => navigate('/')}>Continuar</Botao>
      </ShellPublico>
    )
  }

  return (
    <ShellPublico titulo="Escolha sua nova senha">
      <form className="formulario" onSubmit={salvar}>
        <CampoSenha rotulo="Nova senha" value={novaSenha} onChange={(e) => setNovaSenha(e.target.value)} autoComplete="new-password" minLength={6} ajuda="Pelo menos 6 caracteres." required />
        <CampoSenha rotulo="Confirme a nova senha" value={confirmar} onChange={(e) => setConfirmar(e.target.value)} autoComplete="new-password" minLength={6} required />
        {erro && <Alerta tom="problema">{erro}</Alerta>}
        <Botao type="submit" bloco carregando={carregando}>Salvar nova senha</Botao>
      </form>
    </ShellPublico>
  )
}
