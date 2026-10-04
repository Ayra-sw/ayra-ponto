import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../contexts/AuthContext'

// O que a pessoa já viu ou dispensou (boas-vindas, primeiros passos).
// Fica guardado no banco, então vale em qualquer aparelho.
// Sem a Fase 4A instalada, "disponivel" é falso e nada é guardado.
const memoria = { perfilId: null, chaves: null, disponivel: false, promessa: null }
const ouvintes = new Set()
const avisar = () => ouvintes.forEach((f) => f())

async function carregar(perfilId) {
  if (memoria.perfilId === perfilId && (memoria.chaves || memoria.promessa)) return memoria.promessa
  memoria.perfilId = perfilId
  memoria.chaves = null
  memoria.promessa = supabase.from('marcos_usuario').select('chave').then(({ data, error }) => {
    if (memoria.perfilId !== perfilId) return
    memoria.disponivel = !error
    memoria.chaves = new Set(error ? [] : (data || []).map((m) => m.chave))
    memoria.promessa = null
    avisar()
  })
  return memoria.promessa
}

export default function useMarcos() {
  const { perfil } = useAuth()
  const [, setVersao] = useState(0)

  useEffect(() => {
    const f = () => setVersao((v) => v + 1)
    ouvintes.add(f)
    if (perfil?.id) carregar(perfil.id)
    else { memoria.perfilId = null; memoria.chaves = null }
    return () => ouvintes.delete(f)
  }, [perfil?.id])

  const pronto = Boolean(perfil?.id && memoria.perfilId === perfil.id && memoria.chaves)

  const marcar = useCallback(async (chave) => {
    if (!perfil?.id || !memoria.chaves) return
    memoria.chaves.add(chave); avisar()
    if (!memoria.disponivel) return
    await supabase.from('marcos_usuario').upsert({ perfil_id: perfil.id, chave }, { onConflict: 'perfil_id,chave', ignoreDuplicates: true })
  }, [perfil?.id])

  const desmarcar = useCallback(async (chave) => {
    if (!perfil?.id || !memoria.chaves) return
    memoria.chaves.delete(chave); avisar()
    if (!memoria.disponivel) return
    await supabase.from('marcos_usuario').delete().eq('perfil_id', perfil.id).eq('chave', chave)
  }, [perfil?.id])

  return {
    pronto,
    disponivel: pronto && memoria.disponivel,
    tem: (chave) => Boolean(memoria.chaves?.has(chave)),
    marcar,
    desmarcar,
  }
}
