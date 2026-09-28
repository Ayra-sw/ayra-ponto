import { Network } from 'lucide-react'
import CadastroSimples from '../../components/CadastroSimples'

export default function Departamentos() {
  return (
    <CadastroSimples
      tabela="departamentos" coluna="departamento_id" trilha="Pessoas" titulo="Departamentos"
      subtitulo="Os setores da empresa. Cada colaborador pode ser ligado a um departamento."
      singular="departamento" icone={Network}
      textoVazio="Departamentos ajudam a organizar a equipe e, mais adiante, a separar quem cada gestor acompanha."
      exemploNome="Ex.: Vendas" exemploDescricao="Ex.: Equipe comercial e atendimento"
    />
  )
}
