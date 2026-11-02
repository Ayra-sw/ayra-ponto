import { useCallback, useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { useAvisos } from '../../contexts/AvisosContext'
import { traduzirErro } from '../../lib/mensagensErro'
import { data as formatarData } from '../../lib/formatos'
import { diaIso } from '../../lib/ajustes'
import { lerValor, reais } from '../../lib/pagamento'
import Botao from '../ui/Botao'
import Alerta from '../ui/Alerta'
import Etiqueta from '../ui/Etiqueta'
import { Campo } from '../ui/Campo'
import { Confirmacao } from '../ui/Dialogo'
import { Esqueleto, EstadoErro } from '../ui/Estados'

const primeiroDoMes = () => `${diaIso().slice(0, 8)}01`

// Fase 9A: valor da hora de quem é pago por hora, com a data a partir da qual vale.
// O histórico fica guardado: mudar o valor não altera os meses anteriores.
export default function ValorHora({ perfilId, podeEditar }) {
  const avisar = useAvisos()
  const [lista, setLista] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erroCarga, setErroCarga] = useState('')
  const [valor, setValor] = useState('')
  const [desde, setDesde] = useState(primeiroDoMes())
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [excluir, setExcluir] = useState(null)
  const [excluindo, setExcluindo] = useState(false)

  const carregar = useCallback(async () => {
    setErroCarga('')
    const { data, error } = await supabase.from('valores_hora').select('id, valor, desde, criado_em')
      .eq('perfil_id', perfilId).order('desde', { ascending: false })
    if (error) setErroCarga(traduzirErro(error))
    setLista(data || [])
    setCarregando(false)
  }, [perfilId])

  useEffect(() => { carregar() }, [carregar])

  const hoje = diaIso()
  const atual = lista.find((v) => v.desde <= hoje)

  async function salvar(e) {
    e.preventDefault()
    setErro('')
    const numero = lerValor(valor)
    if (numero == null || numero <= 0) return setErro('Informe o valor da hora, por exemplo 25,50.')
    if (!desde) return setErro('Informe a partir de quando o valor vale.')
    setSalvando(true)
    const { error } = await supabase.rpc('definir_valor_hora', { p_perfil_id: perfilId, p_valor: numero, p_desde: desde })
    setSalvando(false)
    if (error) return setErro(traduzirErro(error))
    setValor('')
    avisar(`Valor da hora salvo: ${reais(numero)} a partir de ${formatarData(desde)}.`)
    carregar()
  }

  async function confirmarExclusao() {
    setExcluindo(true)
    const { error } = await supabase.rpc('excluir_valor_hora', { p_id: excluir.id })
    setExcluindo(false)
    setExcluir(null)
    if (error) return avisar(traduzirErro(error), 'problema')
    avisar('Valor apagado.')
    carregar()
  }

  return (
    <section className="cartao" aria-labelledby="t-valor-hora">
      <div className="cartao__cabecalho">
        <div>
          <h2 id="t-valor-hora">Valor da hora</h2>
          <p className="suave pequeno">Só o administrador e o RH veem. Mudar o valor não altera os meses anteriores.</p>
        </div>
        {atual && <Etiqueta tom="ok" icone={false}>{reais(atual.valor)} por hora</Etiqueta>}
      </div>

      {carregando ? <Esqueleto linhas={2} blocos={1} />
        : erroCarga ? <EstadoErro aoTentarDeNovo={carregar}>{erroCarga}</EstadoErro>
        : (
          <div className="pilha">
            {lista.length === 0 && <Alerta tom="info">Nenhum valor cadastrado ainda. Sem ele, o pagamento do mês aparece sem os valores em reais.</Alerta>}
            {lista.length > 0 && (
              <ul className="lista-simples" aria-label="Valores cadastrados">
                {lista.map((v) => (
                  <li key={v.id} className="linha linha--espacada" style={{ gap: 8 }}>
                    <span><strong>{reais(v.valor)}</strong> a partir de {formatarData(v.desde)}{v === atual ? ' (atual)' : v.desde > hoje ? ' (futuro)' : ''}</span>
                    {podeEditar && (
                      <Botao variante="discreto" tamanho="pequeno" icone={Trash2} onClick={() => setExcluir(v)}
                        aria-label={`Apagar o valor de ${reais(v.valor)} a partir de ${formatarData(v.desde)}`}>Apagar</Botao>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {podeEditar ? (
              <form className="formulario" onSubmit={salvar} noValidate>
                <div className="grade-campos">
                  <Campo rotulo="Novo valor da hora (R$)" inputMode="decimal" placeholder="25,50" value={valor}
                    onChange={(e) => { setValor(e.target.value); setErro('') }} />
                  <Campo rotulo="Vale a partir de" type="date" value={desde} onChange={(e) => { setDesde(e.target.value); setErro('') }}
                    ajuda="Normalmente o primeiro dia do mês." />
                </div>
                {erro && <Alerta tom="problema">{erro}</Alerta>}
                <div className="acoes"><Botao type="submit" carregando={salvando}>Salvar valor</Botao></div>
              </form>
            ) : (
              <p className="suave pequeno" style={{ margin: 0 }}>O valor desta pessoa só pode ser alterado pelo administrador.</p>
            )}
          </div>
        )}

      <Confirmacao aberta={Boolean(excluir)} titulo="Apagar este valor?" textoConfirmar="Apagar" perigo carregando={excluindo}
        aoConfirmar={confirmarExclusao} aoCancelar={() => setExcluir(null)}>
        {excluir ? `O valor de ${reais(excluir.valor)} a partir de ${formatarData(excluir.desde)} será apagado. Use só para corrigir um engano.` : ''}
      </Confirmacao>
    </section>
  )
}
