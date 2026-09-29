import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useOutletContext, useSearchParams } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Search, Users } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { traduzirErro } from '../../lib/mensagensErro'
import { duracao } from '../../lib/formatos'
import { ehMesAtualOuFuturo, lerMes, limitesDoMes, nomeDoMes, somarMeses, textoDoMes } from '../../lib/apuracao'
import CentralSolicitacoes from '../../components/solicitacoes/CentralSolicitacoes'
import Relatorios from '../../components/relatorios/Relatorios'
import Botao from '../../components/ui/Botao'
import Etiqueta from '../../components/ui/Etiqueta'
import Indicador from '../../components/ui/Indicador'
import { Esqueleto, EstadoErro, EstadoVazio } from '../../components/ui/Estados'

const ABAS = [
  { id: 'pedidos', rotulo: 'Pedidos' },
  { id: 'pessoas', rotulo: 'Pessoas' },
  { id: 'relatorios', rotulo: 'Relatórios' },
]

// Área do gestor: os pedidos da equipe e as horas de cada pessoa no mês.
export default function MinhaEquipe() {
  const { equipe } = useOutletContext()
  const [busca, setBusca] = useSearchParams()
  const aba = ABAS.some((a) => a.id === busca.get('aba')) ? busca.get('aba') : 'pedidos'

  if (equipe.carregando) return <div className="pagina"><Esqueleto linhas={5} blocos={1} /></div>
  if (!equipe.ehGestor) {
    return (
      <div className="pagina">
        <EstadoVazio icone={Users} titulo="Você não é gestor de nenhum departamento"
          acao={<Link to="/" className="btn btn--secundario">Voltar ao início</Link>}>
          O RH ou o administrador escolhe os gestores em Departamentos. Quando você for gestor, a sua equipe aparece aqui.
        </EstadoVazio>
      </div>
    )
  }

  const departamentos = [...new Set(equipe.equipe.map((p) => p.departamento).filter(Boolean))]

  return (
    <div className="pagina">
      <div className="pagina__cabecalho nao-imprimir">
        <div className="pagina__titulo">
          <h1>Minha equipe</h1>
          <p className="suave">
            {equipe.equipe.length} {equipe.equipe.length === 1 ? 'pessoa' : 'pessoas'}{departamentos.length ? ` · ${departamentos.join(', ')}` : ''}.
            Você acompanha as horas e analisa os pedidos de ajuste e folga.
          </p>
        </div>
      </div>

      <div className="abas nao-imprimir" role="tablist" aria-label="Seções da equipe">
        {ABAS.map((a) => (
          <button key={a.id} type="button" role="tab" aria-selected={aba === a.id} className="abas__item"
            onClick={() => setBusca(a.id === 'pedidos' ? {} : { aba: a.id }, { replace: true })}>
            {a.rotulo}
            {a.id === 'pedidos' && equipe.pendentes > 0 && <span className="abas__contador">{equipe.pendentes}</span>}
          </button>
        ))}
      </div>

      {aba === 'pedidos'
        ? <CentralSolicitacoes modo="gestor" aoAnalisar={equipe.recarregar} linkDaPessoa={(id) => `/equipe/${id}?aba=pedidos`} />
        : aba === 'relatorios'
          ? <Relatorios modo="gestor" abaFixa="relatorios" />
          : <PessoasDaEquipe />}
    </div>
  )
}

