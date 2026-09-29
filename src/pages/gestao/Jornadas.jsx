import { useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarClock, Copy, Plus } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../contexts/AuthContext'
import { useAvisos } from '../../contexts/AvisosContext'
import { traduzirErro } from '../../lib/mensagensErro'
import { duracao, data as formatarData } from '../../lib/formatos'
import { diaIso } from '../../lib/ajustes'
import {
  DIAS_SEMANA, MODELOS_PRONTOS, ORDEM_DIAS, cargaSemanal, diasEmBranco, diasParaBanco, diasParaFormulario,
  minutosPrevistos, resumoHorarios, textoIntervalo, validarDia,
} from '../../lib/jornadas'
import Botao from '../../components/ui/Botao'
import Etiqueta from '../../components/ui/Etiqueta'
import Alerta from '../../components/ui/Alerta'
import { AreaTexto, Campo, Selecao } from '../../components/ui/Campo'
import { Confirmacao, PainelLateral } from '../../components/ui/Dialogo'
import { Esqueleto, EstadoErro, EstadoVazio } from '../../components/ui/Estados'

// Modelos de jornada: os horários previstos de trabalho, dia a dia.
// Cada colaborador é ligado a um modelo no seu cadastro.
export default function Jornadas() {
  const { perfil } = useAuth()
  const avisar = useAvisos()
  const [modelos, setModelos] = useState([])
  const [dias, setDias] = useState([])
  const [pessoas, setPessoas] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(false)
  const [editando, setEditando] = useState(null)
  const [excluindo, setExcluindo] = useState(null)
  const [salvando, setSalvando] = useState(false)

  const carregar = useCallback(async () => {
    setErro(false)
    const [m, d, p] = await Promise.all([
      supabase.from('modelos_jornada').select('*').eq('empresa_id', perfil.empresa_id).order('nome'),
      supabase.from('modelos_jornada_dias').select('*'),
      supabase.from('perfis').select('id, status, modelo_jornada_id').eq('empresa_id', perfil.empresa_id),
    ])
    if (m.error || d.error || p.error) setErro(true)
    setModelos(m.data || [])
    setDias(d.data || [])
    setPessoas(p.data || [])
    setCarregando(false)
  }, [perfil.empresa_id])

  useEffect(() => { carregar() }, [carregar])

  const diasDo = useMemo(() => {
    const mapa = {}
    for (const d of dias) (mapa[d.modelo_id] ||= []).push(d)
    return mapa
  }, [dias])

  const uso = useMemo(() => {
    const mapa = {}
    for (const p of pessoas) {
      if (!p.modelo_jornada_id) continue
      mapa[p.modelo_jornada_id] ||= { ativas: 0, total: 0 }
      mapa[p.modelo_jornada_id].total += 1
      if (p.status !== 'desligado') mapa[p.modelo_jornada_id].ativas += 1
    }
    return mapa
  }, [pessoas])

  function abrirNovo(pronto) {
    setEditando({
      id: null,
      nome: pronto?.nome || '',
      descricao: pronto?.descricao || '',
      tolerancia: String(pronto?.tolerancia ?? 10),
      ativo: true,
      usaBanco: false, bancoMeses: '6', bancoInicio: '',
      dias: pronto ? pronto.dias() : diasEmBranco(),
      erro: '',
    })
  }

  function abrirEdicao(m, copia = false) {
    setEditando({
      id: copia ? null : m.id,
      nome: copia ? `${m.nome} (cópia)` : m.nome,
      descricao: m.descricao || '',
      tolerancia: String(m.tolerancia_minutos),
      ativo: copia ? true : m.ativo,
      usaBanco: Boolean(m.usa_banco_horas), bancoMeses: String(m.banco_horas_validade_meses || 6), bancoInicio: m.banco_horas_inicio || '',
      dias: diasParaFormulario(diasDo[m.id]),
      erro: '',
    })
  }

  async function salvar(e) {
    e.preventDefault()
    const f = editando
    const nome = f.nome.trim()
    if (nome.length < 2) return setEditando({ ...f, erro: 'Informe o nome da jornada.' })
    const tolerancia = Number(f.tolerancia)
    if (!Number.isInteger(tolerancia) || tolerancia < 0 || tolerancia > 60) return setEditando({ ...f, erro: 'A tolerância deve ser um número de 0 a 60 minutos.' })
    if (!f.dias.some((d) => d.trabalha)) return setEditando({ ...f, erro: 'Marque pelo menos um dia de trabalho.' })
    const ruim = f.dias.find((d) => validarDia(d))
    if (ruim) return setEditando({ ...f, erro: `${DIAS_SEMANA[ruim.dia_semana].longo}: ${validarDia(ruim)}` })
    const meses = Number(f.bancoMeses)
    if (f.usaBanco && !f.bancoInicio) return setEditando({ ...f, erro: 'Informe a partir de que dia o banco de horas passa a valer.' })
    if (f.usaBanco && (!Number.isInteger(meses) || meses < 1 || meses > 12)) return setEditando({ ...f, erro: 'O prazo do banco de horas vai de 1 a 12 meses.' })

    setSalvando(true)
    const { data: idSalvo, error } = await supabase.rpc('salvar_modelo_jornada', {
      p_id: f.id, p_nome: nome, p_descricao: f.descricao.trim() || null,
      p_tolerancia: tolerancia, p_ativo: f.ativo, p_dias: diasParaBanco(f.dias),
    })
    if (error) { setSalvando(false); return setEditando({ ...f, erro: traduzirErro(error) }) }
    // O banco de horas é gravado logo em seguida (só quando há o que gravar)
    let erroBanco = null
    if (f.id || f.usaBanco) {
      const r = await supabase.from('modelos_jornada').update({
        usa_banco_horas: f.usaBanco,
        banco_horas_validade_meses: f.usaBanco ? meses : Number(f.bancoMeses) || 6,
        banco_horas_inicio: f.bancoInicio || null,
      }).eq('id', f.id || idSalvo)
      erroBanco = r.error
    }
    setSalvando(false)
    if (erroBanco) {
      avisar(`A jornada foi salva, mas o banco de horas não: ${traduzirErro(erroBanco)} Abra a jornada e tente de novo.`, 'problema')
      setEditando(null)
      carregar()
      return
    }
    avisar(f.id ? 'Jornada atualizada.' : 'Jornada criada.')
    setEditando(null)
    carregar()
  }

  async function excluir() {
    setSalvando(true)
    const { error } = await supabase.from('modelos_jornada').delete().eq('id', excluindo.id)
    setSalvando(false)
    setExcluindo(null)
    if (error) return avisar(traduzirErro(error), 'problema')
    avisar('Jornada excluída.')
    carregar()
  }

  return (
    <div className="pagina">
      <div className="pagina__cabecalho">
        <div className="pagina__titulo">
          <span className="pagina__trilha">Jornada</span>
          <h1>Jornadas</h1>
          <p className="suave">Os horários previstos de trabalho. Cada colaborador é ligado a uma jornada no seu cadastro.</p>
        </div>
        <Botao icone={Plus} onClick={() => abrirNovo()}>Nova jornada</Botao>
      </div>

      {carregando ? <Esqueleto linhas={4} /> : erro ? <EstadoErro aoTentarDeNovo={carregar} /> : modelos.length === 0 ? (
        <section className="pilha" aria-labelledby="t-modelos">
          <EstadoVazio icone={CalendarClock} titulo="Nenhuma jornada cadastrada">
            Comece por um modelo pronto (você pode ajustar os horários) ou crie do zero.
          </EstadoVazio>
          <h2 id="t-modelos" className="sr-only">Modelos prontos</h2>
          <div className="grade-campos">
            {MODELOS_PRONTOS.map((p) => (
              <button key={p.id} type="button" className="cartao-linha" onClick={() => abrirNovo(p)}>
                <span className="cartao-linha__titulo">{p.nome}</span>
                <span className="cartao-linha__detalhes"><span>{p.descricao}</span></span>
              </button>
            ))}
          </div>
        </section>
      ) : (
        <div className="grade-campos" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
          {modelos.map((m) => {
            const linhas = diasDo[m.id] || []
            const n = uso[m.id]?.ativas || 0
            return (
              <section key={m.id} className="cartao pilha" aria-label={m.nome}>
                <div className="linha linha--espacada">
                  <h2 style={{ fontSize: '1.05rem' }}>{m.nome}</h2>
                  {m.ativo ? <Etiqueta tom="ok">Ativa</Etiqueta> : <Etiqueta tom="neutra">Desativada</Etiqueta>}
                </div>
                {m.descricao && <p className="suave pequeno">{m.descricao}</p>}
                <dl className="lista-definicoes">
                  <dt>Horários</dt><dd className="mono">{resumoHorarios(linhas)}</dd>
                  <dt>Intervalo</dt><dd>{textoIntervalo(linhas)}</dd>
                  <dt>Carga</dt><dd><strong className="mono">{duracao(cargaSemanal(diasParaFormulario(linhas)))}</strong> por semana</dd>
                  <dt>Tolerância</dt><dd>{m.tolerancia_minutos} min por dia</dd>
                  <dt>Banco de horas</dt>
                  <dd>{m.usa_banco_horas
                    ? `Sim, ${m.banco_horas_validade_meses} ${m.banco_horas_validade_meses === 1 ? 'mês' : 'meses'} para compensar (desde ${formatarData(m.banco_horas_inicio)})`
                    : 'Não usa'}</dd>
                  <dt>Pessoas</dt><dd>{n} {n === 1 ? 'pessoa' : 'pessoas'}</dd>
                </dl>
                <div className="acoes">
                  <Botao variante="secundario" tamanho="pequeno" onClick={() => abrirEdicao(m)}>Editar</Botao>
                  <Botao variante="discreto" tamanho="pequeno" icone={Copy} onClick={() => abrirEdicao(m, true)}>Duplicar</Botao>
                  <Botao variante="discreto" tamanho="pequeno" onClick={() => setExcluindo(m)} disabled={(uso[m.id]?.total || 0) > 0}
                    title={(uso[m.id]?.total || 0) > 0 ? 'Há pessoas nesta jornada. Desative-a em vez de excluir.' : 'Excluir'}>Excluir</Botao>
                </div>
              </section>
            )
          })}
        </div>
      )}

      <EditorJornada editando={editando} aoMudar={setEditando} aoFechar={() => setEditando(null)} aoSalvar={salvar} salvando={salvando} aoUsarPronto={abrirNovo} />

      <Confirmacao
        aberta={Boolean(excluindo)} titulo="Excluir jornada?" textoConfirmar="Excluir" perigo carregando={salvando}
        aoConfirmar={excluir} aoCancelar={() => setExcluindo(null)}
      >
        A jornada “{excluindo?.nome}” será excluída. Ninguém está ligado a ela, então nenhum cadastro de pessoa é afetado.
      </Confirmacao>
    </div>
  )
}

