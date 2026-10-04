import { useMemo } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ArrowLeft, BookOpen, ChevronRight, Search } from 'lucide-react'
import {
  MAIS_PROCURADOS, artigoPorId, artigosDaTela, artigosPara, buscar, caminhoCentral,
} from '../../lib/ajuda'
import { PainelLateral } from '../ui/Dialogo'
import Botao from '../ui/Botao'
import ConteudoArtigo from './ConteudoArtigo'
import Suporte from './Suporte'

function ListaArtigos({ artigos, aoAbrir }) {
  return (
    <ul className="ajuda-lista">
      {artigos.map((a) => (
        <li key={a.id}>
          <button type="button" className="ajuda-lista__item" onClick={() => aoAbrir(a.id)}>
            <span>
              <strong>{a.titulo}</strong>
              <span className="suave pequeno">{a.resumo}</span>
            </span>
            <ChevronRight aria-hidden="true" />
          </button>
        </li>
      ))}
    </ul>
  )
}

// Conteúdo do painel de ajuda (baixado só quando a pessoa abre a ajuda).
export default function PainelAjuda({ contexto, ehGestor, empresa, artigoId, setArtigoId, termo, setTermo, fechar }) {
  const local = useLocation()
  const disponiveis = useMemo(() => artigosPara(contexto, ehGestor), [contexto, ehGestor])
  const daTela = useMemo(() => artigosDaTela(local.pathname, disponiveis).slice(0, 5), [local.pathname, disponiveis])
  const procurados = useMemo(() => (MAIS_PROCURADOS[contexto] || [])
    .map(artigoPorId).filter((a) => a && disponiveis.includes(a) && !daTela.includes(a)), [contexto, disponiveis, daTela])
  const resultados = useMemo(() => buscar(termo, disponiveis).slice(0, 12), [termo, disponiveis])
  const artigo = artigoId && artigoPorId(artigoId) && disponiveis.includes(artigoPorId(artigoId)) ? artigoPorId(artigoId) : null
  const relacionados = artigo
    ? disponiveis.filter((a) => a.id !== artigo.id && a.categoria === artigo.categoria).slice(0, 3)
    : []
  function abrirArtigo(id) {
    setArtigoId(id)
    document.querySelector('.painel-lateral__corpo')?.scrollTo?.(0, 0)
  }
  const central = contexto === 'publico' ? null : caminhoCentral(contexto)

  return (
      <PainelLateral
        aberto
        aoFechar={fechar}
        titulo={artigo ? artigo.titulo : 'Ajuda'}
        subtitulo={artigo ? artigo.resumo : 'Respostas rápidas, sem sair da tela.'}
        rodape={central && (
          <Link to={artigo ? `${central}/${artigo.id}` : central} className="btn btn--secundario btn--pequeno" onClick={fechar}>
            <BookOpen aria-hidden="true" /> {artigo ? 'Abrir na central de ajuda' : 'Ver todos os artigos'}
          </Link>
        )}
      >
        {artigo ? (
          <div className="pilha pilha--16">
            <div>
              <Botao variante="discreto" tamanho="pequeno" icone={ArrowLeft} onClick={() => setArtigoId(null)}>Voltar</Botao>
            </div>
            <ConteudoArtigo artigo={artigo} contexto={contexto} aoNavegar={fechar} />
            {relacionados.length > 0 && (
              <section aria-labelledby="ajuda-rel" className="pilha">
                <h3 id="ajuda-rel" className="ajuda-titulo">Veja também</h3>
                <ListaArtigos artigos={relacionados} aoAbrir={abrirArtigo} />
              </section>
            )}
            <Suporte contexto={contexto} empresa={empresa} tela={local.pathname} compacto />
          </div>
        ) : (
          <div className="pilha pilha--16">
            <div className="campo">
              <label className="campo__rotulo" htmlFor="ajuda-busca">O que você procura?</label>
              <div className="entrada-grupo">
                <input id="ajuda-busca" className="entrada" type="search" value={termo} autoComplete="off"
                  placeholder="Ex.: esqueci de bater o ponto" onChange={(e) => setTermo(e.target.value)} />
                <span className="entrada-grupo__botao" aria-hidden="true"><Search /></span>
              </div>
            </div>
            {termo.trim() ? (
              <section aria-live="polite" className="pilha">
                <h3 className="ajuda-titulo">{resultados.length ? `${resultados.length} ${resultados.length === 1 ? 'resultado' : 'resultados'}` : 'Nada encontrado'}</h3>
                {resultados.length
                  ? <ListaArtigos artigos={resultados} aoAbrir={abrirArtigo} />
                  : <p className="suave pequeno">Tente outras palavras, como "senha", "folga" ou "banco de horas".</p>}
              </section>
            ) : (
              <>
                {daTela.length > 0 && (
                  <section aria-labelledby="ajuda-tela" className="pilha">
                    <h3 id="ajuda-tela" className="ajuda-titulo">Ajuda desta tela</h3>
                    <ListaArtigos artigos={daTela} aoAbrir={abrirArtigo} />
                  </section>
                )}
                {procurados.length > 0 && (
                  <section aria-labelledby="ajuda-mais" className="pilha">
                    <h3 id="ajuda-mais" className="ajuda-titulo">Mais procurados</h3>
                    <ListaArtigos artigos={procurados} aoAbrir={abrirArtigo} />
                  </section>
                )}
              </>
            )}
            <Suporte contexto={contexto} empresa={empresa} tela={local.pathname} compacto />
          </div>
        )}
      </PainelLateral>
  )
}
