import { Link } from 'react-router-dom'
import ShellPublico from '../components/layout/ShellPublico'

// Mostrada quando o endereço digitado não existe no Ayra Ponto.
export default function NaoEncontrada() {
  return (
    <ShellPublico
      titulo="Página não encontrada"
      subtitulo="O endereço que você abriu não existe ou mudou de lugar. Confira o link ou volte para o início."
    >
      <Link to="/" className="btn btn--primario btn--bloco">Ir para o início</Link>
    </ShellPublico>
  )
}
