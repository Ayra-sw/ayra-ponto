import { useCallback, useEffect, useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { Search, UserPlus, Users } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../contexts/AuthContext'
import { useAvisos } from '../../contexts/AvisosContext'
import { traduzirErro } from '../../lib/mensagensErro'
import { apenasDigitos, data, formatarCpf } from '../../lib/formatos'
import { CATEGORIA, PAPEL, PAPEL_DESCRICAO, SITUACAO } from '../../lib/rotulos'
import Botao from '../../components/ui/Botao'
import Etiqueta from '../../components/ui/Etiqueta'
import Alerta from '../../components/ui/Alerta'
import { Campo, Selecao } from '../../components/ui/Campo'
import { Confirmacao, PainelLateral } from '../../components/ui/Dialogo'
import { Esqueleto, EstadoErro, EstadoVazio } from '../../components/ui/Estados'
import ConvidarPessoas from '../../components/ConvidarPessoas'

const POR_PAGINA = 25
const TOM_SITUACAO = { ativo: 'ok', afastado: 'atencao', desligado: 'neutra' }

// Lista de colaboradores com busca e filtros. O perfil completo (com abas de
// jornada, registros, banco de horas…) chega na Fase 2.
export default function Pessoas() {
  const { perfil } = useAuth()
  const { empresa, unidades, unidadesAtivas } = useOutletContext()
  const [pessoas, setPessoas] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(false)
  const [busca, setBusca] = useState('')
  const [filtroUnidade, setFiltroUnidade] = useState('')
  const [filtroSituacao, setFiltroSituacao] = useState('ativos')
  const [pagina, setPagina] = useState(1)
  const [editando, setEditando] = useState(null)
  const [convidarAberto, setConvidarAberto] = useState(false)

  const carregar = useCallback(async () => {
    setErro(false)
    const { data: lista, error } = await supabase
      .from('perfis')
      .select('*')
      .eq('empresa_id', perfil.empresa_id)
      .order('nome_completo')
    if (error) setErro(true)
    setPessoas(lista || [])
    setCarregando(false)
  }, [perfil.empresa_id])

  useEffect(() => { carregar() }, [carregar])
  useEffect(() => { setPagina(1) }, [busca, filtroUnidade, filtroSituacao])

  const nomeUnidade = useMemo(() => Object.fromEntries(unidades.map((u) => [u.id, u.nome])), [unidades])

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    return pessoas.filter((p) => {
      if (filtroSituacao === 'ativos' && p.status === 'desligado') return false
      if (filtroSituacao !== 'ativos' && filtroSituacao !== 'todos' && p.status !== filtroSituacao) return false
      if (filtroUnidade && p.filial_id !== filtroUnidade) return false
      if (termo && !`${p.nome_completo} ${p.cargo || ''} ${p.cpf || ''}`.toLowerCase().includes(termo)) return false
      return true
    })
  }, [pessoas, busca, filtroUnidade, filtroSituacao])

  const totalPaginas = Math.max(1, Math.ceil(filtradas.length / POR_PAGINA))
  const visiveis = filtradas.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA)

  function aoSalvar(atualizado) {
    setPessoas((lista) => lista.map((p) => (p.id === atualizado.id ? atualizado : p)))
    setEditando(null)
  }

  return (
    <div className="pagina">
      <div className="pagina__cabecalho">
        <div className="pagina__titulo">
          <span className="pagina__trilha">Pessoas</span>
          <h1>Colaboradores</h1>
          <p className="suave">{pessoas.filter((p) => p.status !== 'desligado').length} pessoas na empresa</p>
        </div>
        <Botao icone={UserPlus} onClick={() => setConvidarAberto(true)}>Convidar colaboradores</Botao>
      </div>

      <div className="filtros">
        <div className="campo campo--busca">
          <label className="campo__rotulo" htmlFor="busca-pessoas">Buscar</label>
          <div className="entrada-grupo">
            <input id="busca-pessoas" className="entrada" type="search" placeholder="Nome, cargo ou CPF" value={busca} onChange={(e) => setBusca(e.target.value)} />
            <span className="entrada-grupo__botao" aria-hidden="true"><Search /></span>
          </div>
        </div>
        {unidades.length > 1 && (
          <Selecao rotulo="Unidade" value={filtroUnidade} onChange={(e) => setFiltroUnidade(e.target.value)}
            opcoes={[{ valor: '', rotulo: 'Todas' }, ...unidades.map((u) => ({ valor: u.id, rotulo: u.nome }))]} />
        )}
        <Selecao rotulo="Situação" value={filtroSituacao} onChange={(e) => setFiltroSituacao(e.target.value)}
          opcoes={[
            { valor: 'ativos', rotulo: 'Ativos e afastados' },
            { valor: 'ativo', rotulo: 'Só ativos' },
            { valor: 'afastado', rotulo: 'Só afastados' },
            { valor: 'desligado', rotulo: 'Desligados' },
            { valor: 'todos', rotulo: 'Todos' },
          ]} />
      </div>

      {carregando ? <Esqueleto linhas={6} /> : erro ? <EstadoErro aoTentarDeNovo={carregar} /> : pessoas.length <= 1 ? (
        <EstadoVazio icone={Users} titulo="Você ainda é a única pessoa por aqui"
          acao={<Botao icone={UserPlus} onClick={() => setConvidarAberto(true)}>Convidar colaboradores</Botao>}>
          Envie o link de convite. Cada pessoa cria a própria senha e aparece nesta lista.
        </EstadoVazio>
      ) : filtradas.length === 0 ? (
        <EstadoVazio icone={Search} titulo="Ninguém encontrado com esses filtros"
          acao={<Botao variante="secundario" onClick={() => { setBusca(''); setFiltroUnidade(''); setFiltroSituacao('ativos') }}>Limpar filtros</Botao>}>
          Confira a busca ou mude os filtros de unidade e situação.
        </EstadoVazio>
      ) : (
        <>
          <div className="so-computador">
            <div className="tabela-envoltorio">
              <table className="tabela">
                <thead><tr><th>Nome</th><th>Papel</th><th>Unidade</th><th>Situação</th><th>Admissão</th></tr></thead>
                <tbody>
                  {visiveis.map((p) => (
                    <tr key={p.id} className="clicavel" onClick={() => setEditando(p)}>
                      <td>
                        <button type="button" className="link" style={{ textDecoration: 'none', color: 'var(--texto)' }} onClick={(e) => { e.stopPropagation(); setEditando(p) }}>
                          {p.nome_completo || '—'}
                        </button>
                        <span className="tabela__secundario">{p.cargo || (p.categoria ? CATEGORIA[p.categoria] : '')}</span>
                      </td>
                      <td>{PAPEL[p.tipo]}{p.id === perfil.id ? ' (você)' : ''}</td>
                      <td>{nomeUnidade[p.filial_id] || '—'}</td>
                      <td><Etiqueta tom={TOM_SITUACAO[p.status]}>{SITUACAO[p.status]}</Etiqueta></td>
                      <td className="mono">{p.data_admissao ? data(p.data_admissao) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="so-celular lista-cartoes">
            {visiveis.map((p) => (
              <button key={p.id} type="button" className="cartao-linha" onClick={() => setEditando(p)}>
                <span className="cartao-linha__topo">
                  <span className="cartao-linha__titulo">{p.nome_completo || '—'}</span>
                  <Etiqueta tom={TOM_SITUACAO[p.status]}>{SITUACAO[p.status]}</Etiqueta>
                </span>
                <span className="cartao-linha__detalhes">
                  <span>{PAPEL[p.tipo]}{p.id === perfil.id ? ' (você)' : ''}</span>
                  <span>{nomeUnidade[p.filial_id] || 'Sem unidade'}</span>
                  {p.cargo && <span>{p.cargo}</span>}
                </span>
              </button>
            ))}
          </div>
          {totalPaginas > 1 && (
            <div className="paginacao">
              <span>Mostrando {(pagina - 1) * POR_PAGINA + 1}–{Math.min(pagina * POR_PAGINA, filtradas.length)} de {filtradas.length}</span>
              <div className="acoes">
                <Botao variante="secundario" tamanho="pequeno" disabled={pagina === 1} onClick={() => setPagina((n) => n - 1)}>Anterior</Botao>
                <Botao variante="secundario" tamanho="pequeno" disabled={pagina === totalPaginas} onClick={() => setPagina((n) => n + 1)}>Próxima</Botao>
              </div>
            </div>
          )}
        </>
      )}

      <EditarPessoa
        pessoa={editando}
        euMesmo={perfil}
        unidadesAtivas={unidadesAtivas}
        nomeUnidade={nomeUnidade}
        aoFechar={() => setEditando(null)}
        aoSalvar={aoSalvar}
      />
      <ConvidarPessoas aberto={convidarAberto} aoFechar={() => setConvidarAberto(false)} empresa={empresa} />
    </div>
  )
}

function EditarPessoa({ pessoa, euMesmo, unidadesAtivas, nomeUnidade, aoFechar, aoSalvar }) {
  const avisar = useAvisos()
  const [form, setForm] = useState(null)
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [confirmar, setConfirmar] = useState(null) // texto da consequência

  useEffect(() => {
    if (!pessoa) return
    setErro('')
    setForm({
      nome_completo: pessoa.nome_completo || '',
      cpf: formatarCpf(pessoa.cpf || ''),
      cargo: pessoa.cargo || '',
      categoria: pessoa.categoria || '',
      data_admissao: pessoa.data_admissao || '',
      filial_id: pessoa.filial_id || '',
      status: pessoa.status,
      tipo: pessoa.tipo,
    })
  }, [pessoa])

  if (!pessoa || !form) return null

  const souAdmin = euMesmo.tipo === 'administrador'
  const ehEuMesmo = pessoa.id === euMesmo.id
  const rhEditandoAdmin = euMesmo.tipo === 'rh' && pessoa.tipo === 'administrador'
  const somenteLeitura = rhEditandoAdmin
  const podeMudarPapel = souAdmin && !ehEuMesmo
  const podeMudarSituacao = !ehEuMesmo && !somenteLeitura
  // quem não é administrador só altera o próprio nome (o resto é com o RH/admin)
  const podeEditarTrabalho = !somenteLeitura && (!ehEuMesmo || souAdmin)
  const unidadeAtualInativa = form.filial_id && !unidadesAtivas.some((u) => u.id === form.filial_id)

  const mudar = (campo) => (e) => setForm((f) => ({ ...f, [campo]: e.target.value }))

  function pedirConfirmacao(e) {
    e.preventDefault()
    setErro('')
    const cpfDigitos = apenasDigitos(form.cpf)
    if (cpfDigitos && cpfDigitos.length !== 11) return setErro('O CPF precisa ter 11 números.')
    if (!form.nome_completo.trim()) return setErro('Informe o nome.')
    if (form.status === 'desligado' && pessoa.status !== 'desligado') {
      return setConfirmar(`${form.nome_completo} não vai mais conseguir registrar o ponto. O histórico de marcações continua guardado, como a lei exige.`)
    }
    if (form.tipo !== pessoa.tipo && form.tipo === 'administrador') {
      return setConfirmar(`${form.nome_completo} terá acesso total: dados da empresa, unidades, pessoas e permissões.`)
    }
    salvar()
  }

  async function salvar() {
    setSalvando(true)
    const novos = {
      nome_completo: form.nome_completo.trim(),
      ...(podeEditarTrabalho ? {
        cpf: apenasDigitos(form.cpf) || null,
        cargo: form.cargo.trim() || null,
        categoria: form.tipo === 'funcionario' && form.categoria ? form.categoria : null,
        data_admissao: form.data_admissao || null,
        filial_id: form.filial_id || null,
      } : {}),
      ...(podeMudarSituacao ? { status: form.status } : {}),
      ...(podeMudarPapel ? { tipo: form.tipo } : {}),
    }
    // envia só o que mudou (o CPF é comparado só pelos números)
    const alteracoes = Object.fromEntries(Object.entries(novos).filter(([campo, valor]) =>
      campo === 'cpf' ? apenasDigitos(pessoa.cpf || '') !== (valor || '') : (pessoa[campo] ?? null) !== valor))
    if (Object.keys(alteracoes).length === 0) {
      setSalvando(false)
      setConfirmar(null)
      return aoFechar()
    }
    const { data: atualizado, error } = await supabase.from('perfis').update(alteracoes).eq('id', pessoa.id).select().single()
    setSalvando(false)
    setConfirmar(null)
    if (error) return setErro(traduzirErro(error))
    avisar('Cadastro atualizado.')
    aoSalvar(atualizado)
  }

  return (
    <PainelLateral
      aberto
      aoFechar={aoFechar}
      titulo={pessoa.nome_completo || 'Colaborador'}
      subtitulo={`${PAPEL[pessoa.tipo]} · ${nomeUnidade[pessoa.filial_id] || 'sem unidade'}`}
      rodape={
        <>
          <Botao variante="secundario" onClick={aoFechar}>Cancelar</Botao>
          {!somenteLeitura && <Botao type="submit" form="form-pessoa" carregando={salvando}>Salvar alterações</Botao>}
        </>
      }
    >
      <form id="form-pessoa" className="formulario" onSubmit={pedirConfirmacao}>
        {somenteLeitura && <Alerta tom="info">O cadastro de um administrador só pode ser alterado por outro administrador.</Alerta>}
        <fieldset className="formulario" disabled={somenteLeitura}>
          <div className="secao-formulario">
            <h3>Dados pessoais</h3>
            <Campo rotulo="Nome completo" value={form.nome_completo} onChange={mudar('nome_completo')} required />
            <Campo rotulo="CPF" value={form.cpf} onChange={(e) => setForm((f) => ({ ...f, cpf: formatarCpf(e.target.value) }))}
              inputMode="numeric" placeholder="000.000.000-00" ajuda="Aparece no comprovante de cada marcação." disabled={!podeEditarTrabalho} />
          </div>
          {!podeEditarTrabalho && !somenteLeitura && (
            <Alerta tom="info">Seus dados de trabalho, unidade e papel são alterados pelo administrador da empresa.</Alerta>
          )}
          <fieldset className="secao-formulario" disabled={!podeEditarTrabalho}>
            <h3>Trabalho</h3>
            <div className="grade-campos">
              <Campo rotulo="Cargo" opcional value={form.cargo} onChange={mudar('cargo')} placeholder="Ex.: Vendedora" />
              <Campo rotulo="Data de admissão" opcional type="date" value={form.data_admissao} onChange={mudar('data_admissao')} />
            </div>
            {form.tipo === 'funcionario' && (
              <Selecao rotulo="Categoria" opcional value={form.categoria} onChange={mudar('categoria')}
                opcoes={[{ valor: '', rotulo: 'Não informada' }, ...Object.entries(CATEGORIA).map(([valor, rotulo]) => ({ valor, rotulo }))]} />
            )}
            <Selecao rotulo="Unidade" value={form.filial_id} onChange={mudar('filial_id')}
              dica="A unidade onde a pessoa trabalha. Cada unidade tem sua própria sequência de registros (NSR)."
              erro={unidadeAtualInativa ? 'A unidade atual está desativada. Escolha outra.' : ''}>
              {!form.filial_id && <option value="">Escolha uma unidade</option>}
              {unidadeAtualInativa && <option value={form.filial_id}>{nomeUnidade[form.filial_id]} (desativada)</option>}
              {unidadesAtivas.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
            </Selecao>
            <Selecao rotulo="Situação" value={form.status} onChange={mudar('status')} disabled={!podeMudarSituacao}
              ajuda={ehEuMesmo ? 'Você não pode alterar a sua própria situação.' : 'Desligados não conseguem registrar ponto; o histórico continua guardado.'}
              opcoes={Object.entries(SITUACAO).map(([valor, rotulo]) => ({ valor, rotulo }))} />
          </fieldset>
          <div className="secao-formulario">
            <h3>Papel no sistema</h3>
            {podeMudarPapel ? (
              <fieldset className="opcoes">
                <legend className="sr-only">Papel</legend>
                {Object.entries(PAPEL).map(([valor, rotulo]) => (
                  <label key={valor} className="opcao">
                    <input type="radio" name="papel" value={valor} checked={form.tipo === valor} onChange={mudar('tipo')} />
                    <span><span className="opcao__titulo">{rotulo}</span><br /><span className="opcao__desc">{PAPEL_DESCRICAO[valor]}</span></span>
                  </label>
                ))}
              </fieldset>
            ) : (
              <p className="suave pequeno">
                <strong>{PAPEL[pessoa.tipo]}</strong>: {PAPEL_DESCRICAO[pessoa.tipo]}{' '}
                {ehEuMesmo ? 'Você não pode alterar o seu próprio papel.' : 'Só o administrador altera papéis.'}
              </p>
            )}
          </div>
        </fieldset>
        {erro && <Alerta tom="problema">{erro}</Alerta>}
      </form>

      <Confirmacao
        aberta={Boolean(confirmar)}
        titulo="Confirmar alteração"
        textoConfirmar="Salvar mesmo assim"
        perigo={form.status === 'desligado'}
        carregando={salvando}
        aoConfirmar={salvar}
        aoCancelar={() => setConfirmar(null)}
      >
        {confirmar}
      </Confirmacao>
    </PainelLateral>
  )
}
