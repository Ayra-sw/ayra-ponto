import { useEffect, useState, useSyncExternalStore } from 'react'

// App instalável (PWA): registro do service worker, convite para instalar e
// estado da conexão. O ponto nunca é guardado para enviar depois: sem internet,
// ele não é registrado (decisão da Fase 4B, pela Portaria 671).

let pedidoInstalacao = null // evento "beforeinstallprompt" (Android/Chrome)
const ouvintes = new Set()
const avisar = () => ouvintes.forEach((f) => f())

export function iniciarPwa() {
  if (typeof window === 'undefined') return
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault() // o app mostra o próprio botão "Instalar o app"
    pedidoInstalacao = e
    avisar()
  })
  window.addEventListener('appinstalled', () => { pedidoInstalacao = null; avisar() })
  if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => { navigator.serviceWorker.register('/sw.js').catch(() => {}) })
  }
}

export function estaInstalado() {
  if (typeof window === 'undefined') return false
  return Boolean(window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone)
}

export function ehIphone() {
  const ua = navigator.userAgent || ''
  return /iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1)
}

export function ehCelular() {
  return /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent || '') || (/macintosh/i.test(navigator.userAgent || '') && navigator.maxTouchPoints > 1)
}

// { instalado, podeInstalar, iphone, instalar() }
export function useInstalarApp() {
  const [, setVersao] = useState(0)
  useEffect(() => {
    const f = () => setVersao((v) => v + 1)
    ouvintes.add(f)
    const mq = window.matchMedia?.('(display-mode: standalone)')
    mq?.addEventListener?.('change', f)
    return () => { ouvintes.delete(f); mq?.removeEventListener?.('change', f) }
  }, [])
  return {
    instalado: estaInstalado(),
    podeInstalar: Boolean(pedidoInstalacao),
    iphone: ehIphone(),
    async instalar() {
      if (!pedidoInstalacao) return false
      const e = pedidoInstalacao
      e.prompt()
      const { outcome } = await e.userChoice.catch(() => ({ outcome: 'dismissed' }))
      if (outcome === 'accepted') { pedidoInstalacao = null; avisar() }
      return outcome === 'accepted'
    },
  }
}

// true = com internet
function assinar(f) {
  window.addEventListener('online', f)
  window.addEventListener('offline', f)
  return () => { window.removeEventListener('online', f); window.removeEventListener('offline', f) }
}
export function useConexao() {
  return useSyncExternalStore(assinar, () => navigator.onLine !== false, () => true)
}
