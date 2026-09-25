import { createContext, useContext, useEffect, useState } from 'react'

const ThemeContext = createContext(null)

// Sem escolha salva, segue o tema do aparelho.
function temaInicial() {
  try {
    const salvo = localStorage.getItem('ayra-theme')
    if (salvo === 'light' || salvo === 'dark') return salvo
  } catch {
    // localStorage indisponível (modo privado, etc.)
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(temaInicial)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    try {
      localStorage.setItem('ayra-theme', theme)
    } catch {
      // segue sem persistir
    }
  }, [theme])

  const toggleTheme = () => setTheme((t) => (t === 'light' ? 'dark' : 'light'))

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme precisa estar dentro de ThemeProvider')
  return ctx
}
