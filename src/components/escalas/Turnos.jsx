import { useCallback, useEffect, useMemo, useState } from 'react'
import { Clock, Plus } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../contexts/AuthContext'
import { useAvisos } from '../../contexts/AvisosContext'
import { traduzirErro } from '../../lib/mensagensErro'
import { duracao } from '../../lib/formatos'
import { TURNOS_PRONTOS, cargaDoTurno, corDoTurno, horarioDoTurno, intervaloDoTurno } from '../../lib/escalas'
import { horaCurta } from '../../lib/jornadas'
import Botao from '../ui/Botao'
import Etiqueta from '../ui/Etiqueta'
import Alerta from '../ui/Alerta'
import { Campo } from '../ui/Campo'
import { Confirmacao, PainelLateral } from '../ui/Dialogo'
import { Esqueleto, EstadoErro, EstadoVazio } from '../ui/Estados'

const VAZIO = { id: null, nome: '', sigla: '', entrada: '', saida: '', temIntervalo: false, intervalo_inicio: '', intervalo_fim: '', ativo: true, erro: '' }

// Turnos: Manhã, Tarde, Noite, Plantão 12h... Servem para a 12x36 e para a escala por calendário.
export default function Turnos() {
  const { perfil } = useAuth()
  const avisar = useAvisos()
  const [turnos, setTurnos] = useState([])
  const [pessoas, setPessoas] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(false)
  const [editando, setEditando] = useState(null)
  const [excluindo, setExcluindo] = useState(null)
  const [salvando, setSalvando] = useState(false)

  const carregar = useCallback(async () => {
    setErro(false)
    const [t, p] = await Promise.all([
      supabase.from('turnos').select('*').eq('empresa_id', perfil.empresa_id).order('criado_em'),
      supabase.from('perfis').select('id, status, escala_turno_id').eq('empresa_id', perfil.empresa_id).eq('tipo_escala', '12x36'),
    ])
    if (t.error) setErro(true)
    setTurnos(t.data || [])
    setPessoas(p.data || [])
    setCarregando(false)
  }, [perfil.empresa_id])

  useEffect(() => { carregar() }, [carregar])

  const uso = useMemo(() => {
    const mapa = {}
    for (const p of pessoas) if (p.escala_turno_id && p.status !== 'desligado') mapa[p.escala_turno_id] = (mapa[p.escala_turno_id] || 0) + 1
    return mapa
  }, [pessoas])

  const abrirNovo = (pronto) => setEditando(pronto
    ? { ...VAZIO, ...pronto, temIntervalo: Boolean(pronto.intervalo_inicio), id: null }
    : { ...VAZIO })
  const abrirEdicao = (t) => setEditando({
    id: t.id, nome: t.nome, sigla: t.sigla, entrada: horaCurta(t.entrada), saida: horaCurta(t.saida),
    temIntervalo: Boolean(t.intervalo_inicio), intervalo_inicio: horaCurta(t.intervalo_inicio), intervalo_fim: horaCurta(t.intervalo_fim),
    ativo: t.ativo, erro: '',
  })

  async function salvar(e) {
    e.preventDefault()
    const f = editando
    const falha = (msg) => setEditando({ ...f, erro: msg })
    const nome = f.nome.trim()
    const sigla = f.sigla.trim().toUpperCase()
    if (nome.length < 2) return falha('Informe o nome do turno (mínimo de 2 letras).')
    if (!/^[A-Z0-9]{1,3}$/.test(sigla)) return falha('A sigla tem de 1 a 3 letras ou números (sem acento). Ex.: M, T, N, PD.')
    if (!f.entrada || !f.saida) return falha('Informe a hora de entrada e a de saída.')
    if (f.entrada === f.saida) return falha('A entrada e a saída não podem ser no mesmo horário.')
    if (f.temIntervalo && (!f.intervalo_inicio || !f.intervalo_fim)) return falha('Informe o início e o fim do intervalo, ou desmarque "Tem intervalo".')
    if (f.temIntervalo && f.intervalo_inicio === f.intervalo_fim) return falha('O início e o fim do intervalo não podem ser iguais.')
    const dados = {
      nome, sigla, entrada: f.entrada, saida: f.saida,
      intervalo_inicio: f.temIntervalo ? f.intervalo_inicio : null,
      intervalo_fim: f.temIntervalo ? f.intervalo_fim : null,
      ativo: f.ativo,
    }
    if (cargaDoTurno(dados) <= 0) return falha('O intervalo é maior que o turno. Confira os horários.')

    setSalvando(true)
    const r = f.id
      ? await supabase.from('turnos').update(dados).eq('id', f.id)
      : await supabase.from('turnos').insert({ ...dados, empresa_id: perfil.empresa_id })
    setSalvando(false)
    if (r.error) return falha(traduzirErro(r.error))
    avisar(f.id ? 'Turno atualizado.' : 'Turno criado.')
    setEditando(null)
    carregar()
  }

  async function excluir() {
    setSalvando(true)
    const { error } = await supabase.from('turnos').delete().eq('id', excluindo.id)
    setSalvando(false)
    setExcluindo(null)
    if (error) return avisar(traduzirErro(error), 'problema')
    avisar('Turno excluído.')
    carregar()
  }

  return (
    <div className="pilha">
      <div className="linha linha--espacada">
        <p className="suave pequeno" style={{ margin: 0 }}>
          Turnos são os horários que você distribui nas escalas: Manhã, Tarde, Noite, Plantão 12h...
        </p>
        <Botao icone={Plus} onClick={() => abrirNovo()}>Novo turno</Botao>
      </div>

      {carregando ? <Esqueleto linhas={4} /> : erro ? <EstadoErro aoTentarDeNovo={carregar}>Se acabou de instalar a Fase 2D, confira se a migração foi rodada no Supabase.</EstadoErro> : turnos.length === 0 ? (
        <section className="pilha" aria-labelledby="t-prontos">
          <EstadoVazio icone={Clock} titulo="Nenhum turno cadastrado">
            Comece por um turno pronto (você pode ajustar os horários) ou crie do zero.
          </EstadoVazio>
          <h2 id="t-prontos" className="sr-only">Turnos prontos</h2>
          <div className="grade-campos">
            {TURNOS_PRONTOS.map((p) => (
              <button key={p.id} type="button" className="cartao-linha" onClick={() => abrirNovo(p)}>
                <span className="cartao-linha__titulo">{p.nome}</span>
                <span className="cartao-linha__detalhes"><span className="mono">{horarioDoTurno(p)}</span></span>
              </button>
            ))}
          </div>
        </section>
      ) : (
        <div className="grade-campos" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
          {turnos.map((t, i) => {
            const n = uso[t.id] || 0
            return (
              <section key={t.id} className="cartao pilha" aria-label={t.nome}>
                <div className="linha linha--espacada">
                  <div className="linha">
                    <span className={`celula-escala celula-escala--fixa ${corDoTurno(i)}`} aria-hidden="true">{t.sigla}</span>
                    <h2 style={{ fontSize: '1.05rem' }}>{t.nome}</h2>
                  </div>
                  {t.ativo ? <Etiqueta tom="ok">Ativo</Etiqueta> : <Etiqueta tom="neutra">Desativado</Etiqueta>}
                </div>
                <dl className="lista-definicoes">
                  <dt>Horário</dt><dd className="mono">{horarioDoTurno(t)}{t.saida <= t.entrada ? ' (termina no dia seguinte)' : ''}</dd>
                  <dt>Intervalo</dt><dd className="mono">{intervaloDoTurno(t) || 'Sem intervalo'}</dd>
                  <dt>Carga</dt><dd><strong className="mono">{duracao(cargaDoTurno(t))}</strong> por turno</dd>
                  <dt>Na 12x36</dt><dd>{n} {n === 1 ? 'pessoa' : 'pessoas'}</dd>
                </dl>
                <div className="acoes">
                  <Botao variante="secundario" tamanho="pequeno" onClick={() => abrirEdicao(t)}>Editar</Botao>
                  <Botao variante="discreto" tamanho="pequeno" onClick={() => setExcluindo(t)}>Excluir</Botao>
                </div>
              </section>
            )
          })}
        </div>
      )}

      {editando && (
        <EditorTurno f={editando} aoMudar={setEditando} aoFechar={() => setEditando(null)} aoSalvar={salvar} salvando={salvando} />
      )}

      <Confirmacao
        aberta={Boolean(excluindo)} titulo="Excluir turno?" textoConfirmar="Excluir" perigo carregando={salvando}
        aoConfirmar={excluir} aoCancelar={() => setExcluindo(null)}
      >
        O turno “{excluindo?.nome}” será excluído. Se ele estiver em alguma escala, o sistema não deixa excluir: nesse caso, desative-o.
      </Confirmacao>
    </div>
  )
}

