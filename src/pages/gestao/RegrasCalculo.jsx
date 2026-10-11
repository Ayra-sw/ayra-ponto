import { useEffect, useState } from 'react'
import { Calculator, RotateCcw, Save } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../contexts/AuthContext'
import { useAvisos } from '../../contexts/AvisosContext'
import { traduzirErro } from '../../lib/mensagensErro'
import { PADRAO_CLT, ehPadraoClt, normalizarRegras } from '../../lib/regrasCalculo'
import Botao from '../../components/ui/Botao'
import Alerta from '../../components/ui/Alerta'
import Etiqueta from '../../components/ui/Etiqueta'
import { Campo } from '../../components/ui/Campo'
import { Esqueleto } from '../../components/ui/Estados'

function Interruptor({ marcado, aoMudar, titulo, descricao, desabilitado }) {
  return (
    <label className="opcao" style={{ alignItems: 'center' }}>
      <input type="checkbox" checked={marcado} onChange={(e) => aoMudar(e.target.checked)} disabled={desabilitado} />
      <span>
        <span className="opcao__titulo">{titulo}</span>
        {descricao && <><br /><span className="opcao__desc">{descricao}</span></>}
      </span>
    </label>
  )
}

const horasDeMin = (m) => String(Math.round((Number(m) / 60) * 100) / 100).replace('.', ',')
const minDeHoras = (h) => Math.round(Number(String(h).replace(',', '.')) * 60)

