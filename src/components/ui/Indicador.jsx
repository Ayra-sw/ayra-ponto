import { Link } from 'react-router-dom'

// Número que importa, com rótulo e detalhe. Vira link quando há "para".
export default function Indicador({ rotulo, valor, detalhe, icone: Icone, para }) {
  const conteudo = (
    <>
      <span className="indicador__rotulo">{Icone && <Icone aria-hidden="true" />}{rotulo}</span>
      <span className="indicador__valor">{valor}</span>
      {detalhe && <span className="indicador__detalhe">{detalhe}</span>}
    </>
  )
  return para ? <Link to={para} className="indicador">{conteudo}</Link> : <div className="indicador">{conteudo}</div>
}
