import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { Check, Link2, ScanFace, UserRoundCheck, X } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../contexts/AuthContext'
import { useAvisos } from '../../contexts/AvisosContext'
import { traduzirErro } from '../../lib/mensagensErro'
import { dataHora, nsr } from '../../lib/formatos'
import { rotuloMarcacao } from '../../lib/marcacoes'
import { MOTIVO_SEM_FOTO, RESULTADO_FACIAL } from '../../lib/rotulos'
import Botao from '../../components/ui/Botao'
import Etiqueta from '../../components/ui/Etiqueta'
import Alerta from '../../components/ui/Alerta'
import { Confirmacao, Dialogo } from '../../components/ui/Dialogo'
import { Esqueleto, EstadoErro, EstadoVazio } from '../../components/ui/Estados'
import FotoRosto from '../../components/rosto/FotoRosto'

const MOTIVOS_RECUSA = ['Foto escura', 'Rosto cortado ou de lado', 'Não é a pessoa', 'Foto de outra foto ou de uma tela']
const MOTIVOS_CONTESTACAO = ['Não é a pessoa na foto', 'Foto de outra foto ou de uma tela', 'Pessoa não estava trabalhando']

const pct = (v) => (v == null ? '—' : `${Math.round(Number(v) * 100)}%`)