function EditorJornada({ editando, aoMudar, aoFechar, aoSalvar, salvando, aoUsarPronto }) {
  if (!editando) return null
  const f = editando
  const mudar = (campo, valor) => aoMudar({ ...f, [campo]: valor, erro: '' })
  const mudarDia = (indice, campo, valor) =>
    aoMudar({ ...f, erro: '', dias: f.dias.map((d, i) => (i === indice ? { ...d, [campo]: valor } : d)) })
  const primeiro = ORDEM_DIAS.map((v) => f.dias.find((d) => d.dia_semana === v)).find((d) => d?.trabalha)
  const copiarParaOutros = () => aoMudar({
    ...f, erro: '',
    dias: f.dias.map((d) => (d.trabalha && d !== primeiro
      ? { ...d, entrada: primeiro.entrada, saida: primeiro.saida, intervalo_inicio: primeiro.intervalo_inicio, intervalo_fim: primeiro.intervalo_fim }
      : d)),
  })
  const carga = cargaSemanal(f.dias.filter((d) => !validarDia(d)))
  const podeUsarPronto = !f.id

  return (
    <PainelLateral
      aberto aoFechar={aoFechar}
      titulo={f.id ? 'Editar jornada' : 'Nova jornada'}
      subtitulo={`Carga semanal prevista: ${duracao(carga)}`}
      rodape={
        <>
          <Botao variante="secundario" onClick={aoFechar}>Cancelar</Botao>
          <Botao type="submit" form="form-jornada" carregando={salvando}>Salvar jornada</Botao>
        </>
      }
    >
      <form id="form-jornada" className="formulario" onSubmit={aoSalvar} noValidate>
        {podeUsarPronto && (
          <div className="pilha">
            <span className="campo__rotulo">Começar de um modelo pronto</span>
            <div className="linha">
              {MODELOS_PRONTOS.map((p) => (
                <button key={p.id} type="button" className="ficha" onClick={() => aoUsarPronto(p)}>{p.nome}</button>
              ))}
            </div>
          </div>
        )}
        <div className="secao-formulario">
          <Campo rotulo="Nome da jornada" value={f.nome} onChange={(e) => mudar('nome', e.target.value)} placeholder="Ex.: Comercial 40h" maxLength={80} required />
          <AreaTexto rotulo="Descrição" opcional rows={2} maxLength={300} value={f.descricao} onChange={(e) => mudar('descricao', e.target.value)} />
          <Campo rotulo="Tolerância diária (minutos)" type="number" min="0" max="60" inputMode="numeric" value={f.tolerancia}
            onChange={(e) => mudar('tolerancia', e.target.value)}
            dica="A CLT (art. 58, §1º) não conta como atraso nem como hora extra a variação de até 5 minutos em cada marcação, limitada a 10 minutos por dia. O padrão é 10."
          />
          {f.id && (
            <label className="opcao" style={{ alignItems: 'center' }}>
              <input type="checkbox" checked={f.ativo} onChange={(e) => mudar('ativo', e.target.checked)} />
              <span><span className="opcao__titulo">Jornada ativa</span><br /><span className="opcao__desc">Desativada, ela não aparece para novas escolhas. Quem já usa continua com ela.</span></span>
            </label>
          )}
        </div>

        <div className="secao-formulario">
          <h3>Banco de horas</h3>
          <label className="opcao" style={{ alignItems: 'center' }}>
            <input type="checkbox" checked={f.usaBanco}
              onChange={(e) => aoMudar({ ...f, erro: '', usaBanco: e.target.checked, bancoInicio: e.target.checked && !f.bancoInicio ? diaIso() : f.bancoInicio })} />
            <span><span className="opcao__titulo">Usar banco de horas nesta jornada</span><br />
              <span className="opcao__desc">As horas extras viram saldo e as horas a menos saem dele. O que não for compensado no prazo vence e fica “a pagar”.</span></span>
          </label>
          {f.usaBanco && (
            <>
              <Selecao rotulo="Prazo para compensar" value={f.bancoMeses} onChange={(e) => mudar('bancoMeses', e.target.value)}
                opcoes={Array.from({ length: 12 }, (_, i) => ({ valor: String(i + 1), rotulo: `${i + 1} ${i === 0 ? 'mês' : 'meses'}${i === 5 ? ' (padrão)' : ''}` }))}
                dica="A CLT permite compensar em até 6 meses por acordo individual por escrito, e em até 12 meses por acordo ou convenção coletiva. Confirme com seu contador ou advogado o que vale na sua empresa." />
              <Campo rotulo="O banco vale a partir de" type="date" value={f.bancoInicio} onChange={(e) => mudar('bancoInicio', e.target.value)} required
                dica="Só os dias a partir desta data entram no saldo. Para levar um saldo antigo, use “Saldo inicial” na ficha da pessoa." />
            </>
          )}
        </div>

        <div className="secao-formulario">
          <div className="linha linha--espacada">
            <h3>Horários da semana</h3>
            {primeiro && f.dias.filter((d) => d.trabalha).length > 1 && (
              <Botao variante="discreto" tamanho="pequeno" onClick={copiarParaOutros}>
                Copiar de {DIAS_SEMANA[primeiro.dia_semana].curto} para os outros dias
              </Botao>
            )}
          </div>
          {ORDEM_DIAS.map((valor) => {
            const indice = f.dias.findIndex((d) => d.dia_semana === valor)
            const d = f.dias[indice]
            const aviso = validarDia(d)
            return (
              <div key={valor} className="cartao cartao--compacto pilha" role="group" aria-label={DIAS_SEMANA[valor].longo}>
                <div className="linha linha--espacada">
                  <label className="linha" style={{ cursor: 'pointer' }}>
                    <input type="checkbox" checked={d.trabalha} onChange={(e) => mudarDia(indice, 'trabalha', e.target.checked)} style={{ accentColor: 'var(--primaria)', width: 18, height: 18 }} />
                    <strong>{DIAS_SEMANA[valor].longo}</strong>
                  </label>
                  {d.trabalha
                    ? <span className="mono suave pequeno">{aviso ? '—' : duracao(minutosPrevistos(d))}</span>
                    : <span className="suave pequeno">Folga</span>}
                </div>
                {d.trabalha && (
                  <>
                    <div className="grade-campos grade-campos--3" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
                      <Campo rotulo="Entrada" type="time" value={d.entrada} onChange={(e) => mudarDia(indice, 'entrada', e.target.value)} />
                      <Campo rotulo="Saída" type="time" value={d.saida} onChange={(e) => mudarDia(indice, 'saida', e.target.value)} />
                      <Campo rotulo="Início do intervalo" type="time" value={d.intervalo_inicio} onChange={(e) => mudarDia(indice, 'intervalo_inicio', e.target.value)} />
                      <Campo rotulo="Fim do intervalo" type="time" value={d.intervalo_fim} onChange={(e) => mudarDia(indice, 'intervalo_fim', e.target.value)} />
                    </div>
                    {aviso
                      ? <span className="campo__erro" role="alert">{aviso}</span>
                      : <span className="suave pequeno">O intervalo é opcional: deixe em branco se não houver.</span>}
                  </>
                )}
              </div>
            )
          })}
          <p className="suave pequeno">Se a saída for antes da entrada (turno da noite), o sistema entende que ela acontece no dia seguinte.</p>
        </div>

        {f.erro && <Alerta tom="problema">{f.erro}</Alerta>}
      </form>
    </PainelLateral>
  )
}
