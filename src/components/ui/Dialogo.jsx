import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import Botao from './Botao'

// Mantém o foco dentro da janela, fecha com Esc e devolve o foco ao sair.
function useJanela(aberta, aoFechar) {
  const ref = useRef(null)
  useEffect(() => {
    if (!aberta) return
    const anterior = document.activeElement
    const alvo = ref.current?.querySelector('[data-foco-inicial]') ||
      ref.current?.querySelector('input, select, textarea, button:not([data-fechar])') ||
      ref.current
    alvo?.focus()
    function tecla(e) {
      // só a janela que está com o foco responde (há janelas uma sobre a outra)
      if (!ref.current || !ref.current.contains(document.activeElement)) return
      if (e.key === 'Escape') { e.stopPropagation(); aoFechar?.() }
      if (e.key !== 'Tab') return
      const focaveis = ref.current.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')
      if (!focaveis.length) return
      const primeiro = focaveis[0]
      const ultimo = focaveis[focaveis.length - 1]
      if (e.shiftKey && document.activeElement === primeiro) { e.preventDefault(); ultimo.focus() }
      else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primeiro.focus() }
    }
    document.addEventListener('keydown', tecla)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', tecla)
      document.body.style.overflow = overflow
      anterior?.focus?.()
    }
  }, [aberta]) // eslint-disable-line react-hooks/exhaustive-deps
  return ref
}

export function Dialogo({ aberto, aoFechar, titulo, children, acoes }) {
  const ref = useJanela(aberto, aoFechar)
  const idTitulo = useId()
  if (!aberto) return null
  return createPortal(
    <div className="fundo-escuro" onMouseDown={(e) => { if (e.target === e.currentTarget) aoFechar?.() }}>
      <div className="dialogo" role="dialog" aria-modal="true" aria-labelledby={idTitulo} ref={ref} tabIndex={-1}>
        <h2 id={idTitulo}>{titulo}</h2>
        {children}
        {acoes && <div className="dialogo__acoes">{acoes}</div>}
      </div>
    </div>,
    document.body,
  )
}

// Confirmação que explica a consequência, nunca só "Tem certeza?"
export function Confirmacao({
  aberta, titulo, children, textoConfirmar = 'Confirmar', textoCancelar = 'Cancelar',
  perigo = false, carregando = false, aoConfirmar, aoCancelar,
}) {
  return (
    <Dialogo
      aberto={aberta}
      aoFechar={carregando ? undefined : aoCancelar}
      titulo={titulo}
      acoes={
        <>
          <Botao variante="secundario" onClick={aoCancelar} disabled={carregando} data-foco-inicial>{textoCancelar}</Botao>
          <Botao variante={perigo ? 'perigo' : 'primario'} onClick={aoConfirmar} carregando={carregando}>{textoConfirmar}</Botao>
        </>
      }
    >
      <div className="suave">{children}</div>
    </Dialogo>
  )
}

export function PainelLateral({ aberto, aoFechar, titulo, subtitulo, children, rodape }) {
  const ref = useJanela(aberto, aoFechar)
  const idTitulo = useId()
  if (!aberto) return null
  return createPortal(
    <div className="fundo-escuro fundo-escuro--lateral" onMouseDown={(e) => { if (e.target === e.currentTarget) aoFechar?.() }}>
      <div className="painel-lateral" role="dialog" aria-modal="true" aria-labelledby={idTitulo} ref={ref} tabIndex={-1}>
        <div className="painel-lateral__topo">
          <div>
            <h2 id={idTitulo}>{titulo}</h2>
            {subtitulo && <p className="suave pequeno">{subtitulo}</p>}
          </div>
          <Botao variante="discreto" className="btn--icone" onClick={aoFechar} aria-label="Fechar" data-fechar icone={X} />
        </div>
        <div className="painel-lateral__corpo">{children}</div>
        {rodape && <div className="painel-lateral__rodape">{rodape}</div>}
      </div>
    </div>,
    document.body,
  )
}
