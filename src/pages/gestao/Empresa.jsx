import { useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { RefreshCw } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../contexts/AuthContext'
import { useAvisos } from '../../contexts/AvisosContext'
import { traduzirErro } from '../../lib/mensagensErro'
import { cnpjValido, erroCnpj, formatarCnpj, normalizarCnpj } from '../../lib/cnpj'
import { apenasDigitos, formatarCep, formatarTelefone, UFS } from '../../lib/formatos'
import { buscarCep } from '../../lib/cep'
import { linkConvite, novoCodigoConvite } from '../../lib/convite'
import Botao from '../../components/ui/Botao'
import BotaoCopiar from '../../components/ui/BotaoCopiar'
import Alerta from '../../components/ui/Alerta'
import { Campo, Selecao } from '../../components/ui/Campo'
import { Confirmacao } from '../../components/ui/Dialogo'
import { Esqueleto, EstadoErro } from '../../components/ui/Estados'

const CAMPOS = ['nome', 'razao_social', 'cnpj', 'inscricao_estadual', 'inscricao_municipal', 'telefone', 'email',
  'cep', 'logradouro', 'numero', 'complemento', 'bairro', 'cidade', 'uf']

function paraFormulario(empresa) {
  const f = Object.fromEntries(CAMPOS.map((c) => [c, empresa?.[c] || '']))
  f.cnpj = formatarCnpj(f.cnpj)
  f.cep = formatarCep(f.cep)
  f.telefone = formatarTelefone(f.telefone)
  return f
}

// Dados da empresa. Só o administrador edita; o RH consulta.
export default function Empresa() {
  const { perfil } = useAuth()
  const { empresa, carregando, erro: erroCarga, recarregar } = useOutletContext()
  const avisar = useAvisos()
  const [form, setForm] = useState(null)
  const [erros, setErros] = useState({})
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [buscandoCep, setBuscandoCep] = useState(false)
  const [confirmarCodigo, setConfirmarCodigo] = useState(false)
  const [gerandoCodigo, setGerandoCodigo] = useState(false)

  const podeEditar = perfil.tipo === 'administrador'

  useEffect(() => { if (empresa) setForm(paraFormulario(empresa)) }, [empresa])

  if (carregando || (!form && !erroCarga)) return <div className="pagina"><Esqueleto blocos={1} linhas={8} /></div>
  if (erroCarga || !empresa) return <div className="pagina"><EstadoErro aoTentarDeNovo={recarregar} /></div>

  const mudar = (campo, formatar) => (e) => {
    const valor = formatar ? formatar(e.target.value) : e.target.value
    setForm((f) => ({ ...f, [campo]: valor }))
    setErros((x) => ({ ...x, [campo]: '' }))
  }

  async function completarCep() {
    if (apenasDigitos(form.cep).length !== 8) return
    setBuscandoCep(true)
    const endereco = await buscarCep(form.cep)
    setBuscandoCep(false)
    if (!endereco) return
    setForm((f) => ({
      ...f,
      logradouro: f.logradouro || endereco.logradouro,
      bairro: f.bairro || endereco.bairro,
      cidade: endereco.cidade || f.cidade,
      uf: endereco.uf || f.uf,
    }))
  }

  function validar() {
    const e = {}
    if (!form.nome.trim()) e.nome = 'Informe o nome da empresa.'
    const problemaCnpj = erroCnpj(form.cnpj)
    if (problemaCnpj) e.cnpj = problemaCnpj
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Informe um e-mail completo, como contato@empresa.com.br'
    if (form.cep && apenasDigitos(form.cep).length !== 8) e.cep = 'O CEP tem 8 números.'
    setErros(e)
    return Object.keys(e).length === 0
  }

  async function salvar(e) {
    e.preventDefault()
    setErro('')
    if (!validar()) return
    setSalvando(true)
    const dados = Object.fromEntries(CAMPOS.map((c) => [c, typeof form[c] === 'string' ? form[c].trim() || null : form[c]]))
    dados.nome = form.nome.trim()
    dados.cnpj = normalizarCnpj(form.cnpj) || null
    dados.cep = apenasDigitos(form.cep) || null
    dados.telefone = apenasDigitos(form.telefone) || null
    const { error } = await supabase.from('empresas').update(dados).eq('id', empresa.id)
    setSalvando(false)
    if (error) return setErro(traduzirErro(error))
    await recarregar()
    avisar('Dados da empresa salvos.')
  }

  async function gerarNovoCodigo() {
    setGerandoCodigo(true)
    const { error } = await supabase.from('empresas').update({ codigo_convite: novoCodigoConvite() }).eq('id', empresa.id)
    setGerandoCodigo(false)
    setConfirmarCodigo(false)
    if (error) return avisar(traduzirErro(error), 'problema')
    await recarregar()
    avisar('Novo código de convite criado. O anterior deixou de funcionar.')
  }

  const cnpjAtualInvalido = empresa.cnpj && !cnpjValido(empresa.cnpj)
  const link = linkConvite(empresa.codigo_convite)

  return (
    <div className="pagina" style={{ maxWidth: 900 }}>
      <div className="pagina__cabecalho">
        <div className="pagina__titulo">
          <span className="pagina__trilha">Configurações</span>
          <h1>Empresa</h1>
          <p className="suave">Esses dados identificam o empregador no espelho de ponto e nos arquivos legais.</p>
        </div>
      </div>

      {!podeEditar && <Alerta tom="info">Somente o administrador pode alterar os dados da empresa.</Alerta>}
      {podeEditar && cnpjAtualInvalido && (
        <Alerta tom="atencao" titulo="O CNPJ gravado não é válido">Corrija o CNPJ para conseguir salvar as alterações.</Alerta>
      )}

      <form className="cartao formulario" onSubmit={salvar} noValidate>
        <fieldset className="formulario" disabled={!podeEditar}>
          <div className="secao-formulario">
            <h2>Identificação</h2>
            <div className="grade-campos">
              <Campo rotulo="Nome fantasia" value={form.nome} onChange={mudar('nome')} erro={erros.nome}
                ajuda="O nome que aparece para a equipe no sistema." required />
              <Campo rotulo="Razão social" value={form.razao_social} onChange={mudar('razao_social')} />
            </div>
            <div className="grade-campos grade-campos--3">
              <Campo
                rotulo="CNPJ"
                mono
                value={form.cnpj}
                onChange={mudar('cnpj', formatarCnpj)}
                onBlur={() => setErros((x) => ({ ...x, cnpj: erroCnpj(form.cnpj) }))}
                placeholder="00.000.000/0000-00"
                autoCapitalize="characters"
                erro={erros.cnpj}
                dica="O CNPJ pode ter letras e números nas 12 primeiras posições (novo padrão da Receita Federal para empresas abertas a partir de julho de 2026). Os CNPJs antigos, só com números, continuam valendo."
              />
              <Campo rotulo="Inscrição estadual" opcional value={form.inscricao_estadual} onChange={mudar('inscricao_estadual')} ajuda="Se a empresa tiver" />
              <Campo rotulo="Inscrição municipal" opcional value={form.inscricao_municipal} onChange={mudar('inscricao_municipal')} ajuda="Se a empresa tiver" />
            </div>
          </div>

          <div className="secao-formulario">
            <h2>Contato</h2>
            <div className="grade-campos">
              <Campo rotulo="Telefone" opcional type="tel" value={form.telefone} onChange={mudar('telefone', formatarTelefone)} placeholder="(41) 99999-9999" />
              <Campo rotulo="E-mail" opcional type="email" value={form.email} onChange={mudar('email')} erro={erros.email} placeholder="contato@empresa.com.br" />
            </div>
          </div>

          <div className="secao-formulario">
            <h2>Endereço</h2>
            <div className="grade-campos grade-campos--3">
              <Campo rotulo="CEP" value={form.cep} onChange={mudar('cep', formatarCep)} onBlur={completarCep} inputMode="numeric"
                placeholder="00000-000" erro={erros.cep} ajuda={buscandoCep ? 'Buscando endereço…' : 'Preenche o endereço sozinho'} />
              <Campo rotulo="Cidade" value={form.cidade} onChange={mudar('cidade')} />
              <Selecao rotulo="UF" value={form.uf} onChange={mudar('uf')}
                opcoes={[{ valor: '', rotulo: 'Selecione' }, ...UFS.map((uf) => ({ valor: uf, rotulo: uf }))]} />
            </div>
            <Campo rotulo="Rua / avenida" value={form.logradouro} onChange={mudar('logradouro')} />
            <div className="grade-campos grade-campos--3">
              <Campo rotulo="Número" value={form.numero} onChange={mudar('numero')} />
              <Campo rotulo="Complemento" opcional value={form.complemento} onChange={mudar('complemento')} />
              <Campo rotulo="Bairro" value={form.bairro} onChange={mudar('bairro')} />
            </div>
          </div>
        </fieldset>

        {erro && <Alerta tom="problema">{erro}</Alerta>}
        {podeEditar && (
          <div className="acoes acoes--fim">
            <Botao variante="secundario" onClick={() => { setForm(paraFormulario(empresa)); setErros({}); setErro('') }}>Descartar alterações</Botao>
            <Botao type="submit" carregando={salvando}>Salvar dados da empresa</Botao>
          </div>
        )}
      </form>

      <section className="cartao" aria-labelledby="t-convite">
        <div className="cartao__cabecalho">
          <div>
            <h2 id="t-convite">Convite para a equipe</h2>
            <p className="suave pequeno">Quem entra por este link ou código vira colaborador desta empresa.</p>
          </div>
        </div>
        <div className="pilha pilha--16">
          <div className="linha linha--espacada">
            <span className="codigo-destaque" aria-label={`Código de convite ${empresa.codigo_convite}`}>{empresa.codigo_convite}</span>
            <div className="acoes">
              <BotaoCopiar texto={empresa.codigo_convite} rotulo="Copiar código" />
              <BotaoCopiar texto={link} rotulo="Copiar link" variante="primario" />
            </div>
          </div>
          <input className="entrada entrada--mono" value={link} readOnly onFocus={(e) => e.target.select()} aria-label="Link de convite" />
          {podeEditar && (
            <div>
              <Botao variante="discreto" icone={RefreshCw} onClick={() => setConfirmarCodigo(true)}>Gerar novo código</Botao>
              <p className="suave pequeno">Use se o código tiver sido compartilhado com quem não deveria. Quem já entrou continua na empresa.</p>
            </div>
          )}
        </div>
      </section>

      <Confirmacao
        aberta={confirmarCodigo}
        titulo="Gerar novo código de convite?"
        textoConfirmar="Gerar novo código"
        carregando={gerandoCodigo}
        aoConfirmar={gerarNovoCodigo}
        aoCancelar={() => setConfirmarCodigo(false)}
      >
        O código e o link atuais param de funcionar na hora. Quem ainda não entrou vai precisar do novo link. Quem já está na empresa não é afetado.
      </Confirmacao>
    </div>
  )
}
