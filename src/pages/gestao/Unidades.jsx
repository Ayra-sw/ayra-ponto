import { useEffect, useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { MapPin, Pencil, Plus, Power, Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../contexts/AuthContext'
import { useAvisos } from '../../contexts/AvisosContext'
import { traduzirErro } from '../../lib/mensagensErro'
import { erroCnpj, formatarCnpj, normalizarCnpj } from '../../lib/cnpj'
import { apenasDigitos, formatarCep, FUSOS, FUSO_PADRAO, UFS } from '../../lib/formatos'
import { buscarCep } from '../../lib/cep'
import { TIPO_IDENTIFICADOR } from '../../lib/rotulos'
import Botao from '../../components/ui/Botao'
import Etiqueta from '../../components/ui/Etiqueta'
import Alerta from '../../components/ui/Alerta'
import { Campo, Selecao } from '../../components/ui/Campo'
import { Confirmacao, PainelLateral } from '../../components/ui/Dialogo'
import { Esqueleto, EstadoErro, EstadoVazio } from '../../components/ui/Estados'

const VAZIA = {
  nome: '', tipo_identificador: '', identificador_legal: '', cep: '', logradouro: '', numero: '',
  complemento: '', bairro: '', cidade: '', uf: '', fuso_horario: FUSO_PADRAO,
}

function identificadorFormatado(u) {
  if (!u.identificador_legal) return null
  const valor = u.tipo_identificador === 'cnpj' ? formatarCnpj(u.identificador_legal) : u.identificador_legal
  return `${TIPO_IDENTIFICADOR[u.tipo_identificador] || 'Documento'} ${valor}`
}

// Unidades (no banco: tabela "filiais"). Cada unidade tem a sua própria
// sequência de registros (NSR). Só o administrador cria e altera.
export default function Unidades() {
  const { perfil } = useAuth()
  const { unidades, carregando, erro: erroCarga, recarregar } = useOutletContext()
  const avisar = useAvisos()
  const [pessoasPorUnidade, setPessoasPorUnidade] = useState({})
  const [editando, setEditando] = useState(null) // objeto da unidade ou {} para nova
  const [acao, setAcao] = useState(null) // { tipo: 'ativar'|'desativar'|'excluir', unidade }
  const [executando, setExecutando] = useState(false)

  const podeEditar = perfil.tipo === 'administrador'

  useEffect(() => {
    supabase.from('perfis').select('filial_id, status').eq('empresa_id', perfil.empresa_id).then(({ data }) => {
      const contagem = {}
      for (const p of data || []) if (p.filial_id && p.status !== 'desligado') contagem[p.filial_id] = (contagem[p.filial_id] || 0) + 1
      setPessoasPorUnidade(contagem)
    })
  }, [perfil.empresa_id, unidades])

  const ordenadas = useMemo(() => [...unidades].sort((a, b) => Number(b.ativa) - Number(a.ativa)), [unidades])

  async function executarAcao() {
    const { tipo, unidade } = acao
    setExecutando(true)
    const consulta = tipo === 'excluir'
      ? supabase.from('filiais').delete().eq('id', unidade.id)
      : supabase.from('filiais').update({ ativa: tipo === 'ativar' }).eq('id', unidade.id)
    const { error } = await consulta
    setExecutando(false)
    setAcao(null)
    if (error) return avisar(traduzirErro(error), 'problema')
    await recarregar()
    avisar(tipo === 'excluir' ? 'Unidade excluída.' : tipo === 'ativar' ? 'Unidade reativada.' : 'Unidade desativada.')
  }

  if (carregando) return <div className="pagina"><Esqueleto blocos={2} linhas={2} /></div>
  if (erroCarga) return <div className="pagina"><EstadoErro aoTentarDeNovo={recarregar} /></div>

  const textosAcao = {
    desativar: {
      titulo: 'Desativar unidade?',
      texto: 'Ninguém novo poderá ser colocado nela e ela deixa de aparecer nas opções. As marcações antigas continuam guardadas. Só é possível desativar uma unidade sem colaboradores.',
      botao: 'Desativar',
    },
    ativar: { titulo: 'Reativar unidade?', texto: 'Ela volta a aparecer nas opções e pode receber colaboradores.', botao: 'Reativar' },
    excluir: {
      titulo: 'Excluir unidade?',
      texto: 'A unidade será apagada de vez. Isso só é possível enquanto ela não tem pessoas nem marcações de ponto. Se ela já foi usada, desative em vez de excluir.',
      botao: 'Excluir unidade',
    },
  }

  return (
    <div className="pagina" style={{ maxWidth: 1000 }}>
      <div className="pagina__cabecalho">
        <div className="pagina__titulo">
          <span className="pagina__trilha">Configurações</span>
          <h1>Unidades</h1>
          <p className="suave">Os locais onde a sua equipe trabalha. Cada unidade tem a sua própria sequência de registros de ponto.</p>
        </div>
        {podeEditar && <Botao icone={Plus} onClick={() => setEditando({})}>Nova unidade</Botao>}
      </div>

      {!podeEditar && <Alerta tom="info">Somente o administrador pode criar e alterar unidades.</Alerta>}

      {ordenadas.length === 0 ? (
        <EstadoVazio icone={MapPin} titulo="Nenhuma unidade cadastrada"
          acao={podeEditar && <Botao icone={Plus} onClick={() => setEditando({})}>Cadastrar unidade</Botao>}>
          Cadastre o local onde a sua equipe trabalha para liberar o registro de ponto.
        </EstadoVazio>
      ) : (
        <div className="grade-2">
          {ordenadas.map((u) => {
            const pessoas = pessoasPorUnidade[u.id] || 0
            const endereco = [u.logradouro && `${u.logradouro}${u.numero ? `, ${u.numero}` : ''}`, u.bairro, u.cidade && `${u.cidade}${u.uf ? `/${u.uf}` : ''}`].filter(Boolean).join(' · ')
            return (
              <article key={u.id} className="cartao pilha" aria-label={`Unidade ${u.nome}`}>
                <div className="linha linha--espacada">
                  <h2>{u.nome}</h2>
                  {u.ativa ? <Etiqueta tom="ok">Ativa</Etiqueta> : <Etiqueta tom="neutra">Desativada</Etiqueta>}
                </div>
                <dl className="lista-definicoes">
                  <dt>Documento</dt><dd className={u.identificador_legal ? 'mono' : 'suave'}>{identificadorFormatado(u) || 'Não informado'}</dd>
                  <dt>Endereço</dt><dd>{endereco || u.endereco || 'Não informado'}</dd>
                  <dt>Pessoas</dt><dd>{pessoas === 0 ? 'Nenhuma' : pessoas === 1 ? '1 pessoa' : `${pessoas} pessoas`}</dd>
                  <dt>Fuso horário</dt><dd>{FUSOS.find((f) => f.valor === u.fuso_horario)?.rotulo || u.fuso_horario}</dd>
                </dl>
                {podeEditar && (
                  <div className="acoes">
                    <Botao variante="secundario" tamanho="pequeno" icone={Pencil} onClick={() => setEditando(u)}>Editar</Botao>
                    {u.ativa ? (
                      <Botao variante="discreto" tamanho="pequeno" icone={Power} onClick={() => setAcao({ tipo: 'desativar', unidade: u })}
                        disabled={pessoas > 0} title={pessoas > 0 ? 'Mova as pessoas para outra unidade antes de desativar' : undefined}>
                        Desativar
                      </Botao>
                    ) : (
                      <Botao variante="discreto" tamanho="pequeno" icone={Power} onClick={() => setAcao({ tipo: 'ativar', unidade: u })}>Reativar</Botao>
                    )}
                    {pessoas === 0 && (
                      <Botao variante="discreto" tamanho="pequeno" icone={Trash2} onClick={() => setAcao({ tipo: 'excluir', unidade: u })}>Excluir</Botao>
                    )}
                  </div>
                )}
                {podeEditar && u.ativa && pessoas > 0 && (
                  <p className="suave pequeno">Para desativar, mova as pessoas desta unidade em Colaboradores.</p>
                )}
              </article>
            )
          })}
        </div>
      )}

      {editando && (
        <FormularioUnidade
          unidade={editando}
          empresaId={perfil.empresa_id}
          aoFechar={() => setEditando(null)}
          aoSalvar={async (nova) => { setEditando(null); await recarregar(); avisar(nova ? 'Unidade cadastrada.' : 'Unidade atualizada.') }}
        />
      )}

      <Confirmacao
        aberta={Boolean(acao)}
        titulo={acao ? textosAcao[acao.tipo].titulo : ''}
        textoConfirmar={acao ? textosAcao[acao.tipo].botao : ''}
        perigo={acao?.tipo === 'excluir'}
        carregando={executando}
        aoConfirmar={executarAcao}
        aoCancelar={() => setAcao(null)}
      >
        {acao && <><strong>{acao.unidade.nome}</strong>: {textosAcao[acao.tipo].texto}</>}
      </Confirmacao>
    </div>
  )
}

function FormularioUnidade({ unidade, empresaId, aoFechar, aoSalvar }) {
  const nova = !unidade.id
  const [form, setForm] = useState(() => {
    const base = { ...VAZIA, ...Object.fromEntries(Object.keys(VAZIA).map((c) => [c, unidade[c] ?? VAZIA[c]])) }
    base.tipo_identificador = unidade.tipo_identificador || ''
    base.identificador_legal = unidade.tipo_identificador === 'cnpj' ? formatarCnpj(unidade.identificador_legal) : unidade.identificador_legal || ''
    base.cep = formatarCep(unidade.cep || '')
    return base
  })
  const [erros, setErros] = useState({})
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)

  const mudar = (campo, formatar) => (e) => {
    const valor = formatar ? formatar(e.target.value) : e.target.value
    setForm((f) => ({ ...f, [campo]: valor }))
    setErros((x) => ({ ...x, [campo]: '' }))
  }

  async function completarCep() {
    const endereco = await buscarCep(form.cep)
    if (!endereco) return
    setForm((f) => ({ ...f, logradouro: f.logradouro || endereco.logradouro, bairro: f.bairro || endereco.bairro, cidade: endereco.cidade || f.cidade, uf: endereco.uf || f.uf }))
  }

  async function salvar(e) {
    e.preventDefault()
    setErro('')
    const e2 = {}
    if (!form.nome.trim()) e2.nome = 'Dê um nome para a unidade, como "Loja Centro".'
    if (form.tipo_identificador === 'cnpj') {
      const problema = erroCnpj(form.identificador_legal)
      if (problema) e2.identificador_legal = problema
    } else if (form.tipo_identificador && !form.identificador_legal.trim()) {
      e2.identificador_legal = 'Informe o número do documento ou escolha "Não informar".'
    }
    if (form.cep && apenasDigitos(form.cep).length !== 8) e2.cep = 'O CEP tem 8 números.'
    setErros(e2)
    if (Object.keys(e2).length) return

    const dados = {
      nome: form.nome.trim(),
      tipo_identificador: form.tipo_identificador || null,
      identificador_legal: form.tipo_identificador
        ? (form.tipo_identificador === 'cnpj' ? normalizarCnpj(form.identificador_legal) : form.identificador_legal.trim())
        : null,
      cep: apenasDigitos(form.cep) || null,
      logradouro: form.logradouro.trim() || null,
      numero: form.numero.trim() || null,
      complemento: form.complemento.trim() || null,
      bairro: form.bairro.trim() || null,
      cidade: form.cidade.trim() || null,
      uf: form.uf || null,
      fuso_horario: form.fuso_horario || FUSO_PADRAO,
    }
    setSalvando(true)
    const { error } = nova
      ? await supabase.from('filiais').insert({ ...dados, empresa_id: empresaId })
      : await supabase.from('filiais').update(dados).eq('id', unidade.id)
    setSalvando(false)
    if (error) return setErro(traduzirErro(error))
    aoSalvar(nova)
  }

  return (
    <PainelLateral
      aberto
      aoFechar={aoFechar}
      titulo={nova ? 'Nova unidade' : `Editar ${unidade.nome}`}
      subtitulo="Loja, escritório, obra ou qualquer local de trabalho."
      rodape={<><Botao variante="secundario" onClick={aoFechar}>Cancelar</Botao><Botao type="submit" form="form-unidade" carregando={salvando}>{nova ? 'Cadastrar unidade' : 'Salvar alterações'}</Botao></>}
    >
      <form id="form-unidade" className="formulario" onSubmit={salvar} noValidate>
        <Campo rotulo="Nome da unidade" value={form.nome} onChange={mudar('nome')} erro={erros.nome} placeholder="Ex.: Loja Centro" required />
        <div className="grade-campos">
          <Selecao rotulo="Documento da unidade" value={form.tipo_identificador} onChange={mudar('tipo_identificador')}
            dica="O documento que identifica o local no espelho de ponto: CNPJ da filial, ou CEI, CAEPF ou CNO para obras e pessoas físicas. Se a unidade usa o CNPJ da empresa, pode deixar como não informado."
            opcoes={[{ valor: '', rotulo: 'Não informar' }, ...Object.entries(TIPO_IDENTIFICADOR).map(([valor, rotulo]) => ({ valor, rotulo }))]} />
          {form.tipo_identificador && (
            <Campo
              rotulo={`Número do ${TIPO_IDENTIFICADOR[form.tipo_identificador]}`}
              mono
              value={form.identificador_legal}
              onChange={mudar('identificador_legal', form.tipo_identificador === 'cnpj' ? formatarCnpj : undefined)}
              placeholder={form.tipo_identificador === 'cnpj' ? '00.000.000/0000-00' : ''}
              autoCapitalize="characters"
              erro={erros.identificador_legal}
            />
          )}
        </div>
        <div className="grade-campos grade-campos--3">
          <Campo rotulo="CEP" value={form.cep} onChange={mudar('cep', formatarCep)} onBlur={completarCep} inputMode="numeric" placeholder="00000-000" erro={erros.cep} />
          <Campo rotulo="Cidade" value={form.cidade} onChange={mudar('cidade')} />
          <Selecao rotulo="UF" value={form.uf} onChange={mudar('uf')} opcoes={[{ valor: '', rotulo: 'Selecione' }, ...UFS.map((uf) => ({ valor: uf, rotulo: uf }))]} />
        </div>
        <Campo rotulo="Rua / avenida" value={form.logradouro} onChange={mudar('logradouro')} />
        <div className="grade-campos grade-campos--3">
          <Campo rotulo="Número" value={form.numero} onChange={mudar('numero')} />
          <Campo rotulo="Complemento" opcional value={form.complemento} onChange={mudar('complemento')} />
          <Campo rotulo="Bairro" value={form.bairro} onChange={mudar('bairro')} />
        </div>
        <Selecao rotulo="Fuso horário" value={form.fuso_horario} onChange={mudar('fuso_horario')}
          dica="Define o horário local usado nos relatórios e no espelho de ponto desta unidade."
          opcoes={FUSOS.map((f) => ({ valor: f.valor, rotulo: f.rotulo }))} />
        {erro && <Alerta tom="problema">{erro}</Alerta>}
      </form>
    </PainelLateral>
  )
}
