import { ScanFace } from 'lucide-react'
import { CONFERENCIA_FACIAL, RESULTADO_FACIAL } from '../../lib/rotulos'
import Etiqueta from '../ui/Etiqueta'

// Situação do reconhecimento facial de uma marcação.
// compacta: na lista do dia só aparece o que importa (reconhecido ou a conferir).
export function EtiquetaVerificacao({ verificacao, compacta = false }) {
  if (!verificacao) return null
  const conferencia = CONFERENCIA_FACIAL[verificacao.conferencia]
  if (conferencia) return <Etiqueta tom={conferencia.tom}>{conferencia.rotulo}</Etiqueta>
  const resultado = RESULTADO_FACIAL[verificacao.resultado]
  if (!resultado) return null
  if (compacta && verificacao.resultado === 'reconhecido') {
    return <Etiqueta tom="ok" icone={ScanFace}>Rosto</Etiqueta>
  }
  return <Etiqueta tom={resultado.tom} icone={ScanFace}>{resultado.rotulo}</Etiqueta>
}
