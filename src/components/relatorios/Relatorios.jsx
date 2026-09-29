import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Search } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../contexts/AuthContext'
import useEmpresa from '../../hooks/useEmpresa'
import { diaIso } from '../../lib/ajustes'
import { PERIODOS_PRONTOS, RELATORIOS, conferirPeriodo, periodoPronto, textoPeriodo } from '../../lib/relatorios'
import { data as formatarData } from '../../lib/formatos'
import Alerta from '../ui/Alerta'
import { Campo, Selecao } from '../ui/Campo'
import RelFrequencia from './RelFrequencia'
import RelPedidos from './RelPedidos'
import RelBancoHoras from './RelBancoHoras'
import RelMarcacoes from './RelMarcacoes'

// Relatórios: frequência, pedidos, banco de horas e marcações.
//   modo "gestao": administrador e RH, a empresa toda
//   modo "gestor": só a equipe (sem abonos e sem reconhecimento facial)
export default function Relatorios({ modo = 'gestao', abaFixa }) {
  const { perfil } = useAuth()
  const { empresa } = useEmpresa()
  const [busca, setBusca] = useSearchParams()
  const gestor = modo === 'gestor'
  const relatorio = RELATORIOS.some((r) => r.id === busca.get('relatorio')) ? busca.get('relatorio') : 'frequencia'
  const padrao = periodoPronto('mes')
  const inicio = busca.get('inicio') || padrao.inicio
  const fim = busca.get('fim') || padrao.fim
  const ate = busca.get('ate') || diaIso()
  const departamento = gestor ? '' : (busca.get('depto') || '')
  const desligados = !gestor && busca.get('desligados') === '1'
  const [termo, setTermo] = useState('')
  const [departamentos, setDepartamentos] = useState([])

  useEffect(() => {
    if (gestor) return
    supabase.from('departamentos').select('id, nome').eq('empresa_id', perfil.empresa_id).order('nome')
      .then(({ data }) => setDepartamentos(data || []))
  }, [gestor, perfil.empresa_id])

  function mudar(valores) {
    const novo = new URLSearchParams(busca)
    if (abaFixa) novo.set('aba', abaFixa)
    for (const [k, v] of Object.entries(valores)) {
      if (v === '' || v == null || v === false) novo.delete(k); else novo.set(k, v === true ? '1' : v)
    }
    setBusca(novo, { replace: true })
  }

  const erroPeriodo = relatorio === 'banco' ? (ate > diaIso() ? 'Escolha uma data de hoje para trás.' : '') : conferirPeriodo(inicio, fim, relatorio)
  const def = RELATORIOS.find((r) => r.id === relatorio)
  const filtros = { inicio, fim, ate, departamento: departamento || null, desligados, termo: termo.trim().toLowerCase(), gestor, perfil }
  const periodoTexto = relatorio === 'banco' ? `Saldo em ${formatarData(ate)}` : textoPeriodo(inicio, fim)

  return (
    <div className="pilha relatorio">
      <div className="abas nao-imprimir" role="tablist" aria-label="Escolha o relatório">
        {RELATORIOS.map((r) => (
          <button key={r.id} type="button" role="tab" aria-selected={relatorio === r.id} className="abas__item"
            onClick={() => mudar({ relatorio: r.id === 'frequencia' ? '' : r.id })}>{r.titulo}</button>
        ))}
      </div>
      <p className="suave pequeno nao-imprimir" style={{ margin: 0 }}>
        {def.descricao}{gestor ? ' Só as pessoas da sua equipe.' : ''}
        {gestor && relatorio === 'pedidos' ? ' Abonos ficam com o RH e não aparecem aqui.' : ''}
      </p>

      <div className="filtros nao-imprimir">
        {relatorio === 'banco' ? (
          <Campo rotulo="Saldo em" type="date" max={diaIso()} value={ate} onChange={(e) => mudar({ ate: e.target.value })} />
        ) : (
          <>
            <Campo rotulo="Primeiro dia" type="date" value={inicio} onChange={(e) => mudar({ inicio: e.target.value })} />
            <Campo rotulo="Último dia" type="date" value={fim} onChange={(e) => mudar({ fim: e.target.value })} />
          </>
        )}
        <div className="campo campo--busca">
          <label className="campo__rotulo" htmlFor={`busca-rel-${modo}`}>Buscar pessoa</label>
          <div className="entrada-grupo">
            <input id={`busca-rel-${modo}`} className="entrada" type="search" placeholder="Nome ou matrícula" value={termo} onChange={(e) => setTermo(e.target.value)} />
            <span className="entrada-grupo__botao" aria-hidden="true"><Search /></span>
          </div>
        </div>
        {!gestor && departamentos.length > 0 && (
          <Selecao rotulo="Departamento" value={departamento} onChange={(e) => mudar({ depto: e.target.value })}
            opcoes={[{ valor: '', rotulo: 'Todos' }, ...departamentos.map((d) => ({ valor: d.id, rotulo: d.nome }))]} />
        )}
      </div>

      <div className="linha linha--espacada nao-imprimir" style={{ flexWrap: 'wrap', gap: 8 }}>
        {relatorio !== 'banco' ? (
          <div className="linha" style={{ flexWrap: 'wrap', gap: 6 }} role="group" aria-label="Períodos prontos">
            {PERIODOS_PRONTOS.map((p) => {
              const per = periodoPronto(p.id)
              const ativo = per.inicio === inicio && per.fim === fim
              return <button key={p.id} type="button" className="ficha" aria-pressed={ativo} onClick={() => mudar({ inicio: per.inicio, fim: per.fim })}>{p.rotulo}</button>
            })}
          </div>
        ) : <span />}
        {!gestor && (
          <label className="linha pequeno" style={{ gap: 6, cursor: 'pointer' }}>
            <input type="checkbox" checked={desligados} onChange={(e) => mudar({ desligados: e.target.checked })} />
            Incluir pessoas desligadas
          </label>
        )}
      </div>

      {/* Cabeçalho que só aparece na impressão */}
      <header className="relatorio__impressao">
        <h1>Relatório de {def.titulo.toLowerCase()} — {periodoTexto}</h1>
        <p>
          {empresa?.razao_social || empresa?.nome || ''}{empresa?.cnpj ? ` · CNPJ ${empresa.cnpj}` : ''}
          {gestor ? ` · Equipe de ${perfil.nome_completo}` : departamento ? ` · ${departamentos.find((d) => d.id === departamento)?.nome || ''}` : ''}
          {' · '}Emitido em {new Date().toLocaleString('pt-BR')}
        </p>
      </header>

      {erroPeriodo ? <Alerta tom="atencao">{erroPeriodo}</Alerta>
        : relatorio === 'pedidos' ? <RelPedidos filtros={filtros} />
        : relatorio === 'banco' ? <RelBancoHoras filtros={filtros} />
        : relatorio === 'marcacoes' ? <RelMarcacoes filtros={filtros} />
        : <RelFrequencia filtros={filtros} />}
    </div>
  )
}
