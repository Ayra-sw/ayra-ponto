import { useCallback, useEffect, useState } from 'react'
import { Plane, Plus } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { useAvisos } from '../../contexts/AvisosContext'
import { traduzirErro } from '../../lib/mensagensErro'
import { data as formatarData } from '../../lib/formatos'
import { diaIso } from '../../lib/ajustes'
import { TIPO_AFASTAMENTO, situacaoDoAfastamento } from '../../lib/bancoHoras'
import Botao from '../ui/Botao'
import Alerta from '../ui/Alerta'
import Etiqueta from '../ui/Etiqueta'
import { AreaTexto, Campo, Selecao } from '../ui/Campo'
import { Dialogo, PainelLateral } from '../ui/Dialogo'
import { Esqueleto, EstadoErro, EstadoVazio } from '../ui/Estados'

// Férias, atestados, licenças e afastamentos de uma pessoa.
// "podeRegistrar": administrador e RH vendo outra pessoa.
export default function Afastamentos({ perfilId, nomePessoa, podeRegistrar = false }) {
  const avisar = useAvisos()
  const [lista, setLista] = useState(null)
  const [erro, setErro] = useState('')
  const [novo, setNovo] = useState(false)
  const [cancelando, setCancelando] = useState(null)

  const carregar = useCallback(async () => {
    setErro('')
    const { data, error } = await supabase.from('afastamentos')
      .select('id, tipo, data_inicio, data_fim, observacao, cancelado_em, motivo_cancelamento, criado_em')
      .eq('perfil_id', perfilId).order('data_inicio', { ascending: false }).limit(200)
    if (error) { setErro(traduzirErro(error)); setLista(null) } else setLista(data || [])
  }, [perfilId])

  useEffect(() => { setLista(null); carregar() }, [carregar])

  if (erro) return <EstadoErro aoTentarDeNovo={carregar}>{erro}</EstadoErro>
  if (!lista) return <Esqueleto linhas={4} blocos={1} />

  const hoje = diaIso()

  return (
    <div className="pilha">
      <div className="linha linha--espacada">
        <p className="suave pequeno" style={{ margin: 0 }}>
          Nos dias de afastamento a pessoa não recebe falta e não precisa bater ponto.
        </p>
        {podeRegistrar && <Botao variante="secundario" tamanho="pequeno" icone={Plus} onClick={() => setNovo(true)}>Registrar afastamento</Botao>}
      </div>

      {lista.length === 0 ? (
        <EstadoVazio icone={Plane} titulo="Nenhum afastamento registrado">
          {podeRegistrar ? 'Registre férias, atestados e licenças para o espelho não marcar falta nesses dias.' : 'Férias, atestados e licenças registrados pela empresa aparecem aqui.'}
        </EstadoVazio>
      ) : (
        <div className="lista-cartoes">
          {lista.map((a) => {
            const s = situacaoDoAfastamento(a, hoje)
            return (
              <div key={a.id} className="cartao-linha">
                <div className="cartao-linha__topo">
                  <span className="cartao-linha__titulo">{TIPO_AFASTAMENTO[a.tipo]}</span>
                  <Etiqueta tom={s.tom}>{s.rotulo}</Etiqueta>
                </div>
                <span>{a.data_inicio === a.data_fim ? formatarData(a.data_inicio) : `${formatarData(a.data_inicio)} a ${formatarData(a.data_fim)}`}</span>
                {a.observacao && <span className="suave pequeno">{a.observacao}</span>}
                {a.cancelado_em && a.motivo_cancelamento && <span className="suave pequeno">Motivo do cancelamento: {a.motivo_cancelamento}</span>}
                {podeRegistrar && !a.cancelado_em && (
                  <div className="linha">
                    <Botao variante="secundario" tamanho="pequeno" onClick={() => setCancelando(a)}>Cancelar afastamento</Botao>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <NovoAfastamento aberto={novo} aoFechar={() => setNovo(false)} aoSalvo={() => { avisar('Afastamento registrado.'); carregar() }} perfilId={perfilId} nomePessoa={nomePessoa} />
      <CancelarAfastamento afastamento={cancelando} aoFechar={() => setCancelando(null)} aoCancelado={() => { avisar('Afastamento cancelado.'); carregar() }} />
    </div>
  )
}

function NovoAfastamento({ aberto, aoFechar, aoSalvo, perfilId, nomePessoa }) {
  const [tipo, setTipo] = useState('ferias')
  const [inicio, setInicio] = useState('')
  const [fim, setFim] = useState('')
  const [obs, setObs] = useState('')
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    if (!aberto) return
    setTipo('ferias'); setInicio(''); setFim(''); setObs(''); setErro('')
  }, [aberto])

  if (!aberto) return null

  async function salvar(e) {
    e.preventDefault()
    setErro('')
    if (!inicio || !fim) return setErro('Informe o primeiro e o último dia do afastamento.')
    if (fim < inicio) return setErro('O último dia não pode ser antes do primeiro.')
    setSalvando(true)
    const { error } = await supabase.from('afastamentos').insert({
      perfil_id: perfilId, tipo, data_inicio: inicio, data_fim: fim, observacao: obs.trim() || null,
    })
    setSalvando(false)
    if (error) return setErro(traduzirErro(error))
    aoSalvo?.()
    aoFechar()
  }

  return (
    <PainelLateral
      aberto aoFechar={aoFechar}
      titulo="Registrar afastamento"
      subtitulo={nomePessoa ? `Para ${nomePessoa}. Para corrigir depois, cancele e registre de novo.` : 'Para corrigir depois, cancele e registre de novo.'}
      rodape={
        <>
          <Botao variante="secundario" onClick={aoFechar}>Cancelar</Botao>
          <Botao type="submit" form="form-afastamento" carregando={salvando}>Registrar</Botao>
        </>
      }
    >
      <form id="form-afastamento" className="formulario" onSubmit={salvar} noValidate>
        <Selecao rotulo="Tipo" value={tipo} onChange={(e) => setTipo(e.target.value)}
          opcoes={Object.entries(TIPO_AFASTAMENTO).map(([valor, rotulo]) => ({ valor, rotulo }))} />
        <div className="grade-campos" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
          <Campo rotulo="Primeiro dia" type="date" value={inicio} onChange={(e) => { setInicio(e.target.value); if (!fim) setFim(e.target.value) }} required />
          <Campo rotulo="Último dia" type="date" min={inicio || undefined} value={fim} onChange={(e) => setFim(e.target.value)} required />
        </div>
        <AreaTexto rotulo="Observação" opcional value={obs} onChange={(e) => setObs(e.target.value)} maxLength={300} rows={3}
          placeholder="Ex.: férias do período 2025/2026" ajuda={`${obs.length}/300 caracteres. Não escreva diagnóstico nem CID.`} />
        {erro && <Alerta tom="problema">{erro}</Alerta>}
      </form>
    </PainelLateral>
  )
}

function CancelarAfastamento({ afastamento, aoFechar, aoCancelado }) {
  const [motivo, setMotivo] = useState('')
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)

  useEffect(() => { setMotivo(''); setErro('') }, [afastamento])

  async function cancelar() {
    setErro('')
    if (motivo.trim().length < 5) return setErro('Conte o motivo com um pouco mais de detalhe (mínimo de 5 letras).')
    setSalvando(true)
    const { data, error } = await supabase.from('afastamentos')
      .update({ cancelado_em: new Date().toISOString(), motivo_cancelamento: motivo.trim() })
      .eq('id', afastamento.id).select('id')
    setSalvando(false)
    if (error) return setErro(traduzirErro(error))
    if (!data?.length) return setErro('Não foi possível cancelar. Atualize a página e tente de novo.')
    aoCancelado?.()
    aoFechar()
  }

  return (
    <Dialogo
      aberto={Boolean(afastamento)} aoFechar={salvando ? undefined : aoFechar} titulo="Cancelar afastamento?"
      acoes={
        <>
          <Botao variante="secundario" onClick={aoFechar} disabled={salvando}>Voltar</Botao>
          <Botao variante="perigo" onClick={cancelar} carregando={salvando}>Cancelar afastamento</Botao>
        </>
      }
    >
      <div className="formulario">
        <p className="suave">
          Os dias desse afastamento voltam a contar normalmente no espelho: dias sem marcação passam a aparecer como falta.
          O registro fica guardado no histórico.
        </p>
        <AreaTexto rotulo="Motivo do cancelamento" value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={300} rows={3} required data-foco-inicial />
        {erro && <Alerta tom="problema">{erro}</Alerta>}
      </div>
    </Dialogo>
  )
}
