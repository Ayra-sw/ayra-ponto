import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useOutletContext, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, UserRoundX } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../contexts/AuthContext'
import { useAvisos } from '../../contexts/AvisosContext'
import { traduzirErro } from '../../lib/mensagensErro'
import { apenasDigitos, duracao, formatarCpf, formatarTelefone } from '../../lib/formatos'
import { CATEGORIA, PAPEL, PAPEL_DESCRICAO, SITUACAO } from '../../lib/rotulos'
import { cargaSemanal, diasParaFormulario, resumoHorarios } from '../../lib/jornadas'
import { TIPOS_ESCALA, horarioDoTurno, proximosPlantoes12x36 } from '../../lib/escalas'
import { data as formatarData } from '../../lib/formatos'
import Botao from '../../components/ui/Botao'
import Etiqueta from '../../components/ui/Etiqueta'
import Alerta from '../../components/ui/Alerta'
import { Campo, Selecao } from '../../components/ui/Campo'
import { Confirmacao } from '../../components/ui/Dialogo'
import { Esqueleto, EstadoErro, EstadoVazio } from '../../components/ui/Estados'
import HistoricoMarcacoes from '../../components/marcacoes/HistoricoMarcacoes'
import EspelhoMensal from '../../components/espelho/EspelhoMensal'
import BancoHoras from '../../components/banco/BancoHoras'
import Afastamentos from '../../components/afastamentos/Afastamentos'
import ListaSolicitacoes from '../../components/marcacoes/ListaSolicitacoes'

const TOM_SITUACAO = { ativo: 'ok', afastado: 'atencao', desligado: 'neutra' }
const ABAS = [
  { id: 'dados', rotulo: 'Dados', formulario: true },
  { id: 'trabalho', rotulo: 'Trabalho', formulario: true },
  { id: 'acesso', rotulo: 'Acesso', formulario: true },
  { id: 'marcacoes', rotulo: 'Marcações' },
  { id: 'espelho', rotulo: 'Espelho' },
  { id: 'banco', rotulo: 'Banco de horas' },
  { id: 'afastamentos', rotulo: 'Afastamentos' },
  { id: 'solicitacoes', rotulo: 'Solicitações' },
]

function formularioDe(p) {
  return {
    nome_completo: p.nome_completo || '',
    cpf: formatarCpf(p.cpf || ''),
    matricula: p.matricula || '',
    telefone: formatarTelefone(p.telefone || ''),
    cargo_id: p.cargo_id || '',
    departamento_id: p.departamento_id || '',
    modelo_jornada_id: p.modelo_jornada_id || '',
    categoria: p.categoria || '',
    data_admissao: p.data_admissao || '',
    filial_id: p.filial_id || '',
    tipo_escala: p.tipo_escala || 'semanal',
    escala_turno_id: p.escala_turno_id || '',
    escala_referencia: p.escala_referencia || '',
    status: p.status,
    tipo: p.tipo,
  }
}

