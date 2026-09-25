import { useEffect, useState } from 'react'
import { LogOut } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../contexts/AuthContext'
import { useAvisos } from '../contexts/AvisosContext'
import { useTheme } from '../contexts/ThemeContext'
import { traduzirErro } from '../lib/mensagensErro'
import { data, mascararCpf } from '../lib/formatos'
import { PAPEL, SITUACAO } from '../lib/rotulos'
import Botao from '../components/ui/Botao'
import Alerta from '../components/ui/Alerta'
import { Campo, CampoSenha } from '../components/ui/Campo'

export default function MinhaConta() {
  const { session, perfil, recarregarPerfil, signOut } = useAuth()
  const { theme, setTheme } = useTheme()
  const avisar = useAvisos()
  const [nome, setNome] = useState(perfil.nome_completo || '')
  const [salvandoNome, setSalvandoNome] = useState(false)
  const [erroNome, setErroNome] = useState('')
  const [unidade, setUnidade] = useState(null)
  const [senha, setSenha] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [erroSenha, setErroSenha] = useState('')
  const [salvandoSenha, setSalvandoSenha] = useState(false)

  useEffect(() => {
    if (!perfil.filial_id) return
    supabase.from('filiais').select('nome').eq('id', perfil.filial_id).maybeSingle()
      .then(({ data: u }) => setUnidade(u))
  }, [perfil.filial_id])

  async function salvarNome(e) {
    e.preventDefault()
    setErroNome('')
    if (!nome.trim()) return setErroNome('Informe seu nome.')
    setSalvandoNome(true)
    const { error } = await supabase.from('perfis').update({ nome_completo: nome.trim() }).eq('id', perfil.id)
    setSalvandoNome(false)
    if (error) return setErroNome(traduzirErro(error))
    await recarregarPerfil()
    avisar('Nome atualizado.')
  }

  async function salvarSenha(e) {
    e.preventDefault()
    setErroSenha('')
    if (senha.length < 6) return setErroSenha('A senha precisa ter pelo menos 6 caracteres.')
    if (senha !== confirmar) return setErroSenha('As duas senhas digitadas não são iguais.')
    setSalvandoSenha(true)
    const { error } = await supabase.auth.updateUser({ password: senha })
    setSalvandoSenha(false)
    if (error) return setErroSenha(traduzirErro(error))
    setSenha('')
    setConfirmar('')
    avisar('Senha alterada.')
  }

  return (
    <div className="pagina" style={{ maxWidth: 760 }}>
      <div className="pagina__cabecalho">
        <div className="pagina__titulo">
          <h1>Minha conta</h1>
          <p className="suave">Seus dados de acesso e preferências.</p>
        </div>
      </div>

      <section className="cartao" aria-labelledby="t-dados">
        <div className="cartao__cabecalho"><h2 id="t-dados">Meus dados</h2></div>
        <form className="formulario" onSubmit={salvarNome}>
          <Campo rotulo="Nome completo" value={nome} onChange={(e) => setNome(e.target.value)} erro={erroNome} autoComplete="name" />
          <dl className="lista-definicoes">
            <dt>E-mail</dt><dd>{session?.user?.email}</dd>
            <dt>CPF</dt><dd className="mono">{mascararCpf(perfil.cpf) || 'não informado'}</dd>
            <dt>Papel</dt><dd>{PAPEL[perfil.tipo] || perfil.tipo}</dd>
            <dt>Unidade</dt><dd>{unidade?.nome || '—'}</dd>
            <dt>Situação</dt><dd>{SITUACAO[perfil.status] || perfil.status}</dd>
            {perfil.data_admissao && (<><dt>Admissão</dt><dd>{data(perfil.data_admissao)}</dd></>)}
          </dl>
          <p className="suave pequeno">CPF, papel, unidade e situação são alterados pelo RH ou pelo administrador da empresa.</p>
          <div className="acoes"><Botao type="submit" carregando={salvandoNome} disabled={nome.trim() === (perfil.nome_completo || '')}>Salvar nome</Botao></div>
        </form>
      </section>

      <section className="cartao" aria-labelledby="t-senha">
        <div className="cartao__cabecalho"><h2 id="t-senha">Alterar senha</h2></div>
        <form className="formulario" onSubmit={salvarSenha}>
          <div className="grade-campos">
            <CampoSenha rotulo="Nova senha" value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete="new-password" ajuda="Pelo menos 6 caracteres." />
            <CampoSenha rotulo="Confirme a nova senha" value={confirmar} onChange={(e) => setConfirmar(e.target.value)} autoComplete="new-password" />
          </div>
          {erroSenha && <Alerta tom="problema">{erroSenha}</Alerta>}
          <div className="acoes"><Botao type="submit" variante="secundario" carregando={salvandoSenha} disabled={!senha}>Alterar senha</Botao></div>
        </form>
      </section>

      <section className="cartao" aria-labelledby="t-aparencia">
        <div className="cartao__cabecalho"><h2 id="t-aparencia">Aparência</h2></div>
        <fieldset className="opcoes" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
          <legend className="sr-only">Tema</legend>
          {[['light', 'Claro'], ['dark', 'Escuro']].map(([valor, rotulo]) => (
            <label key={valor} className="opcao">
              <input type="radio" name="tema" value={valor} checked={theme === valor} onChange={() => setTheme(valor)} />
              <span className="opcao__titulo">{rotulo}</span>
            </label>
          ))}
        </fieldset>
      </section>

      <div><Botao variante="secundario" icone={LogOut} onClick={signOut}>Sair da conta</Botao></div>
    </div>
  )
}
