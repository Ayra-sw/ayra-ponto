import { Suspense, useEffect } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import ProtectedRoute from './routes/ProtectedRoute'
import ShellGestao from './components/layout/ShellGestao'
import ShellColaborador from './components/layout/ShellColaborador'
import { Esqueleto } from './components/ui/Estados'
import Login from './pages/Login'
import NaoEncontrada from './pages/NaoEncontrada'
import FuncionarioDashboard from './pages/FuncionarioDashboard'
import { telas, preCarregar } from './telas'
import AvisoSemInternet from './components/app/AvisoSemInternet'
import ErroNaTela from './components/app/ErroNaTela'

const { RedefinirSenha, Onboarding, GestaoDashboard, MinhaConta, Pessoas, Solicitacoes, Empresa, Unidades, MeuPonto, Reconhecimento, PerfilPessoa, Departamentos, Cargos, Jornadas, Feriados, MeuHistorico, MeuEspelho, Espelhos, BancoHorasEquipe, Escalas, RelatoriosGestao, Historico, MinhaEquipe, PessoaDaEquipe, CentralAjuda } = telas

const GESTAO = ['administrador', 'rh']

// Administrador e RH começam na visão geral; colaborador, no registro de ponto.
function AreaColaborador() {
  const { perfil } = useAuth()
  const local = useLocation()
  if (GESTAO.includes(perfil?.tipo)) {
    // a ajuda tem o mesmo endereço nas duas áreas
    const ajuda = local.pathname.startsWith('/ajuda') ? local.pathname : ''
    return <Navigate to={`/gestao${ajuda}${ajuda ? local.search : ''}`} replace />
  }
  return <ShellColaborador />
}

export default function App() {
  const { perfil } = useAuth()
  // Depois que a tela abre, baixa em segundo plano as telas mais usadas de cada perfil
  useEffect(() => { if (perfil?.tipo) preCarregar(GESTAO.includes(perfil.tipo) ? 'gestao' : 'colaborador') }, [perfil?.tipo])
  return (
    <>
    <AvisoSemInternet />
    <ErroNaTela>
    <Suspense fallback={<div className="pagina"><Esqueleto blocos={1} linhas={4} /></div>}>
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
        <Route path="historico" element={<MeuHistorico />} />
        <Route path="espelho" element={<MeuEspelho />} />
        <Route path="equipe" element={<MinhaEquipe />} />
        <Route path="equipe/:id" element={<PessoaDaEquipe />} />
        <Route path="conta" element={<MinhaConta />} />
        <Route path="ajuda" element={<CentralAjuda contexto="colaborador" />} />
        <Route path="ajuda/:id" element={<CentralAjuda contexto="colaborador" />} />
      </Route>

      {/* Gestão: administrador e RH */}
      <Route path="/gestao" element={<ProtectedRoute tiposPermitidos={GESTAO}><ShellGestao /></ProtectedRoute>}>
        <Route index element={<GestaoDashboard />} />
        <Route path="pessoas" element={<Pessoas />} />
        <Route path="pessoas/:id" element={<PerfilPessoa />} />
        <Route path="departamentos" element={<Departamentos />} />
        <Route path="cargos" element={<Cargos />} />
        <Route path="jornadas" element={<Jornadas />} />
        <Route path="escalas" element={<Escalas />} />
        <Route path="feriados" element={<Feriados />} />
        <Route path="espelhos" element={<Espelhos />} />
        <Route path="banco-de-horas" element={<BancoHorasEquipe />} />
        <Route path="solicitacoes" element={<Solicitacoes />} />
        <Route path="relatorios" element={<RelatoriosGestao />} />
        <Route path="historico" element={<Historico />} />
        <Route path="reconhecimento" element={<Reconhecimento />} />
        <Route path="configuracoes" element={<Navigate to="/gestao/configuracoes/empresa" replace />} />
        <Route path="configuracoes/empresa" element={<Empresa />} />
        <Route path="configuracoes/unidades" element={<Unidades />} />
        <Route path="meu-ponto" element={<MeuPonto />} />
        <Route path="meu-historico" element={<MeuHistorico />} />
        <Route path="meu-espelho" element={<MeuEspelho />} />
        <Route path="conta" element={<MinhaConta />} />
        <Route path="ajuda" element={<CentralAjuda contexto="gestao" />} />
        <Route path="ajuda/:id" element={<CentralAjuda contexto="gestao" />} />
      </Route>

      <Route path="*" element={<NaoEncontrada />} />
    </Routes>
    </Suspense>
    </ErroNaTela>
    </>
  )
}
