import { useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarX2, ChevronLeft, ChevronRight, Pencil, Printer, TriangleAlert } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { traduzirErro } from '../../lib/mensagensErro'
import { data as formatarData, duracao, formatarCpf } from '../../lib/formatos'
import { rotuloMarcacao } from '../../lib/marcacoes'
import {
  diaCurto, ehMesAtualOuFuturo, horaNoFuso, limitesDoMes, lerMes, nomeDoMes, origemDaMarcacao,
  saldoTexto, situacaoDoDia, somarMeses, textoDoMes, tomDoSaldo, totaisDoPeriodo,
} from '../../lib/apuracao'
import useEmpresa from '../../hooks/useEmpresa'
import Botao from '../ui/Botao'
import Etiqueta from '../ui/Etiqueta'
import Alerta from '../ui/Alerta'
import Indicador from '../ui/Indicador'
import { Esqueleto, EstadoErro, EstadoVazio } from '../ui/Estados'

function Marcas({ marcacoes, fuso }) {
  if (!marcacoes?.length) return <span className="suave">—</span>
  return (
    <ul className="marcas">
      {marcacoes.map((m, i) => {
        const aviso = origemDaMarcacao(m)
        return (
          <li key={m.id || i} className={aviso ? 'marcas__item marcas__item--ajustada' : 'marcas__item'}>
            <span className="mono">{horaNoFuso(m.em, fuso)}</span>
            <span>{rotuloMarcacao(m.tipo)}</span>
            {aviso && (
              <span className="marcas__selo" title={m.em_original ? `${aviso}. Horário original: ${horaNoFuso(m.em_original, fuso)}` : aviso}>
                <Pencil aria-hidden="true" />
                <span className="sr-only">{aviso}{m.em_original ? `. Horário original: ${horaNoFuso(m.em_original, fuso)}` : ''}</span>
              </span>
            )}
          </li>
        )
      })}
    </ul>
  )
}

function Avisos({ alertas }) {
  if (!alertas?.length) return null
  return (
    <ul className="avisos-dia">
      {alertas.map((a) => <li key={a}><TriangleAlert aria-hidden="true" />{a}</li>)}
    </ul>
  )
}

