import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [perfil, setPerfil] = useState(null)
  const [loading, setLoading] = useState(true)

  async function carregarPerfil(userId) {
    const { data, error } = await supabase
      .from('perfis')
      .select('*')
      .eq('id', userId)
      .single()

    if (error) {
      console.error('Erro ao carregar perfil:', error)
      setPerfil(null)
    } else {
      setPerfil(data)
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session?.user) carregarPerfil(session.user.id)
      setLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session?.user) {
        carregarPerfil(session.user.id)
      } else {
        setPerfil(null)
      }
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  async function signOut() {
    await supabase.auth.signOut()
  }

  // Chame depois de criar empresa / entrar com código, pra atualizar o
  // perfil em tela sem precisar recarregar a página.
  async function recarregarPerfil() {
    if (session?.user) await carregarPerfil(session.user.id)
  }

  return (
    <AuthContext.Provider value={{ session, perfil, loading, signOut, recarregarPerfil }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth precisa estar dentro de AuthProvider')
  return ctx
}
