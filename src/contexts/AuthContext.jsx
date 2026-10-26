import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { marcarSaida } from '../lib/digital'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [perfil, setPerfil] = useState(null)
  const [loading, setLoading] = useState(true)
  // 'ocioso' | 'carregando' | 'ok' | 'erro'
  const [perfilStatus, setPerfilStatus] = useState('ocioso')
  // Fase 8A: dona/dono da plataforma (Central Ayra). null = ainda não sabe
  const [ehDono, setEhDono] = useState(null)
  // Fase 8B: suporte autorizado pela empresa (só a dona da Central, enquanto durar). null = fora do suporte
  const [suporte, setSuporte] = useState(null)

  async function carregarPerfil(userId) {
    setPerfilStatus('carregando')
    const { data, error } = await supabase
      .from('perfis')
      .select('*')
      .eq('id', userId)
      .maybeSingle()

    if (error || !data) {
      console.error('Erro ao carregar perfil:', error || 'perfil não encontrado')
      setPerfil(null)
      setPerfilStatus('erro')
    } else {
      // só quem não tem empresa pode ser da Central (a conta da Central é separada)
      let sessaoSuporte = null
      if (data.empresa_id) setEhDono(false)
      else {
        const dono = await supabase.rpc('eh_dono')
        const souDono = !dono.error && dono.data === true
        setEhDono(souDono)
        // Fase 8B: com o suporte liberado pela empresa, a dona age como administradora SÓ dela
        if (souDono) {
          const sessao = await supabase.rpc('suporte_sessao_atual')
          if (!sessao.error && sessao.data) sessaoSuporte = sessao.data
        }
      }
      setSuporte(sessaoSuporte)
      setPerfil(sessaoSuporte ? { ...data, empresa_id: sessaoSuporte.empresa_id, tipo: 'administrador', status: 'ativo' } : data)
      setPerfilStatus('ok')
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
        setPerfilStatus('ocioso')
        setEhDono(null)
        setSuporte(null)
      }
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  async function signOut() {
    marcarSaida()
    await supabase.auth.signOut()
  }

  // Chame depois de criar empresa / entrar com código, pra atualizar o
  // perfil em tela sem precisar recarregar a página.
  async function recarregarPerfil() {
    if (session?.user) await carregarPerfil(session.user.id)
  }

  return (
    <AuthContext.Provider value={{ session, perfil, perfilStatus, loading, signOut, recarregarPerfil, ehDono, suporte }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth precisa estar dentro de AuthProvider')
  return ctx
}
