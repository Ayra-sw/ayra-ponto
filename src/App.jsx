import { Routes, Route } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import ProtectedRoute from './routes/ProtectedRoute'
import Login from './pages/Login'
import RedefinirSenha from './pages/RedefinirSenha'
import Onboarding from './pages/Onboarding'
import FuncionarioDashboard from './pages/FuncionarioDashboard'
import GestaoDashboard from './pages/GestaoDashboard'
import NaoEncontrada from './pages/NaoEncontrada'

function Home() {
  const { perfil } = useAuth()
  if (perfil?.tipo === 'administrador' || perfil?.tipo === 'rh') {
    return <GestaoDashboard />
  }
  return <FuncionarioDashboard />
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/redefinir-senha" element={<RedefinirSenha />} />
      <Route
        path="/onboarding"
        element={
          <ProtectedRoute exigeEmpresa={false}>
            <Onboarding />
          </ProtectedRoute>
        }
      />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Home />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<NaoEncontrada />} />
    </Routes>
  )
}
