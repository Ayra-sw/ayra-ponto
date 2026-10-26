import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useOutletContext, useSearchParams } from 'react-router-dom'
import { Building2, Search } from 'lucide-react'
import { traduzirErro } from '../../lib/mensagensErro'
import { data as formatarData } from '../../lib/formatos'
import { SITUACAO_EMPRESA, formatarCnpj, quandoFoi } from '../../lib/central'
import Etiqueta from '../../components/ui/Etiqueta'
import Indicador from '../../components/ui/Indicador'
import Botao from '../../components/ui/Botao'
import { Esqueleto, EstadoErro, EstadoVazio } from '../../components/ui/Estados'

const FILTROS = [
  { id: '', rotulo: 'Todas' },
  { id: 'teste', rotulo: 'Em teste' },
  { id: 'ativa', rotulo: 'Ativas' },
  { id: 'suspensa', rotulo: 'Suspensas' },
]

// Central Ayra: todas as empresas clientes, com números (sem dados dos funcionários).
export default function CentralInicio() {
  const { chamar } = useOutletContext()
  const [busca, setBusca] = useSearchParams()
  const filtro = FILTROS.some((f) => f.id === busca.get('situacao')) ? busca.get('situacao') || '' : ''
  const [resumo, setResumo] = useState(null)
  const [empresas, setEmpresas] = useState([])
  const [termo, setTermo] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')

  const carregar = useCallback(async () => {
    setErro(''); setCarregando(true)
    const r = await chamar('central_resumo')
    if (r.error) { setErro(r.error.cancelada ? 'Para ver a Central, confirme que é você.' : traduzirErro(r.error)); setCarregando(false); return }
    const e = await chamar('central_empresas')
    if (e.error) { setErro(traduzirErro(e.error)); setCarregando(false); return }
    setResumo(r.data || {})
    setEmpresas(Array.isArray(e.data) ? e.data : [])
    setCarregando(false)
  }, [chamar])

  useEffect(() => { carregar() }, [carregar])

  const visiveis = useMemo(() => {
    const t = termo.trim().toLowerCase()
    const so = (s) => String(s || '').toLowerCase()
    return empresas
      .filter((e) => !filtro || e.situacao === filtro)
      .filter((e) => !t || `${so(e.nome)} ${so(e.razao_social)} ${so(e.cnpj).replace(/\D/g, '')} ${so(e.cidade)}`.includes(t.replace(/[./-]/g, '')) || so(e.nome).includes(t))
  }, [empresas, filtro, termo])

  const mudarFiltro = (id) => setBusca(id ? { situacao: id } : {}, { replace: true })

  return (
    <div className="pagina">
      <div className="pagina__cabecalho">
        <div className="pagina__titulo">
          <span className="pagina__trilha">Central Ayra</span>
          <h1>Empresas</h1>
          <p className="suave">Todas as empresas que usam o Ayra Ponto. Aqui aparecem só números: marcações e dados dos funcionários ficam com cada cliente.</p>
        </div>
      </div>

      {carregando ? <Esqueleto blocos={2} linhas={4} /> : erro ? (
        <EstadoErro aoTentarDeNovo={carregar}>{erro}</EstadoErro>
      ) : (
        <>
          <div className="indicadores">
            <Indicador rotulo="Empresas" valor={resumo.empresas ?? 0} detalhe={`${resumo.novas_30d ?? 0} nos últimos 30 dias`} />
            <Indicador rotulo="Em teste" valor={resumo.teste ?? 0} detalhe="Ainda não pagam" />
            <Indicador rotulo="Ativas" valor={resumo.ativas ?? 0} detalhe="Clientes pagantes" />
            <Indicador rotulo="Suspensas" valor={resumo.suspensas ?? 0} detalhe="Gestão bloqueada" />
            <Indicador rotulo="Pessoas" valor={resumo.pessoas ?? 0} detalhe={`${resumo.marcacoes_hoje ?? 0} marcações hoje`} />
          </div>

          <div className="filtros">
            <div className="campo">
              <span className="campo__rotulo" id="rotulo-situacao">Situação</span>
              <div className="linha" role="group" aria-labelledby="rotulo-situacao" style={{ gap: 6 }}>
                {FILTROS.map((f) => (
                  <button key={f.id || 'todas'} type="button" className="ficha" aria-pressed={filtro === f.id} onClick={() => mudarFiltro(f.id)}>
                    {f.rotulo}
                  </button>
                ))}
              </div>
            </div>
            <div className="campo campo--busca">
              <label className="campo__rotulo" htmlFor="busca-empresas">Buscar</label>
              <div className="entrada-grupo">
                <input id="busca-empresas" className="entrada" type="search" placeholder="Nome, CNPJ ou cidade" value={termo} onChange={(e) => setTermo(e.target.value)} />
                <span className="entrada-grupo__botao" aria-hidden="true"><Search /></span>
              </div>
            </div>
          </div>

          {empresas.length === 0 ? (
            <EstadoVazio icone={Building2} titulo="Nenhuma empresa ainda">
              Quando um cliente criar a conta da empresa no Ayra Ponto, ela aparece aqui, em teste.
            </EstadoVazio>
          ) : visiveis.length === 0 ? (
            <EstadoVazio icone={Search} titulo="Nenhuma empresa encontrada" acao={<Botao variante="secundario" onClick={() => { setTermo(''); mudarFiltro('') }}>Ver todas</Botao>}>
              Confira o nome, o CNPJ ou a situação escolhida.
            </EstadoVazio>
          ) : (
            <>
              <div className="so-computador">
                <div className="tabela-envoltorio">
                  <table className="tabela">
                    <thead>
                      <tr>
                        <th scope="col">Empresa</th>
                        <th scope="col">Situação</th>
                        <th scope="col" className="num">Pessoas</th>
                        <th scope="col">Último ponto</th>
                        <th scope="col">Cliente desde</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visiveis.map((e) => {
                        const s = SITUACAO_EMPRESA[e.situacao] || SITUACAO_EMPRESA.ativa
                        return (
                          <tr key={e.id}>
                            <td>
                              <Link to={`/central/empresas/${e.id}`} className="link"><strong>{e.nome}</strong></Link>
                              <span className="tabela__secundario">{[e.cnpj ? formatarCnpj(e.cnpj) : null, e.cidade && e.uf ? `${e.cidade}/${e.uf}` : null].filter(Boolean).join(' · ') || 'Sem CNPJ'}</span>
                            </td>
                            <td><Etiqueta tom={s.tom}>{s.rotulo}</Etiqueta></td>
                            <td className="num">{e.pessoas_ativas}</td>
                            <td>{quandoFoi(e.ultima_marcacao)}</td>
                            <td>{formatarData(e.criado_em)}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="so-celular lista-cartoes">
                {visiveis.map((e) => {
                  const s = SITUACAO_EMPRESA[e.situacao] || SITUACAO_EMPRESA.ativa
                  return (
                    <section key={e.id} className="cartao-linha" aria-label={e.nome}>
                      <div className="cartao-linha__topo">
                        <Link to={`/central/empresas/${e.id}`} className="cartao-linha__titulo link">{e.nome}</Link>
                        <Etiqueta tom={s.tom}>{s.rotulo}</Etiqueta>
                      </div>
                      <div className="cartao-linha__detalhes">
                        <span>Pessoas <strong className="mono">{e.pessoas_ativas}</strong></span>
                        <span>Último ponto <strong>{quandoFoi(e.ultima_marcacao)}</strong></span>
                        <span>Desde <strong>{formatarData(e.criado_em)}</strong></span>
                      </div>
                    </section>
                  )
                })}
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
