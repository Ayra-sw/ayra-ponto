import { BriefcaseBusiness } from 'lucide-react'
import CadastroSimples from '../../components/CadastroSimples'

export default function Cargos() {
  return (
    <CadastroSimples
      tabela="cargos" coluna="cargo_id" trilha="Pessoas" titulo="Cargos"
      subtitulo="As funções da equipe. O cargo aparece no cadastro e nos relatórios."
      singular="cargo" icone={BriefcaseBusiness}
      textoVazio="Cadastre os cargos da empresa para escolher no cadastro de cada colaborador."
      exemploNome="Ex.: Analista financeiro" exemploDescricao="Ex.: Rotinas de contas a pagar e receber"
    />
  )
}
