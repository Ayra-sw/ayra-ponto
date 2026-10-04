import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { CircleHelp, Clock, FileClock, History, ScanFace, Users } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../contexts/AuthContext'
import { abrirAjuda } from '../lib/abrirAjuda'
import useMarcos from '../hooks/useMarcos'
import { Dialogo } from './ui/Dialogo'
import Botao from './ui/Botao'

// Boas-vindas do colaborador: aparece uma vez, no primeiro acesso à tela Início.
// Sem a Fase 4A no banco, não aparece (para não repetir a cada acesso).
export default function BoasVindas({ ehGestor }) {
  const { perfil } = useAuth()
  const local = useLocation()
  const marcos = useMarcos()
  const [facial, setFacial] = useState(false)
  const [fechada, setFechada] = useState(false)

  const mostrar = !fechada && local.pathname === '/' && marcos.disponivel && !marcos.tem('boas_vindas') && Boolean(perfil?.empresa_id)

  useEffect(() => {
    if (!mostrar) return
    supabase.from('empresas').select('reconhecimento_facial').eq('id', perfil.empresa_id).maybeSingle()
      .then(({ data }) => setFacial(Boolean(data?.reconhecimento_facial)))
  }, [mostrar, perfil?.empresa_id])

  if (!mostrar) return null

  const nome = (perfil?.nome_completo || '').split(' ')[0]
  function concluir(abrir) {
    setFechada(true)
    marcos.marcar('boas_vindas')
    if (abrir) setTimeout(() => abrirAjuda(), 50)
  }

  const itens = [
    { icone: Clock, titulo: 'Bater o ponto', texto: 'Aqui no Início, toque no botão grande. O horário vem do servidor, e você recebe um comprovante.' },
    { icone: History, titulo: 'Esqueceu ou errou?', texto: 'Em Histórico, toque em "Pedir ajuste". Sua marcação original nunca é apagada.' },
    { icone: FileClock, titulo: 'Suas horas', texto: 'Em Espelho você vê o mês, a sua escala e o banco de horas.' },
    ...(facial ? [{ icone: ScanFace, titulo: 'Cadastre seu rosto', texto: 'Sua empresa usa reconhecimento facial. Cadastre a foto em Minha conta.' }] : []),
    ...(ehGestor ? [{ icone: Users, titulo: 'Você é gestor', texto: 'Em Equipe você acompanha as pessoas e analisa os pedidos de ajuste e folga.' }] : []),
    { icone: CircleHelp, titulo: 'Dúvidas?', texto: 'Toque no ? no alto da tela para ver a ajuda.' },
  ]

  return (
    <Dialogo
      aberto
      aoFechar={() => concluir(false)}
      titulo={`Boas-vindas ao Ayra Ponto${nome ? `, ${nome}` : ''}!`}
      acoes={
        <>
          <Botao variante="secundario" onClick={() => concluir(true)}>Ver a ajuda</Botao>
          <Botao onClick={() => concluir(false)} data-foco-inicial>Começar</Botao>
        </>
      }
    >
      <p className="suave" style={{ marginTop: 0 }}>Em um minuto, o que você precisa saber:</p>
      <ul className="boas-vindas">
        {itens.map(({ icone: Icone, titulo, texto }) => (
          <li key={titulo}>
            <span className="boas-vindas__icone" aria-hidden="true"><Icone /></span>
            <span><strong>{titulo}</strong><span className="suave pequeno">{texto}</span></span>
          </li>
        ))}
      </ul>
    </Dialogo>
  )
}
