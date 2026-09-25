import { Link } from 'react-router-dom'

// Mostrada quando o endereço digitado não existe no Ayra Ponto.
export default function NaoEncontrada() {
  return (
    <div className="container">
      <div className="card">
        <h1><span className="brand">Ayra</span> Ponto</h1>
        <h2>Página não encontrada</h2>
        <p style={{ color: 'var(--text-muted)' }}>
          O endereço que você abriu não existe ou mudou de lugar. Confira o link
          ou volte para o início.
        </p>
        <Link to="/" className="btn-primary" style={{ display: 'block', textAlign: 'center', textDecoration: 'none' }}>
          Ir para o início
        </Link>
      </div>
    </div>
  )
}
