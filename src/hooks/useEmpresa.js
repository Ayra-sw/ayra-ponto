import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../contexts/AuthContext'

// Empresa do usuário e suas unidades (tabela "filiais" no banco).
export default function useEmpresa() {
  const { perfil } = useAuth()
  const [empresa, setEmpresa] = useState(null)
  const [unidades, setUnidades] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)

  const carregar = useCallback(async () => {
    if (!perfil?.empresa_id) return
    setErro(null)
    const [emp, uni] = await Promise.all([
      supabase.from('empresas').select('*').eq('id', perfil.empresa_id).single(),
      supabase.from('filiais').select('*').eq('empresa_id', perfil.empresa_id).order('criado_em'),
    ])
    if (emp.error || uni.error) setErro(emp.error || uni.error)
    setEmpresa(emp.data || null)
    setUnidades(uni.data || [])
    setCarregando(false)
  }, [perfil?.empresa_id])

  useEffect(() => { carregar() }, [carregar])

  return { empresa, unidades, unidadesAtivas: unidades.filter((u) => u.ativa !== false), carregando, erro, recarregar: carregar }
}
