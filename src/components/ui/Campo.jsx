import { useId, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import Dica from './Dica'

// Envolve qualquer controle com rótulo, ajuda e erro ligados por aria.
function Moldura({ id, rotulo, opcional, ajuda, erro, dica, children }) {
  return (
    <div className={`campo${erro ? ' campo--erro' : ''}`}>
      {rotulo && (
        <span className="campo__rotulo">
          <label htmlFor={id}>{rotulo}</label>
          {opcional && <span className="campo__opcional">(opcional)</span>}
          {dica && <Dica texto={dica} />}
        </span>
      )}
      {children}
      {erro ? (
        <span id={`${id}-erro`} className="campo__erro" role="alert">{erro}</span>
      ) : ajuda ? (
        <span id={`${id}-ajuda`} className="campo__ajuda">{ajuda}</span>
      ) : null}
    </div>
  )
}

function descricao(id, erro, ajuda) {
  if (erro) return `${id}-erro`
  if (ajuda) return `${id}-ajuda`
  return undefined
}

export function Campo({ rotulo, opcional, ajuda, erro, dica, id: idProp, mono, className = '', ...resto }) {
  const auto = useId()
  const id = idProp || auto
  return (
    <Moldura id={id} rotulo={rotulo} opcional={opcional} ajuda={ajuda} erro={erro} dica={dica}>
      <input
        id={id}
        className={`entrada${mono ? ' entrada--mono' : ''} ${className}`}
        aria-invalid={erro ? true : undefined}
        aria-describedby={descricao(id, erro, ajuda)}
        {...resto}
      />
    </Moldura>
  )
}

export function CampoSenha({ rotulo = 'Senha', ajuda, erro, id: idProp, ...resto }) {
  const auto = useId()
  const id = idProp || auto
  const [visivel, setVisivel] = useState(false)
  return (
    <Moldura id={id} rotulo={rotulo} ajuda={ajuda} erro={erro}>
      <div className="entrada-grupo">
        <input
          id={id}
          type={visivel ? 'text' : 'password'}
          className="entrada"
          aria-invalid={erro ? true : undefined}
          aria-describedby={descricao(id, erro, ajuda)}
          {...resto}
        />
        <button
          type="button"
          className="entrada-grupo__botao"
          onClick={() => setVisivel((v) => !v)}
          aria-label={visivel ? 'Ocultar senha' : 'Mostrar senha'}
          aria-pressed={visivel}
        >
          {visivel ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
        </button>
      </div>
    </Moldura>
  )
}

export function Selecao({ rotulo, opcional, ajuda, erro, dica, id: idProp, opcoes = [], children, ...resto }) {
  const auto = useId()
  const id = idProp || auto
  return (
    <Moldura id={id} rotulo={rotulo} opcional={opcional} ajuda={ajuda} erro={erro} dica={dica}>
      <select
        id={id}
        className="selecao"
        aria-invalid={erro ? true : undefined}
        aria-describedby={descricao(id, erro, ajuda)}
        {...resto}
      >
        {children}
        {opcoes.map((o) => (
          <option key={o.valor} value={o.valor} disabled={o.desativada}>{o.rotulo}</option>
        ))}
      </select>
    </Moldura>
  )
}