function PessoasDaEquipe() {
  const [busca, setBusca] = useSearchParams()
  const mes = lerMes(busca.get('mes'))
  const [linhas, setLinhas] = useState([])
  const [termo, setTermo] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')

  const carregar = useCallback(async () => {
    setErro('')
    setCarregando(true)
    const { inicio, fim } = limitesDoMes(mes.ano, mes.mes)
    const { data, error } = await supabase.rpc('resumo_minha_equipe', { p_inicio: inicio, p_fim: fim })
    if (error) { setErro(traduzirErro(error)); setLinhas([]) } else setLinhas(data || [])
    setCarregando(false)
  }, [mes.ano, mes.mes])

  useEffect(() => { carregar() }, [carregar])

  const visiveis = useMemo(() => {
    const t = termo.trim().toLowerCase()
    return t ? linhas.filter((l) => `${l.nome_completo} ${l.matricula || ''}`.toLowerCase().includes(t)) : linhas
  }, [linhas, termo])
  const soma = (campo) => visiveis.reduce((total, l) => total + Number(l[campo] || 0), 0)
  const mudarMes = (novo) => setBusca({ aba: 'pessoas', mes: textoDoMes(novo) }, { replace: true })
  const link = (l) => `/equipe/${l.perfil_id}?aba=espelho&mes=${textoDoMes(mes)}`

  return (
    <div className="pilha">
      <div className="filtros">
        <div className="campo">
          <span className="campo__rotulo" id="rotulo-mes-equipe">Mês</span>
          <div className="linha" role="group" aria-labelledby="rotulo-mes-equipe">
            <Botao variante="secundario" tamanho="pequeno" className="btn--icone" aria-label="Mês anterior" icone={ChevronLeft} onClick={() => mudarMes(somarMeses(mes, -1))} />
            <strong style={{ minWidth: 150, textAlign: 'center' }} aria-live="polite">{nomeDoMes(mes)}</strong>
            <Botao variante="secundario" tamanho="pequeno" className="btn--icone" aria-label="Próximo mês" icone={ChevronRight} onClick={() => mudarMes(somarMeses(mes, 1))} disabled={ehMesAtualOuFuturo(mes)} />
          </div>
        </div>
        <div className="campo campo--busca">
          <label className="campo__rotulo" htmlFor="busca-equipe">Buscar</label>
          <div className="entrada-grupo">
            <input id="busca-equipe" className="entrada" type="search" placeholder="Nome ou matrícula" value={termo} onChange={(e) => setTermo(e.target.value)} />
            <span className="entrada-grupo__botao" aria-hidden="true"><Search /></span>
          </div>
        </div>
      </div>

      {carregando ? <Esqueleto linhas={5} blocos={1} /> : erro ? <EstadoErro aoTentarDeNovo={carregar}>{erro}</EstadoErro> : (
        <>
          <div className="indicadores">
            <Indicador rotulo="Horas trabalhadas" valor={duracao(soma('trabalhado_min'))} detalhe={`Previsto até hoje: ${duracao(soma('previsto_min'))}`} />
            <Indicador rotulo="Horas extras" valor={duracao(soma('extra_min'))} detalhe="Acima da jornada" />
            <Indicador rotulo="Atrasos e faltas" valor={duracao(soma('atraso_min') + soma('falta_min'))} detalhe={`${soma('dias_falta')} ${soma('dias_falta') === 1 ? 'falta' : 'faltas'}`} />
            <Indicador rotulo="Pedidos esperando você" valor={soma('pedidos_pendentes')} detalhe="Ajustes e folgas" />
          </div>
          {visiveis.length === 0 ? (
            <EstadoVazio icone={Search} titulo="Ninguém encontrado" acao={<Botao variante="secundario" onClick={() => setTermo('')}>Limpar busca</Botao>}>
              Confira o nome ou a matrícula.
            </EstadoVazio>
          ) : (
            <div className="lista-cartoes">
              {visiveis.map((l) => (
                <Link key={l.perfil_id} to={link(l)} className="cartao-linha">
                  <div className="cartao-linha__topo">
                    <span className="cartao-linha__titulo">{l.nome_completo}</span>
                    <span className="linha" style={{ gap: 6 }}>
                      {Number(l.pedidos_pendentes) > 0 && <Etiqueta tom="info">{l.pedidos_pendentes} {Number(l.pedidos_pendentes) === 1 ? 'pedido' : 'pedidos'}</Etiqueta>}
                      {Number(l.dias_com_alerta) > 0
                        ? <Etiqueta tom="atencao">{l.dias_com_alerta} {Number(l.dias_com_alerta) === 1 ? 'aviso' : 'avisos'}</Etiqueta>
                        : <Etiqueta tom="ok">Sem avisos</Etiqueta>}
                    </span>
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
          )}
        </>
      )}
    </div>
  )
}
