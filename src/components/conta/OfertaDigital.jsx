import { useEffect, useState } from 'react'
import { Fingerprint } from 'lucide-react'
import { useAvisos } from '../../contexts/AvisosContext'
import { ehCelular } from '../../lib/pwa'
import {
  aparelhoTemDigital, ativadaAqui, ativarDigital, dispensarOferta, listarDigitais, ofertaDispensada,
} from '../../lib/digital'
import Botao from '../ui/Botao'

// Convite discreto, só no celular, para ligar a digital depois de entrar com a
// senha. "Agora não" vale para este aparelho; dá para ligar depois em Minha conta.
export default function OfertaDigital() {
  const avisar = useAvisos()
  const [mostrar, setMostrar] = useState(false)
  const [ativando, setAtivando] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => {
    let cancelado = false
    if (!ehCelular() || ativadaAqui() || ofertaDispensada()) return
    ;(async () => {
      if (!(await aparelhoTemDigital())) return
      const r = await listarDigitais() // confirma que o recurso está ligado no Supabase
      if (!cancelado && !r.desligado && r.lista) setMostrar(true)
    })()
    return () => { cancelado = true }
  }, [])

  if (!mostrar) return null

  function agoraNao() { dispensarOferta(); setMostrar(false) }

  async function ativar() {
    setErro('')
    setAtivando(true)
    const r = await ativarDigital()
    setAtivando(false)
    if (!r.ok) { if (r.mensagem) setErro(r.mensagem); return }
    setMostrar(false)
    avisar('Digital ativada. Na próxima vez, toque em "Entrar com a digital".')
  }

  return (
    <section className="convite-app" aria-label="Entrar com a digital">
      <Fingerprint aria-hidden="true" />
      <p>
        <strong>Entre mais rápido, com a sua digital.</strong> Sem digitar a senha. O Ayra Ponto não guarda a sua digital.
        {erro && <span className="convite-app__erro" role="status">{erro}</span>}
      </p>
      <div className="convite-app__acoes">
        <Botao tamanho="pequeno" onClick={ativar} carregando={ativando}>Ativar</Botao>
        <Botao tamanho="pequeno" variante="discreto" onClick={agoraNao}>Agora não</Botao>
      </div>
    </section>
  )
}
