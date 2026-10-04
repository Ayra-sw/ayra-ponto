// Ayra Ponto: service worker do app instalável.
// Regras:
//  - Nunca guarda nem responde nada do Supabase (dados, login, marcações).
//    Só arquivos do próprio site. O ponto SEMPRE precisa de internet: a hora e
//    o NSR vêm do servidor (Portaria 671).
//  - Páginas: tenta a internet primeiro (sempre a versão mais nova do site);
//    sem internet, abre a última versão guardada, que avisa "Sem internet".
//  - Arquivos com nome versionado (/assets/...): guardados depois do 1º uso.
const VERSAO = 'ayra-v1'
const PAGINAS = `${VERSAO}-paginas`
const ARQUIVOS = `${VERSAO}-arquivos`
const MAX_ARQUIVOS = 80

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(PAGINAS).then((c) => c.addAll(['/', '/manifest.webmanifest', '/icons/icon-192.png'])).catch(() => {}))
  self.skipWaiting()
})

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const nome of await caches.keys()) if (!nome.startsWith(VERSAO)) await caches.delete(nome)
    await self.clients.claim()
  })())
})

async function limitar(cache) {
  const chaves = await cache.keys()
  for (let i = 0; i < chaves.length - MAX_ARQUIVOS; i++) await cache.delete(chaves[i])
}

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return // Supabase, CDN e afins: direto na internet
  if (url.pathname === '/sw.js') return

  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      try {
        const resp = await fetch(req)
        if (resp.ok) { const c = await caches.open(PAGINAS); c.put('/', resp.clone()) }
        return resp
      } catch {
        return (await caches.match('/')) || new Response('Sem internet. Conecte-se e tente de novo.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
      }
    })())
    return
  }

  if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/icons/') || url.pathname === '/manifest.webmanifest') {
    e.respondWith((async () => {
      const guardado = await caches.match(req)
      if (guardado) return guardado
      const resp = await fetch(req)
      if (resp.ok) { const c = await caches.open(ARQUIVOS); await c.put(req, resp.clone()); limitar(c) }
      return resp
    })())
  }
})
