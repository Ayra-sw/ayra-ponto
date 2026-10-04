import { useEffect, useMemo, useState } from 'react'
import { Link, useOutletContext, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, ListChecks, Search, SearchX } from 'lucide-react'
import { CATEGORIAS, artigoPorId, artigosPara, buscar, caminhoCentral } from '../lib/ajuda'
import useMarcos from '../hooks/useMarcos'
import ConteudoArtigo from '../components/ajuda/ConteudoArtigo'
import Suporte from '../components/ajuda/Suporte'
import Botao from '../components/ui/Botao'
import { EstadoVazio } from '../components/ui/Estados'

function ListaLinks({ artigos, base }) {
  return (
    <ul className="ajuda-links">
      {artigos.map((a) => (
        <li key={a.id}><Link to={`${base}/${a.id}`} className="link">{a.titulo}</Link></li>
      ))}
    </ul>
  )
}

// Central de ajuda: todos os artigos, por assunto, com busca.
// contexto: 'gestao' (administrador e RH) ou 'colaborador'.
export default function CentralAjuda({ contexto }) {
  const { id } = useParams()
  const saida = useOutletContext() || {}
  const ehGestor = Boolean(saida.equipe?.ehGestor)
  const empresa = saida.empresa?.nome
  const [busca, setBusca] = useSearchParams()
  const [termo, setTermo] = useState(busca.get('q') || '')
  const marcos = useMarcos()
  const base = caminhoCentral(contexto)

  const disponiveis = useMemo(() => artigosPara(contexto, ehGestor), [contexto, ehGestor])
  const resultados = useMemo(() => buscar(termo, disponiveis), [termo, disponiveis])

  useEffect(() => {
    const atual = busca.get('q') || ''
    if (atual === termo.trim()) return
    const novo = new URLSearchParams(busca)
    if (termo.trim()) novo.set('q', termo.trim()); else novo.delete('q')
    setBusca(novo, { replace: true })
  }, [termo]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { window.scrollTo?.(0, 0) }, [id])

  // ----- Um artigo
  if (id) {
    const artigo = artigoPorId(id)
    const permitido = artigo && disponiveis.includes(artigo)
    if (!permitido) {
      return (
        <div className="pagina" style={{ maxWidth: 760 }}>
          <EstadoVazio icone={SearchX} titulo="Artigo não encontrado"
            acao={<Link to={base} className="btn btn--secundario">Ir para a central de ajuda</Link>}>
            Ele pode ter mudado de nome. Procure pelo assunto na central de ajuda.
          </EstadoVazio>
        </div>
      )
    }
    const categoria = CATEGORIAS.find((c) => c.id === artigo.categoria)
    const relacionados = disponiveis.filter((a) => a.id !== artigo.id && a.categoria === artigo.categoria).slice(0, 4)
    return (
      <div className="pagina" style={{ maxWidth: 760 }}>
        <div className="pagina__cabecalho">
          <div className="pagina__titulo">
            <Link to={base} className="pagina__trilha link--suave"><ArrowLeft aria-hidden="true" className="icone-inline" /> Central de ajuda · {categoria?.titulo}</Link>
            <h1>{artigo.titulo}</h1>
            <p className="suave">{artigo.resumo}</p>
          </div>
        </div>
        <article className="cartao">
          <ConteudoArtigo artigo={artigo} contexto={contexto} />
        </article>
        {relacionados.length > 0 && (
          <section className="cartao" aria-labelledby="t-rel">
            <h2 id="t-rel" className="ajuda-titulo" style={{ marginBottom: 8 }}>Veja também</h2>
            <ListaLinks artigos={relacionados} base={base} />
          </section>
        )}
        <Suporte contexto={contexto} empresa={empresa} tela={`Ajuda: ${artigo.titulo}`} />
      </div>
    )
  }

  // ----- A central
  const listaOculta = contexto === 'gestao' && marcos.disponivel &&
    (marcos.tem('primeiros_passos_oculto') || marcos.tem('primeiros_passos_concluido'))

  return (
    <div className="pagina" style={{ maxWidth: 980 }}>
      <div className="pagina__cabecalho">
        <div className="pagina__titulo">
          <h1>Central de ajuda</h1>
          <p className="suave">Respostas curtas para as dúvidas mais comuns. Em qualquer tela, o <strong>?</strong> no alto mostra a ajuda daquela tela.</p>
        </div>
      </div>

      <div className="campo ajuda-busca-grande">
        <label className="campo__rotulo" htmlFor="central-busca">O que você procura?</label>
        <div className="entrada-grupo">
          <input id="central-busca" className="entrada" type="search" value={termo} autoComplete="off"
            placeholder="Ex.: banco de horas, folga, convite" onChange={(e) => setTermo(e.target.value)} />
          <span className="entrada-grupo__botao" aria-hidden="true"><Search /></span>
        </div>
      </div>

      {listaOculta && (
        <div className="cartao cartao--compacto linha linha--espacada">
          <span className="linha"><ListChecks aria-hidden="true" className="icone-inline" /> A lista de primeiros passos está escondida.</span>
          <Botao variante="secundario" tamanho="pequeno" onClick={async () => {
            await marcos.desmarcar('primeiros_passos_oculto')
            await marcos.desmarcar('primeiros_passos_concluido')
          }}>Mostrar os primeiros passos de novo</Botao>
        </div>
      )}
      {contexto === 'gestao' && marcos.disponivel && !listaOculta && (
        <p className="suave pequeno" style={{ margin: 0 }}>A lista de primeiros passos aparece na <Link to="/gestao" className="link">Visão geral</Link>.</p>
      )}

      {termo.trim() ? (
        <section className="cartao" aria-live="polite" aria-labelledby="t-res">
          <h2 id="t-res" className="ajuda-titulo" style={{ marginBottom: 8 }}>
            {resultados.length ? `${resultados.length} ${resultados.length === 1 ? 'resultado' : 'resultados'} para "${termo.trim()}"` : `Nada encontrado para "${termo.trim()}"`}
          </h2>
          {resultados.length ? (
            <ul className="ajuda-resultados">
              {resultados.map((a) => (
                <li key={a.id}>
                  <Link to={`${base}/${a.id}`} className="link">{a.titulo}</Link>
                  <span className="suave pequeno">{a.resumo}</span>
                </li>
              ))}
            </ul>
          ) : <p className="suave pequeno">Tente outras palavras, como "senha", "folga" ou "banco de horas".</p>}
        </section>
      ) : (
        <div className="ajuda-categorias">
          {CATEGORIAS.map((c) => {
            const lista = disponiveis.filter((a) => a.categoria === c.id)
            if (!lista.length) return null
            return (
              <section key={c.id} className="cartao" aria-labelledby={`cat-${c.id}`}>
                <h2 id={`cat-${c.id}`} className="ajuda-titulo" style={{ marginBottom: 8 }}>{c.titulo}</h2>
                <ListaLinks artigos={lista} base={base} />
              </section>
            )
          })}
        </div>
      )}

      <Suporte contexto={contexto} empresa={empresa} tela="Central de ajuda" />
    </div>
  )
}
