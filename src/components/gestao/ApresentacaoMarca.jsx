// Apresentação institucional da Ayra Soluções no alto da Visão geral
// (só administrador e RH). É uma faixa discreta: o painel continua sendo
// o principal, logo abaixo.
//
// Para trocar o nome ou o slogan, mude as duas linhas abaixo.
export const MARCA_EMPRESA = 'AYRA SOLUÇÕES'
export const SLOGAN = 'Pessoas, tempo e gestão em perfeita sintonia.'

function Emblema() {
  return (
    <svg className="apresentacao__emblema" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <rect width="64" height="64" rx="14" className="apresentacao__emblema-fundo" />
      <circle cx="32" cy="32" r="17" fill="none" className="apresentacao__emblema-traco" strokeWidth="4" />
      <path d="M32 21.5V32l6.5 4.2" fill="none" className="apresentacao__emblema-traco" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// Desenho de fundo: anéis de relógio e pontos ligados (pessoas e organização)
function Grafismo() {
  const pontos = [[250, 40], [300, 70], [262, 104], [330, 118], [214, 86]]
  const ligacoes = [[0, 1], [1, 2], [2, 0], [1, 3], [2, 3], [0, 4], [2, 4]]
  return (
    <svg className="apresentacao__grafismo" viewBox="0 0 360 150" preserveAspectRatio="xMaxYMid slice" aria-hidden="true" focusable="false">
      <g className="apresentacao__aneis" fill="none">
        <circle cx="300" cy="75" r="44" />
        <circle cx="300" cy="75" r="70" />
        <circle cx="300" cy="75" r="98" strokeDasharray="2 7" />
      </g>
      <g className="apresentacao__rede">
        {ligacoes.map(([a, b]) => (
          <line key={`${a}-${b}`} x1={pontos[a][0]} y1={pontos[a][1]} x2={pontos[b][0]} y2={pontos[b][1]} />
        ))}
        {pontos.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={i === 1 ? 5 : 3.5} className={i === 1 ? 'apresentacao__no apresentacao__no--destaque' : 'apresentacao__no'} />)}
      </g>
    </svg>
  )
}

export default function ApresentacaoMarca() {
  return (
    <section className="apresentacao" aria-labelledby="apresentacao-nome">
      <Grafismo />
      <div className="apresentacao__conteudo">
        <Emblema />
        <div className="apresentacao__texto">
          <p className="apresentacao__nome" id="apresentacao-nome">{MARCA_EMPRESA}</p>
          <span className="apresentacao__fio" aria-hidden="true" />
          <p className="apresentacao__slogan">{SLOGAN}</p>
        </div>
      </div>
    </section>
  )
}
