import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { MapPin, Minus, Plus } from 'lucide-react'
import {
  MAPA_CREDITO, MAPA_TILES, TAMANHO_BLOCO, dePixel, metrosPorPixel, paraPixel, zoomParaCaber,
} from '../../lib/geo'

const ZOOM_MIN = 3
const ZOOM_MAX = 19

// Mapa simples, feito com os blocos do OpenStreetMap (sem biblioteca externa).
//   foco       { lat, lon, zoom? } ou { pontos: [{lat, lon}…] } — para onde o mapa vai
//              (só muda a visão quando este valor muda)
//   marcadores [{ lat, lon, tom: 'unidade'|'ok'|'atencao', rotulo }]
//   circulo    { lat, lon, raio } em metros
//   aoEscolher (lat, lon) — clique no mapa (ou Enter, que marca o centro)
export default function Mapa({ foco, marcadores = [], circulo = null, aoEscolher, altura = 280, rotulo = 'Mapa' }) {
  const caixa = useRef(null)
  const [tam, setTam] = useState({ w: 0, h: 0 })
  const [visao, setVisao] = useState({ z: 15, cx: 0, cy: 0 })
  const arrasto = useRef(null)
  const visaoRef = useRef(visao)
  visaoRef.current = visao

  // tamanho da caixa
  useEffect(() => {
    const el = caixa.current
    if (!el) return
    const medir = () => setTam({ w: el.clientWidth, h: el.clientHeight })
    medir()
    if (typeof ResizeObserver === 'undefined') return
    const obs = new ResizeObserver(medir)
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  // vai para onde o foco mandar (quando ele muda ou quando a caixa ganha tamanho)
  const chaveFoco = JSON.stringify(foco || null)
  const temTamanho = tam.w > 0
  useEffect(() => {
    if (!foco || !temTamanho) return
    let z
    let alvo
    if (foco.pontos?.length) {
      const pts = foco.pontos
      const lats = pts.map((p) => p.lat), lons = pts.map((p) => p.lon)
      alvo = { lat: (Math.min(...lats) + Math.max(...lats)) / 2, lon: (Math.min(...lons) + Math.max(...lons)) / 2 }
      z = zoomParaCaber(pts, tam.w, tam.h, { max: 18, min: ZOOM_MIN })
    } else {
      alvo = { lat: foco.lat, lon: foco.lon }
      z = foco.zoom || 16
    }
    const c = paraPixel(alvo, z)
    setVisao({ z, cx: c.x, cy: c.y })
  }, [chaveFoco, temTamanho]) // eslint-disable-line react-hooks/exhaustive-deps

  const { z, cx, cy } = visao
  const n = 2 ** z

  const blocos = useMemo(() => {
    if (!tam.w) return []
    const x0 = Math.floor((cx - tam.w / 2) / TAMANHO_BLOCO)
    const x1 = Math.floor((cx + tam.w / 2) / TAMANHO_BLOCO)
    const y0 = Math.max(0, Math.floor((cy - tam.h / 2) / TAMANHO_BLOCO))
    const y1 = Math.min(n - 1, Math.floor((cy + tam.h / 2) / TAMANHO_BLOCO))
    const lista = []
    for (let x = x0; x <= x1; x++) {
      for (let y = y0; y <= y1; y++) {
        const xx = ((x % n) + n) % n
        lista.push({
          chave: `${z}/${x}/${y}`,
          src: MAPA_TILES.replace('{z}', z).replace('{x}', xx).replace('{y}', y),
          left: x * TAMANHO_BLOCO - cx + tam.w / 2,
          top: y * TAMANHO_BLOCO - cy + tam.h / 2,
        })
      }
    }
    return lista
  }, [cx, cy, z, n, tam.w, tam.h])

  const naTela = (p) => {
    const px = paraPixel(p, z)
    return { x: px.x - cx + tam.w / 2, y: px.y - cy + tam.h / 2 }
  }

  const aproximar = useCallback((d) => {
    setVisao((v) => {
      const nz = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, v.z + d))
      if (nz === v.z) return v
      const f = 2 ** (nz - v.z)
      return { z: nz, cx: v.cx * f, cy: v.cy * f }
    })
  }, [])

  // roda do mouse (precisa de ouvinte "não passivo" para não rolar a página)
  useEffect(() => {
    const el = caixa.current
    if (!el) return
    let ultimo = 0
    const roda = (e) => {
      e.preventDefault()
      const agora = Date.now()
      if (agora - ultimo < 150) return
      ultimo = agora
      aproximar(e.deltaY < 0 ? 1 : -1)
    }
    el.addEventListener('wheel', roda, { passive: false })
    return () => el.removeEventListener('wheel', roda)
  }, [aproximar])

  function aoApertar(e) {
    if (e.target.closest('.mapa__zoom')) return
    caixa.current?.setPointerCapture?.(e.pointerId)
    arrasto.current = { x: e.clientX, y: e.clientY, moveu: false }
  }
  function aoMover(e) {
    const a = arrasto.current
    if (!a) return
    const dx = e.clientX - a.x, dy = e.clientY - a.y
    if (!a.moveu && Math.hypot(dx, dy) < 4) return
    a.moveu = true
    a.x = e.clientX; a.y = e.clientY
    setVisao((v) => ({ ...v, cx: v.cx - dx, cy: v.cy - dy }))
  }
  function aoSoltar(e) {
    const a = arrasto.current
    arrasto.current = null
    if (!a || a.moveu || !aoEscolher) return
    const r = caixa.current.getBoundingClientRect()
    const v = visaoRef.current
    const p = dePixel({ x: v.cx + (e.clientX - r.left - r.width / 2), y: v.cy + (e.clientY - r.top - r.height / 2) }, v.z)
    aoEscolher(p.lat, p.lon)
  }
  function aoTeclar(e) {
    const passo = 80
    if (e.key === 'ArrowLeft') setVisao((v) => ({ ...v, cx: v.cx - passo }))
    else if (e.key === 'ArrowRight') setVisao((v) => ({ ...v, cx: v.cx + passo }))
    else if (e.key === 'ArrowUp') setVisao((v) => ({ ...v, cy: v.cy - passo }))
    else if (e.key === 'ArrowDown') setVisao((v) => ({ ...v, cy: v.cy + passo }))
    else if (e.key === '+' || e.key === '=') aproximar(1)
    else if (e.key === '-' || e.key === '_') aproximar(-1)
    else if ((e.key === 'Enter' || e.key === ' ') && aoEscolher) {
      const v = visaoRef.current
      const p = dePixel({ x: v.cx, y: v.cy }, v.z)
      aoEscolher(p.lat, p.lon)
    } else return
    e.preventDefault()
  }

  const raioPx = circulo && tam.w ? circulo.raio / metrosPorPixel(circulo.lat, z) : 0
  const centroCirculo = circulo && tam.w ? naTela(circulo) : null

  return (
    <div
      ref={caixa}
      className={`mapa${aoEscolher ? ' mapa--escolher' : ''}`}
      style={{ height: altura }}
      role="group"
      aria-label={rotulo}
      aria-roledescription="mapa"
      tabIndex={0}
      onPointerDown={aoApertar}
      onPointerMove={aoMover}
      onPointerUp={aoSoltar}
      onPointerCancel={() => { arrasto.current = null }}
      onKeyDown={aoTeclar}
    >
      <div className="mapa__blocos" aria-hidden="true">
        {blocos.map((b) => (
          <img key={b.chave} className="mapa__bloco" src={b.src} alt="" draggable="false" loading="eager"
            style={{ left: b.left, top: b.top, width: TAMANHO_BLOCO, height: TAMANHO_BLOCO }} />
        ))}
      </div>

      {centroCirculo && raioPx > 0 && (
        <div className="mapa__circulo" aria-hidden="true"
          style={{ left: centroCirculo.x - raioPx, top: centroCirculo.y - raioPx, width: raioPx * 2, height: raioPx * 2 }} />
      )}

      {tam.w > 0 && marcadores.map((m, i) => {
        const p = naTela(m)
        return (
          <span key={m.chave || i} className={`mapa__marcador mapa__marcador--${m.tom || 'unidade'}`}
            style={{ left: p.x, top: p.y }} title={m.rotulo} role="img" aria-label={m.rotulo}>
            <MapPin aria-hidden="true" />
          </span>
        )
      })}

      <div className="mapa__zoom">
        <button type="button" onClick={() => aproximar(1)} aria-label="Aproximar o mapa" disabled={z >= ZOOM_MAX}><Plus aria-hidden="true" /></button>
        <button type="button" onClick={() => aproximar(-1)} aria-label="Afastar o mapa" disabled={z <= ZOOM_MIN}><Minus aria-hidden="true" /></button>
      </div>
      <a className="mapa__credito" href={MAPA_CREDITO.link} target="_blank" rel="noopener noreferrer">{MAPA_CREDITO.texto}</a>
    </div>
  )
}
