import { CircleAlert, Inbox } from 'lucide-react'
import Botao from './Botao'

// Carregamento em esqueleto: mostra a forma do conteúdo enquanto chega.
export function Esqueleto({ linhas = 3, blocos = 0 }) {
  return (
    <div className="esqueleto" aria-busy="true" aria-label="Carregando">
      {Array.from({ length: blocos }, (_, i) => <i key={`b${i}`} className="alto" />)}
      {Array.from({ length: linhas }, (_, i) => <i key={i} style={{ width: `${90 - (i % 3) * 18}%` }} />)}
    </div>
  )
}

// Nunca deixar a tela vazia: diz o que está acontecendo e o que fazer.
export function EstadoVazio({ icone: Icone = Inbox, titulo, children, acao }) {
  return (
    <div className="estado-vazio">
      <Icone aria-hidden="true" />
      <strong>{titulo}</strong>
      {children && <p className="suave pequeno">{children}</p>}
      {acao}
    </div>
  )
}

export function EstadoErro({ titulo = 'Não conseguimos carregar esta informação', children, aoTentarDeNovo }) {
  return (
    <div className="estado-vazio" role="alert">
      <CircleAlert aria-hidden="true" />
      <strong>{titulo}</strong>
      <p className="suave pequeno">{children || 'Pode ser a conexão com a internet. Tente de novo em instantes.'}</p>
      {aoTentarDeNovo && <Botao variante="secundario" onClick={aoTentarDeNovo}>Tentar de novo</Botao>}
    </div>
  )
}
