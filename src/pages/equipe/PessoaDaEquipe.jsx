import { Link, useOutletContext, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, UserRoundX } from 'lucide-react'
import EspelhoMensal from '../../components/espelho/EspelhoMensal'
import HistoricoMarcacoes from '../../components/marcacoes/HistoricoMarcacoes'
import BancoHoras from '../../components/banco/BancoHoras'
import ListaSolicitacoes from '../../components/marcacoes/ListaSolicitacoes'
import MinhaEscala from '../../components/escalas/MinhaEscala'
import Etiqueta from '../../components/ui/Etiqueta'
import { Esqueleto, EstadoVazio } from '../../components/ui/Estados'

// Uma pessoa da equipe, vista pelo gestor (só leitura).
export default function PessoaDaEquipe() {
  const { id } = useParams()
  const { equipe } = useOutletContext()
  const [busca, setBusca] = useSearchParams()

  if (equipe.carregando) return <div className="pagina"><Esqueleto linhas={5} blocos={1} /></div>
  const pessoa = equipe.equipe.find((p) => p.perfil_id === id)
  if (!pessoa) {
    return (
      <div className="pagina">
        <EstadoVazio icone={UserRoundX} titulo="Esta pessoa não é da sua equipe"
          acao={<Link to="/equipe" className="btn btn--secundario">Voltar para a equipe</Link>}>
          Você só acompanha quem está nos departamentos em que você é gestor.
        </EstadoVazio>
      </div>
    )
  }

  const abas = [
    { id: 'espelho', rotulo: 'Espelho' },
    { id: 'marcacoes', rotulo: 'Marcações' },
    ...(pessoa.tipo_escala && pessoa.tipo_escala !== 'semanal' ? [{ id: 'escala', rotulo: 'Escala' }] : []),
    { id: 'banco', rotulo: 'Banco de horas' },
    { id: 'pedidos', rotulo: 'Pedidos' },
  ]
  const aba = abas.some((a) => a.id === busca.get('aba')) ? busca.get('aba') : 'espelho'
  const pessoaInicial = { id: pessoa.perfil_id, nome_completo: pessoa.nome_completo, matricula: pessoa.matricula, cargo: pessoa.cargo, filial_id: pessoa.filial_id }

  return (
    <div className="pagina" style={{ maxWidth: 980 }}>
      <div className="pagina__cabecalho">
        <div className="pagina__titulo">
          <Link to="/equipe?aba=pessoas" className="pagina__trilha link link--suave" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <ArrowLeft size={14} aria-hidden="true" /> Minha equipe
          </Link>
          <h1>{pessoa.nome_completo}</h1>
          <p className="suave">{[pessoa.cargo, pessoa.departamento, pessoa.matricula ? `Matrícula ${pessoa.matricula}` : ''].filter(Boolean).join(' · ') || 'Da sua equipe'}</p>
        </div>
        {pessoa.status !== 'ativo' && <Etiqueta tom="atencao">{pessoa.status === 'afastado' ? 'Afastada(o)' : pessoa.status}</Etiqueta>}
      </div>

      <div className="abas" role="tablist" aria-label="Seções da pessoa">
        {abas.map((a) => (
          <button key={a.id} type="button" role="tab" aria-selected={aba === a.id} className="abas__item"
            onClick={() => setBusca(a.id === 'espelho' ? {} : { aba: a.id }, { replace: true })}>{a.rotulo}</button>
        ))}
      </div>

      {aba === 'marcacoes' ? (
        <HistoricoMarcacoes perfilId={id} />
      ) : aba === 'escala' ? (
        <MinhaEscala perfilId={id} deOutraPessoa />
      ) : aba === 'banco' ? (
        <BancoHoras perfilId={id} nomePessoa={pessoa.nome_completo} textoSemBanco="As horas extras e os atrasos desta pessoa aparecem no espelho." />
      ) : aba === 'pedidos' ? (
        <div className="pilha">
          <ListaSolicitacoes perfilId={id} ocultarAbono textoVazio="Esta pessoa ainda não enviou pedidos de ajuste ou folga." />
          <p className="suave pequeno">Para aprovar ou recusar, use a aba Pedidos em <Link to="/equipe" className="link">Minha equipe</Link>. Abonos ficam com o RH.</p>
        </div>
      ) : (
        <EspelhoMensal perfilId={id} pessoaInicial={pessoaInicial} mesInicial={busca.get('mes')}
          aoMudarMes={(m) => setBusca({ aba: 'espelho', mes: m }, { replace: true })} />
      )}
    </div>
  )
}
