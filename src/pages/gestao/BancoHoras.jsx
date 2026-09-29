import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { FileSpreadsheet, PiggyBank, Search } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../contexts/AuthContext'
import { traduzirErro } from '../../lib/mensagensErro'
import { data as formatarData, duracao } from '../../lib/formatos'
import { baixarCsv } from '../../lib/apuracao'
import { minutosComSinal, tomDoSaldoBanco } from '../../lib/bancoHoras'
import Botao from '../../components/ui/Botao'
import Etiqueta from '../../components/ui/Etiqueta'
import Indicador from '../../components/ui/Indicador'
import { Selecao } from '../../components/ui/Campo'
import { Esqueleto, EstadoErro, EstadoVazio } from '../../components/ui/Estados'

// Banco de horas de toda a equipe (só quem tem jornada com banco de horas).
export default function BancoHorasEquipe() {
  const { perfil } = useAuth()
  const [linhas, setLinhas] = useState([])
  const [departamentos, setDepartamentos] = useState([])
  const [filtroDepartamento, setFiltroDepartamento] = useState('')
  const [termo, setTermo] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')

  const carregar = useCallback(async () => {
    setErro('')
    setCarregando(true)
    const [resumo, deptos] = await Promise.all([
      supabase.rpc('resumo_banco_horas', { p_departamento: filtroDepartamento || null }),
      supabase.from('departamentos').select('id, nome').eq('empresa_id', perfil.empresa_id).order('nome'),
    ])
    if (resumo.error) { setErro(traduzirErro(resumo.error)); setLinhas([]) } else setLinhas(resumo.data || [])
    setDepartamentos(deptos.data || [])
    setCarregando(false)
  }, [filtroDepartamento, perfil.empresa_id])

  useEffect(() => { carregar() }, [carregar])

  const visiveis = useMemo(() => {
    const t = termo.trim().toLowerCase()
    return t ? linhas.filter((l) => `${l.nome_completo} ${l.matricula || ''}`.toLowerCase().includes(t)) : linhas
  }, [linhas, termo])

  const soma = (campo, lista = visiveis) => lista.reduce((total, l) => total + Number(l[campo] || 0), 0)
  const linkPessoa = (l) => `/gestao/pessoas/${l.perfil_id}?aba=banco`
  const comVencido = visiveis.filter((l) => Number(l.vencido_min) > 0).length
  const positivos = soma('saldo_min', visiveis.filter((l) => Number(l.saldo_min) > 0))
  const negativos = soma('saldo_min', visiveis.filter((l) => Number(l.saldo_min) < 0))

  const baixar = () => baixarCsv(
    'banco-de-horas.csv',
    ['Nome', 'Matrícula', 'Saldo (h)', 'Vencem em 30 dias (h)', 'Vencidas a pagar (h)', 'Próximo vencimento'],
    visiveis.map((l) => {
      const h = (m) => (Number(m) / 60).toFixed(2).replace('.', ',')
      return [l.nome_completo, l.matricula || '', h(l.saldo_min), h(l.a_vencer_min), h(l.vencido_min), l.proximo_vencimento ? formatarData(l.proximo_vencimento) : '']
    }),
  )

  return (
    <div className="pagina">
      <div className="pagina__cabecalho">
        <div className="pagina__titulo">
          <span className="pagina__trilha">Jornada</span>
          <h1>Banco de horas</h1>
          <p className="suave">Saldo de cada pessoa cuja jornada usa banco de horas. Para ligar o banco, edite a jornada.</p>
        </div>
        <Botao variante="secundario" icone={FileSpreadsheet} onClick={baixar} disabled={carregando || visiveis.length === 0}>Baixar planilha</Botao>
      </div>

      <div className="filtros">
        <div className="campo campo--busca">
          <label className="campo__rotulo" htmlFor="busca-banco">Buscar</label>
          <div className="entrada-grupo">
            <input id="busca-banco" className="entrada" type="search" placeholder="Nome ou matrícula" value={termo} onChange={(e) => setTermo(e.target.value)} />
            <span className="entrada-grupo__botao" aria-hidden="true"><Search /></span>
          </div>
        </div>
        {departamentos.length > 0 && (
          <Selecao rotulo="Departamento" value={filtroDepartamento} onChange={(e) => setFiltroDepartamento(e.target.value)}
            opcoes={[{ valor: '', rotulo: 'Todos' }, ...departamentos.map((d) => ({ valor: d.id, rotulo: d.nome }))]} />
        )}
      </div>

      {carregando ? <Esqueleto linhas={6} blocos={1} /> : erro ? <EstadoErro aoTentarDeNovo={carregar}>{erro}</EstadoErro> : linhas.length === 0 ? (
        <EstadoVazio icone={PiggyBank} titulo="Nenhuma pessoa usa banco de horas ainda"
          acao={<Link to="/gestao/jornadas" className="btn btn--secundario">Ir para Jornadas</Link>}>
          Em Jornadas, edite uma jornada e ligue o banco de horas. Quem trabalha nessa jornada aparece aqui.
        </EstadoVazio>
      ) : (
        <>
          <div className="indicadores">
            <Indicador rotulo="Horas a favor" valor={duracao(positivos)} detalhe="Soma dos saldos positivos" />
            <Indicador rotulo="Horas a compensar" valor={duracao(Math.abs(negativos))} detalhe="Soma dos saldos negativos" />
            <Indicador rotulo="Vencem em 30 dias" valor={duracao(soma('a_vencer_min'))} detalhe="Melhor compensar logo" />
            <Indicador rotulo="Vencidas, a pagar" valor={duracao(soma('vencido_min'))} detalhe={comVencido ? `${comVencido} ${comVencido === 1 ? 'pessoa' : 'pessoas'}` : 'Nenhuma'} />
          </div>

          {visiveis.length === 0 ? (
            <EstadoVazio icone={Search} titulo="Ninguém encontrado" acao={<Botao variante="secundario" onClick={() => setTermo('')}>Limpar busca</Botao>}>
              Confira o nome ou a matrícula.
            </EstadoVazio>
          ) : (
            <>
              <div className="so-computador">
                <div className="tabela-envoltorio">
                  <table className="tabela">
                    <thead>
                      <tr>
                        <th scope="col">Pessoa</th>
                        <th scope="col" className="num">Saldo</th>
                        <th scope="col" className="num">Vencem em 30 dias</th>
                        <th scope="col" className="num">Vencidas</th>
                        <th scope="col">Próximo vencimento</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visiveis.map((l) => (
                        <tr key={l.perfil_id}>
                          <td>
                            <Link to={linkPessoa(l)} className="link"><strong>{l.nome_completo}</strong></Link>
                            {l.matricula && <span className="tabela__secundario">Matrícula {l.matricula}</span>}
                            {Number(l.dias_incompletos) > 0 && <span className="tabela__secundario">{l.dias_incompletos} {Number(l.dias_incompletos) === 1 ? 'dia incompleto' : 'dias incompletos'}</span>}
                          </td>
                          <td className="num"><Etiqueta tom={tomDoSaldoBanco(l.saldo_min)} icone={false}>{minutosComSinal(l.saldo_min)}</Etiqueta></td>
                          <td className="num">{Number(l.a_vencer_min) ? duracao(l.a_vencer_min) : '—'}</td>
                          <td className="num">{Number(l.vencido_min) ? <Etiqueta tom="atencao">{duracao(l.vencido_min)}</Etiqueta> : '—'}</td>
                          <td>{l.proximo_vencimento ? formatarData(l.proximo_vencimento) : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="so-celular lista-cartoes">
                {visiveis.map((l) => (
                  <Link key={l.perfil_id} to={linkPessoa(l)} className="cartao-linha">
                    <div className="cartao-linha__topo">
                      <span className="cartao-linha__titulo">{l.nome_completo}</span>
                      <Etiqueta tom={tomDoSaldoBanco(l.saldo_min)} icone={false}>{minutosComSinal(l.saldo_min)}</Etiqueta>
                    </div>
                    <div className="cartao-linha__detalhes">
                      {Number(l.a_vencer_min) > 0 && <span>Vencem em 30 dias <strong className="mono">{duracao(l.a_vencer_min)}</strong></span>}
                      {Number(l.vencido_min) > 0 && <span>Vencidas <strong className="mono">{duracao(l.vencido_min)}</strong></span>}
                      {l.proximo_vencimento && <span>Próximo vencimento <strong className="mono">{formatarData(l.proximo_vencimento)}</strong></span>}
                    </div>
                  </Link>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
