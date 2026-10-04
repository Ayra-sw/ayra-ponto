import { Suspense, lazy, useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { CircleHelp } from 'lucide-react'
import Botao from '../ui/Botao'

// Os artigos ficam num arquivo à parte, baixado só quando a ajuda é aberta.
const carregarPainel = () => import('./PainelAjuda')
const PainelAjuda = lazy(carregarPainel)

// O "?" da barra de cima: abre a ajuda da tela atual num painel lateral.
// contexto: 'gestao' (administrador e RH), 'colaborador' ou 'publico' (sem login).
export default function BotaoAjuda({ contexto = 'colaborador', ehGestor = false, empresa, comTexto = false }) {
  const local = useLocation()
  const [aberto, setAberto] = useState(false)
  const [artigoId, setArtigoId] = useState(null)
  const [termo, setTermo] = useState('')
  const caminho = useRef(local.pathname)

  // Outras partes da tela podem pedir para abrir a ajuda (ex.: "Como fazer" dos primeiros passos)
  useEffect(() => {
    function pedido(e) {
      setArtigoId(e.detail?.artigo || null)
      setTermo('')
      setAberto(true)
    }
    window.addEventListener('ayra:ajuda', pedido)
    return () => window.removeEventListener('ayra:ajuda', pedido)
  }, [])

  // Mudou de tela (por um link do artigo): fecha
  useEffect(() => {
    if (caminho.current !== local.pathname) { caminho.current = local.pathname; setAberto(false) }
  }, [local.pathname])

  function abrir() { setArtigoId(null); setTermo(''); setAberto(true) }

  return (
    <>
      <Botao variante="discreto" className={comTexto ? '' : 'btn--icone'} icone={CircleHelp} onClick={abrir}
        onPointerEnter={() => carregarPainel()} onFocus={() => carregarPainel()}
        aria-label={comTexto ? undefined : 'Ajuda'} title="Ajuda" aria-haspopup="dialog">
        {comTexto ? 'Precisa de ajuda?' : null}
      </Botao>
      {aberto && (
        <Suspense fallback={null}>
          <PainelAjuda contexto={contexto} ehGestor={ehGestor} empresa={empresa}
            artigoId={artigoId} setArtigoId={setArtigoId} termo={termo} setTermo={setTermo} fechar={() => setAberto(false)} />
        </Suspense>
      )}
    </>
  )
}
