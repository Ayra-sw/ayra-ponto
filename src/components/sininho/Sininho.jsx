import { useEffect, useId, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, CalendarClock, CheckCheck, Inbox, MessageSquareReply, PiggyBank, ScanFace, UserPlus } from 'lucide-react'
import useSininho from '../../hooks/useSininho'

const ICONE = {
  pedido_novo: Inbox,
  pedido_respondido: MessageSquareReply,
  dia_incompleto: CalendarClock,
  banco_vencendo: PiggyBank,
  pessoa_nova: UserPlus,
  foto_para_aprovar: ScanFace,
  foto_analisada: ScanFace,
}

// "há 5 min", "ontem", "12/09"
export function quando(valor) {
  const s = Math.max(0, (Date.now() - new Date(valor).getTime()) / 1000)
  if (s < 60) return 'agora'
  if (s < 3600) return `há ${Math.floor(s / 60)} min`
  if (s < 86400) return `há ${Math.floor(s / 3600)} h`
  if (s < 172800) return 'ontem'
  if (s < 7 * 86400) return `há ${Math.floor(s / 86400)} dias`
  return new Date(valor).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

// O sininho da barra de cima, com os avisos de quem está logado.
export default function Sininho() {
  const s = useSininho()
  const navegar = useNavigate()
  const [aberto, setAberto] = useState(false)
  const idPainel = useId()
  const caixa = useRef(null)
  const botao = useRef(null)
  const { carregarLista } = s

  useEffect(() => { if (aberto) carregarLista() }, [aberto, carregarLista])

  useEffect(() => {
    if (!aberto) return
    const fora = (e) => { if (caixa.current && !caixa.current.contains(e.target)) setAberto(false) }
    const tecla = (e) => { if (e.key === 'Escape') { setAberto(false); botao.current?.focus() } }
    document.addEventListener('mousedown', fora)
    document.addEventListener('keydown', tecla)
    return () => { document.removeEventListener('mousedown', fora); document.removeEventListener('keydown', tecla) }
  }, [aberto])

  if (!s.disponivel) return null

  const abrirAviso = (a) => {
    s.marcarLido(a)
    setAberto(false)
    if (a.link) navegar(a.link)
  }
  const rotulo = s.naoLidos > 0 ? `Avisos (${s.naoLidos} ${s.naoLidos === 1 ? 'novo' : 'novos'})` : 'Avisos'

  return (
    <div className="sininho" ref={caixa}>
      <button ref={botao} type="button" className="btn btn--discreto btn--icone sininho__botao" aria-label={rotulo} title={rotulo}
        aria-expanded={aberto} aria-controls={idPainel} onClick={() => setAberto((v) => !v)}>
        <Bell aria-hidden="true" />
        {s.naoLidos > 0 && <span className="sininho__contador" aria-hidden="true">{s.naoLidos > 99 ? '99+' : s.naoLidos}</span>}
      </button>
      {aberto && (
        <section id={idPainel} className="sininho__painel" aria-label="Avisos">
          <div className="sininho__topo">
            <strong>Avisos</strong>
            {s.naoLidos > 0 && (
              <button type="button" className="link link--suave pequeno sininho__todos" onClick={s.marcarTodos}>
                <CheckCheck aria-hidden="true" /> Marcar todos como lidos
              </button>
            )}
          </div>
          {s.carregando && s.lista.length === 0 ? (
            <p className="suave pequeno sininho__vazio">Carregando…</p>
          ) : s.lista.length === 0 ? (
            <div className="sininho__vazio">
              <Bell aria-hidden="true" />
              <p className="suave pequeno">Nenhum aviso por aqui. Quando chegar um pedido, uma resposta ou algo para conferir, ele aparece aqui.</p>
            </div>
          ) : (
            <ul className="sininho__lista">
              {s.lista.map((a) => {
                const Icone = ICONE[a.tipo] || Bell
                return (
                  <li key={a.id}>
                    <button type="button" className={`sininho__aviso${a.lido_em ? '' : ' sininho__aviso--novo'}`} onClick={() => abrirAviso(a)}>
                      <span className="sininho__icone" aria-hidden="true"><Icone /></span>
                      <span className="sininho__texto">
                        <span className="sininho__titulo">{a.titulo}{!a.lido_em && <span className="sr-only"> (novo)</span>}</span>
                        {a.texto && <span className="sininho__detalhe">{a.texto}</span>}
                        <span className="sininho__quando">{quando(a.criado_em)}</span>
                      </span>
                      {!a.lido_em && <span className="sininho__ponto" aria-hidden="true" />}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      )}
    </div>
  )
}