// Central do reconhecimento facial para administrador e RH:
// aprovar fotos de cadastro e conferir marcações duvidosas.
export default function Reconhecimento() {
  const { perfil } = useAuth()
  const { empresa, unidades, atualizarPendentes } = useOutletContext()
  const avisar = useAvisos()
  const [aba, setAba] = useState('marcacoes')
  const [fotos, setFotos] = useState([])
  const [marcacoes, setMarcacoes] = useState([])
  const [aprovadas, setAprovadas] = useState({}) // perfil_id -> foto aprovada
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(false)
  const [confirmarFoto, setConfirmarFoto] = useState(null)
  const [recusarFoto, setRecusarFoto] = useState(null)
  const [contestar, setContestar] = useState(null)
  const [texto, setTexto] = useState('')
  const [erroTexto, setErroTexto] = useState('')
  const [salvando, setSalvando] = useState(false)

  const carregar = useCallback(async () => {
    setErro(false)
    const [f, m, a] = await Promise.all([
      supabase.from('rostos_referencia')
        .select('id, perfil_id, foto_path, enviada_em, qualidade, pessoa:perfis!rostos_referencia_perfil_id_fkey(nome_completo, tipo, cargo)')
        .eq('status', 'pendente').order('enviada_em', { ascending: true }),
      supabase.from('verificacoes_faciais')
        .select('id, perfil_id, resultado, motivo_sem_foto, foto_path, similaridade, limiar, antispoof, vivacidade, piscou, criado_em, pessoa:perfis!verificacoes_faciais_perfil_id_fkey(nome_completo, tipo), marcacao:registros_ponto!verificacoes_faciais_registro_id_fkey(tipo, marcado_em, nsr)')
        .eq('conferencia', 'pendente').order('criado_em', { ascending: false }).limit(100),
      supabase.from('rostos_referencia').select('id, perfil_id, foto_path').eq('status', 'aprovada'),
    ])
    if (f.error || m.error || a.error) setErro(true)
    setFotos(f.data || [])
    setMarcacoes(m.data || [])
    setAprovadas(Object.fromEntries((a.data || []).map((x) => [x.perfil_id, x])))
    setCarregando(false)
  }, [])

  useEffect(() => { carregar() }, [carregar])
  useEffect(() => {
    // abre direto nas fotos se não houver marcações para conferir
    if (!carregando && marcacoes.length === 0 && fotos.length > 0) setAba('fotos')
  }, [carregando]) // eslint-disable-line react-hooks/exhaustive-deps

  // RH não analisa administrador; ninguém analisa o próprio (só o administrador)
  const podeAnalisar = (item) => {
    if (perfil.tipo === 'administrador') return true
    return item.perfil_id !== perfil.id && item.pessoa?.tipo !== 'administrador'
  }

  function abrirTexto(setter, item) {
    setTexto('')
    setErroTexto('')
    setter(item)
  }

  async function analisarFoto(item, aprovar, motivo) {
    setSalvando(true)
    const { error } = await supabase.rpc('analisar_rosto_referencia', { p_id: item.id, p_aprovar: aprovar, p_motivo: motivo || null })
    setSalvando(false)
    if (error) return avisar(traduzirErro(error), 'problema')
    setConfirmarFoto(null)
    setRecusarFoto(null)
    setFotos((l) => l.filter((x) => x.id !== item.id))
    if (aprovar) setAprovadas((a) => ({ ...a, [item.perfil_id]: { id: item.id, perfil_id: item.perfil_id, foto_path: item.foto_path } }))
    atualizarPendentes()
    avisar(aprovar ? `Foto de ${item.pessoa?.nome_completo || 'colaborador'} aprovada.` : 'Foto recusada. A pessoa verá o motivo em "Minha conta".')
  }

  async function conferir(item, confirmar, observacao) {
    setSalvando(true)
    const { error } = await supabase.rpc('conferir_verificacao_facial', { p_id: item.id, p_confirmar: confirmar, p_observacao: observacao || null })
    setSalvando(false)
    if (error) return avisar(traduzirErro(error), 'problema')
    setContestar(null)
    setMarcacoes((l) => l.filter((x) => x.id !== item.id))
    atualizarPendentes()
    avisar(confirmar ? 'Marcação confirmada.' : 'Marcação contestada. Ela continua registrada, com a sua observação.')
  }

  function enviarTexto(e) {
    e.preventDefault()
    if (!texto.trim()) return setErroTexto(recusarFoto ? 'Conte à pessoa por que a foto foi recusada.' : 'Explique por que a marcação foi contestada.')
    if (recusarFoto) analisarFoto(recusarFoto, false, texto.trim())
    else conferir(contestar, false, texto.trim())
  }

  const desligado = empresa && !empresa.reconhecimento_facial

  return (
    <div className="pagina">
      <div className="pagina__cabecalho">
        <div className="pagina__titulo">
          <span className="pagina__trilha">Gestão</span>
          <h1>Reconhecimento facial</h1>
          <p className="suave">Aprove as fotos de cadastro e confira as marcações em que o rosto não foi confirmado.</p>
        </div>
      </div>

      {desligado && (
        <Alerta tom="info" titulo="O reconhecimento facial está desligado"
          acao={perfil.tipo === 'administrador' && <Link to="/gestao/configuracoes/empresa" className="link">Ligar em Empresa</Link>}>
          Enquanto estiver desligado, o ponto é registrado sem câmera.
        </Alerta>
      )}

      <div className="abas" role="tablist" aria-label="Itens para analisar">
        <button type="button" role="tab" aria-selected={aba === 'marcacoes'} className="abas__item" onClick={() => setAba('marcacoes')}>
          Marcações a conferir {marcacoes.length > 0 && <span className="abas__contador">{marcacoes.length}</span>}
        </button>
        <button type="button" role="tab" aria-selected={aba === 'fotos'} className="abas__item" onClick={() => setAba('fotos')}>
          Fotos para aprovar {fotos.length > 0 && <span className="abas__contador">{fotos.length}</span>}
        </button>
      </div>

      {carregando ? (
        <Esqueleto blocos={2} linhas={3} />
      ) : erro ? (
        <EstadoErro aoTentarDeNovo={carregar} />
      ) : aba === 'fotos' ? (
        fotos.length === 0 ? (
          <EstadoVazio icone={UserRoundCheck} titulo="Nenhuma foto esperando aprovação">
            Quando alguém cadastrar ou trocar a foto do rosto, ela aparece aqui.
          </EstadoVazio>
        ) : (
          <div className="grade-revisao">
            {fotos.map((f) => {
              const anterior = aprovadas[f.perfil_id]
              return (
                <article key={f.id} className="cartao revisao">
                  <div className="revisao__fotos">
                    <figure>
                      <FotoRosto caminho={f.foto_path} alt={`Foto nova de ${f.pessoa?.nome_completo}`} />
                      <figcaption>Foto nova</figcaption>
                    </figure>
                    {anterior && (
                      <figure>
                        <FotoRosto caminho={anterior.foto_path} alt="Foto aprovada atual" />
                        <figcaption>Foto atual</figcaption>
                      </figure>
                    )}
                  </div>
                  <div className="revisao__info">
                    <strong>{f.pessoa?.nome_completo || '—'}</strong>
                    <span className="suave pequeno">Enviada em {dataHora(f.enviada_em)}{anterior ? ' · troca de foto' : ' · primeiro cadastro'}</span>
                  </div>
                  {podeAnalisar(f) ? (
                    <div className="acoes">
                      <Botao tamanho="pequeno" icone={Check} onClick={() => setConfirmarFoto(f)}>Aprovar</Botao>
                      <Botao tamanho="pequeno" variante="secundario" icone={X} onClick={() => abrirTexto(setRecusarFoto, f)}>Recusar</Botao>
                    </div>
                  ) : (
                    <span className="suave pequeno">Só o administrador analisa esta foto.</span>
                  )}
                </article>
              )
            })}
          </div>
        )
      ) : marcacoes.length === 0 ? (
        <EstadoVazio icone={ScanFace} titulo="Nenhuma marcação para conferir">
          Marcações em que o rosto não foi reconhecido, ou que foram feitas sem foto, aparecem aqui.
        </EstadoVazio>
      ) : (
        <div className="grade-revisao">
          {marcacoes.map((m) => {
            const ref = aprovadas[m.perfil_id]
            const res = RESULTADO_FACIAL[m.resultado]
            return (
              <article key={m.id} className="cartao revisao">
                <div className="revisao__fotos">
                  <figure>
                    <FotoRosto caminho={m.foto_path} alt="Foto tirada na marcação" />
                    <figcaption>Na marcação</figcaption>
                  </figure>
                  <figure>
                    <FotoRosto caminho={ref?.foto_path} alt="Foto de cadastro" />
                    <figcaption>Cadastro</figcaption>
                  </figure>
                </div>
                <div className="revisao__info">
                  <strong>{m.pessoa?.nome_completo || '—'}</strong>
                  <span className="suave pequeno">
                    {m.marcacao ? `${rotuloMarcacao(m.marcacao.tipo)} · ${dataHora(m.marcacao.marcado_em)} · NSR ${nsr(m.marcacao.nsr)}` : dataHora(m.criado_em)}
                  </span>
                  <div className="linha">
                    <Etiqueta tom={res?.tom}>{res?.rotulo}</Etiqueta>
                  </div>
                  <dl className="revisao__dados">
                    {m.resultado === 'sem_foto' ? (
                      <><dt>Motivo</dt><dd>{MOTIVO_SEM_FOTO[m.motivo_sem_foto] || 'Registrado sem foto'}</dd></>
                    ) : (
                      <>
                        {m.similaridade != null && <><dt>Semelhança</dt><dd>{pct(m.similaridade)} <span className="suave">(mínimo {pct(m.limiar)})</span></dd></>}
                        {m.antispoof != null && <><dt>Parece rosto real</dt><dd>{pct(m.antispoof)}</dd></>}
                        {m.piscou != null && <><dt>Piscou</dt><dd>{m.piscou ? 'Sim' : 'Não'}</dd></>}
                      </>
                    )}
                  </dl>
                </div>
                {podeAnalisar(m) ? (
                  <div className="acoes">
                    <Botao tamanho="pequeno" icone={Check} onClick={() => conferir(m, true)} disabled={salvando}>Era a pessoa</Botao>
                    <Botao tamanho="pequeno" variante="secundario" icone={X} onClick={() => abrirTexto(setContestar, m)}>Não era</Botao>
                  </div>
                ) : (
                  <span className="suave pequeno">Só o administrador confere esta marcação.</span>
                )}
              </article>
            )
          })}
        </div>
      )}

      <Integridade unidades={unidades} />

      <Confirmacao
        aberta={Boolean(confirmarFoto)}
        titulo="Aprovar esta foto?"
        textoConfirmar="Aprovar foto"
        carregando={salvando}
        aoConfirmar={() => analisarFoto(confirmarFoto, true)}
        aoCancelar={() => setConfirmarFoto(null)}
      >
        A partir de agora, as marcações de {confirmarFoto?.pessoa?.nome_completo || 'desta pessoa'} serão comparadas com esta foto.
        Confira se é mesmo a pessoa, de frente e com o rosto bem visível.
      </Confirmacao>

      <Dialogo
        aberto={Boolean(recusarFoto || contestar)}
        aoFechar={salvando ? undefined : () => { setRecusarFoto(null); setContestar(null) }}
        titulo={recusarFoto ? 'Recusar a foto' : 'A marcação não era da pessoa?'}
        acoes={
          <>
            <Botao variante="secundario" onClick={() => { setRecusarFoto(null); setContestar(null) }} disabled={salvando}>Cancelar</Botao>
            <Botao variante="perigo" type="submit" form="form-motivo" carregando={salvando}>{recusarFoto ? 'Recusar foto' : 'Contestar marcação'}</Botao>
          </>
        }
      >
        <form id="form-motivo" className="formulario" onSubmit={enviarTexto}>
          <p className="suave pequeno">
            {recusarFoto
              ? 'A pessoa verá o motivo e poderá tirar outra foto.'
              : 'A marcação não é apagada (a lei não permite): ela fica registrada como contestada, com a sua explicação.'}
          </p>
          <div className="linha" style={{ flexWrap: 'wrap', gap: 6 }}>
            {(recusarFoto ? MOTIVOS_RECUSA : MOTIVOS_CONTESTACAO).map((mt) => (
              <button key={mt} type="button" className="ficha" onClick={() => { setTexto(mt); setErroTexto('') }}>{mt}</button>
            ))}
          </div>
          <div className={`campo${erroTexto ? ' campo--erro' : ''}`}>
            <label className="campo__rotulo" htmlFor="motivo">{recusarFoto ? 'Motivo' : 'Explicação'}</label>
            <textarea id="motivo" className="entrada" rows={3} value={texto} onChange={(e) => { setTexto(e.target.value); setErroTexto('') }}
              aria-invalid={erroTexto ? true : undefined} />
            {erroTexto && <span className="campo__erro" role="alert">{erroTexto}</span>}
          </div>
        </form>
      </Dialogo>
    </div>
  )
}

