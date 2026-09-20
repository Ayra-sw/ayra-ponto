import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

// tiposPermitidos: lista opcional de tipos de perfil que podem acessar
// (ex.: ['administrador', 'rh']). Se omitido, qualquer perfil logado passa.
// exigeEmpresa: false na própria tela de onboarding, pra não entrar em loop
// de redirecionamento (quem ainda não tem empresa É pra estar lá).
export default function ProtectedRoute({ children, tiposPermitidos, exigeEmpresa = true }) {
  const { session, perfil, loading } = useAuth()

  if (loading) return <div className="container">Carregando…</div>

  if (!session) return <Navigate to="/login" replace />

  if (!perfil) return <div className="container">Carregando seu perfil…</div>

  if (exigeEmpresa && !perfil.empresa_id) return <Navigate to="/onboarding" replace />

  if (!exigeEmpresa && perfil.empresa_id) return <Navigate to="/" replace />

  if (tiposPermitidos && !tiposPermitidos.includes(perfil.tipo)) {
    return <Navigate to="/" replace />
  }

  return children
}
