import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import ProtectedRoute from './routes/ProtectedRoute'
import ShellGestao from './components/layout/ShellGestao'
import ShellColaborador from './components/layout/ShellColaborador'
import Login from './pages/Login'
import RedefinirSenha from './pages/RedefinirSenha'
import Onboarding from './pages/Onboarding'
import NaoEncontrada from './pages/NaoEncontrada'
import FuncionarioDashboard from './pages/FuncionarioDashboard'
import GestaoDashboard from './pages/GestaoDashboard'
import MinhaConta from './pages/MinhaConta'
import Pessoas from './pages/gestao/Pessoas'
import Solicitacoes from './pages/gestao/Solicitacoes'
import Empresa from './pages/gestao/Empresa'
import Unidades from './pages/gestao/Unidades'
import MeuPonto from './pages/gestao/MeuPonto'
import Reconhecimento from './pages/gestao/Reconhecimento'

const GESTAO = ['administrador', 'rh']

// Administrador e RH começam na visão geral; colaborador, no registro de ponto.
function AreaColaborador() {
  const { perfil } = useAuth()
  if (GESTAO.includes(perfil?.tipo)) return <Navigate to="/gestao" replace />
  return <ShellColaborador />
}

export default function App() {
  return (
    <Routes>
      {/* Acesso */}
      <Route path="/entrar" element={<Login modo="entrar" />} />
      <Route path="/login" element={<Navigate to="/entrar" replace />} />
      <Route path="/criar-conta" element={<Login modo="criar_empresa" />} />
      <Route path="/convite" element={<Login modo="convite" />} />
      <Route path="/convite/:codigo" element={<Login modo="convite" />} />
      <Route path="/recuperar-senha" element={<Login modo="recuperar" />} />
      <Route path="/redefinir-senha" element={<RedefinirSenha />} />
      <Route path="/onboarding" element={<ProtectedRoute exigeEmpresa={false}><Onboarding /></ProtectedRoute>} />

      {/* Colaborador */}
      <Route path="/" element={<ProtectedRoute><AreaColaborador /></ProtectedRoute>}>
        <Route index element={<FuncionarioDashboard />} />
        <Route path="conta" element={<MinhaConta />} />
      </Route>

      {/* Gestão: administrador e RH */}
      <Route path="/gestao" element={<ProtectedRoute tiposPermitidos={GESTAO}><ShellGestao /></ProtectedRoute>}>
        <Route index element={<GestaoDashboard />} />
        <Route path="pessoas" element={<Pessoas />} />
        <Route path="solicitacoes" element={<Solicitacoes />} />
        <Route path="reconhecimento" element={<Reconhecimento />} />
        <Route path="configuracoes" element={<Navigate to="/gestao/configuracoes/empresa" replace />} />
        <Route path="configuracoes/empresa" element={<Empresa />} />
        <Route path="configuracoes/unidades" element={<Unidades />} />
        <Route path="meu-ponto" element={<MeuPonto />} />
        <Route path="conta" element={<MinhaConta />} />
      </Route>

      <Route path="*" element={<NaoEncontrada />} />
    </Routes>
  )
}