// Espelho de ponto de uma pessoa, mês a mês. As contas vêm prontas do banco
// (função apurar_periodo). Com "aoPedirAjuste" aparece o botão de pedir ajuste
// nos dias com problema (só na tela da própria pessoa).
export default function EspelhoMensal({ perfilId, mesInicial, aoMudarMes, aoPedirAjuste, atualizarEm }) {
  const { empresa, unidades } = useEmpresa()
  const [mes, setMes] = useState(() => lerMes(mesInicial))
  const [linhas, setLinhas] = useState([])
  const [pessoa, setPessoa] = useState(null)
  const [jornada, setJornada] = useState(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')

  const carregar = useCallback(async () => {
    setErro('')
    setCarregando(true)
    const { inicio, fim } = limitesDoMes(mes.ano, mes.mes)
    const [apuracao, quem] = await Promise.all([
      supabase.rpc('apurar_periodo', { p_perfil_id: perfilId, p_inicio: inicio, p_fim: fim }),
      supabase.from('perfis').select('id, nome_completo, cpf, matricula, cargo, filial_id, modelo_jornada_id, data_admissao').eq('id', perfilId).maybeSingle(),
    ])
    if (apuracao.error) { setErro(traduzirErro(apuracao.error)); setLinhas([]) } else setLinhas(apuracao.data || [])
    setPessoa(quem.data || null)
    if (quem.data?.modelo_jornada_id) {
      const j = await supabase.from('modelos_jornada').select('nome').eq('id', quem.data.modelo_jornada_id).maybeSingle()
      setJornada(j.data?.nome || null)
    } else setJornada(null)
    setCarregando(false)
  }, [perfilId, mes])

  useEffect(() => { carregar() }, [carregar, atualizarEm])

  const fuso = unidades.find((u) => u.id === pessoa?.filial_id)?.fuso_horario
  const visiveis = useMemo(() => linhas.filter((l) => l.situacao !== 'futuro'), [linhas])
  const totais = useMemo(() => totaisDoPeriodo(linhas), [linhas])
  const noMesAtual = ehMesAtualOuFuturo(mes)

  const irPara = (novo) => { setMes(novo); aoMudarMes?.(textoDoMes(novo)) }
  const podeAjustar = (l) => aoPedirAjuste && !['futuro', 'antes_admissao'].includes(l.situacao)
    && (l.situacao === 'falta' || l.situacao === 'incompleto' || (l.alertas || []).length > 0)

  return (
    <div className="pilha espelho">
      <div className="linha linha--espacada nao-imprimir">
        <div className="linha">
          <Botao variante="secundario" tamanho="pequeno" className="btn--icone" aria-label="Mês anterior" icone={ChevronLeft} onClick={() => irPara(somarMeses(mes, -1))} />
          <strong style={{ minWidth: 150, textAlign: 'center' }} aria-live="polite">{nomeDoMes(mes)}</strong>
          <Botao variante="secundario" tamanho="pequeno" className="btn--icone" aria-label="Próximo mês" icone={ChevronRight} onClick={() => irPara(somarMeses(mes, 1))} disabled={noMesAtual} />
        </div>
        <Botao variante="secundario" tamanho="pequeno" icone={Printer} onClick={() => window.print()} disabled={carregando || Boolean(erro)}>
          Imprimir ou salvar em PDF
        </Botao>
      </div>

      {/* Cabeçalho que só aparece na impressão */}
      <header className="espelho__impressao">
        <h1>Espelho de ponto — {nomeDoMes(mes)}</h1>
        <dl>
          <div><dt>Empresa</dt><dd>{empresa?.razao_social || empresa?.nome || '—'}{empresa?.cnpj ? ` · ${empresa.cnpj}` : ''}</dd></div>
          <div><dt>Colaborador</dt><dd>{pessoa?.nome_completo || '—'}</dd></div>
          {pessoa?.cpf && <div><dt>CPF</dt><dd>{formatarCpf(pessoa.cpf)}</dd></div>}
          {pessoa?.matricula && <div><dt>Matrícula</dt><dd>{pessoa.matricula}</dd></div>}
          {pessoa?.cargo && <div><dt>Cargo</dt><dd>{pessoa.cargo}</dd></div>}
          <div><dt>Jornada</dt><dd>{jornada || 'Não definida'}</dd></div>
        </dl>
      </header>

      {carregando ? <Esqueleto linhas={6} blocos={1} /> : erro ? (
        <EstadoErro aoTentarDeNovo={carregar}>{erro}</EstadoErro>
      ) : (
        <>
          <div className="indicadores">
            <Indicador rotulo="Horas trabalhadas" valor={duracao(totais.trabalhado)} detalhe={`Previsto até hoje: ${duracao(totais.previsto)}`} />
            <Indicador rotulo="Horas extras" valor={duracao(totais.extra)} detalhe="Acima da jornada" />
            <Indicador rotulo="Atrasos e faltas" valor={duracao(totais.atraso + totais.falta)}
              detalhe={totais.diasFalta > 0 ? `${totais.diasFalta} ${totais.diasFalta === 1 ? 'falta' : 'faltas'}` : 'Nenhuma falta'} />
            <Indicador rotulo="Saldo do mês" valor={saldoTexto(totais.saldo)} detalhe={totais.abonado > 0 ? `Abonado: ${duracao(totais.abonado)}` : 'Extras menos atrasos e faltas'} />
          </div>

          {totais.diasComAlerta > 0 && (
            <Alerta tom="atencao" titulo={`${totais.diasComAlerta} ${totais.diasComAlerta === 1 ? 'dia precisa' : 'dias precisam'} de atenção`}>
              {aoPedirAjuste
                ? 'Veja os avisos nos dias marcados. Se esqueceu de bater o ponto, use “Pedir ajuste” no próprio dia.'
                : 'Veja os avisos nos dias marcados. Peça ao colaborador que solicite o ajuste, ou aprove o pedido que já estiver na tela Solicitações.'}
            </Alerta>
          )}

          {visiveis.length === 0 ? (
            <EstadoVazio icone={CalendarX2} titulo={`Nada para mostrar em ${nomeDoMes(mes).toLowerCase()}`}>
              Quando houver marcações ou jornada cadastrada, o espelho aparece aqui, dia a dia.
            </EstadoVazio>
          ) : (
            <>
              <div className="so-computador">
                <div className="tabela-envoltorio">
                  <table className="tabela tabela--espelho">
                    <thead>
                      <tr>
                        <th scope="col">Dia</th><th scope="col">Situação</th><th scope="col">Marcações</th>
                        <th scope="col" className="num">Previsto</th><th scope="col" className="num">Trabalhado</th>
                        <th scope="col" className="num">A menos</th><th scope="col" className="num">Extra</th>
                        <th scope="col" className="num">Saldo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visiveis.map((l) => {
                        const s = situacaoDoDia(l)
                        return (
                          <tr key={l.data} className={l.situacao === 'dia_livre' || l.situacao === 'folga_escala' ? 'linha-suave' : undefined}>
                            <td><strong>{diaCurto(l.data)}</strong></td>
                            <td>
                              <Etiqueta tom={s.tom} icone={s.icone}>{s.rotulo}</Etiqueta>
                              {l.turno && <span className="tabela__secundario">{l.turno}</span>}
                            </td>
                            <td>
                              <Marcas marcacoes={l.marcacoes} fuso={fuso} />
                              <Avisos alertas={l.alertas} />
                              {podeAjustar(l) && (
                                <Botao variante="discreto" tamanho="pequeno" icone={Pencil} className="nao-imprimir" onClick={() => aoPedirAjuste({ data: l.data })}>Pedir ajuste</Botao>
                              )}
                            </td>
                            <td className="num">{l.previsto_min ? duracao(l.previsto_min) : '—'}</td>
                            <td className="num">{l.trabalhado_min ? duracao(l.trabalhado_min) : '—'}</td>
                            <td className="num">{l.atraso_min + l.falta_min ? duracao(l.atraso_min + l.falta_min) : '—'}</td>
                            <td className="num">{l.extra_min ? duracao(l.extra_min) : '—'}</td>
                            <td className="num">{l.situacao === 'incompleto' ? '?' : l.saldo_min ? saldoTexto(l.saldo_min) : '—'}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                    <tfoot>
                      <tr>
                        <th scope="row" colSpan={3}>Totais do mês</th>
                        <td className="num">{duracao(totais.previsto)}</td>
                        <td className="num">{duracao(totais.trabalhado)}</td>
                        <td className="num">{duracao(totais.atraso + totais.falta)}</td>
                        <td className="num">{duracao(totais.extra)}</td>
                        <td className="num">{saldoTexto(totais.saldo)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              <div className="so-celular lista-cartoes">
                {visiveis.map((l) => {
                  const s = situacaoDoDia(l)
                  return (
                    <section key={l.data} className={`cartao-linha ${l.situacao === 'dia_livre' || l.situacao === 'folga_escala' ? 'linha-suave' : ''}`} aria-label={diaCurto(l.data)}>
                      <div className="cartao-linha__topo">
                        <span className="cartao-linha__titulo">{diaCurto(l.data)}</span>
                        <Etiqueta tom={s.tom} icone={s.icone}>{s.rotulo}</Etiqueta>
                      </div>
                      {l.turno && <span className="pequeno suave">{l.turno}</span>}
                      {l.marcacoes?.length > 0 && <Marcas marcacoes={l.marcacoes} fuso={fuso} />}
                      <Avisos alertas={l.alertas} />
                      {(l.previsto_min > 0 || l.trabalhado_min > 0) && (
                        <div className="cartao-linha__detalhes">
                          <span>Previsto <strong className="mono">{l.previsto_min ? duracao(l.previsto_min) : '—'}</strong></span>
                          <span>Trabalhado <strong className="mono">{l.trabalhado_min ? duracao(l.trabalhado_min) : '—'}</strong></span>
                          {l.situacao !== 'incompleto' && (l.atraso_min + l.falta_min + l.extra_min > 0) && (
                            <span>Saldo <strong className="mono">{saldoTexto(l.saldo_min)}</strong></span>
                          )}
                        </div>
                      )}
                      {podeAjustar(l) && (
                        <div className="acoes nao-imprimir">
                          <Botao variante="secundario" tamanho="pequeno" icone={Pencil} onClick={() => aoPedirAjuste({ data: l.data })}>Pedir ajuste deste dia</Botao>
                        </div>
                      )}
                    </section>
                  )
                })}
                <div className="cartao-linha cartao-linha--totais">
                  <strong>Totais do mês</strong>
                  <div className="cartao-linha__detalhes">
                    <span>Previsto <strong className="mono">{duracao(totais.previsto)}</strong></span>
                    <span>Trabalhado <strong className="mono">{duracao(totais.trabalhado)}</strong></span>
                    <span>Saldo <strong className="mono">{saldoTexto(totais.saldo)}</strong></span>
                  </div>
                </div>
              </div>

              <p className="suave pequeno espelho__nota">
                <Pencil aria-hidden="true" className="espelho__nota-icone" /> O lápis marca uma marcação ajustada por pedido aprovado. A marcação original continua guardada, sem alteração.
                {noMesAtual && ' Os dias que ainda não chegaram aparecem quando passam.'}
                {' '}Tolerância, feriados e jornada seguem o cadastro da empresa.
              </p>
              <p className="espelho__impressao-rodape">
                Documento gerado em {formatarData(new Date())} pelo Ayra Ponto. Conferido por: ______________________________
              </p>
            </>
          )}
        </>
      )}
    </div>
  )
}