// Ficha completa do colaborador, com abas. Administrador e RH.
export default function PerfilPessoa() {
  const { id } = useParams()
  const { perfil: eu } = useAuth()
  const { unidades, unidadesAtivas } = useOutletContext()
  const avisar = useAvisos()
  const [busca, setBusca] = useSearchParams()
  const aba = ABAS.some((a) => a.id === busca.get('aba')) ? busca.get('aba') : 'dados'

  const [pessoa, setPessoa] = useState(null)
  const [cadastros, setCadastros] = useState({ departamentos: [], cargos: [], modelos: [], dias: [], turnos: [] })
  const [form, setForm] = useState(null)
  const [carregando, setCarregando] = useState(true)
  const [erroCarga, setErroCarga] = useState(false)
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [confirmar, setConfirmar] = useState(null)

  const carregar = useCallback(async () => {
    setErroCarga(false)
    const [p, d, c, m, dias, turnos] = await Promise.all([
      supabase.from('perfis').select('*').eq('id', id).eq('empresa_id', eu.empresa_id).maybeSingle(),
      supabase.from('departamentos').select('id, nome, ativo').eq('empresa_id', eu.empresa_id).order('nome'),
      supabase.from('cargos').select('id, nome, ativo').eq('empresa_id', eu.empresa_id).order('nome'),
      supabase.from('modelos_jornada').select('id, nome, ativo').eq('empresa_id', eu.empresa_id).order('nome'),
      supabase.from('modelos_jornada_dias').select('*'),
      supabase.from('turnos').select('id, nome, sigla, entrada, saida, ativo').eq('empresa_id', eu.empresa_id).order('nome'),
    ])
    if (p.error || d.error || c.error || m.error || dias.error) setErroCarga(true)
    setPessoa(p.data || null)
    setForm(p.data ? formularioDe(p.data) : null)
    setCadastros({ departamentos: d.data || [], cargos: c.data || [], modelos: m.data || [], dias: dias.data || [], turnos: turnos.data || [] })
    setCarregando(false)
  }, [id, eu.empresa_id])

  useEffect(() => { setCarregando(true); carregar() }, [carregar])

  const souAdmin = eu.tipo === 'administrador'
  const ehEuMesmo = pessoa?.id === eu.id
  const somenteLeitura = eu.tipo === 'rh' && pessoa?.tipo === 'administrador'
  const podeMudarPapel = souAdmin && !ehEuMesmo
  const podeMudarSituacao = !ehEuMesmo && !somenteLeitura
  // quem não é administrador só altera nome e telefone (o resto é com o RH/admin)
  const podeEditarTrabalho = !somenteLeitura && (!ehEuMesmo || souAdmin)

  const nomeUnidade = useMemo(() => Object.fromEntries(unidades.map((u) => [u.id, u.nome])), [unidades])

  // Só o que mudou vai para o banco
  const alteracoes = useMemo(() => {
    if (!pessoa || !form) return {}
    const vazio = (v) => (v === '' ? null : v)
    const novos = {
      nome_completo: form.nome_completo.trim(),
      ...(!somenteLeitura ? { telefone: apenasDigitos(form.telefone) || null } : {}),
      ...(podeEditarTrabalho ? {
        cpf: apenasDigitos(form.cpf) || null,
        matricula: form.matricula.trim() || null,
        cargo_id: vazio(form.cargo_id),
        departamento_id: vazio(form.departamento_id),
        modelo_jornada_id: vazio(form.modelo_jornada_id),
        categoria: form.tipo === 'funcionario' ? vazio(form.categoria) : null,
        data_admissao: vazio(form.data_admissao),
        filial_id: vazio(form.filial_id),
      } : {}),
      // (só depois que a migração da Fase 2D foi rodada, quando o cadastro já traz o tipo de escala)
      ...(podeEditarTrabalho && 'tipo_escala' in pessoa ? {
        tipo_escala: form.tipo_escala,
        escala_turno_id: form.tipo_escala === '12x36' ? vazio(form.escala_turno_id) : null,
        escala_referencia: form.tipo_escala === '12x36' ? vazio(form.escala_referencia) : null,
      } : {}),
      ...(podeMudarSituacao ? { status: form.status } : {}),
      ...(podeMudarPapel ? { tipo: form.tipo } : {}),
    }
    return Object.fromEntries(Object.entries(novos).filter(([campo, valor]) =>
      campo === 'cpf' ? apenasDigitos(pessoa.cpf || '') !== (valor || '') : (pessoa[campo] ?? null) !== valor))
  }, [pessoa, form, somenteLeitura, podeEditarTrabalho, podeMudarSituacao, podeMudarPapel])

  const alterado = Object.keys(alteracoes).length > 0

  useEffect(() => {
    if (!alterado) return
    const avisarSaida = (e) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', avisarSaida)
    return () => window.removeEventListener('beforeunload', avisarSaida)
  }, [alterado])

  if (carregando) return <div className="pagina"><Esqueleto blocos={1} linhas={5} /></div>
  if (erroCarga && !pessoa) return <div className="pagina"><EstadoErro aoTentarDeNovo={carregar} /></div>
  if (!pessoa || !form) {
    return (
      <div className="pagina">
        <EstadoVazio icone={UserRoundX} titulo="Colaborador não encontrado"
          acao={<Link to="/gestao/pessoas" className="btn btn--secundario">Voltar para Colaboradores</Link>}>
          Esse cadastro não existe ou não pertence à sua empresa.
        </EstadoVazio>
      </div>
    )
  }

  const mudar = (campo) => (e) => { setErro(''); setForm((f) => ({ ...f, [campo]: e.target.value })) }
  const irParaAba = (novaAba) => setBusca(novaAba === 'dados' ? {} : { aba: novaAba }, { replace: true })

  function pedirConfirmacao(e) {
    e.preventDefault()
    setErro('')
    const cpfDigitos = apenasDigitos(form.cpf)
    if (!form.nome_completo.trim()) { irParaAba('dados'); return setErro('Informe o nome.') }
    if (cpfDigitos && cpfDigitos.length !== 11) { irParaAba('dados'); return setErro('O CPF precisa ter 11 números.') }
    const tel = apenasDigitos(form.telefone)
    if (tel && (tel.length < 10 || tel.length > 11)) { irParaAba('dados'); return setErro('O telefone precisa ter DDD e 8 ou 9 números.') }
    if (form.tipo_escala === '12x36' && (!form.escala_turno_id || !form.escala_referencia)) {
      irParaAba('trabalho')
      return setErro('Na escala 12x36, escolha o turno e o primeiro dia de trabalho.')
    }
    if (form.status === 'desligado' && pessoa.status !== 'desligado') {
      return setConfirmar(`${form.nome_completo} não vai mais conseguir registrar o ponto. O histórico de marcações continua guardado, como a lei exige.`)
    }
    if (form.tipo !== pessoa.tipo && form.tipo === 'administrador') {
      return setConfirmar(`${form.nome_completo} terá acesso total: dados da empresa, unidades, pessoas e permissões.`)
    }
    salvar()
  }

  async function salvar() {
    if (!alterado) return setConfirmar(null)
    setSalvando(true)
    const { data: atualizado, error } = await supabase.from('perfis').update(alteracoes).eq('id', pessoa.id).select().single()
    setSalvando(false)
    setConfirmar(null)
    if (error) return setErro(traduzirErro(error))
    avisar('Cadastro atualizado.')
    setPessoa(atualizado)
    setForm(formularioDe(atualizado))
  }

  function descartar() {
    setErro('')
    setForm(formularioDe(pessoa))
  }

  const abaAtual = ABAS.find((a) => a.id === aba)
  const dep = cadastros.departamentos.find((x) => x.id === pessoa.departamento_id)
  const subtitulo = [pessoa.cargo, dep?.nome, nomeUnidade[pessoa.filial_id]].filter(Boolean).join(' · ')

  // Opções de seleção: só ativos, mais o valor atual mesmo que desativado
  const opcoesDe = (lista, atual) => lista
    .filter((x) => x.ativo || x.id === atual)
    .map((x) => ({ valor: x.id, rotulo: x.ativo ? x.nome : `${x.nome} (desativado)` }))
  const modeloEscolhido = cadastros.modelos.find((m) => m.id === form.modelo_jornada_id)
  const diasDoModelo = cadastros.dias.filter((d) => d.modelo_id === form.modelo_jornada_id)
  const escalaDisponivel = 'tipo_escala' in pessoa
  const unidadeAtualInativa = form.filial_id && !unidadesAtivas.some((u) => u.id === form.filial_id)

  return (
    <div className="pagina">
      <div className="pagina__cabecalho">
        <div className="pagina__titulo">
          <Link to="/gestao/pessoas" className="pagina__trilha link link--suave" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <ArrowLeft size={14} aria-hidden="true" /> Colaboradores
          </Link>
          <h1>{pessoa.nome_completo || 'Colaborador'}{ehEuMesmo ? ' (você)' : ''}</h1>
          <p className="suave">{subtitulo || 'Cadastro sem cargo, departamento e unidade'}</p>
        </div>
        <div className="linha">
          <Etiqueta tom="info" icone={false}>{PAPEL[pessoa.tipo]}</Etiqueta>
          <Etiqueta tom={TOM_SITUACAO[pessoa.status]}>{SITUACAO[pessoa.status]}</Etiqueta>
        </div>
      </div>

      <div className="abas" role="tablist" aria-label="Seções do cadastro">
        {ABAS.map((a) => (
          <button key={a.id} type="button" role="tab" aria-selected={aba === a.id} className="abas__item" onClick={() => irParaAba(a.id)}>{a.rotulo}</button>
        ))}
      </div>

      {somenteLeitura && <Alerta tom="info">O cadastro de um administrador só pode ser alterado por outro administrador.</Alerta>}

      {abaAtual.formulario ? (
        <form id="form-pessoa" className="formulario" onSubmit={pedirConfirmacao} noValidate>
          <fieldset className="cartao formulario" disabled={somenteLeitura}>
            {aba === 'dados' && (
              <div className="secao-formulario">
                <h2>Dados pessoais</h2>
                <Campo rotulo="Nome completo" value={form.nome_completo} onChange={mudar('nome_completo')} required autoComplete="off" />
                <div className="grade-campos">
                  <Campo rotulo="CPF" value={form.cpf} onChange={(e) => { setErro(''); setForm((f) => ({ ...f, cpf: formatarCpf(e.target.value) })) }}
                    inputMode="numeric" placeholder="000.000.000-00" ajuda="Aparece no comprovante de cada marcação." disabled={!podeEditarTrabalho} />
                  <Campo rotulo="Matrícula" opcional value={form.matricula} onChange={mudar('matricula')} maxLength={30} disabled={!podeEditarTrabalho}
                    ajuda="Código interno da pessoa na empresa." />
                </div>
                <Campo rotulo="Telefone" opcional value={form.telefone} onChange={(e) => { setErro(''); setForm((f) => ({ ...f, telefone: formatarTelefone(e.target.value) })) }}
                  inputMode="tel" placeholder="(00) 00000-0000" autoComplete="off" />
              </div>
            )}

            {aba === 'trabalho' && (
              <div className="secao-formulario">
                <h2>Trabalho</h2>
                {!podeEditarTrabalho && !somenteLeitura && (
                  <Alerta tom="info">Seus dados de trabalho, unidade e papel são alterados pelo administrador da empresa.</Alerta>
                )}
                <fieldset className="formulario" disabled={!podeEditarTrabalho}>
                  <Selecao rotulo="Unidade" value={form.filial_id} onChange={mudar('filial_id')}
                    dica="A unidade onde a pessoa trabalha. Cada unidade tem sua própria sequência de registros (NSR)."
                    erro={unidadeAtualInativa ? 'A unidade atual está desativada. Escolha outra.' : ''}>
                    {!form.filial_id && <option value="">Escolha uma unidade</option>}
                    {unidadeAtualInativa && <option value={form.filial_id}>{nomeUnidade[form.filial_id]} (desativada)</option>}
                    {unidadesAtivas.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
                  </Selecao>
                  <div className="grade-campos">
                    <Selecao rotulo="Departamento" opcional value={form.departamento_id} onChange={mudar('departamento_id')}
                      ajuda={cadastros.departamentos.length === 0 ? 'Nenhum departamento cadastrado ainda.' : undefined}
                      opcoes={[{ valor: '', rotulo: 'Sem departamento' }, ...opcoesDe(cadastros.departamentos, form.departamento_id)]} />
                    <Selecao rotulo="Cargo" opcional value={form.cargo_id} onChange={mudar('cargo_id')}
                      ajuda={!pessoa.cargo_id && pessoa.cargo ? `Cargo anterior (texto livre): ${pessoa.cargo}. Escolha um da lista para substituir.` : cadastros.cargos.length === 0 ? 'Nenhum cargo cadastrado ainda.' : undefined}
                      opcoes={[{ valor: '', rotulo: 'Sem cargo' }, ...opcoesDe(cadastros.cargos, form.cargo_id)]} />
                  </div>
                  {escalaDisponivel && (
                    <>
                      <Selecao rotulo="Como a pessoa trabalha" value={form.tipo_escala} onChange={mudar('tipo_escala')}
                        dica="Jornada semanal: horários fixos por dia da semana. 12x36: trabalha um dia e folga o seguinte. Calendário: você marca, dia a dia, o turno de cada um."
                        ajuda={TIPOS_ESCALA.find((t) => t.valor === form.tipo_escala)?.descricao}
                        opcoes={TIPOS_ESCALA.map((t) => ({ valor: t.valor, rotulo: t.rotulo }))} />
                      {form.tipo_escala === '12x36' && (
                        <div className="grade-campos">
                          <Selecao rotulo="Turno" value={form.escala_turno_id} onChange={mudar('escala_turno_id')}
                            ajuda={cadastros.turnos.length === 0 ? 'Nenhum turno cadastrado ainda.' : undefined}>
                            {!form.escala_turno_id && <option value="">Escolha um turno</option>}
                            {cadastros.turnos.filter((t) => t.ativo || t.id === form.escala_turno_id).map((t) => (
                              <option key={t.id} value={t.id}>{t.nome} ({horarioDoTurno(t)}){t.ativo ? '' : ' (desativado)'}</option>
                            ))}
                          </Selecao>
                          <Campo rotulo="Primeiro dia de trabalho" type="date" value={form.escala_referencia} onChange={mudar('escala_referencia')}
                            ajuda={form.escala_referencia
                              ? `Próximos plantões: ${proximosPlantoes12x36(form.escala_referencia).map((d) => formatarData(d).slice(0, 5)).join(', ')}`
                              : 'A pessoa trabalha neste dia, folga no seguinte, e assim por diante.'} />
                        </div>
                      )}
                      {form.tipo_escala === 'calendario' && (
                        <p className="suave pequeno">
                          Os dias de trabalho ficam na grade do mês, em <Link to="/gestao/escalas?aba=calendario" className="link">Escalas</Link>. Dia sem turno é folga.
                        </p>
                      )}
                    </>
                  )}
                  <Selecao rotulo={form.tipo_escala !== 'semanal' && escalaDisponivel ? 'Jornada (tolerância e banco de horas)' : 'Jornada de trabalho'} opcional value={form.modelo_jornada_id} onChange={mudar('modelo_jornada_id')}
                    ajuda={form.tipo_escala !== 'semanal' && escalaDisponivel
                      ? 'Os horários vêm da escala. A jornada escolhida vale só para a tolerância de atraso e para o banco de horas.'
                      : modeloEscolhido
                      ? `${resumoHorarios(diasDoModelo)} · ${duracao(cargaSemanal(diasParaFormulario(diasDoModelo)))} por semana`
                      : cadastros.modelos.length === 0 ? 'Nenhuma jornada cadastrada ainda.' : 'Os horários previstos de trabalho desta pessoa.'}
                    opcoes={[{ valor: '', rotulo: 'Sem jornada definida' }, ...opcoesDe(cadastros.modelos, form.modelo_jornada_id)]} />
                  <p className="suave pequeno">
                    Falta algum na lista? Cadastre em <Link to="/gestao/departamentos" className="link">Departamentos</Link>, <Link to="/gestao/cargos" className="link">Cargos</Link> ou <Link to="/gestao/jornadas" className="link">Jornadas</Link>.
                  </p>
                  <div className="grade-campos">
                    <Campo rotulo="Data de admissão" opcional type="date" value={form.data_admissao} onChange={mudar('data_admissao')} />
                    {form.tipo === 'funcionario' && (
                      <Selecao rotulo="Categoria" opcional value={form.categoria} onChange={mudar('categoria')}
                        opcoes={[{ valor: '', rotulo: 'Não informada' }, ...Object.entries(CATEGORIA).map(([valor, rotulo]) => ({ valor, rotulo }))]} />
                    )}
                  </div>
                </fieldset>
                <Selecao rotulo="Situação" value={form.status} onChange={mudar('status')} disabled={!podeMudarSituacao || somenteLeitura}
                  ajuda={ehEuMesmo ? 'Você não pode alterar a sua própria situação.' : 'Desligados não conseguem registrar ponto; o histórico continua guardado.'}
                  opcoes={Object.entries(SITUACAO).map(([valor, rotulo]) => ({ valor, rotulo }))} />
              </div>
            )}

            {aba === 'acesso' && (
              <div className="secao-formulario">
                <h2>Papel no sistema</h2>
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
                  <p className="suave">
                    <strong>{PAPEL[pessoa.tipo]}</strong>: {PAPEL_DESCRICAO[pessoa.tipo]}{' '}
                    {ehEuMesmo ? 'Você não pode alterar o seu próprio papel.' : 'Só o administrador altera papéis.'}
                  </p>
                )}
              </div>
            )}
          </fieldset>

          {erro && <Alerta tom="problema">{erro}</Alerta>}

          {!somenteLeitura && (
            <div className="barra-salvar">
              <span className="suave pequeno">{alterado ? 'Você tem alterações não salvas.' : 'Nenhuma alteração.'}</span>
              <div className="acoes">
                <Botao variante="secundario" onClick={descartar} disabled={!alterado || salvando}>Descartar</Botao>
                <Botao type="submit" carregando={salvando} disabled={!alterado}>Salvar alterações</Botao>
              </div>
            </div>
          )}
        </form>
      ) : aba === 'marcacoes' ? (
        <HistoricoMarcacoes perfilId={pessoa.id} />
      ) : aba === 'espelho' ? (
        <EspelhoMensal perfilId={pessoa.id} mesInicial={busca.get('mes')}
          aoMudarMes={(m) => setBusca({ aba: 'espelho', mes: m }, { replace: true })} />
      ) : aba === 'banco' ? (
        <BancoHoras perfilId={pessoa.id} nomePessoa={pessoa.nome_completo} podeLancar={!ehEuMesmo} />
      ) : aba === 'afastamentos' ? (
        <Afastamentos perfilId={pessoa.id} nomePessoa={pessoa.nome_completo} podeRegistrar={!ehEuMesmo} />
      ) : (
        <div className="pilha">
          <ListaSolicitacoes perfilId={pessoa.id} textoVazio="Esta pessoa ainda não enviou pedidos de ajuste, abono ou folga." />
          <p className="suave pequeno">Para aprovar ou recusar, use a tela <Link to="/gestao/solicitacoes" className="link">Solicitações</Link>.</p>
        </div>
      )}

      <Confirmacao
        aberta={Boolean(confirmar)} titulo="Confirmar alteração" textoConfirmar="Salvar mesmo assim"
        perigo={form.status === 'desligado'} carregando={salvando}
        aoConfirmar={salvar} aoCancelar={() => setConfirmar(null)}
      >
        {confirmar}
      </Confirmacao>
    </div>
  )
}
