import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../contexts/AuthContext'
import { traduzirErro } from '../lib/mensagensErro'
import { erroCnpj, formatarCnpj, normalizarCnpj } from '../lib/cnpj'
import { lerConvitePendente, limparConvitePendente } from '../lib/convite'
import ShellPublico from '../components/layout/ShellPublico'
import Botao from '../components/ui/Botao'
import Alerta from '../components/ui/Alerta'
import { Campo } from '../components/ui/Campo'

// Primeiro acesso de quem ainda não está em nenhuma empresa.
// Dois caminhos: cadastrar a própria empresa (vira administrador) ou entrar
// numa empresa com o código de convite (entra como colaborador). O banco
// garante essas regras; a tela abre no caminho escolhido no cadastro.
export default function Onboarding() {
  const { session, recarregarPerfil, signOut } = useAuth()
  const navigate = useNavigate()
  const metadados = session?.user?.user_metadata || {}
  const conviteGuardado = lerConvitePendente() || metadados.codigo_convite || ''
  const [caminho, setCaminho] = useState(
    conviteGuardado || metadados.intencao !== 'criar_empresa' ? 'convite' : 'criar_empresa',
  )
  const [nomeEmpresa, setNomeEmpresa] = useState('')
  const [cnpj, setCnpj] = useState('')
  const [codigo, setCodigo] = useState(conviteGuardado)
  const [erro, setErro] = useState('')
  const [erroCampoCnpj, setErroCampoCnpj] = useState('')
  const [carregando, setCarregando] = useState(false)

  function trocar(novo) {
    setErro('')
    setCaminho(novo)
  }

  async function criarEmpresa(e) {
    e.preventDefault()
    setErro('')
    const problema = erroCnpj(cnpj)
    setErroCampoCnpj(problema)
    if (problema) return
    setCarregando(true)
    const { error } = await supabase.rpc('criar_empresa', {
      p_nome: nomeEmpresa,
      p_cnpj: normalizarCnpj(cnpj) || null,
    })
    setCarregando(false)
    if (error) return setErro(traduzirErro(error))
    await recarregarPerfil()
    navigate('/gestao')
  }

  async function entrarComCodigo(e) {
    e.preventDefault()
    setErro('')
    setCarregando(true)
    const { error } = await supabase.rpc('entrar_por_codigo', { p_codigo: codigo.trim() })
    setCarregando(false)
    if (error) {
      return setErro(/convite inválido/i.test(error.message || '')
        ? 'Código de convite inválido. Confira com o administrador ou o RH da sua empresa.'
        : traduzirErro(error))
    }
    limparConvitePendente()
    await recarregarPerfil()
    navigate('/')
  }

  const rodape = (
    <>
      {caminho === 'criar_empresa' ? (
        <span>Recebeu um convite? <button type="button" className="link" onClick={() => trocar('convite')}>Usar código de convite</button></span>
      ) : (
        <span>Vai cadastrar a sua própria empresa? <button type="button" className="link" onClick={() => trocar('criar_empresa')}>Cadastrar empresa</button></span>
      )}
      <button type="button" className="link link--suave" onClick={signOut}>Sair</button>
    </>
  )

  if (caminho === 'criar_empresa') {
    return (
      <ShellPublico
        titulo="Cadastre sua empresa"
        subtitulo="Você será o administrador. Os outros dados da empresa podem ser preenchidos depois, em Configurações."
        rodape={rodape}
      >
        <form className="formulario" onSubmit={criarEmpresa}>
          <Campo rotulo="Nome da empresa" value={nomeEmpresa} onChange={(e) => setNomeEmpresa(e.target.value)} required
            ajuda="O nome que aparece para a sua equipe no sistema." />
          <Campo
            rotulo="CNPJ"
            opcional
            mono
            value={cnpj}
            onChange={(e) => { setCnpj(formatarCnpj(e.target.value)); setErroCampoCnpj('') }}
            onBlur={() => setErroCampoCnpj(erroCnpj(cnpj))}
            placeholder="00.000.000/0000-00"
            autoCapitalize="characters"
            ajuda="Aceita letras e números, como no novo padrão da Receita Federal."
            erro={erroCampoCnpj}
          />
          {erro && <Alerta tom="problema">{erro}</Alerta>}
          <Botao type="submit" bloco carregando={carregando}>Criar empresa</Botao>
        </form>
      </ShellPublico>
    )
  }

  return (
    <ShellPublico
      titulo="Entre na sua empresa"
      subtitulo="Digite o código de convite que o administrador ou o RH da sua empresa enviou. Você entra como colaborador."
      rodape={rodape}
    >
      <form className="formulario" onSubmit={entrarComCodigo}>
        <Campo
          rotulo="Código de convite"
          mono
          value={codigo}
          onChange={(e) => setCodigo(e.target.value)}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="Ex.: a1b2c3d4"
          required
        />
        {erro && <Alerta tom="problema">{erro}</Alerta>}
        <Botao type="submit" bloco carregando={carregando}>Entrar na empresa</Botao>
      </form>
    </ShellPublico>
  )
}
