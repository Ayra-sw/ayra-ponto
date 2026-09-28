import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ChevronLeft, ChevronRight, FileSpreadsheet, Search, Users } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../contexts/AuthContext'
import { traduzirErro } from '../../lib/mensagensErro'
import { duracao } from '../../lib/formatos'
import { baixarCsv, ehMesAtualOuFuturo, lerMes, limitesDoMes, nomeDoMes, somarMeses, textoDoMes } from '../../lib/apuracao'
import Botao from '../../components/ui/Botao'
import Etiqueta from '../../components/ui/Etiqueta'
import Indicador from '../../components/ui/Indicador'
import { Selecao } from '../../components/ui/Campo'
import { Esqueleto, EstadoErro, EstadoVazio } from '../../components/ui/Estados'

// Horas da equipe no mês: uma linha por pessoa. Clicar abre o espelho dela.
export default function Espelhos() {
  const { perfil } = useAuth()
  const [busca, setBusca] = useSearchParams()
  const mes = lerMes(busca.get('mes'))
  const [linhas, setLinhas] = useState([])
  const [departamentos, setDepartamentos] = useState([])
  const [filtroDepartamento, setFiltroDepartamento] = useState('')
  const [termo, setTermo] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')

  const carregar = useCallback(async () => {
    setErro('')
    setCarregando(true)
    const { inicio, fim } = limitesDoMes(mes.ano, mes.mes)
    const [resumo, deptos] = await Promise.all([
      supabase.rpc('resumo_equipe', { p_inicio: inicio, p_fim: fim, p_departamento: filtroDepartamento || null }),
      supabase.from('departamentos').select('id, nome').eq('empresa_id', perfil.empresa_id).order('nome'),
    ])
    if (resumo.error) { setErro(traduzirErro(resumo.error)); setLinhas([]) } else setLinhas(resumo.data || [])
    setDepartamentos(deptos.data || [])
    setCarregando(false)
  }, [mes.ano, mes.mes, filtroDepartamento, perfil.empresa_id])

  useEffect(() => { carregar() }, [carregar])

  const visiveis = useMemo(() => {
    const t = termo.trim().toLowerCase()
    return t ? linhas.filter((l) => `${l.nome_completo} ${l.matricula || ''}`.toLowerCase().includes(t)) : linhas
  }, [linhas, termo])

  const soma = (campo) => visiveis.reduce((total, l) => total + Number(l[campo] || 0), 0)
  const comPendencia = visiveis.filter((l) => Number(l.dias_com_alerta) > 0).length
  const mudarMes = (novo) => setBusca({ mes: textoDoMes(novo) }, { replace: true })
  const linkPessoa = (l) => `/gestao/pessoas/${l.perfil_id}?aba=espelho&mes=${textoDoMes(mes)}`

  const baixar = () => baixarCsv(
    `horas-da-equipe-${textoDoMes(mes)}.csv`,
    ['Nome', 'Matrícula', 'Previsto (h)', 'Trabalhado (h)', 'Atrasos (h)', 'Faltas (h)', 'Dias de falta', 'Extras (h)', 'Abonado (h)', 'Saldo (h)', 'Dias com aviso'],
    visiveis.map((l) => {
      const h = (m) => (Number(m) / 60).toFixed(2).replace('.', ',')
      return [l.nome_completo, l.matricula || '', h(l.previsto_min), h(l.trabalhado_min), h(l.atraso_min), h(l.falta_min), l.dias_falta,
        h(l.extra_min), h(l.abonado_min), h(Number(l.extra_min) - Number(l.atraso_min) - Number(l.falta_min)), l.dias_com_alerta]
    }),
  )

  return (
    <div className="pagina">
      <div className="pagina__cabecalho">
        <div className="pagina__titulo">
          <span className="pagina__trilha">Jornada</span>
          <h1>Horas da equipe</h1>
          <p className="suave">Quanto cada pessoa trabalhou no mês, com atrasos, horas extras e faltas.</p>
        </div>
        <Botao variante="secundario" icone={FileSpreadsheet} onClick={baixar} disabled={carregando || visiveis.length === 0}>Baixar planilha</Botao>
      </div>

      <div className="filtros">
        <div className="campo">
          <span className="campo__rotulo" id="rotulo-mes">Mês</span>
          <div className="linha" role="group" aria-labelledby="rotulo-mes">
            <Botao variante="secundario" tamanho="pequeno" className="btn--icone" aria-label="Mês anterior" icone={ChevronLeft} onClick={() => mudarMes(somarMeses(mes, -1))} />
            <strong style={{ minWidth: 150, textAlign: 'center' }} aria-live="polite">{nomeDoMes(mes)}</strong>
            <Botao variante="secundario" tamanho="pequeno" className="btn--icone" aria-label="Próximo mês" icone={ChevronRight} onClick={() => mudarMes(somarMeses(mes, 1))} disabled={ehMesAtualOuFuturo(mes)} />
          </div>
        </div>
        <div className="campo campo--busca">
          <label className="campo__rotulo" htmlFor="busca-espelhos">Buscar</label>
          <div className="entrada-grupo">
            <input id="busca-espelhos" className="entrada" type="search" placeholder="Nome ou matrícula" value={termo} onChange={(e) => setTermo(e.target.value)} />
            <span className="entrada-grupo__botao" aria-hidden="true"><Search /></span>
          </div>
        </div>
        {departamentos.length > 0 && (
          <Selecao rotulo="Departamento" value={filtroDepartamento} onChange={(e) => setFiltroDepartamento(e.target.value)}
            opcoes={[{ valor: '', rotulo: 'Todos' }, ...departamentos.map((d) => ({ valor: d.id, rotulo: d.nome }))]} />
        )}
      </div>

      {carregando ? <Esqueleto linhas={6} blocos={1} /> : erro ? <EstadoErro aoTentarDeNovo={carregar}>{erro}</EstadoErro> : linhas.length === 0 ? (
        <EstadoVazio icone={Users} titulo="Nenhuma pessoa para mostrar">
          Convide colaboradores e cadastre a jornada de trabalho para acompanhar as horas aqui.
        </EstadoVazio>
      ) : (
        <>
          <div className="indicadores">
            <Indicador rotulo="Horas trabalhadas" valor={duracao(soma('trabalhado_min'))} detalhe={`Previsto até hoje: ${duracao(soma('previsto_min'))}`} />
            <Indicador rotulo="Horas extras" valor={duracao(soma('extra_min'))} detalhe="Acima da jornada" />
            <Indicador rotulo="Atrasos e faltas" valor={duracao(soma('atraso_min') + soma('falta_min'))} detalhe={`${soma('dias_falta')} ${soma('dias_falta') === 1 ? 'falta' : 'faltas'}`} />
            <Indicador rotulo="Pessoas com aviso" valor={comPendencia} detalhe={comPendencia ? 'Marcação faltando ou fora do comum' : 'Tudo certo por aqui'} />
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
                        <th scope="col" className="num">Previsto</th><th scope="col" className="num">Trabalhado</th>
                        <th scope="col" className="num">Atrasos</th><th scope="col" className="num">Faltas</th>
                        <th scope="col" className="num">Extras</th><th scope="col">Avisos</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visiveis.map((l) => (
                        <tr key={l.perfil_id}>
                          <td>
                            <Link to={linkPessoa(l)} className="link"><strong>{l.nome_completo}</strong></Link>
                            {l.matricula && <span className="tabela__secundario">Matrícula {l.matricula}</span>}
                          </td>
                          <td className="num">{duracao(l.previsto_min)}</td>
                          <td className="num">{duracao(l.trabalhado_min)}</td>
                          <td className="num">{Number(l.atraso_min) ? duracao(l.atraso_min) : '—'}</td>
                          <td className="num">{Number(l.dias_falta) ? `${l.dias_falta} ${Number(l.dias_falta) === 1 ? 'dia' : 'dias'}` : '—'}</td>
                          <td className="num">{Number(l.extra_min) ? duracao(l.extra_min) : '—'}</td>
                          <td>{Number(l.dias_com_alerta) > 0
                            ? <Etiqueta tom="atencao">{l.dias_com_alerta} {Number(l.dias_com_alerta) === 1 ? 'dia' : 'dias'}</Etiqueta>
                            : <Etiqueta tom="ok">Sem avisos</Etiqueta>}</td>
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
                      {Number(l.dias_com_alerta) > 0
                        ? <Etiqueta tom="atencao">{l.dias_com_alerta} {Number(l.dias_com_alerta) === 1 ? 'aviso' : 'avisos'}</Etiqueta>
                        : <Etiqueta tom="ok">Sem avisos</Etiqueta>}
                    </div>
                    <div className="cartao-linha__detalhes">
                      <span>Trabalhado <strong className="mono">{duracao(l.trabalhado_min)}</strong></span>
                      <span>Previsto <strong className="mono">{duracao(l.previsto_min)}</strong></span>
                      {Number(l.atraso_min) > 0 && <span>Atrasos <strong className="mono">{duracao(l.atraso_min)}</strong></span>}
                      {Number(l.dias_falta) > 0 && <span>Faltas <strong className="mono">{l.dias_falta}</strong></span>}
                      {Number(l.extra_min) > 0 && <span>Extras <strong className="mono">{duracao(l.extra_min)}</strong></span>}
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
