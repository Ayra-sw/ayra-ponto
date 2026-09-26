import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../contexts/AuthContext'
import { VERSAO_AVISO } from '../components/rosto/AvisoBiometria'

// Situação do reconhecimento facial da pessoa logada: se aceitou o aviso e
// como está a foto de cadastro (aprovada, aguardando ou recusada).
export default function useRosto() {
  const { perfil } = useAuth()
  const [estado, setEstado] = useState({ carregando: true, erro: false, aceitou: false, aprovada: null, pendente: null, recusada: null })

  const carregar = useCallback(async () => {
    if (!perfil?.id) return
    const [c, r] = await Promise.all([
      supabase.from('consentimentos_biometria').select('id, versao_aviso')
        .eq('perfil_id', perfil.id).is('revogado_em', null),
      supabase.from('rostos_referencia').select('id, status, descritor, motivo_recusa, enviada_em, analisada_em, foto_path')
        .eq('perfil_id', perfil.id).in('status', ['aprovada', 'pendente', 'recusada'])
        .order('enviada_em', { ascending: false }),
    ])
    const refs = r.data || []
    setEstado({
      carregando: false,
      erro: Boolean(c.error || r.error),
      aceitou: (c.data || []).some((x) => x.versao_aviso === VERSAO_AVISO),
      aprovada: refs.find((x) => x.status === 'aprovada') || null,
      pendente: refs.find((x) => x.status === 'pendente') || null,
      // a recusa só aparece se foi a última foto enviada
      recusada: refs[0]?.status === 'recusada' ? refs[0] : null,
    })
  }, [perfil?.id])

  useEffect(() => { carregar() }, [carregar])

  return { ...estado, recarregar: carregar }
}
