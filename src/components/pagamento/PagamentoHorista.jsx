import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { traduzirErro } from '../../lib/mensagensErro'
import { duracao } from '../../lib/formatos'
import { lerMes, limitesDoMes, nomeDoMes } from '../../lib/apuracao'
import { linhasDoPagamento, reais } from '../../lib/pagamento'
import Alerta from '../ui/Alerta'
import { Esqueleto, EstadoErro } from '../ui/Estados'

// Fase 9A: estimativa do pagamento do mês de quem é pago por hora.
// Só administrador e RH (o banco confere). Fica embaixo do espelho, na ficha.
export default function PagamentoHorista({ perfilId, mesTexto }) {
  const mes = lerMes(mesTexto)
  const { inicio, fim } = limitesDoMes(mes.ano, mes.mes)
  const [dados, setDados] = useState(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')

  const carregar = useCallback(async () => {
    setErro('')
    setCarregando(true)
    const { data, error } = await supabase.rpc('pagamento_por_hora', { p_perfil_id: perfilId, p_inicio: inicio, p_fim: fim })
    if (error) setErro(traduzirErro(error))
    setDados(error ? null : data)
    setCarregando(false)
  }, [perfilId, inicio, fim])

  useEffect(() => { carregar() }, [carregar])

  return (
    <section className="cartao" aria-labelledby="t-pagamento-hora">
      <div className="cartao__cabecalho">
        <div>
          <h2 id="t-pagamento-hora">Pagamento por hora: {nomeDoMes(mes)}</h2>
          <p className="suave pequeno">Estimativa para a folha conferir. Não inclui férias, 13º, INSS, FGTS nem descontos.</p>
        </div>
      </div>
      {carregando ? <Esqueleto linhas={4} blocos={1} />
        : erro ? <EstadoErro aoTentarDeNovo={carregar}>{erro}</EstadoErro>
        : (
          <div className="pilha">
            {dados.valor_hora == null && (
              <Alerta tom="atencao">Cadastre o valor da hora na aba <strong>Trabalho</strong> para ver os valores em reais.</Alerta>
            )}
            {dados.valor_hora != null && dados.dias_sem_valor > 0 && (
              <Alerta tom="atencao">
                Em {dados.dias_sem_valor} {dados.dias_sem_valor === 1 ? 'dia trabalhado' : 'dias trabalhados'} ainda não havia valor da hora cadastrado. Esses dias ficaram de fora da conta.
              </Alerta>
            )}
            <div className="tabela-envoltorio">
              <table className="tabela">
                <caption className="sr-only">Pagamento por hora de {nomeDoMes(mes)}</caption>
                <thead><tr><th scope="col">Item</th><th scope="col" className="num">Horas</th><th scope="col" className="num">Valor</th></tr></thead>
                <tbody>
                  {linhasDoPagamento(dados).map((l) => (
                    <tr key={l.id}><td>{l.rotulo}</td><td className="num">{duracao(l.minutos || 0)}</td><td className="num">{reais(l.valor)}</td></tr>
                  ))}
                  <tr><td><strong>Subtotal</strong></td><td /><td className="num"><strong>{reais(dados.subtotal)}</strong></td></tr>
                  <tr>
                    <td>
                      DSR estimado
                      <span className="tabela__secundario">
                        {dados.dsr.dias_repouso} {dados.dsr.dias_repouso === 1 ? 'domingo ou feriado' : 'domingos e feriados'} para {dados.dsr.dias_uteis} dias úteis
                      </span>
                    </td>
                    <td /><td className="num">{reais(dados.dsr.valor)}</td>
                  </tr>
                  <tr><td><strong>Total estimado</strong></td><td /><td className="num"><strong>{reais(dados.total)}</strong></td></tr>
                </tbody>
              </table>
            </div>
            <p className="suave pequeno" style={{ margin: 0 }}>
              {dados.valor_hora != null ? `Valor da hora no fim do período: ${reais(dados.valor_hora)}. ` : ''}
              Os percentuais vêm das Regras de cálculo da empresa. O DSR é uma estimativa: o total das horas dividido pelos dias úteis, vezes os domingos e feriados.
            </p>
          </div>
        )}
    </section>
  )
}