// Confere se alguma marcação foi alterada ou apagada direto no banco.
function Integridade({ unidades }) {
  const [resultado, setResultado] = useState(null) // null | 'rodando' | [{ unidade, problemas }]
  const ativas = useMemo(() => unidades || [], [unidades])

  async function rodar() {
    setResultado('rodando')
    const lista = []
    for (const u of ativas) {
      const { data, error } = await supabase.rpc('verificar_cadeia_integridade', { p_filial_id: u.id })
      lista.push({ unidade: u.nome, problemas: error ? [{ nsr: null, problema: traduzirErro(error) }] : data || [] })
    }
    setResultado(lista)
  }

  const comProblema = Array.isArray(resultado) && resultado.some((r) => r.problemas.length)

  return (
    <section className="cartao" aria-labelledby="t-integridade">
      <div className="cartao__cabecalho">
        <div>
          <h2 id="t-integridade">Integridade das marcações</h2>
          <p className="suave pequeno">
            Cada marcação guarda o código da anterior, como elos de uma corrente. Se alguém alterar ou apagar uma marcação direto no banco, a corrente quebra e aparece aqui.
          </p>
        </div>
        <Botao variante="secundario" icone={Link2} onClick={rodar} carregando={resultado === 'rodando'}>Conferir agora</Botao>
      </div>
      {Array.isArray(resultado) && (comProblema ? (
        <Alerta tom="problema" titulo="Encontramos marcações com problema">
          <ul>
            {resultado.flatMap((r) => r.problemas.map((p, i) => (
              <li key={`${r.unidade}-${i}`}>{r.unidade}{p.nsr ? ` · NSR ${nsr(p.nsr)}` : ''}: {p.problema}</li>
            )))}
          </ul>
        </Alerta>
      ) : (
        <Alerta tom="ok" titulo="Tudo certo">
          Nenhuma marcação foi alterada ou apagada{resultado.length > 1 ? ` nas ${resultado.length} unidades` : ''}.
        </Alerta>
      ))}
    </section>
  )
}
