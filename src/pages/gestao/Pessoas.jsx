import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useOutletContext } from 'react-router-dom'
import { Search, UserPlus, Users } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../contexts/AuthContext'
import { data } from '../../lib/formatos'
import { CATEGORIA, PAPEL, SITUACAO } from '../../lib/rotulos'
import Botao from '../../components/ui/Botao'
import Etiqueta from '../../components/ui/Etiqueta'
import Alerta from '../../components/ui/Alerta'
import { Selecao } from '../../components/ui/Campo'
import { Esqueleto, EstadoErro, EstadoVazio } from '../../components/ui/Estados'
import ConvidarPessoas from '../../components/ConvidarPessoas'

const POR_PAGINA = 25
const TOM_SITUACAO = { ativo: 'ok', afastado: 'atencao', desligado: 'neutra' }

// Lista de colaboradores com busca e filtros. Ao clicar numa pessoa abre a
// ficha completa (dados, trabalho, acesso, marcações e solicitações).
export default function Pessoas() {
  const { perfil } = useAuth()
  const navegar = useNavigate()
  const { empresa, unidades } = useOutletContext()
  const [pessoas, setPessoas] = useState([])
  const [departamentos, setDepartamentos] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(false)
  const [busca, setBusca] = useState('')
  const [filtroUnidade, setFiltroUnidade] = useState('')
  const [filtroDepartamento, setFiltroDepartamento] = useState('')
  const [filtroSituacao, setFiltroSituacao] = useState('ativos')
  const [pagina, setPagina] = useState(1)
  const [convidarAberto, setConvidarAberto] = useState(false)

  const carregar = useCallback(async () => {
    setErro(false)
    const [p, d] = await Promise.all([
      supabase.from('perfis').select('*').eq('empresa_id', perfil.empresa_id).order('nome_completo'),
      supabase.from('departamentos').select('id, nome').eq('empresa_id', perfil.empresa_id).order('nome'),
    ])
    if (p.error || d.error) setErro(true)
    setPessoas(p.data || [])
    setDepartamentos(d.data || [])
    setCarregando(false)
  }, [perfil.empresa_id])

  useEffect(() => { carregar() }, [carregar])
  useEffect(() => { setPagina(1) }, [busca, filtroUnidade, filtroDepartamento, filtroSituacao])

  const nomeUnidade = useMemo(() => Object.fromEntries(unidades.map((u) => [u.id, u.nome])), [unidades])
  const nomeDepartamento = useMemo(() => Object.fromEntries(departamentos.map((d) => [d.id, d.nome])), [departamentos])

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    return pessoas.filter((p) => {
      if (filtroSituacao === 'ativos' && p.status === 'desligado') return false
      if (filtroSituacao !== 'ativos' && filtroSituacao !== 'todos' && p.status !== filtroSituacao) return false
      if (filtroUnidade && p.filial_id !== filtroUnidade) return false
      if (filtroDepartamento && p.departamento_id !== filtroDepartamento) return false
      if (termo && !`${p.nome_completo} ${p.cargo || ''} ${p.cpf || ''} ${p.matricula || ''}`.toLowerCase().includes(termo)) return false
      return true
    })
  }, [pessoas, busca, filtroUnidade, filtroDepartamento, filtroSituacao])

  const totalPaginas = Math.max(1, Math.ceil(filtradas.length / POR_PAGINA))
  const visiveis = filtradas.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA)
  const abrir = (p) => navegar(`/gestao/pessoas/${p.id}`)

  return (
    <div className="pagina">
      <div className="pagina__cabecalho">
        <div className="pagina__titulo">
          <span className="pagina__trilha">Pessoas</span>
          <h1>Colaboradores</h1>
          <p className="suave">{(() => { const n = pessoas.filter((p) => p.status !== 'desligado').length; return `${n} ${n === 1 ? 'pessoa' : 'pessoas'} na empresa` })()}</p>
        </div>
        <Botao icone={UserPlus} onClick={() => setConvidarAberto(true)}>Convidar colaboradores</Botao>
      </div>

      <div className="filtros">
        <div className="campo campo--busca">
          <label className="campo__rotulo" htmlFor="busca-pessoas">Buscar</label>
          <div className="entrada-grupo">
            <input id="busca-pessoas" className="entrada" type="search" placeholder="Nome, cargo, CPF ou matrícula" value={busca} onChange={(e) => setBusca(e.target.value)} />
            <span className="entrada-grupo__botao" aria-hidden="true"><Search /></span>
          </div>
        </div>
        {unidades.length > 1 && (
          <Selecao rotulo="Unidade" value={filtroUnidade} onChange={(e) => setFiltroUnidade(e.target.value)}
            opcoes={[{ valor: '', rotulo: 'Todas' }, ...unidades.map((u) => ({ valor: u.id, rotulo: u.nome }))]} />
        )}
        {departamentos.length > 0 && (
          <Selecao rotulo="Departamento" value={filtroDepartamento} onChange={(e) => setFiltroDepartamento(e.target.value)}
            opcoes={[{ valor: '', rotulo: 'Todos' }, ...departamentos.map((d) => ({ valor: d.id, rotulo: d.nome }))]} />
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

      {carregando ? <Esqueleto linhas={6} /> : erro ? <EstadoErro aoTentarDeNovo={carregar} /> : pessoas.length === 0 ? (
        <EstadoVazio icone={Users} titulo="Nenhum colaborador por aqui"
          acao={<Botao icone={UserPlus} onClick={() => setConvidarAberto(true)}>Convidar colaboradores</Botao>}>
          Envie o link de convite. Cada pessoa cria a própria senha e aparece nesta lista.
        </EstadoVazio>
      ) : filtradas.length === 0 ? (
        <EstadoVazio icone={Search} titulo="Ninguém encontrado com esses filtros"
          acao={<Botao variante="secundario" onClick={() => { setBusca(''); setFiltroUnidade(''); setFiltroDepartamento(''); setFiltroSituacao('ativos') }}>Limpar filtros</Botao>}>
          Confira a busca ou mude os filtros.
        </EstadoVazio>
      ) : (
        <>
          {pessoas.length === 1 && (
            <Alerta tom="info">
              Por enquanto você é a única pessoa aqui. Clique no seu nome para abrir a sua ficha, ou use o botão “Convidar colaboradores” para chamar a sua equipe.
            </Alerta>
          )}
          <div className="so-computador">
            <div className="tabela-envoltorio">
              <table className="tabela">
                <thead><tr><th>Nome</th><th>Papel</th><th>Departamento</th><th>Unidade</th><th>Situação</th><th>Admissão</th></tr></thead>
                <tbody>
                  {visiveis.map((p) => (
                    <tr key={p.id} className="clicavel" onClick={() => abrir(p)}>
                      <td>
                        <Link to={`/gestao/pessoas/${p.id}`} className="link" style={{ textDecoration: 'none', color: 'var(--texto)' }} onClick={(e) => e.stopPropagation()}>
                          {p.nome_completo || '—'}
                        </Link>
                        <span className="tabela__secundario">{p.cargo || (p.categoria ? CATEGORIA[p.categoria] : '')}</span>
                      </td>
                      <td>{PAPEL[p.tipo]}{p.id === perfil.id ? ' (você)' : ''}</td>
                      <td>{nomeDepartamento[p.departamento_id] || '—'}</td>
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
              <Link key={p.id} to={`/gestao/pessoas/${p.id}`} className="cartao-linha" style={{ textDecoration: 'none', color: 'inherit' }}>
                <span className="cartao-linha__topo">
                  <span className="cartao-linha__titulo">{p.nome_completo || '—'}</span>
                  <Etiqueta tom={TOM_SITUACAO[p.status]}>{SITUACAO[p.status]}</Etiqueta>
                </span>
                <span className="cartao-linha__detalhes">
                  <span>{PAPEL[p.tipo]}{p.id === perfil.id ? ' (você)' : ''}</span>
                  <span>{nomeUnidade[p.filial_id] || 'Sem unidade'}</span>
                  {nomeDepartamento[p.departamento_id] && <span>{nomeDepartamento[p.departamento_id]}</span>}
                  {p.cargo && <span>{p.cargo}</span>}
                </span>
              </Link>
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

      <ConvidarPessoas aberto={convidarAberto} aoFechar={() => setConvidarAberto(false)} empresa={empresa} />
    </div>
  )
}
