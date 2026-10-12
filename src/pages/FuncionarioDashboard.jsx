import RegistrarPonto from '../components/ponto/RegistrarPonto'
import { ConviteInstalarApp } from '../components/app/InstalarApp'
import ApresentacaoMarca from '../components/gestao/ApresentacaoMarca'
import OfertaDigital from '../components/conta/OfertaDigital'
import AvisoAssinar from '../components/espelho/AvisoAssinar'

// Início do colaborador: registrar ponto é a primeira coisa da tela.
export default function FuncionarioDashboard() {
  return (
    <div className="pagina">
      <h1 className="sr-only">Início: registrar ponto</h1>
      <ApresentacaoMarca compacta />
      <ConviteInstalarApp />
      <RegistrarPonto />
      <AvisoAssinar base="/espelho" />
      <OfertaDigital />
    </div>
  )
}
