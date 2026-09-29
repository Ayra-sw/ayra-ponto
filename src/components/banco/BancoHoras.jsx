import { useCallback, useEffect, useMemo, useState } from 'react'
import { PiggyBank, Plus } from 'lucide-react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { traduzirErro } from '../../lib/mensagensErro'
import { data as formatarData, duracao } from '../../lib/formatos'
import { MOVIMENTO, minutosComSinal, tomDoSaldoBanco } from '../../lib/bancoHoras'
import Botao from '../ui/Botao'
import Alerta from '../ui/Alerta'
import Etiqueta from '../ui/Etiqueta'
import Indicador from '../ui/Indicador'
import { Esqueleto, EstadoErro, EstadoVazio } from '../ui/Estados'
import NovoLancamento from './NovoLancamento'

const POR_PAGINA = 40

// Saldo e extrato do banco de horas de uma pessoa. Com "podeLancar" (administrador
// e RH vendo outra pessoa) aparece o botão de novo lançamento.
export default function BancoHoras({ perfilId, nomePessoa, podeLancar = false }) {
  const [banco, setBanco] = useState(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [lancando, setLancando] = useState(false)
  const [visiveis, setVisiveis] = useState(POR_PAGINA)

  const carregar = useCallback(async () => {
    setErro('')
    setCarregando(true)
    const { data, error } = await supabase.rpc('banco_horas', { p_perfil_id: perfilId })
    if (error) { setErro(traduzirErro(error)); setBanco(null) } else setBanco(data)
    setCarregando(false)
  }, [perfilId])

  useEffect(() => { carregar() }, [carregar])

  const movimentos = useMemo(() => [...(banco?.movimentos || [])].reverse(), [banco])

  if (carregando) return <Esqueleto linhas={5} blocos={1} />
  if (erro) return <EstadoErro aoTentarDeNovo={carregar}>{erro}</EstadoErro>

  if (!banco?.usa_banco) {
    return (
      <EstadoVazio icone={PiggyBank} titulo="A jornada desta pessoa não usa banco de horas">
        {podeLancar
          ? <>Para usar, ligue o banco de horas na jornada (tela <Link to="/gestao/jornadas" className="link">Jornadas</Link>) e escolha essa jornada no cadastro da pessoa. As horas extras e os atrasos continuam aparecendo no espelho.</>
          : 'Suas horas extras e atrasos aparecem no seu espelho de ponto.'}
      </EstadoVazio>
    )
  }

  const saldo = banco.saldo_min
  const prox = banco.proximo_vencimento

  return (
    <div className="pilha">
      <div className="linha linha--espacada">
        <p className="suave pequeno" style={{ margin: 0 }}>
          Conta desde {formatarData(banco.inicio)}. Prazo para compensar: {banco.validade_meses} {banco.validade_meses === 1 ? 'mês' : 'meses'}.
        </p>
        {podeLancar && <Botao variante="secundario" tamanho="pequeno" icone={Plus} onClick={() => setLancando(true)}>Novo lançamento</Botao>}
      </div>

      {banco.ainda_nao_comecou ? (
        <Alerta tom="info">O banco de horas desta jornada começa em {formatarData(banco.inicio)}. Até lá não há saldo.</Alerta>
      ) : (
        <>
          <div className="indicadores">
            <Indicador rotulo="Saldo do banco" valor={minutosComSinal(saldo)}
              detalhe={saldo < 0 ? 'Horas a compensar' : saldo > 0 ? 'Horas a favor' : 'Zerado'} />
            <Indicador rotulo="Vencem em 30 dias" valor={duracao(banco.a_vencer_min)}
              detalhe={prox ? `Próximo vencimento: ${formatarData(prox.data)} (${duracao(prox.minutos)})` : 'Nada perto de vencer'} />
            <Indicador rotulo="Vencidas, a pagar" valor={duracao(banco.vencido_min)}
              detalhe={banco.vencido_min > 0 ? 'Passaram do prazo' : 'Nenhuma'} />
          </div>

          {banco.vencido_min > 0 && (
            <Alerta tom="atencao" titulo="Há horas vencidas">
              {podeLancar
                ? 'Horas não compensadas no prazo devem ser pagas. Depois de pagar na folha, registre em “Novo lançamento” do tipo Pagamento.'
                : 'Essas horas passaram do prazo para compensar e serão pagas pela empresa.'}
            </Alerta>
          )}
          {banco.dias_incompletos > 0 && (
            <Alerta tom="atencao" titulo={`${banco.dias_incompletos} ${banco.dias_incompletos === 1 ? 'dia incompleto' : 'dias incompletos'}`}>
              Dias com marcação faltando ainda não entram no saldo. Quando forem ajustados, o saldo é recalculado.
            </Alerta>
          )}

          {movimentos.length === 0 ? (
            <EstadoVazio icone={PiggyBank} titulo="Ainda não há movimentos">
              Quando houver horas extras, atrasos ou lançamentos, eles aparecem aqui.
            </EstadoVazio>
          ) : (
            <section aria-label="Extrato do banco de horas" className="pilha">
              <h2 style={{ fontSize: '1.05rem' }}>Extrato</h2>
              <div className="so-computador">
                <div className="tabela-envoltorio">
                  <table className="tabela">
                    <thead>
                      <tr><th scope="col">Data</th><th scope="col">Movimento</th><th scope="col">Detalhe</th>
                        <th scope="col" className="num">Horas</th><th scope="col" className="num">Saldo depois</th></tr>
                    </thead>
                    <tbody>
                      {movimentos.slice(0, visiveis).map((m, i) => {
                        const def = MOVIMENTO[m.tipo] || MOVIMENTO.ajuste
                        return (
                          <tr key={`${m.data}-${m.tipo}-${i}`}>
                            <td style={{ whiteSpace: 'nowrap' }}>{formatarData(m.data)}</td>
                            <td><Etiqueta tom={m.tipo === 'vencimento' ? 'atencao' : 'neutra'} icone={def.icone}>{def.rotulo}</Etiqueta></td>
                            <td>{m.descricao}</td>
                            <td className="num">{minutosComSinal(m.minutos)}</td>
                            <td className="num">{minutosComSinal(m.saldo_apos)}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="so-celular lista-cartoes">
                {movimentos.slice(0, visiveis).map((m, i) => {
                  const def = MOVIMENTO[m.tipo] || MOVIMENTO.ajuste
                  return (
                    <div key={`${m.data}-${m.tipo}-${i}`} className="cartao-linha">
                      <div className="cartao-linha__topo">
                        <span className="cartao-linha__titulo">{formatarData(m.data)}</span>
                        <Etiqueta tom={m.tipo === 'vencimento' ? 'atencao' : 'neutra'} icone={def.icone}>{def.rotulo}</Etiqueta>
                      </div>
                      <span className="pequeno">{m.descricao}</span>
                      <div className="cartao-linha__detalhes">
                        <span>Horas <strong className="mono">{minutosComSinal(m.minutos)}</strong></span>
                        <span>Saldo depois <strong className="mono">{minutosComSinal(m.saldo_apos)}</strong></span>
                      </div>
                    </div>
                  )
                })}
              </div>
              {movimentos.length > visiveis && (
                <div className="paginacao">
                  <span>Mostrando {visiveis} de {movimentos.length} movimentos</span>
                  <Botao variante="secundario" tamanho="pequeno" onClick={() => setVisiveis((v) => v + POR_PAGINA)}>Mostrar mais</Botao>
                </div>
              )}
              <p className="suave pequeno">
                Horas extras viram crédito. Horas a menos consomem primeiro o crédito mais antigo. O crédito não compensado no prazo vence e fica “a pagar”.
                O saldo de cada dia é o mesmo do espelho de ponto.
              </p>
            </section>
          )}
        </>
      )}

      <NovoLancamento aberto={lancando} aoFechar={() => setLancando(false)} aoSalvo={carregar} perfilId={perfilId} nomePessoa={nomePessoa} />
    </div>
  )
}
