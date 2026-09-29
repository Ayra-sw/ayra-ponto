import { useCallback, useEffect, useMemo, useState } from 'react'
import { PiggyBank } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { traduzirErro } from '../../lib/mensagensErro'
import { data as formatarData, duracao } from '../../lib/formatos'
import { baixarCsv } from '../../lib/apuracao'
import { minutosComSinal, tomDoSaldoBanco } from '../../lib/bancoHoras'
import { horasPlanilha } from '../../lib/relatorios'
import Etiqueta from '../ui/Etiqueta'
import Indicador from '../ui/Indicador'
import { Esqueleto, EstadoErro, EstadoVazio } from '../ui/Estados'
import { AcoesRelatorio, usePaginas } from './Comum'

export default function RelBancoHoras({ filtros }) {
  const { ate, departamento, desligados, termo } = filtros
  const [linhas, setLinhas] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')

  const carregar = useCallback(async () => {
    setErro('')
    setCarregando(true)
    const { data, error } = await supabase.rpc('relatorio_banco_horas', { p_ate: ate, p_departamento: departamento, p_incluir_desligados: desligados })
    if (error) { setErro(traduzirErro(error)); setLinhas([]) } else setLinhas(data || [])
    setCarregando(false)
  }, [ate, departamento, desligados])

  useEffect(() => { carregar() }, [carregar])

  const visiveis = useMemo(() => (termo ? linhas.filter((l) => `${l.nome_completo} ${l.matricula || ''}`.toLowerCase().includes(termo)) : linhas), [linhas, termo])
  const paginas = usePaginas(visiveis.length)
  const somaSe = (campo, teste) => visiveis.filter(teste).reduce((t, l) => t + Number(l[campo] || 0), 0)

  const baixar = () => baixarCsv(`banco-de-horas-em-${ate}.csv`,
    ['Nome', 'Matrícula', 'Departamento', 'Prazo (meses)', 'Saldo (h)', 'Vencem em 30 dias (h)', 'Vencidas a pagar (h)', 'Próximo vencimento', 'Dias incompletos'],
    visiveis.map((l) => [l.nome_completo, l.matricula || '', l.departamento || '', l.validade_meses, horasPlanilha(l.saldo_min), horasPlanilha(l.a_vencer_min),
      horasPlanilha(l.vencido_min), l.proximo_vencimento ? formatarData(l.proximo_vencimento) : '', l.dias_incompletos]))

  if (carregando) return <Esqueleto linhas={6} blocos={1} />
  if (erro) return <EstadoErro aoTentarDeNovo={carregar}>{erro}</EstadoErro>
  if (visiveis.length === 0) {
    return <EstadoVazio icone={PiggyBank} titulo="Ninguém com banco de horas">Só aparecem pessoas cuja jornada usa banco de horas (e que já tinham banco nessa data).</EstadoVazio>
  }

  return (
    <div className="pilha">
      <div className="indicadores">
        <Indicador rotulo="Horas a favor" valor={duracao(somaSe('saldo_min', (l) => l.saldo_min > 0))} detalhe="Soma dos saldos positivos" />
        <Indicador rotulo="Horas a compensar" valor={duracao(Math.abs(somaSe('saldo_min', (l) => l.saldo_min < 0)))} detalhe="Soma dos saldos negativos" />
        <Indicador rotulo="Vencem em 30 dias" valor={duracao(somaSe('a_vencer_min', () => true))} detalhe="A partir da data escolhida" />
        <Indicador rotulo="Vencidas, a pagar" valor={duracao(somaSe('vencido_min', () => true))} detalhe={`${visiveis.filter((l) => l.vencido_min > 0).length} pessoas`} />
      </div>
      <AcoesRelatorio aoBaixar={baixar} />
      <div className="so-computador tabela-envoltorio">
        <table className="tabela tabela--relatorio">
          <thead><tr>
            <th scope="col">Pessoa</th><th scope="col" className="num">Saldo</th><th scope="col" className="num">Vencem em 30 dias</th>
            <th scope="col" className="num">Vencidas</th><th scope="col">Próximo vencimento</th><th scope="col" className="num">Prazo</th>
          </tr></thead>
          <tbody>
            {visiveis.slice(0, paginas.visiveis).map((l) => (
              <tr key={l.perfil_id}>
                <td><strong>{l.nome_completo}</strong><span className="tabela__secundario">{[l.matricula && `Matrícula ${l.matricula}`, l.departamento, l.dias_incompletos > 0 && `${l.dias_incompletos} ${l.dias_incompletos === 1 ? 'dia incompleto' : 'dias incompletos'}`].filter(Boolean).join(' · ')}</span></td>
                <td className="num"><Etiqueta tom={tomDoSaldoBanco(l.saldo_min)} icone={false}>{minutosComSinal(l.saldo_min)}</Etiqueta></td>
                <td className="num">{l.a_vencer_min ? duracao(l.a_vencer_min) : '—'}</td>
                <td className="num">{l.vencido_min ? duracao(l.vencido_min) : '—'}</td>
                <td>{l.proximo_vencimento ? formatarData(l.proximo_vencimento) : '—'}</td>
                <td className="num">{l.validade_meses} {l.validade_meses === 1 ? 'mês' : 'meses'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="so-celular lista-cartoes">
        {visiveis.slice(0, paginas.visiveis).map((l) => (
          <div key={l.perfil_id} className="cartao-linha">
            <div className="cartao-linha__topo">
              <span className="cartao-linha__titulo">{l.nome_completo}</span>
              <Etiqueta tom={tomDoSaldoBanco(l.saldo_min)} icone={false}>{minutosComSinal(l.saldo_min)}</Etiqueta>
            </div>
            <div className="cartao-linha__detalhes">
              {l.a_vencer_min > 0 && <span>Vencem em 30 dias <strong className="mono">{duracao(l.a_vencer_min)}</strong></span>}
              {l.vencido_min > 0 && <span>Vencidas <strong className="mono">{duracao(l.vencido_min)}</strong></span>}
              {l.proximo_vencimento && <span>Próximo vencimento <strong className="mono">{formatarData(l.proximo_vencimento)}</strong></span>}
            </div>
          </div>
        ))}
      </div>
      <paginas.Mais />
    </div>
  )
}
