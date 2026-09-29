import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarRange, ChevronLeft, ChevronRight, Copy, Eraser, Search } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../contexts/AuthContext'
import { useAvisos } from '../../contexts/AvisosContext'
import { traduzirErro } from '../../lib/mensagensErro'
import { diaIso } from '../../lib/ajustes'
import { limitesDoMes, nomeDoMes, somarMeses } from '../../lib/apuracao'
import { CURTO_ESCALA, corDoTurno, diaDaSemana, diasDoMes, horarioDoTurno, trabalhaNo12x36 } from '../../lib/escalas'
import Botao from '../ui/Botao'
import Alerta from '../ui/Alerta'
import Etiqueta from '../ui/Etiqueta'
import { Selecao } from '../ui/Campo'
import { Confirmacao } from '../ui/Dialogo'
import { Esqueleto, EstadoErro, EstadoVazio } from '../ui/Estados'

const LETRA_DIA = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']
const NOME_DIA = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado']

// Grade do mês: pessoas nas linhas, dias nas colunas. Escolha um "pincel" (turno ou folga)
// e clique nos dias da escala por calendário. Cada clique já salva.
export default function CalendarioMes({ mes, aoMudarMes, aoIrParaTurnos }) {
  const { perfil } = useAuth()
  const avisar = useAvisos()
  const [pessoas, setPessoas] = useState([])
  const [turnos, setTurnos] = useState([])
  const [dias, setDias] = useState({})            // "perfil|AAAA-MM-DD" → turno_id
  const [feriados, setFeriados] = useState({})    // "AAAA-MM-DD" → nome
  const [departamentos, setDepartamentos] = useState([])
  const [filtroDepartamento, setFiltroDepartamento] = useState('')
  const [termo, setTermo] = useState('')
  const [pincel, setPincel] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [repetindo, setRepetindo] = useState(null)
  const [salvando, setSalvando] = useState(false)

  const listaDias = useMemo(() => diasDoMes(mes.ano, mes.mes), [mes.ano, mes.mes])
  const { inicio, fim } = limitesDoMes(mes.ano, mes.mes)

  const carregar = useCallback(async () => {
    setErro('')
    setCarregando(true)
    const [p, t, d, f, dep] = await Promise.all([
      supabase.from('perfis').select('id, nome_completo, matricula, status, departamento_id, tipo_escala, escala_turno_id, escala_referencia')
        .eq('empresa_id', perfil.empresa_id).neq('tipo_escala', 'semanal').neq('status', 'desligado').order('nome_completo'),
      supabase.from('turnos').select('*').eq('empresa_id', perfil.empresa_id).order('criado_em'),
      supabase.from('escala_dias').select('perfil_id, data, turno_id').gte('data', inicio).lte('data', fim),
      supabase.from('feriados').select('data, nome').eq('empresa_id', perfil.empresa_id).gte('data', inicio).lte('data', fim),
      supabase.from('departamentos').select('id, nome').eq('empresa_id', perfil.empresa_id).order('nome'),
    ])
    const falha = p.error || t.error || d.error
    if (falha) { setErro(traduzirErro(falha)); setCarregando(false); return }
    setPessoas(p.data || [])
    setTurnos(t.data || [])
    setDias(Object.fromEntries((d.data || []).map((x) => [`${x.perfil_id}|${x.data}`, x.turno_id])))
    setFeriados(Object.fromEntries((f.data || []).map((x) => [x.data, x.nome])))
    setDepartamentos(dep.data || [])
    setCarregando(false)
  }, [perfil.empresa_id, inicio, fim])

  useEffect(() => { carregar() }, [carregar])

  const turnoPorId = useMemo(() => Object.fromEntries(turnos.map((t, i) => [t.id, { ...t, cor: corDoTurno(i) }])), [turnos])
  const turnosAtivos = useMemo(() => turnos.filter((t) => t.ativo), [turnos])
  useEffect(() => {
    if (!pincel && turnosAtivos.length) setPincel(turnosAtivos[0].id)
  }, [pincel, turnosAtivos])

  const visiveis = useMemo(() => {
    const t = termo.trim().toLowerCase()
    return pessoas.filter((p) => (!filtroDepartamento || p.departamento_id === filtroDepartamento)
      && (!t || `${p.nome_completo} ${p.matricula || ''}`.toLowerCase().includes(t)))
  }, [pessoas, termo, filtroDepartamento])

  // turno de uma pessoa num dia (calendário: o que foi marcado; 12x36: pela conta de dois em dois dias)
  const turnoDoDia = useCallback((p, dia) => {
    if (p.tipo_escala === '12x36') return trabalhaNo12x36(dia, p.escala_referencia) ? turnoPorId[p.escala_turno_id] : null
    return turnoPorId[dias[`${p.id}|${dia}`]] || null
  }, [dias, turnoPorId])

  const totalPorDia = useMemo(() => listaDias.map((dia) => visiveis.filter((p) => turnoDoDia(p, dia)).length), [listaDias, visiveis, turnoDoDia])

  async function pintar(p, dia) {
    if (!pincel) return
    const chave = `${p.id}|${dia}`
    const atual = dias[chave] || null
    const alvo = pincel === 'folga' ? null : pincel
    if (atual === alvo) return
    setDias((m) => { const n = { ...m }; if (alvo) n[chave] = alvo; else delete n[chave]; return n })
    const r = alvo
      ? await supabase.from('escala_dias').upsert({ perfil_id: p.id, data: dia, turno_id: alvo }, { onConflict: 'perfil_id,data' })
      : await supabase.from('escala_dias').delete().eq('perfil_id', p.id).eq('data', dia)
    if (r.error) {
      setDias((m) => { const n = { ...m }; if (atual) n[chave] = atual; else delete n[chave]; return n })
      avisar(traduzirErro(r.error), 'problema')
    }
  }

  // Copia os dias 1 a 7 (por dia da semana) para o resto do mês
  async function repetirSemana() {
    const p = repetindo
    const padrao = {}
    for (const dia of listaDias.slice(0, 7)) padrao[diaDaSemana(dia)] = dias[`${p.id}|${dia}`] || null
    const resto = listaDias.slice(7)
    const comTurno = resto.filter((dia) => padrao[diaDaSemana(dia)])
    const folgas = resto.filter((dia) => !padrao[diaDaSemana(dia)])
    setSalvando(true)
    let falha = null
    if (comTurno.length) {
      const r = await supabase.from('escala_dias').upsert(
        comTurno.map((dia) => ({ perfil_id: p.id, data: dia, turno_id: padrao[diaDaSemana(dia)] })), { onConflict: 'perfil_id,data' })
      falha = r.error
    }
    if (!falha && folgas.length) {
      const r = await supabase.from('escala_dias').delete().eq('perfil_id', p.id).in('data', folgas)
      falha = r.error
    }
    setSalvando(false)
    setRepetindo(null)
    if (falha) avisar(traduzirErro(falha), 'problema')
    else avisar('Semana repetida no resto do mês.')
    carregar()
  }

  const mesPassado = fim < diaIso()

  if (carregando && pessoas.length === 0 && turnos.length === 0) return <Esqueleto linhas={5} blocos={1} />
  if (erro) return <EstadoErro aoTentarDeNovo={carregar}>{erro}</EstadoErro>

  if (turnos.length === 0) {
    return (
      <EstadoVazio icone={CalendarRange} titulo="Antes, crie os turnos"
        acao={<Botao onClick={aoIrParaTurnos}>Criar turnos</Botao>}>
        A grade do mês usa turnos (Manhã, Tarde, Noite...). Crie os turnos e depois volte aqui para distribuí-los.
      </EstadoVazio>
    )
  }
  if (pessoas.length === 0) {
    return (
      <EstadoVazio icone={CalendarRange} titulo="Ninguém usa escala ainda">
        Na ficha da pessoa, aba <strong>Trabalho</strong>, escolha em “Como a pessoa trabalha” a escala 12x36 ou a escala por calendário. Depois ela aparece aqui.
      </EstadoVazio>
    )
  }

  return (
    <div className="pilha">
      <div className="filtros">
        <div className="campo">
          <span className="campo__rotulo" id="rotulo-mes-escala">Mês</span>
          <div className="linha" role="group" aria-labelledby="rotulo-mes-escala">
            <Botao variante="secundario" tamanho="pequeno" className="btn--icone" aria-label="Mês anterior" icone={ChevronLeft} onClick={() => aoMudarMes(somarMeses(mes, -1))} />
            <strong style={{ minWidth: 150, textAlign: 'center' }} aria-live="polite">{nomeDoMes(mes)}</strong>
            <Botao variante="secundario" tamanho="pequeno" className="btn--icone" aria-label="Próximo mês" icone={ChevronRight} onClick={() => aoMudarMes(somarMeses(mes, 1))} />
          </div>
        </div>
        <div className="campo campo--busca">
          <label className="campo__rotulo" htmlFor="busca-escala">Buscar</label>
          <div className="entrada-grupo">
            <input id="busca-escala" className="entrada" type="search" placeholder="Nome ou matrícula" value={termo} onChange={(e) => setTermo(e.target.value)} />
            <span className="entrada-grupo__botao" aria-hidden="true"><Search /></span>
          </div>
        </div>
        {departamentos.length > 0 && (
          <Selecao rotulo="Departamento" value={filtroDepartamento} onChange={(e) => setFiltroDepartamento(e.target.value)}
            opcoes={[{ valor: '', rotulo: 'Todos' }, ...departamentos.map((d) => ({ valor: d.id, rotulo: d.nome }))]} />
        )}
      </div>

      <div className="pincel" role="group" aria-label="Pincel: o que cada clique coloca no dia">
        <span className="campo__rotulo">Clique no dia para colocar:</span>
        <div className="linha" style={{ flexWrap: 'wrap' }}>
          {turnosAtivos.map((t) => (
            <button key={t.id} type="button" className="pincel__item" aria-pressed={pincel === t.id} onClick={() => setPincel(t.id)}>
              <span className={`celula-escala celula-escala--fixa ${turnoPorId[t.id].cor}`} aria-hidden="true">{t.sigla}</span>
              <span>{t.nome} <span className="mono suave pequeno">{horarioDoTurno(t)}</span></span>
            </button>
          ))}
          <button type="button" className="pincel__item" aria-pressed={pincel === 'folga'} onClick={() => setPincel('folga')}>
            <span className="celula-escala celula-escala--fixa" aria-hidden="true"><Eraser size={14} /></span>
            <span>Folga</span>
          </button>
        </div>
      </div>

      {mesPassado && (
        <Alerta tom="atencao" titulo="Este mês já passou">
          Mudar um dia aqui muda o espelho de ponto da pessoa nesse dia. Só faça isso para corrigir a escala.
        </Alerta>
      )}

      {visiveis.length === 0 ? (
        <EstadoVazio icone={Search} titulo="Ninguém encontrado" acao={<Botao variante="secundario" onClick={() => { setTermo(''); setFiltroDepartamento('') }}>Limpar filtros</Botao>}>
          Confira o nome ou o departamento.
        </EstadoVazio>
      ) : (
        <div className="grade-escala-envoltorio" tabIndex={0} aria-label="Grade da escala do mês (role para os lados para ver todos os dias)">
          <table className="grade-escala">
            <thead>
              <tr>
                <th scope="col" className="grade-escala__pessoa">Pessoa</th>
                {listaDias.map((dia) => {
                  const dow = diaDaSemana(dia)
                  const fer = feriados[dia]
                  return (
                    <th key={dia} scope="col" className={`grade-escala__dia${dow === 0 || dow === 6 ? ' fim-de-semana' : ''}${fer ? ' feriado' : ''}`}
                      title={fer ? `Feriado: ${fer}` : undefined}>
                      <span className="sr-only">{`${Number(dia.slice(8))}, ${NOME_DIA[dow]}${fer ? `, feriado: ${fer}` : ''}`}</span>
                      <span aria-hidden="true">{Number(dia.slice(8))}<small>{LETRA_DIA[dow]}</small>{fer ? <i className="feriado__ponto" /> : null}</span>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {visiveis.map((p) => (
                <tr key={p.id}>
                  <th scope="row" className="grade-escala__pessoa">
                    <Link to={`/gestao/pessoas/${p.id}?aba=trabalho`} className="link"><strong>{p.nome_completo}</strong></Link>
                    <span className="linha" style={{ gap: 6 }}>
                      <Etiqueta tom="neutra" icone={false}>{CURTO_ESCALA[p.tipo_escala]}</Etiqueta>
                      {p.tipo_escala === 'calendario' && (
                        <button type="button" className="link link--suave pequeno grade-escala__repetir" onClick={() => setRepetindo(p)}
                          aria-label={`Repetir a primeira semana de ${p.nome_completo} no resto do mês`}>
                          <Copy size={12} aria-hidden="true" /> repetir semana
                        </button>
                      )}
                    </span>
                  </th>
                  {listaDias.map((dia) => {
                    const t = turnoDoDia(p, dia)
                    const dow = diaDaSemana(dia)
                    const classe = `${dow === 0 || dow === 6 ? 'fim-de-semana' : ''}${feriados[dia] ? ' feriado' : ''}`
                    const rotulo = `${p.nome_completo}, dia ${Number(dia.slice(8))}: ${t ? `${t.nome} ${horarioDoTurno(t)}` : 'folga'}`
                    if (p.tipo_escala === '12x36') {
                      return (
                        <td key={dia} className={classe}>
                          <span className={`celula-escala celula-escala--fixa ${t ? t.cor : 'vazia'}`} role="img" aria-label={`${rotulo} (escala 12x36, muda na ficha da pessoa)`}>{t ? t.sigla : '·'}</span>
                        </td>
                      )
                    }
                    return (
                      <td key={dia} className={classe}>
                        <button type="button" className={`celula-escala ${t ? t.cor : 'vazia'}`} aria-label={`${rotulo}. Clique para colocar ${pincel === 'folga' ? 'folga' : (turnoPorId[pincel]?.nome || '')}`}
                          onClick={() => pintar(p, dia)}>{t ? t.sigla : '·'}</button>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row" className="grade-escala__pessoa">Trabalham no dia</th>
                {totalPorDia.map((n, i) => <td key={listaDias[i]} className="grade-escala__total mono">{n}</td>)}
              </tr>
            </tfoot>
          </table>
        </div>
      )}
      <p className="suave pequeno">
        Dia com ponto (·) é folga. Na escala 12x36 os dias são calculados sozinhos a partir do primeiro dia de trabalho; para mudar, edite a ficha da pessoa.
        Cada clique já é salvo.
      </p>

      <Confirmacao
        aberta={Boolean(repetindo)} titulo="Repetir a primeira semana?" textoConfirmar="Repetir" carregando={salvando}
        aoConfirmar={repetirSemana} aoCancelar={() => setRepetindo(null)}
      >
        Os dias 1 a 7 de {nomeDoMes(mes)} de {repetindo?.nome_completo} serão copiados, por dia da semana, para os dias 8 a {listaDias.length}.
        O que já estava marcado nesses dias será substituído.
      </Confirmacao>
    </div>
  )
}
