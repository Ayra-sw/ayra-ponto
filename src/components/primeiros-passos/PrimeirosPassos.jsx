import { useCallback, useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Check, CircleHelp, PartyPopper } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../contexts/AuthContext'
import { cnpjValido } from '../../lib/cnpj'
import { abrirAjuda } from '../../lib/abrirAjuda'
import useMarcos from '../../hooks/useMarcos'
import Botao from '../ui/Botao'
import Etiqueta from '../ui/Etiqueta'

const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`

// Lista "Primeiros passos" da Visão geral (administrador e RH).
// Cada item é marcado sozinho quando é feito. A lista pode ser escondida e
// volta pela Central de ajuda. Sem a Fase 4A no banco, mostra a lista simples
// (os 4 passos que já existiam) e não guarda nada.
export default function PrimeirosPassos({ empresa, unidades, pessoas, aoConvidar }) {
  const { perfil } = useAuth()
  const local = useLocation()
  const marcos = useMarcos()
  const [dados, setDados] = useState(undefined) // undefined = carregando; null = sem a 4A
  const [jornadasAntigo, setJornadasAntigo] = useState(null)

  const carregar = useCallback(async () => {
    const { data, error } = await supabase.rpc('primeiros_passos')
    if (!error && data) { setDados(data); return }
    setDados(null)
    const j = await supabase.from('modelos_jornada').select('id', { count: 'exact', head: true })
    if (!j.error) setJornadasAntigo(j.count || 0)
  }, [])

  useEffect(() => { carregar() }, [carregar, local.key])

  if (dados === undefined || !marcos.pronto) return null

  const rh = perfil?.tipo === 'rh'
  const ano = new Date().getFullYear()
  const cnpjOk = empresa?.cnpj && cnpjValido(empresa.cnpj)
  const empresaOk = Boolean(empresa?.razao_social && cnpjOk && empresa?.cidade)
  const soAdmin = rh ? 'Só o administrador altera. Peça a ele.' : null

  const passos = dados ? [
    { id: 'empresa', feito: empresaOk, titulo: 'Complete os dados da empresa', detalhe: soAdmin || 'Razão social, CNPJ e endereço aparecem no espelho de ponto.', link: '/gestao/configuracoes/empresa', acao: rh ? 'Ver' : 'Abrir', artigo: 'dados-empresa' },
    { id: 'unidade', feito: dados.unidade_com_endereco, titulo: 'Confira o endereço da unidade', detalhe: soAdmin || 'Endereço e fuso horário de cada local de trabalho.', link: '/gestao/configuracoes/unidades', acao: rh ? 'Ver' : 'Abrir', artigo: 'unidades' },
    { id: 'jornada', feito: dados.jornadas > 0, titulo: 'Cadastre a jornada de trabalho', detalhe: 'Há modelos prontos. A jornada calcula atrasos e horas extras.', link: '/gestao/jornadas', acao: 'Abrir', artigo: 'jornadas' },
    { id: 'feriados', feito: dados.feriados_do_ano > 0, titulo: `Cadastre os feriados de ${ano}`, detalhe: 'O botão "Feriados nacionais" adiciona todos de uma vez.', link: '/gestao/feriados', acao: 'Abrir', artigo: 'feriados' },
    { id: 'departamentos', feito: dados.departamentos > 0, titulo: 'Crie os departamentos', detalhe: 'E, se quiser, escolha quem aprova os pedidos de cada equipe.', link: '/gestao/departamentos', acao: 'Abrir', artigo: 'departamentos-gestores' },
    { id: 'equipe', feito: dados.pessoas > 1, titulo: 'Convide sua equipe', detalhe: 'Envie o link de convite. Cada pessoa cria a própria senha.', aoClicar: aoConvidar, acao: 'Convidar', artigo: 'convidar-equipe' },
    { id: 'jornada-pessoas', feito: dados.sem_jornada === 0, titulo: 'Defina como cada pessoa trabalha',
      detalhe: dados.sem_jornada > 0 ? `${plural(dados.sem_jornada, 'pessoa ainda está', 'pessoas ainda estão')} sem jornada. Abra a ficha, aba Trabalho.` : 'Jornada ou escala de cada pessoa, na ficha, aba Trabalho.',
      link: '/gestao/pessoas', acao: 'Abrir', artigo: 'ficha-pessoa' },
    { id: 'marcacao', feito: dados.tem_marcacao, titulo: 'Faça a primeira marcação de ponto', detalhe: 'Teste você mesmo: registre uma entrada e veja o comprovante.', link: '/gestao/meu-ponto', acao: 'Abrir', artigo: 'bater-ponto' },
  ] : [
    { id: 'empresa', feito: empresaOk, titulo: 'Complete os dados da empresa', detalhe: 'Razão social, CNPJ e endereço aparecem no espelho de ponto.', link: '/gestao/configuracoes/empresa', acao: 'Abrir' },
    { id: 'unidade', feito: unidades.some((u) => u.cidade), titulo: 'Confira suas unidades', detalhe: 'Cada local de trabalho tem sua própria sequência de registros.', link: '/gestao/configuracoes/unidades', acao: 'Abrir' },
    { id: 'jornada', feito: jornadasAntigo !== 0, titulo: 'Cadastre a jornada de trabalho', detalhe: 'Os horários previstos alimentam o cálculo de atrasos e horas extras.', link: '/gestao/jornadas', acao: 'Abrir' },
    { id: 'equipe', feito: pessoas > 1, titulo: 'Convide sua equipe', detalhe: 'Envie o link de convite. Cada pessoa cria a própria senha.', aoClicar: aoConvidar, acao: 'Convidar' },
  ]

  const feitos = passos.filter((p) => p.feito).length
  const tudoPronto = feitos === passos.length

  // Tudo pronto: comemora uma vez (com a 4A) e some
  if (tudoPronto) {
    if (!marcos.disponivel || marcos.tem('primeiros_passos_concluido')) return null
    return (
      <section className="cartao primeiros-passos primeiros-passos--pronto" aria-labelledby="t-pronto">
        <PartyPopper aria-hidden="true" className="primeiros-passos__festa" />
        <div style={{ flex: 1, minWidth: 200 }}>
          <h2 id="t-pronto">Tudo pronto!</h2>
          <p className="suave pequeno">Sua empresa está configurada. A equipe já pode bater o ponto, e você acompanha tudo por aqui.</p>
        </div>
        <Botao variante="secundario" onClick={() => marcos.marcar('primeiros_passos_concluido')}>Fechar</Botao>
      </section>
    )
  }
  if (marcos.disponivel && marcos.tem('primeiros_passos_oculto')) return null

  return (
    <section className="cartao primeiros-passos" aria-labelledby="t-config">
      <div className="cartao__cabecalho">
        <div>
          <h2 id="t-config">Primeiros passos</h2>
          <p className="suave pequeno">{feitos} de {passos.length} concluídos. Faça na ordem que preferir: cada item é marcado sozinho quando fica pronto.</p>
        </div>
        {marcos.disponivel && (
          <Botao variante="discreto" tamanho="pequeno" onClick={() => marcos.marcar('primeiros_passos_oculto')}>Esconder lista</Botao>
        )}
      </div>
      <div className="progresso" style={{ marginBottom: 16 }} role="progressbar" aria-label="Primeiros passos concluídos"
        aria-valuemin={0} aria-valuemax={passos.length} aria-valuenow={feitos}>
        <span style={{ width: `${(feitos / passos.length) * 100}%` }} />
      </div>
      <ol className="checklist">
        {passos.map((p) => (
          <li key={p.id} className={`checklist__item${p.feito ? ' checklist__item--feito' : ''}`}>
            <span className="checklist__marca" aria-hidden="true">{p.feito && <Check />}</span>
            <span className="checklist__texto">
              <strong>{p.titulo}{p.id === 'departamentos' && !p.feito && <Etiqueta tom="neutra">Recomendado</Etiqueta>}</strong>
              <span className="suave pequeno">{p.feito ? 'Concluído' : p.detalhe}</span>
              <span className="sr-only">{p.feito ? '(feito)' : '(a fazer)'}</span>
            </span>
            {!p.feito && (
              <span className="checklist__acoes">
                {p.artigo && (
                  <Botao variante="discreto" tamanho="pequeno" className="btn--icone" icone={CircleHelp}
                    aria-label={`Como fazer: ${p.titulo}`} title="Como fazer" onClick={() => abrirAjuda(p.artigo)} />
                )}
                {p.link
                  ? <Link to={p.link} className="btn btn--secundario btn--pequeno" aria-label={`${p.acao}: ${p.titulo}`}>{p.acao}</Link>
                  : <Botao variante="secundario" tamanho="pequeno" onClick={p.aoClicar} aria-label={`${p.acao}: ${p.titulo}`}>{p.acao}</Botao>}
              </span>
            )}
          </li>
        ))}
      </ol>
      {marcos.disponivel && <p className="suave pequeno" style={{ margin: '12px 0 0' }}>Escondeu sem querer? A lista volta pela Central de ajuda.</p>}
    </section>
  )
}
