import { useEffect, useState } from 'react'
import { ImageOff } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'

// Mostra uma foto do armazenamento privado "rostos" por meio de um link
// temporário (vale 10 minutos).
const cache = new Map()

export default function FotoRosto({ caminho, alt, tamanho }) {
  const [url, setUrl] = useState(() => cache.get(caminho)?.url || null)
  const [erro, setErro] = useState(false)

  useEffect(() => {
    if (!caminho) return
    const guardado = cache.get(caminho)
    if (guardado && guardado.expira > Date.now()) { setUrl(guardado.url); return }
    let ativo = true
    supabase.storage.from('rostos').createSignedUrl(caminho, 600).then(({ data, error }) => {
      if (!ativo) return
      if (error || !data?.signedUrl) return setErro(true)
      cache.set(caminho, { url: data.signedUrl, expira: Date.now() + 540000 })
      setUrl(data.signedUrl)
    })
    return () => { ativo = false }
  }, [caminho])

  const classe = `foto-rosto${tamanho ? ` foto-rosto--${tamanho}` : ''}`
  if (!caminho || erro) return <div className={`${classe} foto-rosto--vazia`} title="Foto indisponível"><ImageOff aria-hidden="true" /></div>
  if (!url) return <div className={`${classe} foto-rosto--carregando`} aria-busy="true" />
  return <img className={classe} src={url} alt={alt} loading="lazy" />
}
