import { LoaderCircle } from 'lucide-react'

// variante: 'primario' | 'secundario' | 'discreto' | 'perigo'
export default function Botao({
  variante = 'primario', tamanho, bloco = false, carregando = false, icone: Icone,
  children, className = '', type = 'button', disabled, ...resto
}) {
  const classes = [
    'btn', `btn--${variante}`,
    tamanho ? `btn--${tamanho}` : '',
    bloco ? 'btn--bloco' : '',
    className,
  ].filter(Boolean).join(' ')
  return (
    <button type={type} className={classes} disabled={disabled || carregando} aria-busy={carregando || undefined} {...resto}>
      {carregando ? <LoaderCircle className="btn__giro" aria-hidden="true" /> : Icone ? <Icone aria-hidden="true" /> : null}
      {children}
    </button>
  )
}
