import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import Botao from './Botao'

export default function BotaoCopiar({ texto, rotulo = 'Copiar', rotuloCopiado = 'Copiado', variante = 'secundario', tamanho }) {
  const [copiado, setCopiado] = useState(false)
  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch {
      window.prompt('Copie o texto abaixo:', texto)
    }
  }
  return (
    <Botao variante={variante} tamanho={tamanho} icone={copiado ? Check : Copy} onClick={copiar} aria-live="polite">
      {copiado ? rotuloCopiado : rotulo}
    </Botao>
  )
}
