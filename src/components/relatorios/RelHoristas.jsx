import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Wallet } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { traduzirErro } from '../../lib/mensagensErro'
import { duracao } from '../../lib/formatos'
import { baixarCsv } from '../../lib/apuracao'
import { horasPlanilha } from '../../lib/relatorios'
import { reais } from '../../lib/pagamento'
import Etiqueta from '../ui/Etiqueta'
import Alerta from '../ui/Alerta'
import Indicador from '../ui/Indicador'
import { Esqueleto, EstadoErro, EstadoVazio } from '../ui/Estados'
import { AcoesRelatorio, usePaginas } from './Comum'

const extras = (p) => (p.minutos?.extra_normal || 0) + (p.minutos?.extra_especial || 0)
const valorExtras = (p) => Number(p.valores?.extra_normal || 0) + Number(p.valores?.extra_especial || 0)
const valorNoturno = (p) => Number(p.valores?.adicional_noturno || 0) + Number(p.valores?.hora_reduzida || 0)
const real = (n) => Number(n || 0).toFixed(2).replace('.', ',')

// Fase 9A: horas e valor estimado de quem é pago por hora (administrador e RH)
export default function RelHoristas({ filtros }) {
  const { inicio, fim, departamento, desligados, termo } = filtros
  const [linhas, setLinhas] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')

  const carregar = useCallback(async () => {
    setErro('')
    setCarregando(true)
    const { data, error } = await supabase.rpc('relatorio_horistas', { p_inicio: inicio, p_fim: fim, p_departamento: departamento, p_incluir_desligados: desligados })
    if (error) { setErro(traduzirErro(error)); setLinhas([]) } else setLinhas(data || [])
    setCarregando(false)
  }, [inicio, fim, departamento, desligados])

  useEffect(() => { carregar() }, [carregar])

  const visiveis = useMemo(() => (termo ? linhas.filter((l) => `${l.nome_completo} ${l.matricula || ''}`.toLowerCase().includes(termo)) : linhas), [linhas, termo])
  const paginas = usePaginas(visiveis.length)
  const soma = (f) => visiveis.reduce((t, l) => t + Number(f(l.pagamento) || 0), 0)
  const semValor = visiveis.filter((l) => l.pagamento.valor_hora == null || l.pagamento.dias_sem_valor > 0)

  const baixar = () => baixarCsv(`horistas-${inicio}-a-${fim}.csv`,
    ['Nome', 'Matrícula', 'Departamento', 'Como trabalha', 'Valor da hora (R$)', 'Horas normais (h)', 'Horas extras (h)', 'Horas noturnas (h)',
      'Normais (R$)', 'Extras (R$)', 'Noturno (R$)', 'Intervalo e descanso (R$)', 'DSR estimado (R$)', 'Total estimado (R$)'],
    visiveis.map((l) => {
      const p = l.pagamento
      return [l.nome_completo, l.matricula || '', l.departamento || '', l.tipo_escala === 'horista' ? 'Sem horário fixo' : 'Com jornada ou escala',
        p.valor_hora == null ? '' : real(p.valor_hora), horasPlanilha(p.minutos.normais), horasPlanilha(extras(p)), horasPlanilha(p.minutos.noturno),
        real(p.valores.normais), real(valorExtras(p)), real(valorNoturno(p)), real(p.valores.a_pagar_50), real(p.dsr.valor), real(p.total)]
    }))

  if (carregando) return <Esqueleto linhas={6} blocos={1} />
  if (erro) return <EstadoErro aoTentarDeNovo={carregar}>{erro}</EstadoErro>
  if (visiveis.length === 0) {
    return <EstadoVazio icone={Wallet} titulo="Ninguém pago por hora">Marque <strong>Pago por hora</strong> na ficha da pessoa, aba Trabalho, ou escolha “Horista (sem horário fixo)” em Como a pessoa trabalha.</EstadoVazio>
  }

  return (
    <div className="pilha">
      <div className="indicadores">
        <Indicador rotulo="Pessoas pagas por hora" valor={String(visiveis.length)} detalhe={`${visiveis.filter((l) => l.tipo_escala === 'horista').length} sem horário fixo`} />
        <Indicador rotulo="Horas normais" valor={duracao(soma((p) => p.minutos.normais))} detalhe="Trabalhadas e abonadas" />
        <Indicador rotulo="Horas extras" valor={duracao(soma(extras))} detalhe="Com os percentuais das Regras de cálculo" />
        <Indicador rotulo="Total estimado" valor={reais(soma((p) => p.total))} detalhe="Com DSR estimado" />
      </div>
      {semValor.length > 0 && (
        <Alerta tom="atencao">
          {semValor.length === 1 ? '1 pessoa está' : `${semValor.length} pessoas estão`} sem valor da hora em parte do período: {semValor.map((l) => l.nome_completo).join(', ')}. Cadastre na ficha, aba Trabalho.
        </Alerta>
      )}
      <p className="suave pequeno" style={{ margin: 0 }}>Estimativa para a folha conferir. Não inclui férias, 13º, INSS, FGTS nem descontos.</p>
      <AcoesRelatorio aoBaixar={baixar} />
      <div className="so-computador tabela-envoltorio">
        <table className="tabela tabela--relatorio">
          <thead><tr>
            <th scope="col">Pessoa</th><th scope="col" className="num">Valor da hora</th><th scope="col" className="num">Normais</th>
            <th scope="col" className="num">Extras</th><th scope="col" className="num">Noturnas</th><th scope="col" className="num">DSR estimado</th>
            <th scope="col" className="num">Total estimado</th>
          </tr></thead>
          <tbody>
            {visiveis.slice(0, paginas.visiveis).map((l) => {
              const p = l.pagamento
              return (
                <tr key={l.perfil_id}>
                  <td>
                    <Link to={`/gestao/pessoas/${l.perfil_id}?aba=espelho`} className="link"><strong>{l.nome_completo}</strong></Link>
                    <span className="tabela__secundario">{[l.tipo_escala === 'horista' ? 'Sem horário fixo' : 'Com jornada ou escala', l.matricula && `Matrícula ${l.matricula}`, l.departamento].filter(Boolean).join(' · ')}</span>
                  </td>
                  <td className="num">{p.valor_hora == null ? <Etiqueta tom="atencao" icone={false}>Sem valor</Etiqueta> : reais(p.valor_hora)}</td>
                  <td className="num">{duracao(p.minutos.normais)}</td>
                  <td className="num">{extras(p) ? duracao(extras(p)) : '—'}</td>
                  <td className="num">{p.minutos.noturno ? duracao(p.minutos.noturno) : '—'}</td>
                  <td className="num">{reais(p.dsr.valor)}</td>
                  <td className="num"><strong>{reais(p.total)}</strong></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="so-celular lista-cartoes">
        {visiveis.slice(0, paginas.visiveis).map((l) => {
          const p = l.pagamento
          return (
            <div key={l.perfil_id} className="cartao-linha">
              <div className="cartao-linha__topo">
                <Link to={`/gestao/pessoas/${l.perfil_id}?aba=espelho`} className="cartao-linha__titulo link">{l.nome_completo}</Link>
                <strong className="mono">{reais(p.total)}</strong>
              </div>
              <div className="cartao-linha__detalhes">
                <span>Valor da hora <strong className="mono">{p.valor_hora == null ? 'sem valor' : reais(p.valor_hora)}</strong></span>
                <span>Normais <strong className="mono">{duracao(p.minutos.normais)}</strong></span>
                {extras(p) > 0 && <span>Extras <strong className="mono">{duracao(extras(p))}</strong></span>}
                <span>DSR <strong className="mono">{reais(p.dsr.valor)}</strong></span>
              </div>
            </div>
          )
        })}
      </div>
      <paginas.Mais />
    </div>
  )
}
