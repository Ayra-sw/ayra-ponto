import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'

export default function TopBar() {
  const { perfil, signOut } = useAuth()
  const { theme, toggleTheme } = useTheme()

  return (
    <div className="gestao-topbar">
      <div>
        <span className="brand">Ayra</span> Ponto
        {perfil && <span style={{ marginLeft: 16, fontWeight: 400, opacity: 0.85 }}>{perfil.nome_completo}</span>}
      </div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <button className="theme-toggle" onClick={toggleTheme}>
          {theme === 'light' ? '🌙 Escuro' : '☀️ Claro'}
        </button>
        <button className="btn-ghost" style={{ color: 'white' }} onClick={signOut}>
          Sair
        </button>
      </div>
    </div>
  )
}
