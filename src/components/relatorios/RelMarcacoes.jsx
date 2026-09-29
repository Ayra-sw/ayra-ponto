import { useCallback, useEffect, useMemo, useState } from 'react'
import { Fingerprint, Pencil } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { traduzirErro } from '../../lib/mensagensErro'
import { nsr as formatarNsr } from '../../lib/formatos'
import { rotuloMarcacao } from '../../lib/marcacoes'
import { RESULTADO_FACIAL } from '../../lib/rotulos'
import { baixarCsv, horaNoFuso } from '../../lib/apuracao'
import { ORIGEM } from '../../lib/relatorios'
import Etiqueta from '../ui/Etiqueta'
import Indicador from '../ui/Indicador'
import { Esqueleto, EstadoErro, EstadoVazio } from '../ui/Estados'
import { AcoesRelatorio, usePaginas } from './Comum'

// dia "DD/MM/AAAA" no relógio da unidade
function diaNoFuso(valor, fuso) {
  return new Date(valor).toLocaleDateString('pt-BR', { timeZone: fuso || 'America/Sao_Paulo' })
}

export default function RelMarcacoes({ filtros }) {
  const { inicio, fim, departamento, desligados, termo, gestor } = filtros
  const [linhas, setLinhas] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')

  const carregar = useCallback(async () => {
    setErro('')
    setCarregando(true)
    const { data, error } = await supabase.rpc('relatorio_marcacoes', {
      p_inicio: inicio, p_fim: fim, p_departamento: departamento, p_incluir_desligados: desligados,
    })
    if (error) { setErro(traduzirErro(error)); setLinhas([]) } else setLinhas(data || [])
    setCarregando(false)
  }, [inicio, fim, departamento, desligados])

  useEffect(() => { carregar() }, [carregar])

  const pessoas = useMemo(() => (termo ? linhas.filter((l) => `${l.nome_completo} ${l.matricula || ''}`.toLowerCase().includes(termo)) : linhas), [linhas, termo])
  const marcas = useMemo(() => pessoas.flatMap((p) => (p.marcacoes || []).map((m) => ({ ...m, pessoa: p }))), [pessoas])
  const paginas = usePaginas(marcas.length)
  const semMarcacao = pessoas.filter((p) => !(p.marcacoes || []).length).length
  const corrigidas = marcas.filter((m) => m.corrigida).length
  const naoReconhecidas = marcas.filter((m) => m.facial === 'nao_reconhecido').length

  const baixar = () => baixarCsv(`marcacoes-${inicio}-a-${fim}.csv`,
    ['Nome', 'Matrícula', 'Data', 'Hora', 'Tipo', 'NSR', 'Unidade', 'Origem', ...(gestor ? [] : ['Reconhecimento facial']), 'Corrigida por ajuste aprovado'],
    marcas.map((m) => [m.pessoa.nome_completo, m.pessoa.matricula || '', diaNoFuso(m.marcado_em, m.fuso), horaNoFuso(m.marcado_em, m.fuso),
      rotuloMarcacao(m.tipo), formatarNsr(m.nsr), m.unidade || '', ORIGEM[m.origem] || m.origem,
      ...(gestor ? [] : [RESULTADO_FACIAL[m.facial]?.rotulo || '']), m.corrigida ? 'Sim' : 'Não']))

  if (carregando) return <Esqueleto linhas={6} blocos={1} />
  if (erro) return <EstadoErro aoTentarDeNovo={carregar}>{erro}</EstadoErro>
  if (marcas.length === 0) {
    return <EstadoVazio icone={Fingerprint} titulo="Nenhuma marcação no período">Ninguém bateu ponto nesses dias{termo || departamento ? ' com esses filtros' : ''}.</EstadoVazio>
  }

  return (
    <div className="pilha">
      <div className="indicadores">
        <Indicador rotulo="Marcações" valor={marcas.length} detalhe={`${pessoas.length - semMarcacao} de ${pessoas.length} pessoas`} />
        <Indicador rotulo="Sem nenhuma marcação" valor={semMarcacao} detalhe={semMarcacao === 1 ? 'pessoa no período' : 'pessoas no período'} />
        <Indicador rotulo="Corrigidas por ajuste" valor={corrigidas} detalhe="A original continua guardada" />
        {!gestor && <Indicador rotulo="Rosto não reconhecido" valor={naoReconhecidas} detalhe="Conferir em Reconhecimento facial" />}
      </div>
      <AcoesRelatorio aoBaixar={baixar} />
      <div className="so-computador tabela-envoltorio">
        <table className="tabela tabela--relatorio">
          <thead><tr>
            <th scope="col">Pessoa</th><th scope="col">Data</th><th scope="col">Hora</th><th scope="col">Tipo</th>
            <th scope="col" className="num">NSR</th><th scope="col">Unidade</th><th scope="col">Origem</th>
            {!gestor && <th scope="col">Rosto</th>}
          </tr></thead>
          <tbody>
            {marcas.slice(0, paginas.visiveis).map((m) => (
              <tr key={m.id}>
                <td>{m.pessoa.nome_completo}</td>
                <td className="mono">{diaNoFuso(m.marcado_em, m.fuso)}</td>
                <td className="mono">
                  {horaNoFuso(m.marcado_em, m.fuso)}
                  {m.corrigida && <span className="marcas__selo" title="Corrigida por ajuste aprovado"><Pencil aria-hidden="true" /><span className="sr-only">Corrigida por ajuste aprovado</span></span>}
                </td>
                <td>{rotuloMarcacao(m.tipo)}</td>
                <td className="num">{formatarNsr(m.nsr)}</td>
                <td>{m.unidade}</td>
                <td className="pequeno">{ORIGEM[m.origem] || m.origem}</td>
                {!gestor && <td>{RESULTADO_FACIAL[m.facial] ? <Etiqueta tom={RESULTADO_FACIAL[m.facial].tom} icone={false}>{RESULTADO_FACIAL[m.facial].rotulo}</Etiqueta> : '—'}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="so-celular lista-cartoes">
        {marcas.slice(0, paginas.visiveis).map((m) => (
          <div key={m.id} className="cartao-linha">
            <div className="cartao-linha__topo">
              <span className="cartao-linha__titulo">{m.pessoa.nome_completo}</span>
              <span className="mono">{diaNoFuso(m.marcado_em, m.fuso)} {horaNoFuso(m.marcado_em, m.fuso)}</span>
            </div>
            <div className="cartao-linha__detalhes">
              <span>{rotuloMarcacao(m.tipo)}</span>
              <span>NSR <strong className="mono">{formatarNsr(m.nsr)}</strong></span>
              <span>{m.unidade}</span>
              {m.corrigida && <span>Corrigida por ajuste</span>}
            </div>
          </div>
        ))}
      </div>
      <paginas.Mais />
    </div>
  )
}
