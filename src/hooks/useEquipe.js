import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../contexts/AuthContext'

// A equipe de quem está logado (quando é gestor de algum departamento) e
// quantos pedidos dela esperam análise. Sem a Fase 3A instalada, ninguém é gestor.
export default function useEquipe() {
  const { perfil } = useAuth()
  const [equipe, setEquipe] = useState([])
  const [pendentes, setPendentes] = useState(0)
  const [carregando, setCarregando] = useState(true)

  const carregar = useCallback(async () => {
    if (!perfil?.id) return
    const { data, error } = await supabase.rpc('minha_equipe')
    const lista = !error && Array.isArray(data) ? data : []
    setEquipe(lista)
    if (lista.length) {
      const { count } = await supabase.from('ajustes_ponto').select('id', { count: 'exact', head: true })
        .eq('status', 'pendente').neq('tipo', 'abono').neq('perfil_id', perfil.id)
      setPendentes(count || 0)
    } else setPendentes(0)
    setCarregando(false)
  }, [perfil?.id])

  useEffect(() => { carregar() }, [carregar])

  return { equipe, ehGestor: equipe.length > 0, pendentes, carregando, recarregar: carregar }
}
