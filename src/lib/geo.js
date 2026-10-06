// Geolocalização (Fase 6A): distância, busca de endereço e conta do mapa.

// Mapa de fundo: OpenStreetMap (gratuito). A política de uso do OSM serve para
// uso leve, como o de uma tela de gestão. Quando o Ayra tiver muitos clientes,
// troque só esta linha por um serviço pago (MapTiler, Stadia, Mapbox…).
export const MAPA_TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
export const MAPA_CREDITO = { texto: '© OpenStreetMap', link: 'https://www.openstreetmap.org/copyright' }

export const RAIO_PADRAO = 200
export const RAIO_MIN = 50
export const RAIO_MAX = 5000

const RAIO_TERRA = 6371008.8

// Mesma conta do banco (haversine), em metros
export function distanciaMetros(a, b) {
  if (!a || !b) return null
  const rad = (g) => (g * Math.PI) / 180
  const dLat = rad(b.lat - a.lat)
  const dLon = rad(b.lon - a.lon)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2
  return Math.round(2 * RAIO_TERRA * Math.asin(Math.min(1, Math.sqrt(h))))
}

// 350 → "350 m"; 1240 → "1,2 km"; 12400 → "12 km"
export function formatarDistancia(metros) {
  if (metros == null) return ''
  if (metros < 1000) return `${Math.round(metros)} m`
  const km = metros / 1000
  return `${km < 10 ? km.toFixed(1).replace('.', ',') : Math.round(km)} km`
}

export const comCoordenadas = (o) => o != null && o.latitude != null && o.longitude != null
export const pontoDe = (o) => (comCoordenadas(o) ? { lat: Number(o.latitude), lon: Number(o.longitude) } : null)

// Busca o endereço no Nominatim (serviço de busca do OpenStreetMap).
// Só é chamado quando a pessoa clica no botão (uma busca por clique, como pede
// a política de uso). Se falhar, a pessoa marca o ponto no mapa.
export async function buscarEndereco({ logradouro, numero, bairro, cidade, uf, cep }) {
  const rua = [logradouro, numero].filter(Boolean).join(', ')
  const partes = [rua, bairro, cidade, uf, cep, 'Brasil'].filter(Boolean)
  if (!cidade && !cep) return null
  try {
    const url = new URL('https://nominatim.openstreetmap.org/search')
    url.searchParams.set('format', 'jsonv2')
    url.searchParams.set('limit', '1')
    url.searchParams.set('countrycodes', 'br')
    url.searchParams.set('accept-language', 'pt-BR')
    url.searchParams.set('q', partes.join(', '))
    const resposta = await fetch(url)
    if (!resposta.ok) return null
    const lista = await resposta.json()
    const item = lista?.[0]
    if (!item) return null
    return { lat: Number(item.lat), lon: Number(item.lon) }
  } catch {
    return null
  }
}

// ---- conta do mapa (projeção "Web Mercator", a mesma dos blocos do OSM) ----
export const TAMANHO_BLOCO = 256
const mundo = (z) => TAMANHO_BLOCO * 2 ** z
export function paraPixel({ lat, lon }, z) {
  const t = mundo(z)
  const seno = Math.sin((Math.max(-85.0511, Math.min(85.0511, lat)) * Math.PI) / 180)
  return { x: ((lon + 180) / 360) * t, y: (0.5 - Math.log((1 + seno) / (1 - seno)) / (4 * Math.PI)) * t }
}
export function dePixel({ x, y }, z) {
  const t = mundo(z)
  const n = Math.PI - (2 * Math.PI * y) / t
  return { lat: (Math.atan(Math.sinh(n)) * 180) / Math.PI, lon: (x / t) * 360 - 180 }
}
// quantos metros cabem em 1 pixel nesta latitude e zoom
export const metrosPorPixel = (lat, z) => (Math.cos((lat * Math.PI) / 180) * 2 * Math.PI * RAIO_TERRA) / mundo(z)

// o maior zoom em que todos os pontos cabem na área (largura x altura em px)
export function zoomParaCaber(pontos, largura, altura, { margem = 48, max = 18, min = 3 } = {}) {
  if (!pontos.length) return max
  for (let z = max; z >= min; z--) {
    const px = pontos.map((p) => paraPixel(p, z))
    const xs = px.map((p) => p.x), ys = px.map((p) => p.y)
    if (Math.max(...xs) - Math.min(...xs) <= largura - margem * 2 && Math.max(...ys) - Math.min(...ys) <= altura - margem * 2) return z
  }
  return min
}

// pontos extremos de um círculo (para o mapa enquadrar a cerca inteira)
export function extremosDoCirculo({ lat, lon }, raioM) {
  const dLat = (raioM / RAIO_TERRA) * (180 / Math.PI)
  const dLon = dLat / Math.max(0.01, Math.cos((lat * Math.PI) / 180))
  return [{ lat: lat + dLat, lon }, { lat: lat - dLat, lon }, { lat, lon: lon + dLon }, { lat, lon: lon - dLon }]
}

// Aviso para o colaborador (bem gentil) e selo para o RH
export function textoLocalColaborador(local) {
  if (!local) return null
  if (local.situacao === 'fora') {
    return `Você registrou o ponto a cerca de ${formatarDistancia(local.distancia_m)} da unidade. O ponto foi registrado normalmente. Se estava em atividade fora do local, está tudo certo: o RH poderá ver essa informação.`
  }
  if (local.situacao === 'sem_localizacao') {
    return 'O ponto foi registrado normalmente, mas não conseguimos saber onde você estava. Se quiser, permita o acesso à localização no navegador na próxima vez.'
  }
  return null
}
