import { createContext, useCallback, useContext, useState } from 'react'
import { CircleAlert, CircleCheck, Info, X } from 'lucide-react'

// Avisos rápidos (toasts) depois de ações importantes.
const AvisosContext = createContext(null)
const ICONE = { ok: CircleCheck, problema: CircleAlert, info: Info }

export function AvisosProvider({ children }) {
  const [avisos, setAvisos] = useState([])

  const fechar = useCallback((id) => setAvisos((lista) => lista.filter((a) => a.id !== id)), [])

  const avisar = useCallback((texto, tom = 'ok') => {
    const id = Date.now() + Math.random()
    setAvisos((lista) => [...lista.slice(-2), { id, texto, tom }])
    setTimeout(() => fechar(id), tom === 'problema' ? 7000 : 4500)
  }, [fechar])

  return (
    <AvisosContext.Provider value={avisar}>
      {children}
      <div className="avisos" role="status" aria-live="polite">
        {avisos.map((a) => {
          const Icone = ICONE[a.tom] || Info
          return (
            <div key={a.id} className={`aviso aviso--${a.tom}`}>
              <Icone aria-hidden="true" />
              <span className="aviso__texto">{a.texto}</span>
              <button type="button" onClick={() => fechar(a.id)} aria-label="Fechar aviso"><X size={16} aria-hidden="true" /></button>
            </div>
          )
        })}
      </div>
    </AvisosContext.Provider>
  )
}

export function useAvisos() {
  const ctx = useContext(AvisosContext)
  if (!ctx) throw new Error('useAvisos precisa estar dentro de AvisosProvider')
  return ctx
}
