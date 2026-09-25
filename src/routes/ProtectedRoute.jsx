import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import ShellPublico from '../components/layout/ShellPublico'
import Botao from '../components/ui/Botao'
import { Esqueleto } from '../components/ui/Estados'

// tiposPermitidos: lista opcional de papéis que podem acessar
// (ex.: ['administrador', 'rh']). Se omitido, qualquer pessoa logada passa.
// exigeEmpresa: false na tela de onboarding, pra não entrar em loop
// de redirecionamento (quem ainda não tem empresa É pra estar lá).
// A segurança de verdade está no banco (RLS); isto só organiza as telas.
export default function ProtectedRoute({ children, tiposPermitidos, exigeEmpresa = true }) {
  const { session, perfil, perfilStatus, loading, recarregarPerfil, signOut } = useAuth()

  if (loading) return <Carregando />

  if (!session) return <Navigate to="/entrar" replace />

  if (!perfil) {
    if (perfilStatus === 'erro') {
      return (
        <ShellPublico titulo="Não conseguimos carregar seu cadastro" subtitulo="Pode ser a conexão com a internet. Tente de novo em instantes. Se continuar, saia e entre novamente.">
          <div className="acoes">
            <Botao onClick={recarregarPerfil}>Tentar de novo</Botao>
            <Botao variante="secundario" onClick={signOut}>Sair</Botao>
          </div>
        </ShellPublico>
      )
    }
    return <Carregando />
  }

  if (exigeEmpresa && !perfil.empresa_id) return <Navigate to="/onboarding" replace />

  if (!exigeEmpresa && perfil.empresa_id) return <Navigate to="/" replace />

  if (tiposPermitidos && !tiposPermitidos.includes(perfil.tipo)) {
    return <Navigate to="/" replace />
  }

  return children
}

function Carregando() {
  return (
    <div className="publico" aria-busy="true">
      <div className="publico__caixa"><Esqueleto blocos={1} linhas={3} /></div>
    </div>
  )
}
