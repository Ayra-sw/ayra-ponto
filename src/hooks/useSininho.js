import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../contexts/AuthContext'

const INTERVALO = 60000 // confere avisos novos a cada minuto
const POR_VEZ = 30

// Guardado fora do componente: a barra de cima é montada de novo em cada tela,
// e a conferência pesada (atualizar_meus_avisos) deve rodar só uma vez por login.
const memoria = { perfilId: null, disponivel: false, naoLidos: 0 }

// Avisos do sininho de quem está logado. Sem a Fase 3C instalada, o sininho
// simplesmente não aparece ("disponivel" fica falso).
export default function useSininho() {
  const { perfil } = useAuth()
  const local = useLocation()
  const mesmo = memoria.perfilId && memoria.perfilId === perfil?.id
  const [naoLidos, setNaoLidosEstado] = useState(mesmo ? memoria.naoLidos : 0)
  const [lista, setLista] = useState([])
  const [disponivel, setDisponivelEstado] = useState(mesmo ? memoria.disponivel : false)
  const [carregando, setCarregando] = useState(false)
  const setNaoLidos = useCallback((v) => setNaoLidosEstado((n) => { const novo = typeof v === 'function' ? v(n) : v; memoria.naoLidos = novo; return novo }), [])
  const setDisponivel = useCallback((v) => { memoria.disponivel = v; setDisponivelEstado(v) }, [])

  const contar = useCallback(async () => {
    if (!perfil?.id) return
    const { count, error } = await supabase.from('avisos').select('id', { count: 'exact', head: true }).is('lido_em', null)
    if (error) { setDisponivel(false); return }
    setDisponivel(true)
    setNaoLidos(count || 0)
  }, [perfil?.id, setDisponivel, setNaoLidos])

  // Ao entrar: o banco confere os avisos do dia (dia incompleto, banco de horas)
  useEffect(() => {
    if (!perfil?.id) { memoria.perfilId = null; return } // saiu: no próximo login confere de novo
    if (memoria.perfilId === perfil.id) return
    memoria.perfilId = perfil.id
    memoria.disponivel = false
    memoria.naoLidos = 0
    supabase.rpc('atualizar_meus_avisos').then(({ data, error }) => {
      if (error) { setDisponivel(false); return }
      setDisponivel(true)
      setNaoLidos(Number(data) || 0)
    })
  }, [perfil?.id, setDisponivel, setNaoLidos])

  useEffect(() => {
    const id = setInterval(() => { if (document.visibilityState === 'visible') contar() }, INTERVALO)
    return () => clearInterval(id)
  }, [contar])

  // A cada troca de tela, só a contagem (consulta leve)
  const primeira = useRef(true)
  useEffect(() => {
    if (primeira.current && !mesmo) { primeira.current = false; return }
    primeira.current = false
    if (memoria.perfilId === perfil?.id) contar()
  }, [local.pathname, contar]) // eslint-disable-line react-hooks/exhaustive-deps

  const carregarLista = useCallback(async () => {
    setCarregando(true)
    const { data, error } = await supabase.from('avisos').select('*').order('criado_em', { ascending: false }).limit(POR_VEZ)
    if (!error) setLista(data || [])
    setCarregando(false)
  }, [])

  const marcarLido = useCallback(async (aviso) => {
    if (aviso.lido_em) return
    const agora = new Date().toISOString()
    setLista((l) => l.map((a) => (a.id === aviso.id ? { ...a, lido_em: agora } : a)))
    setNaoLidos((n) => Math.max(0, n - 1))
    await supabase.from('avisos').update({ lido_em: agora }).eq('id', aviso.id)
  }, [setNaoLidos])

  const marcarTodos = useCallback(async () => {
    const agora = new Date().toISOString()
    setLista((l) => l.map((a) => (a.lido_em ? a : { ...a, lido_em: agora })))
    setNaoLidos(0)
    await supabase.from('avisos').update({ lido_em: agora }).is('lido_em', null)
  }, [setNaoLidos])

  return { disponivel, naoLidos, lista, carregando, carregarLista, marcarLido, marcarTodos }
}
