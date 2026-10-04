import { useCallback, useEffect, useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { CalendarDays, Flag, Plus, Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../contexts/AuthContext'
import { useAvisos } from '../../contexts/AvisosContext'
import { traduzirErro } from '../../lib/mensagensErro'
import { data as formatarData } from '../../lib/formatos'
import { TIPO_FERIADO, diaDaSemanaCurto, feriadosNacionais, tomFeriado } from '../../lib/jornadas'
import Botao from '../../components/ui/Botao'
import Etiqueta from '../../components/ui/Etiqueta'
import Alerta from '../../components/ui/Alerta'
import { Campo, Selecao } from '../../components/ui/Campo'
import { Confirmacao, Dialogo } from '../../components/ui/Dialogo'
import { Esqueleto, EstadoErro, EstadoVazio } from '../../components/ui/Estados'

// Feriados da empresa (ou de uma unidade). Nos dias de feriado, a jornada
// prevista do colaborador é zerada no cálculo (etapa seguinte do sistema).
export default function Feriados() {
  const { perfil } = useAuth()
  const { unidades, unidadesAtivas } = useOutletContext()
  const avisar = useAvisos()
  const anoAtual = new Date().getFullYear()
  const [ano, setAno] = useState(anoAtual)
  const [lista, setLista] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(false)
  const [novo, setNovo] = useState(null)
  const [nacionais, setNacionais] = useState(null)
  const [excluindo, setExcluindo] = useState(null)
  const [salvando, setSalvando] = useState(false)

  const nomeUnidade = useMemo(() => Object.fromEntries(unidades.map((u) => [u.id, u.nome])), [unidades])

  const carregar = useCallback(async () => {
    setErro(false)
    setCarregando(true)
    const { data, error } = await supabase.from('feriados').select('*')
      .eq('empresa_id', perfil.empresa_id).gte('data', `${ano}-01-01`).lte('data', `${ano}-12-31`).order('data')
    if (error) setErro(true)
    setLista(data || [])
    setCarregando(false)
  }, [perfil.empresa_id, ano])

  useEffect(() => { carregar() }, [carregar])

  async function salvarNovo(e) {
    e.preventDefault()
    if (!novo.data) return setNovo({ ...novo, erro: 'Informe a data.' })
    if (novo.nome.trim().length < 2) return setNovo({ ...novo, erro: 'Informe o nome do feriado.' })
    setSalvando(true)
    const { error } = await supabase.from('feriados').insert({
      empresa_id: perfil.empresa_id, data: novo.data, nome: novo.nome.trim(), tipo: novo.tipo, filial_id: novo.filial_id || null,
    })
    setSalvando(false)
    if (error) return setNovo({ ...novo, erro: traduzirErro(error) })
    avisar('Feriado cadastrado.')
    const anoNovo = Number(novo.data.slice(0, 4))
    setNovo(null)
    if (anoNovo !== ano) setAno(anoNovo); else carregar()
  }

  // Feriados nacionais que ainda não estão cadastrados (comparando data e nome)
  const previa = useMemo(() => {
    if (!nacionais) return []
    const existentes = new Set(lista.filter((f) => !f.filial_id).map((f) => `${f.data}|${f.nome.toLowerCase()}`))
    return feriadosNacionais(ano, { facultativos: nacionais.facultativos })
      .filter((f) => !existentes.has(`${f.data}|${f.nome.toLowerCase()}`))
  }, [nacionais, lista, ano])

  async function importar() {
    setSalvando(true)
    const { error } = await supabase.from('feriados').insert(previa.map((f) => ({ ...f, empresa_id: perfil.empresa_id })))
    setSalvando(false)
    if (error) return setNacionais({ ...nacionais, erro: traduzirErro(error) })
    avisar(`${previa.length} ${previa.length === 1 ? 'feriado adicionado' : 'feriados adicionados'}.`)
    setNacionais(null)
    carregar()
  }

  async function excluir() {
    setSalvando(true)
    const { error } = await supabase.from('feriados').delete().eq('id', excluindo.id)
    setSalvando(false)
    setExcluindo(null)
    if (error) return avisar(traduzirErro(error), 'problema')
    avisar('Feriado excluído.')
    carregar()
  }

  const abrangencia = (f) => (f.filial_id ? nomeUnidade[f.filial_id] || 'Uma unidade' : 'Todas as unidades')
  const anos = [anoAtual - 1, anoAtual, anoAtual + 1, anoAtual + 2]

  return (
    <div className="pagina">
      <div className="pagina__cabecalho">
        <div className="pagina__titulo">
          <span className="pagina__trilha">Jornada</span>
          <h1>Feriados</h1>
          <p className="suave">Dias sem expediente. Podem valer para a empresa toda ou só para uma unidade.</p>
        </div>
        <div className="acoes">
          <Botao variante="secundario" icone={Flag} onClick={() => setNacionais({ facultativos: false, erro: '' })}>Feriados nacionais</Botao>
          <Botao icone={Plus} onClick={() => setNovo({ data: '', nome: '', tipo: 'empresa', filial_id: '', erro: '' })}>Novo feriado</Botao>
        </div>
      </div>

      <div className="filtros">
        <Selecao rotulo="Ano" value={ano} onChange={(e) => setAno(Number(e.target.value))}
          opcoes={anos.map((a) => ({ valor: a, rotulo: String(a) }))} />
      </div>

      {carregando ? <Esqueleto linhas={5} /> : erro ? <EstadoErro aoTentarDeNovo={carregar} /> : lista.length === 0 ? (
        <EstadoVazio icone={CalendarDays} titulo={`Nenhum feriado cadastrado em ${ano}`}
          acao={<Botao icone={Flag} onClick={() => setNacionais({ facultativos: false, erro: '' })}>Adicionar feriados nacionais de {ano}</Botao>}>
          Cadastre os feriados para que os dias sem expediente não contem como falta.
        </EstadoVazio>
      ) : (
        <>
          <div className="so-computador">
            <div className="tabela-envoltorio">
              <table className="tabela">
                <thead><tr><th>Data</th><th>Feriado</th><th>Tipo</th><th>Vale para</th><th><span className="sr-only">Ações</span></th></tr></thead>
                <tbody>
                  {lista.map((f) => (
                    <tr key={f.id}>
                      <td className="mono">{formatarData(f.data)} <span className="suave">{diaDaSemanaCurto(f.data)}</span></td>
                      <td>{f.nome}</td>
                      <td><Etiqueta tom={tomFeriado(f.tipo)}>{TIPO_FERIADO[f.tipo]}</Etiqueta></td>
                      <td>{abrangencia(f)}</td>
                      <td><Botao variante="discreto" tamanho="pequeno" icone={Trash2} onClick={() => setExcluindo(f)} aria-label={`Excluir ${f.nome}`}>Excluir</Botao></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="so-celular lista-cartoes">
            {lista.map((f) => (
              <div key={f.id} className="cartao-linha">
                <div className="cartao-linha__topo">
                  <span className="cartao-linha__titulo">{f.nome}</span>
                  <Etiqueta tom={tomFeriado(f.tipo)}>{TIPO_FERIADO[f.tipo]}</Etiqueta>
                </div>
                <div className="cartao-linha__detalhes">
                  <span className="mono">{formatarData(f.data)} · {diaDaSemanaCurto(f.data)}</span>
                  <span>{abrangencia(f)}</span>
                </div>
                <div><Botao variante="discreto" tamanho="pequeno" icone={Trash2} onClick={() => setExcluindo(f)}>Excluir</Botao></div>
              </div>
            ))}
          </div>
        </>
      )}

      <Dialogo
        aberto={Boolean(novo)} aoFechar={() => setNovo(null)} titulo="Novo feriado"
        acoes={<>
          <Botao variante="secundario" onClick={() => setNovo(null)} disabled={salvando}>Cancelar</Botao>
          <Botao type="submit" form="form-feriado" carregando={salvando}>Salvar</Botao>
        </>}
      >
        {novo && (
          <form id="form-feriado" className="formulario" onSubmit={salvarNovo}>
            <div className="grade-campos">
              <Campo rotulo="Data" type="date" value={novo.data} onChange={(e) => setNovo({ ...novo, data: e.target.value, erro: '' })} required data-foco-inicial />
              <Selecao rotulo="Tipo" value={novo.tipo} onChange={(e) => setNovo({ ...novo, tipo: e.target.value })}
                opcoes={Object.entries(TIPO_FERIADO).map(([valor, rotulo]) => ({ valor, rotulo }))} />
            </div>
            <Campo rotulo="Nome" value={novo.nome} maxLength={80} placeholder="Ex.: Aniversário da cidade" required
              onChange={(e) => setNovo({ ...novo, nome: e.target.value, erro: '' })} />
            {unidadesAtivas.length > 1 && (
              <Selecao rotulo="Vale para" value={novo.filial_id} onChange={(e) => setNovo({ ...novo, filial_id: e.target.value })}
                opcoes={[{ valor: '', rotulo: 'Todas as unidades' }, ...unidadesAtivas.map((u) => ({ valor: u.id, rotulo: u.nome }))]} />
            )}
            {novo.erro && <Alerta tom="problema">{novo.erro}</Alerta>}
          </form>
        )}
      </Dialogo>

      <Dialogo
        aberto={Boolean(nacionais)} aoFechar={() => setNacionais(null)} titulo={`Feriados nacionais de ${ano}`}
        acoes={<>
          <Botao variante="secundario" onClick={() => setNacionais(null)} disabled={salvando}>Cancelar</Botao>
          <Botao onClick={importar} carregando={salvando} disabled={previa.length === 0}>
            {previa.length === 0 ? 'Nada a adicionar' : `Adicionar ${previa.length}`}
          </Botao>
        </>}
      >
        {nacionais && (
          <div className="pilha">
            <p className="suave">Vamos adicionar os feriados nacionais que ainda não estão na sua lista. Feriados estaduais e municipais você cadastra à mão.</p>
            <label className="opcao" style={{ alignItems: 'center' }}>
              <input type="checkbox" checked={nacionais.facultativos} onChange={(e) => setNacionais({ ...nacionais, facultativos: e.target.checked })} />
              <span><span className="opcao__titulo">Incluir pontos facultativos</span><br /><span className="opcao__desc">Carnaval e Corpus Christi. A empresa decide se há expediente.</span></span>
            </label>
            {previa.length > 0 ? (
              <ul className="lista-simples">
                {previa.map((f) => <li key={f.data + f.nome}><span className="mono">{formatarData(f.data)}</span> · {f.nome}</li>)}
              </ul>
            ) : <Alerta tom="ok">Todos esses feriados já estão cadastrados.</Alerta>}
            {nacionais.erro && <Alerta tom="problema">{nacionais.erro}</Alerta>}
          </div>
        )}
      </Dialogo>

      <Confirmacao
        aberta={Boolean(excluindo)} titulo="Excluir feriado?" textoConfirmar="Excluir" perigo carregando={salvando}
        aoConfirmar={excluir} aoCancelar={() => setExcluindo(null)}
      >
        “{excluindo?.nome}” ({excluindo && formatarData(excluindo.data)}) deixa de ser considerado dia sem expediente.
      </Confirmacao>
    </div>
  )
}