function EditorTurno({ f, aoMudar, aoFechar, aoSalvar, salvando }) {
  const mudar = (campo, valor) => aoMudar({ ...f, [campo]: valor, erro: '' })
  const previa = {
    entrada: f.entrada, saida: f.saida,
    intervalo_inicio: f.temIntervalo ? f.intervalo_inicio : null, intervalo_fim: f.temIntervalo ? f.intervalo_fim : null,
  }
  const carga = f.entrada && f.saida && f.entrada !== f.saida ? cargaDoTurno(previa) : 0
  return (
    <PainelLateral
      aberto aoFechar={aoFechar}
      titulo={f.id ? 'Editar turno' : 'Novo turno'}
      subtitulo={carga > 0 ? `Carga prevista: ${duracao(carga)} por turno` : 'Informe os horários'}
      rodape={
        <>
          <Botao variante="secundario" onClick={aoFechar}>Cancelar</Botao>
          <Botao type="submit" form="form-turno" carregando={salvando}>Salvar turno</Botao>
        </>
      }
    >
      <form id="form-turno" className="formulario" onSubmit={aoSalvar} noValidate>
        {!f.id && (
          <div className="pilha">
            <span className="campo__rotulo">Começar de um turno pronto</span>
            <div className="linha">
              {TURNOS_PRONTOS.map((p) => (
                <button key={p.id} type="button" className="ficha"
                  onClick={() => aoMudar({ ...f, ...p, temIntervalo: Boolean(p.intervalo_inicio), id: null, ativo: true, erro: '' })}>{p.nome}</button>
              ))}
            </div>
          </div>
        )}
        <div className="grade-campos">
          <Campo rotulo="Nome do turno" value={f.nome} onChange={(e) => mudar('nome', e.target.value)} placeholder="Ex.: Manhã" maxLength={40} required />
          <Campo rotulo="Sigla" value={f.sigla} onChange={(e) => mudar('sigla', e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3))}
            placeholder="M" maxLength={3} required mono
            ajuda="De 1 a 3 letras. Aparece na grade do mês." />
        </div>
        <div className="grade-campos">
          <Campo rotulo="Entrada" type="time" value={f.entrada} onChange={(e) => mudar('entrada', e.target.value)} required />
          <Campo rotulo="Saída" type="time" value={f.saida} onChange={(e) => mudar('saida', e.target.value)} required
            ajuda={f.entrada && f.saida && f.saida <= f.entrada ? 'Saída antes da entrada: o turno termina no dia seguinte.' : undefined} />
        </div>
        <label className="opcao" style={{ alignItems: 'center' }}>
          <input type="checkbox" checked={f.temIntervalo} onChange={(e) => mudar('temIntervalo', e.target.checked)} />
          <span><span className="opcao__titulo">Tem intervalo (almoço, jantar, descanso)</span><br />
            <span className="opcao__desc">O intervalo é descontado da carga prevista do turno.</span></span>
        </label>
        {f.temIntervalo && (
          <div className="grade-campos">
            <Campo rotulo="Início do intervalo" type="time" value={f.intervalo_inicio} onChange={(e) => mudar('intervalo_inicio', e.target.value)} required />
            <Campo rotulo="Fim do intervalo" type="time" value={f.intervalo_fim} onChange={(e) => mudar('intervalo_fim', e.target.value)} required />
          </div>
        )}
        {f.id && (
          <label className="opcao" style={{ alignItems: 'center' }}>
            <input type="checkbox" checked={f.ativo} onChange={(e) => mudar('ativo', e.target.checked)} />
            <span><span className="opcao__titulo">Turno ativo</span><br />
              <span className="opcao__desc">Desativado, ele não aparece para novas escalas. Quem já usa continua com ele.</span></span>
          </label>
        )}
        {f.id && (
          <Alerta tom="info">
            Se este turno já foi usado em dias que passaram, o horário dele não pode mudar (isso mudaria o espelho do passado).
            Nesse caso, crie um turno novo com o horário certo e desative este. Nome e sigla podem mudar sempre.
          </Alerta>
        )}
        {f.erro && <Alerta tom="problema">{f.erro}</Alerta>}
      </form>
    </PainelLateral>
  )
}
