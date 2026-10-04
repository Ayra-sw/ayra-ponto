import { WifiOff } from 'lucide-react'
import { useConexao } from '../../lib/pwa'

// Faixa no alto de todas as telas quando a internet cai.
export default function AvisoSemInternet() {
  const online = useConexao()
  if (online) return null
  return (
    <div className="sem-internet" role="status">
      <WifiOff aria-hidden="true" />
      <span><strong>Sem internet.</strong> O ponto e as informações voltam quando a conexão voltar.</span>
    </div>
  )
}
