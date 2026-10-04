import { useCallback, useEffect, useMemo, useState } from 'react'
import { History } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../contexts/AuthContext'
import { traduzirErro } from '../../lib/mensagensErro'
import { dataHora } from '../../lib/formatos'
import { GRUPOS, ROTULO_ACAO, TOM_ACAO, agrupar, detalhes, frase } from '../../lib/historico'
import Botao from '../ui/Botao'
import Etiqueta from '../ui/Etiqueta'
import { Esqueleto, EstadoErro, EstadoVazio } from '../ui/Estados'

const POR_VEZ = 100

// Nomes para traduzir os códigos guardados no histórico (departamento, cargo...)
export function useMapasHistorico() {
  const { perfil } = useAuth()
  const [mapas, setMapas] = useState({ pessoas: {}, departamentos: {}, cargos: {}, jornadas: {}, unidades: {}, turnos: {} })
  useEffect(() => {
    const e = perfil.empresa_id
    const de = (r) => Object.fromEntries((r.data || []).map((x) => [x.id, x.nome_completo || x.nome]))
    Promise.all([
      supabase.from('perfis').select('id, nome_completo').eq('empresa_id', e),
      supabase.from('departamentos').select('id, nome').eq('empresa_id', e),
      supabase.from('cargos').select('id, nome').eq('empresa_id', e),
      supabase.from('modelos_jornada').select('id, nome').eq('empresa_id', e),
      supabase.from('filiais').select('id, nome').eq('empresa_id', e),
      supabase.from('turnos').select('id, nome').eq('empresa_id', e),
    ]).then(([p, d, c, j, u, t]) => setMapas({ pessoas: de(p), departamentos: de(d), cargos: de(c), jornadas: de(j), unidades: de(u), turnos: de(t) }))
  }, [perfil.empresa_id])
  return mapas
}

// Lista do histórico. Filtros: pessoaId (ficha da pessoa), inicio/fim (AAAA-MM-DD), grupo e termo.
export default function ListaHistorico({ pessoaId, inicio, fim, grupo, termo = '', textoVazio }) {
  const mapas = useMapasHistorico()
  const [lista, setLista] = useState([])
  const [temMais, setTemMais] = useState(false)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')

  const buscar = useCallback(async (de) => {
    // sem as anotações do contador de NSR (gravadas por engano a cada marcação, corrigido na Fase 5A)
    let q = supabase.from('historico_alteracoes').select('*').or('campos.is.null,campos.neq.{proximo_nsr}')
    if (pessoaId) q = q.eq('pessoa_id', pessoaId)
    if (inicio) q = q.gte('em', new Date(`${inicio}T00:00:00`).toISOString())
    if (fim) q = q.lt('em', new Date(new Date(`${fim}T00:00:00`).getTime() + 86400000).toISOString())
    const tabelas = GRUPOS.find((g) => g.id === grupo)?.tabelas
    if (tabelas) q = q.in('tabela', tabelas)
    return q.order('id', { ascending: false }).range(de, de + POR_VEZ - 1)
  }, [pessoaId, inicio, fim, grupo])

  const carregar = useCallback(async () => {
    setErro('')
    setCarregando(true)
    const { data, error } = await buscar(0)
    if (error) { setErro(traduzirErro(error)); setLista([]) } else { setLista(data || []); setTemMais((data || []).length === POR_VEZ) }
    setCarregando(false)
  }, [buscar])

  useEffect(() => { carregar() }, [carregar])

  async function maisAntigos() {
    const { data, error } = await buscar(lista.length)
    if (error) return
    setLista((l) => [...l, ...(data || [])])
    setTemMais((data || []).length === POR_VEZ)
  }

  const grupos = useMemo(() => {
    const t = termo.trim().toLowerCase()
    const todos = agrupar(lista)
    return t ? todos.filter((g) => `${frase(g, mapas)} ${g.feito_por_nome || ''}`.toLowerCase().includes(t)) : todos
  }, [lista, termo, mapas])

  if (carregando) return <Esqueleto linhas={6} />
  if (erro) return <EstadoErro aoTentarDeNovo={carregar}>{erro}</EstadoErro>
  if (grupos.length === 0) {
    return (
      <EstadoVazio icone={History} titulo="Nenhuma alteração encontrada">
        {textoVazio || 'As alterações aparecem aqui a partir da instalação da Fase 3C. Troque o período ou os filtros para ver outras.'}
      </EstadoVazio>
    )
  }

  return (
    <div className="pilha">
      <ol className="historico" aria-label="Alterações, da mais nova para a mais antiga" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {grupos.map((g) => {
          const lista = detalhes(g, mapas)
          return (
            <li key={g.id} className="cartao-linha historico__item">
              <div className="historico__cabeca">
                <p className="historico__frase"><strong>{frase(g, mapas)}</strong></p>
                <span className="historico__quando">{dataHora(g.em)}</span>
              </div>
              {lista.length > 0 && (
                <ul className="historico__mudancas">
                  {lista.slice(0, 14).map((m, i) => (
                    <li key={i}>
                      <span className="historico__campo">{m.campo}: </span>
                      {m.antes != null && m.depois != null ? (
                        <><span className="historico__antes">{m.antes}</span> → <strong>{m.depois}</strong></>
                      ) : <strong>{m.depois ?? m.antes}</strong>}
                    </li>
                  ))}
                  {lista.length > 14 && <li className="suave">… e mais {lista.length - 14}</li>}
                </ul>
              )}
              <div className="linha" style={{ gap: 6 }}>
                <Etiqueta tom={TOM_ACAO[g.acao]} icone={false}>{ROTULO_ACAO[g.acao]}</Etiqueta>
                {g.itens.length > 1 && <span className="suave pequeno">{g.itens.length} mudanças de uma vez</span>}
              </div>
            </li>
          )
        })}
      </ol>
      {temMais && (
        <div className="paginacao">
          <span>Mostrando as {lista.length} alterações mais recentes</span>
          <Botao variante="secundario" tamanho="pequeno" onClick={maisAntigos}>Ver mais antigas</Botao>
        </div>
      )}
    </div>
  )
}