// Regras de cálculo (Fase 7A): já vêm no padrão da CLT. Só o administrador altera.
export default function RegrasCalculo() {
  const { perfil } = useAuth()
  const avisar = useAvisos()
  const podeEditar = perfil.tipo === 'administrador'
  const [r, setR] = useState(null)
  const [original, setOriginal] = useState(null)
  const [semTabela, setSemTabela] = useState(false)
  const [interjornadaH, setInterjornadaH] = useState('11')
  const [semanaH, setSemanaH] = useState('44')
  const [erros, setErros] = useState({})
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    supabase.from('regras_calculo').select('*').eq('empresa_id', perfil.empresa_id).maybeSingle()
      .then(({ data, error }) => {
        if (error) { setSemTabela(true); return }
        const n = normalizarRegras(data)
        setR(n); setOriginal(n)
        setInterjornadaH(horasDeMin(n.interjornada_min)); setSemanaH(horasDeMin(n.limite_semanal_min))
      })
  }, [perfil.empresa_id])

  if (semTabela) {
    return (
      <div className="pagina" style={{ maxWidth: 820 }}>
        <div className="pagina__cabecalho"><div className="pagina__titulo"><span className="pagina__trilha">Configurações</span><h1>Regras de cálculo</h1></div></div>
        <Alerta tom="info" titulo="Ainda não instalado">As regras de cálculo chegam com a atualização do banco da Fase 7A. Rode a migração no Supabase (passo a passo no guia da fase).</Alerta>
      </div>
    )
  }
  if (!r) return <div className="pagina"><Esqueleto blocos={3} linhas={3} /></div>

  const mudar = (campo) => (valor) => { setR((x) => ({ ...x, [campo]: valor })); setErros((e) => ({ ...e, [campo]: '' })) }
  const numero = (campo) => (e) => mudar(campo)(e.target.value)

  function validar() {
    const e = {}
    const n = (v) => Number(v)
    if (!(n(r.extra_normal_pct) >= 50 && n(r.extra_normal_pct) <= 200)) e.extra_normal_pct = 'Entre 50% (mínimo da lei) e 200%.'
    if (!(n(r.extra_especial_pct) >= 50 && n(r.extra_especial_pct) <= 300)) e.extra_especial_pct = 'Entre 50% e 300%.'
    if (!(n(r.noturno_pct) >= 20 && n(r.noturno_pct) <= 100)) e.noturno_pct = 'Entre 20% (mínimo da lei) e 100%.'
    if (!r.noturno_inicio || !r.noturno_fim || r.noturno_inicio === r.noturno_fim) e.noturno_fim = 'Informe o começo e o fim do horário noturno.'
    const ij = minDeHoras(interjornadaH)
    if (!(ij >= 0 && ij <= 1440)) e.interjornada_min = 'Entre 0 e 24 horas.'
    const sm = minDeHoras(semanaH)
    if (!(sm >= 600 && sm <= 3600)) e.limite_semanal_min = 'Entre 10 e 60 horas.'
    setErros(e)
    return Object.keys(e).length === 0 ? { ij, sm } : null
  }

  async function salvar(e) {
    e.preventDefault()
    setErro('')
    const ok = validar()
    if (!ok) return
    const dados = {
      empresa_id: perfil.empresa_id,
      extra_normal_pct: Number(r.extra_normal_pct),
      extra_especial_pct: Number(r.extra_especial_pct),
      extra_especial_folgas: r.extra_especial_folgas,
      noturno_inicio: r.noturno_inicio,
      noturno_fim: r.noturno_fim,
      noturno_pct: Number(r.noturno_pct),
      hora_noturna_reduzida: r.hora_noturna_reduzida,
      prorrogar_noturno: r.prorrogar_noturno,
      intervalo_pre_assinalado: r.intervalo_pre_assinalado,
      interjornada_min: ok.ij,
      dsr_perde_falta: r.dsr_perde_falta,
      dsr_perde_atraso: r.dsr_perde_atraso,
      limite_semanal_min: ok.sm,
    }
    setSalvando(true)
    const { error } = await supabase.from('regras_calculo').upsert(dados, { onConflict: 'empresa_id' })
    setSalvando(false)
    if (error) return setErro(traduzirErro(error))
    const n = normalizarRegras(dados)
    setR(n); setOriginal(n)
    avisar('Regras de cálculo salvas. O espelho já usa as regras novas.')
  }

  function voltarAoPadrao() {
    setR({ ...PADRAO_CLT }); setInterjornadaH('11'); setSemanaH('44'); setErros({})
  }

  const alterado = JSON.stringify({ ...r, interjornadaH, semanaH }) !== JSON.stringify({ ...original, interjornadaH: horasDeMin(original.interjornada_min), semanaH: horasDeMin(original.limite_semanal_min) })
  const padrao = ehPadraoClt({ ...r, interjornada_min: minDeHoras(interjornadaH), limite_semanal_min: minDeHoras(semanaH) })
  const d = !podeEditar

  return (
    <div className="pagina" style={{ maxWidth: 820 }}>
      <div className="pagina__cabecalho">
        <div className="pagina__titulo">
          <span className="pagina__trilha">Configurações</span>
          <h1>Regras de cálculo</h1>
          <p className="suave">Como o Ayra calcula hora extra, trabalho noturno, intervalo, descanso e DSR no espelho e no fechamento do mês.</p>
        </div>
        {padrao ? <Etiqueta tom="ok">Padrão da CLT</Etiqueta> : <Etiqueta tom="info" icone={Calculator}>Personalizado</Etiqueta>}
      </div>

      {!podeEditar && <Alerta tom="info">Somente o administrador altera as regras de cálculo.</Alerta>}
      <Alerta tom="info">
        Já vem tudo no padrão da CLT. Só mude se a <strong>convenção coletiva</strong> ou o <strong>contador</strong> da empresa pedirem outro número.
      </Alerta>

      <form className="pilha" onSubmit={salvar} noValidate>
        <section className="cartao" aria-labelledby="r-extra">
          <div className="cartao__cabecalho"><h2 id="r-extra">Hora extra</h2></div>
          <div className="formulario">
            <div className="grade-campos">
              <Campo rotulo="Dias normais (%)" type="number" inputMode="numeric" min={50} max={200} value={r.extra_normal_pct}
                onChange={numero('extra_normal_pct')} erro={erros.extra_normal_pct} disabled={d} ajuda="A lei pede no mínimo 50%." />
              <Campo rotulo="Domingo, feriado e folga (%)" type="number" inputMode="numeric" min={50} max={300} value={r.extra_especial_pct}
                onChange={numero('extra_especial_pct')} erro={erros.extra_especial_pct} disabled={d || !r.extra_especial_folgas}
                ajuda="Trabalho nesses dias sem folga compensatória: pagamento em dobro (100%)." />
            </div>
            <Interruptor marcado={r.extra_especial_folgas} aoMudar={mudar('extra_especial_folgas')} desabilitado={d}
              titulo="Usar o percentual especial em domingo de descanso, feriado e folga"
              descricao="Desligado, todas as horas extras usam o percentual dos dias normais. Na escala 12x36, o feriado já é compensado pela escala." />
          </div>
        </section>

        <section className="cartao" aria-labelledby="r-noturno">
          <div className="cartao__cabecalho"><h2 id="r-noturno">Trabalho noturno</h2></div>
          <div className="formulario">
            <div className="grade-campos grade-campos--3">
              <Campo rotulo="Começa às" type="time" value={r.noturno_inicio} onChange={(e) => mudar('noturno_inicio')(e.target.value)} disabled={d} />
              <Campo rotulo="Termina às" type="time" value={r.noturno_fim} onChange={(e) => mudar('noturno_fim')(e.target.value)} erro={erros.noturno_fim} disabled={d} />
              <Campo rotulo="Adicional (%)" type="number" inputMode="numeric" min={20} max={100} value={r.noturno_pct} onChange={numero('noturno_pct')} erro={erros.noturno_pct} disabled={d} />
            </div>
            <Interruptor marcado={r.hora_noturna_reduzida} aoMudar={mudar('hora_noturna_reduzida')} desabilitado={d}
              titulo="Hora noturna reduzida (52 minutos e 30 segundos)"
              descricao="Cada 52min30s trabalhados à noite valem 1 hora. É a regra para trabalho urbano. No rural (lavoura: 21h às 5h; pecuária: 20h às 4h) não existe hora reduzida e o adicional é de 25%." />
            <Interruptor marcado={r.prorrogar_noturno} aoMudar={mudar('prorrogar_noturno')} desabilitado={d}
              titulo="Continuar contando como noturno depois das 5h"
              descricao="Quando a pessoa trabalha a noite toda e segue trabalhando depois das 5h, essas horas também são noturnas (Súmula 60 do TST)." />
          </div>
        </section>

        <section className="cartao" aria-labelledby="r-descanso">
          <div className="cartao__cabecalho"><h2 id="r-descanso">Intervalo e descanso</h2></div>
          <div className="formulario">
            <Interruptor marcado={r.intervalo_pre_assinalado} aoMudar={mudar('intervalo_pre_assinalado')} desabilitado={d}
              titulo="A equipe não marca o intervalo (intervalo pré-assinalado)"
              descricao="Ligado, dia sem marcação de intervalo não gera intervalo a pagar. Sem essa opção, quem trabalha mais de 6h sem marcar intervalo tem 1h a pagar com 50% (art. 71 da CLT)." />
            <Campo rotulo="Descanso mínimo entre um dia e outro (horas)" inputMode="decimal" value={interjornadaH}
              onChange={(e) => { setInterjornadaH(e.target.value); setErros((x) => ({ ...x, interjornada_min: '' })) }}
              erro={erros.interjornada_min} disabled={d} ajuda="A CLT pede 11 horas (art. 66). O tempo que faltar é pago como hora extra." />
          </div>
        </section>

        <section className="cartao" aria-labelledby="r-dsr">
          <div className="cartao__cabecalho"><h2 id="r-dsr">DSR (descanso semanal remunerado)</h2></div>
          <div className="formulario">
            <Interruptor marcado={r.dsr_perde_falta} aoMudar={mudar('dsr_perde_falta')} desabilitado={d}
              titulo="Perde o DSR quem falta sem justificativa na semana"
              descricao="Regra da Lei 605/49. Falta abonada, atestado e afastamento não contam. Vale para quem tem jornada semanal (descanso no domingo)." />
            <Interruptor marcado={r.dsr_perde_atraso} aoMudar={mudar('dsr_perde_atraso')} desabilitado={d}
              titulo="Atraso também faz perder o DSR"
              descricao="Só ligue se a convenção coletiva ou o contador da empresa pedirem." />
          </div>
        </section>

        <section className="cartao" aria-labelledby="r-semana">
          <div className="cartao__cabecalho"><h2 id="r-semana">Limite da semana</h2></div>
          <div className="formulario">
            <Campo rotulo="Horas por semana" inputMode="decimal" value={semanaH}
              onChange={(e) => { setSemanaH(e.target.value); setErros((x) => ({ ...x, limite_semanal_min: '' })) }}
              erro={erros.limite_semanal_min} disabled={d}
              ajuda="Hoje a Constituição fala em 44 horas. Se a PEC do fim da escala 6x1 for aprovada, troque aqui para 42h e, depois, 40h. O espelho avisa quando a semana passar do limite." />
          </div>
        </section>

        {erro && <Alerta tom="problema">{erro}</Alerta>}
        {podeEditar && (
          <div className="acoes">
            <Botao type="submit" icone={Save} carregando={salvando} disabled={!alterado}>Salvar regras</Botao>
            <Botao type="button" variante="secundario" icone={RotateCcw} onClick={voltarAoPadrao} disabled={padrao}>Voltar ao padrão da CLT</Botao>
          </div>
        )}
      </form>
    </div>
  )
}
