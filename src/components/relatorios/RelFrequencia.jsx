import { useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarSearch } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { traduzirErro } from '../../lib/mensagensErro'
import { duracao } from '../../lib/formatos'
import { baixarCsv, diaCurto, situacaoDoDia } from '../../lib/apuracao'
import { horasPlanilha } from '../../lib/relatorios'
import Etiqueta from '../ui/Etiqueta'
import Indicador from '../ui/Indicador'
import { Esqueleto, EstadoErro, EstadoVazio } from '../ui/Estados'
import { AcoesRelatorio, Visoes, usePaginas } from './Comum'

const temOcorrencia = (d) => d.situacao === 'falta' || d.situacao === 'incompleto' || d.atraso_min > 0 || d.extra_min > 0
  || d.abonado_min > 0 || (d.alertas || []).length > 0

export default function RelFrequencia({ filtros }) {
  const { inicio, fim, departamento, desligados, termo } = filtros
  const [linhas, setLinhas] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [visao, setVisao] = useState('pessoas')
  const [soOcorrencias, setSoOcorrencias] = useState(true)

  const carregar = useCallback(async () => {
    setErro('')
    setCarregando(true)
    const { data, error } = await supabase.rpc('relatorio_frequencia', {
      p_inicio: inicio, p_fim: fim, p_departamento: departamento, p_incluir_desligados: desligados,
    })
    if (error) { setErro(traduzirErro(error)); setLinhas([]) } else setLinhas(data || [])
    setCarregando(false)
  }, [inicio, fim, departamento, desligados])

  useEffect(() => { carregar() }, [carregar])

  const pessoas = useMemo(() => (termo ? linhas.filter((l) => `${l.nome_completo} ${l.matricula || ''}`.toLowerCase().includes(termo)) : linhas), [linhas, termo])
  const dias = useMemo(() => pessoas.flatMap((p) => (p.dias || []).map((d) => ({ ...d, pessoa: p })))
    .filter((d) => !soOcorrencias || temOcorrencia(d))
    .sort((a, b) => (a.data === b.data ? a.pessoa.nome_completo.localeCompare(b.pessoa.nome_completo) : a.data < b.data ? -1 : 1)), [pessoas, soOcorrencias])
  const paginas = usePaginas(visao === 'pessoas' ? pessoas.length : dias.length)
  const soma = (c) => pessoas.reduce((t, l) => t + Number(l[c] || 0), 0)

  function baixar() {
    if (visao === 'pessoas') {
      baixarCsv(`frequencia-por-pessoa-${inicio}-a-${fim}.csv`,
        ['Nome', 'Matrícula', 'Departamento', 'Previsto (h)', 'Trabalhado (h)', 'Atrasos (h)', 'Dias com atraso', 'Faltas (h)', 'Dias de falta', 'Extras (h)', 'Dias com extra', 'Abonado (h)', 'Dias incompletos', 'Dias com aviso', 'Saldo (h)'],
        pessoas.map((l) => [l.nome_completo, l.matricula || '', l.departamento || '', horasPlanilha(l.previsto_min), horasPlanilha(l.trabalhado_min),
          horasPlanilha(l.atraso_min), l.dias_atraso, horasPlanilha(l.falta_min), l.dias_falta, horasPlanilha(l.extra_min), l.dias_extra,
          horasPlanilha(l.abonado_min), l.dias_incompletos, l.dias_com_alerta, horasPlanilha(Number(l.extra_min) - Number(l.atraso_min) - Number(l.falta_min))]))
    } else {
      baixarCsv(`frequencia-por-dia-${inicio}-a-${fim}.csv`,
        ['Data', 'Nome', 'Matrícula', 'Situação', 'Turno', 'Previsto (h)', 'Trabalhado (h)', 'Atraso (h)', 'Falta (h)', 'Extra (h)', 'Abonado (h)', 'Avisos'],
        dias.map((d) => [d.data.split('-').reverse().join('/'), d.pessoa.nome_completo, d.pessoa.matricula || '', situacaoDoDia(d).rotulo, d.turno || '',
          horasPlanilha(d.previsto_min), horasPlanilha(d.trabalhado_min), horasPlanilha(d.atraso_min), horasPlanilha(d.falta_min),
          horasPlanilha(d.extra_min), horasPlanilha(d.abonado_min), (d.alertas || []).join(' | ')]))
    }
  }

  if (carregando) return <Esqueleto linhas={6} blocos={1} />
  if (erro) return <EstadoErro aoTentarDeNovo={carregar}>{erro}</EstadoErro>
  if (linhas.length === 0) {
    return <EstadoVazio icone={CalendarSearch} titulo="Ninguém neste relatório">Não há pessoas para mostrar com esses filtros.</EstadoVazio>
  }

  return (
    <div className="pilha">
      <div className="indicadores">
        <Indicador rotulo="Horas trabalhadas" valor={duracao(soma('trabalhado_min'))} detalhe={`Previsto: ${duracao(soma('previsto_min'))}`} />
        <Indicador rotulo="Horas extras" valor={duracao(soma('extra_min'))} detalhe={`${soma('dias_extra')} ${soma('dias_extra') === 1 ? 'dia' : 'dias'}`} />
        <Indicador rotulo="Atrasos e faltas" valor={duracao(soma('atraso_min') + soma('falta_min'))} detalhe={`${soma('dias_falta')} ${soma('dias_falta') === 1 ? 'falta' : 'faltas'} · ${soma('dias_atraso')} com atraso`} />
        <Indicador rotulo="Dias com aviso" valor={soma('dias_com_alerta')} detalhe={`${soma('dias_incompletos')} incompletos`} />
      </div>

      <AcoesRelatorio aoBaixar={baixar} desativado={visao === 'pessoas' ? pessoas.length === 0 : dias.length === 0}>
        <Visoes valor={visao} aoMudar={(v) => { setVisao(v); paginas.reiniciar() }}
          opcoes={[{ id: 'pessoas', rotulo: 'Por pessoa' }, { id: 'dias', rotulo: 'Por dia' }]} />
        {visao === 'dias' && (
          <label className="linha pequeno" style={{ gap: 6, cursor: 'pointer' }}>
            <input type="checkbox" checked={soOcorrencias} onChange={(e) => { setSoOcorrencias(e.target.checked); paginas.reiniciar() }} />
            Só dias com ocorrência
          </label>
        )}
      </AcoesRelatorio>

      {visao === 'pessoas' ? (
        pessoas.length === 0 ? <EstadoVazio icone={CalendarSearch} titulo="Ninguém encontrado">Confira o nome ou a matrícula.</EstadoVazio> : (
          <>
            <div className="so-computador tabela-envoltorio">
              <table className="tabela tabela--relatorio">
                <thead><tr>
                  <th scope="col">Pessoa</th><th scope="col" className="num">Previsto</th><th scope="col" className="num">Trabalhado</th>
                  <th scope="col" className="num">Atrasos</th><th scope="col" className="num">Faltas</th><th scope="col" className="num">Extras</th>
                  <th scope="col" className="num">Abonado</th><th scope="col">Avisos</th>
                </tr></thead>
                <tbody>
                  {pessoas.slice(0, paginas.visiveis).map((l) => (
                    <tr key={l.perfil_id}>
                      <td><strong>{l.nome_completo}</strong>
                        <span className="tabela__secundario">{[l.matricula && `Matrícula ${l.matricula}`, l.departamento, l.status === 'desligado' && 'Desligada(o)'].filter(Boolean).join(' · ')}</span></td>
                      <td className="num">{duracao(l.previsto_min)}</td>
                      <td className="num">{duracao(l.trabalhado_min)}</td>
                      <td className="num">{Number(l.atraso_min) ? <>{duracao(l.atraso_min)}<span className="tabela__secundario">{l.dias_atraso} {Number(l.dias_atraso) === 1 ? 'dia' : 'dias'}</span></> : '—'}</td>
                      <td className="num">{Number(l.dias_falta) ? `${l.dias_falta} ${Number(l.dias_falta) === 1 ? 'dia' : 'dias'}` : '—'}</td>
                      <td className="num">{Number(l.extra_min) ? duracao(l.extra_min) : '—'}</td>
                      <td className="num">{Number(l.abonado_min) ? duracao(l.abonado_min) : '—'}</td>
                      <td>{Number(l.dias_com_alerta) > 0 ? <Etiqueta tom="atencao">{l.dias_com_alerta} {Number(l.dias_com_alerta) === 1 ? 'dia' : 'dias'}</Etiqueta> : <Etiqueta tom="ok">Sem avisos</Etiqueta>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="so-celular lista-cartoes">
              {pessoas.slice(0, paginas.visiveis).map((l) => (
                <div key={l.perfil_id} className="cartao-linha">
                  <div className="cartao-linha__topo">
                    <span className="cartao-linha__titulo">{l.nome_completo}</span>
                    {Number(l.dias_com_alerta) > 0 ? <Etiqueta tom="atencao">{l.dias_com_alerta} {Number(l.dias_com_alerta) === 1 ? 'aviso' : 'avisos'}</Etiqueta> : <Etiqueta tom="ok">Sem avisos</Etiqueta>}
                  </div>
                  <div className="cartao-linha__detalhes">
                    <span>Trabalhado <strong className="mono">{duracao(l.trabalhado_min)}</strong></span>
                    <span>Previsto <strong className="mono">{duracao(l.previsto_min)}</strong></span>
                    {Number(l.atraso_min) > 0 && <span>Atrasos <strong className="mono">{duracao(l.atraso_min)}</strong></span>}
                    {Number(l.dias_falta) > 0 && <span>Faltas <strong className="mono">{l.dias_falta}</strong></span>}
                    {Number(l.extra_min) > 0 && <span>Extras <strong className="mono">{duracao(l.extra_min)}</strong></span>}
                  </div>
                </div>
              ))}
            </div>
            <paginas.Mais />
          </>
        )
      ) : dias.length === 0 ? (
        <EstadoVazio icone={CalendarSearch} titulo="Nenhum dia com ocorrência">Ninguém teve falta, atraso, hora extra ou aviso nesse período.</EstadoVazio>
      ) : (
        <>
          <div className="so-computador tabela-envoltorio">
            <table className="tabela tabela--relatorio">
              <thead><tr>
                <th scope="col">Dia</th><th scope="col">Pessoa</th><th scope="col">Situação</th>
                <th scope="col" className="num">Previsto</th><th scope="col" className="num">Trabalhado</th>
                <th scope="col" className="num">A menos</th><th scope="col" className="num">Extra</th><th scope="col">Avisos</th>
              </tr></thead>
              <tbody>
                {dias.slice(0, paginas.visiveis).map((d) => {
                  const s = situacaoDoDia(d)
                  return (
                    <tr key={`${d.pessoa.perfil_id}-${d.data}`}>
                      <td style={{ whiteSpace: 'nowrap' }}><strong>{diaCurto(d.data)}</strong></td>
                      <td>{d.pessoa.nome_completo}</td>
                      <td><Etiqueta tom={s.tom} icone={s.icone}>{s.rotulo}</Etiqueta>{d.turno && <span className="tabela__secundario">{d.turno}</span>}</td>
                      <td className="num">{d.previsto_min ? duracao(d.previsto_min) : '—'}</td>
                      <td className="num">{d.trabalhado_min ? duracao(d.trabalhado_min) : '—'}</td>
                      <td className="num">{d.atraso_min + d.falta_min ? duracao(d.atraso_min + d.falta_min) : '—'}</td>
                      <td className="num">{d.extra_min ? duracao(d.extra_min) : '—'}</td>
                      <td className="pequeno">{(d.alertas || []).join(' ')}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="so-celular lista-cartoes">
            {dias.slice(0, paginas.visiveis).map((d) => {
              const s = situacaoDoDia(d)
              return (
                <div key={`${d.pessoa.perfil_id}-${d.data}`} className="cartao-linha">
                  <div className="cartao-linha__topo">
                    <span className="cartao-linha__titulo">{diaCurto(d.data)} · {d.pessoa.nome_completo}</span>
                    <Etiqueta tom={s.tom} icone={s.icone}>{s.rotulo}</Etiqueta>
                  </div>
                  <div className="cartao-linha__detalhes">
                    <span>Trabalhado <strong className="mono">{d.trabalhado_min ? duracao(d.trabalhado_min) : '—'}</strong></span>
                    {d.atraso_min + d.falta_min > 0 && <span>A menos <strong className="mono">{duracao(d.atraso_min + d.falta_min)}</strong></span>}
                    {d.extra_min > 0 && <span>Extra <strong className="mono">{duracao(d.extra_min)}</strong></span>}
                  </div>
                  {(d.alertas || []).length > 0 && <span className="pequeno suave">{d.alertas.join(' ')}</span>}
                </div>
              )
            })}
          </div>
          <paginas.Mais />
        </>
      )}
    </div>
  )
}
