import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useAvisos } from '../../contexts/AvisosContext'
import { traduzirErro } from '../../lib/mensagensErro'
import { diaIso } from '../../lib/ajustes'
import { TIPOS_LANCAMENTO, minutosDeCampos } from '../../lib/bancoHoras'
import Botao from '../ui/Botao'
import Alerta from '../ui/Alerta'
import { AreaTexto, Campo, Selecao } from '../ui/Campo'
import { PainelLateral } from '../ui/Dialogo'

// Lançamento manual no banco de horas de uma pessoa (administrador e RH).
export default function NovoLancamento({ aberto, aoFechar, aoSalvo, perfilId, nomePessoa }) {
  const avisar = useAvisos()
  const [tipo, setTipo] = useState('pagamento')
  const [entra, setEntra] = useState(true)
  const [horas, setHoras] = useState('')
  const [minutos, setMinutos] = useState('')
  const [dia, setDia] = useState(diaIso())
  const [motivo, setMotivo] = useState('')
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    if (!aberto) return
    setTipo('pagamento'); setEntra(true); setHoras(''); setMinutos(''); setDia(diaIso()); setMotivo(''); setErro('')
  }, [aberto])

  if (!aberto) return null
  const def = TIPOS_LANCAMENTO.find((t) => t.valor === tipo)
  const sinalLivre = def.sinal === 'livre'

  async function salvar(e) {
    e.preventDefault()
    setErro('')
    const total = minutosDeCampos(horas, minutos)
    if (total == null) return setErro('Informe as horas e os minutos (minutos de 0 a 59). O máximo é 240 horas.')
    if (!dia) return setErro('Informe o dia do lançamento.')
    if (dia > diaIso()) return setErro('O lançamento não pode ter data no futuro.')
    if (motivo.trim().length < 5) return setErro('Conte o motivo com um pouco mais de detalhe (mínimo de 5 letras).')
    const assinado = sinalLivre && entra ? total : -total

    setSalvando(true)
    const { error } = await supabase.from('banco_horas_lancamentos').insert({
      perfil_id: perfilId, data: dia, tipo, minutos: assinado, motivo: motivo.trim(),
    })
    setSalvando(false)
    if (error) return setErro(traduzirErro(error))
    avisar('Lançamento registrado.')
    aoSalvo?.()
    aoFechar()
  }

  return (
    <PainelLateral
      aberto aoFechar={aoFechar}
      titulo="Novo lançamento no banco de horas"
      subtitulo={nomePessoa ? `Para ${nomePessoa}. Lançamentos não podem ser editados nem apagados.` : 'Lançamentos não podem ser editados nem apagados.'}
      rodape={
        <>
          <Botao variante="secundario" onClick={aoFechar}>Cancelar</Botao>
          <Botao type="submit" form="form-lancamento" carregando={salvando}>Registrar lançamento</Botao>
        </>
      }
    >
      <form id="form-lancamento" className="formulario" onSubmit={salvar} noValidate>
        <Selecao rotulo="Tipo" value={tipo} onChange={(e) => { setTipo(e.target.value); setErro('') }}
          opcoes={TIPOS_LANCAMENTO.map((t) => ({ valor: t.valor, rotulo: t.rotulo }))} ajuda={def.descricao} />

        {sinalLivre && (
          <fieldset className="opcoes" style={{ border: 'none', padding: 0, margin: 0 }}>
            <legend className="campo__rotulo">O que este lançamento faz?</legend>
            <label className="opcao">
              <input type="radio" name="sentido" checked={entra} onChange={() => setEntra(true)} />
              <span className="opcao__titulo">Coloca horas no banco</span>
            </label>
            <label className="opcao">
              <input type="radio" name="sentido" checked={!entra} onChange={() => setEntra(false)} />
              <span className="opcao__titulo">Tira horas do banco</span>
            </label>
          </fieldset>
        )}

        <div className="grade-campos" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
          <Campo rotulo="Horas" type="number" min="0" max="240" inputMode="numeric" value={horas} onChange={(e) => setHoras(e.target.value)} placeholder="0" />
          <Campo rotulo="Minutos" type="number" min="0" max="59" inputMode="numeric" value={minutos} onChange={(e) => setMinutos(e.target.value)} placeholder="0" />
        </div>
        <Campo rotulo="Dia do lançamento" type="date" max={diaIso()} value={dia} onChange={(e) => setDia(e.target.value)} required />
        <AreaTexto rotulo="Motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={300} rows={3} required
          placeholder="Ex.: pago na folha de setembro" ajuda={`${motivo.length}/300 caracteres`} />
        {erro && <Alerta tom="problema">{erro}</Alerta>}
      </form>
    </PainelLateral>
  )
}
