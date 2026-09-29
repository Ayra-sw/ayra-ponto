import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../contexts/AuthContext'
import { useAvisos } from '../contexts/AvisosContext'
import { traduzirErro } from '../lib/mensagensErro'
import Botao from './ui/Botao'
import Etiqueta from './ui/Etiqueta'
import Alerta from './ui/Alerta'
import { AreaTexto, Campo } from './ui/Campo'
import { Confirmacao, Dialogo } from './ui/Dialogo'
import { Esqueleto, EstadoErro, EstadoVazio } from './ui/Estados'

// Lista simples de cadastros da empresa (departamentos, cargos): nome,
// descrição, quantas pessoas usam e situação. Administrador e RH gerenciam.
//   tabela: tabela do banco · coluna: coluna em "perfis" que aponta para ela
export default function CadastroSimples({
  tabela, coluna, trilha, titulo, subtitulo, singular, artigoNovo = 'Novo', icone: Icone,
  textoVazio, exemploNome, exemploDescricao, colunaExtra, acaoExtra, versao = 0,
}) {
  const { perfil } = useAuth()
  const avisar = useAvisos()
  const [itens, setItens] = useState([])
  const [pessoas, setPessoas] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(false)
  const [editando, setEditando] = useState(null) // { id?, nome, descricao }
  const [mudandoSituacao, setMudandoSituacao] = useState(null)
  const [excluindo, setExcluindo] = useState(null)
  const [salvando, setSalvando] = useState(false)

  const carregar = useCallback(async () => {
    setErro(false)
    const [c, p] = await Promise.all([
      supabase.from(tabela).select('*').eq('empresa_id', perfil.empresa_id).order('nome'),
      supabase.from('perfis').select(`id, status, ${coluna}`).eq('empresa_id', perfil.empresa_id),
    ])
    if (c.error || p.error) setErro(true)
    setItens(c.data || [])
    setPessoas(p.data || [])
    setCarregando(false)
  }, [tabela, coluna, perfil.empresa_id])

  useEffect(() => { carregar() }, [carregar, versao])

  const uso = useMemo(() => {
    const mapa = {}
    for (const p of pessoas) {
      const id = p[coluna]
      if (!id) continue
      mapa[id] ||= { ativas: 0, total: 0 }
      mapa[id].total += 1
      if (p.status !== 'desligado') mapa[id].ativas += 1
    }
    return mapa
  }, [pessoas, coluna])

  async function salvar(e) {
    e.preventDefault()
    const nome = editando.nome.trim()
    if (nome.length < 2) return setEditando((x) => ({ ...x, erro: 'Informe o nome (mínimo de 2 letras).' }))
    setSalvando(true)
    const dados = { nome, descricao: editando.descricao.trim() || null }
    const { error } = editando.id
      ? await supabase.from(tabela).update(dados).eq('id', editando.id)
      : await supabase.from(tabela).insert({ ...dados, empresa_id: perfil.empresa_id })
    setSalvando(false)
    if (error) return setEditando((x) => ({ ...x, erro: traduzirErro(error) }))
    avisar(editando.id ? 'Cadastro atualizado.' : `${singular.charAt(0).toUpperCase() + singular.slice(1)} criado.`)
    setEditando(null)
    carregar()
  }

  async function alternarSituacao() {
    setSalvando(true)
    const { error } = await supabase.from(tabela).update({ ativo: !mudandoSituacao.ativo }).eq('id', mudandoSituacao.id)
    setSalvando(false)
    if (error) { setMudandoSituacao(null); return avisar(traduzirErro(error), 'problema') }
    avisar(mudandoSituacao.ativo ? 'Desativado. Quem já está vinculado continua, mas ele não aparece mais para novas escolhas.' : 'Ativado de novo.')
    setMudandoSituacao(null)
    carregar()
  }

  async function excluir() {
    setSalvando(true)
    const { error } = await supabase.from(tabela).delete().eq('id', excluindo.id)
    setSalvando(false)
    setExcluindo(null)
    if (error) return avisar(traduzirErro(error), 'problema')
    avisar('Excluído.')
    carregar()
  }

  function Acoes({ item }) {
    const u = uso[item.id] || { ativas: 0, total: 0 }
    return (
      <div className="acoes">
        {acaoExtra?.(item)}
        <Botao variante="secundario" tamanho="pequeno" onClick={() => setEditando({ id: item.id, nome: item.nome, descricao: item.descricao || '' })}>Editar</Botao>
        <Botao variante="discreto" tamanho="pequeno" onClick={() => setMudandoSituacao(item)}>{item.ativo ? 'Desativar' : 'Ativar'}</Botao>
        <Botao variante="discreto" tamanho="pequeno" onClick={() => setExcluindo(item)} disabled={u.total > 0}
          title={u.total > 0 ? 'Há pessoas vinculadas. Desative em vez de excluir.' : 'Excluir'}>Excluir</Botao>
      </div>
    )
  }

  const situacao = (item) => item.ativo ? <Etiqueta tom="ok">Ativo</Etiqueta> : <Etiqueta tom="neutra">Desativado</Etiqueta>
  const textoPessoas = (item) => {
    const n = uso[item.id]?.ativas || 0
    return `${n} ${n === 1 ? 'pessoa' : 'pessoas'}`
  }

  return (
    <div className="pagina">
      <div className="pagina__cabecalho">
        <div className="pagina__titulo">
          {trilha && <span className="pagina__trilha">{trilha}</span>}
          <h1>{titulo}</h1>
          <p className="suave">{subtitulo}</p>
        </div>
        <Botao icone={Plus} onClick={() => setEditando({ nome: '', descricao: '' })}>{artigoNovo} {singular}</Botao>
      </div>

      {carregando ? <Esqueleto linhas={4} /> : erro ? <EstadoErro aoTentarDeNovo={carregar} /> : itens.length === 0 ? (
        <EstadoVazio icone={Icone} titulo={`Nenhum ${singular} cadastrado`}
          acao={<Botao icone={Plus} onClick={() => setEditando({ nome: '', descricao: '' })}>{artigoNovo} {singular}</Botao>}>
          {textoVazio}
        </EstadoVazio>
      ) : (
        <>
          <div className="so-computador">
            <div className="tabela-envoltorio">
              <table className="tabela">
                <thead><tr><th>Nome</th>{colunaExtra && <th>{colunaExtra.titulo}</th>}<th>Pessoas</th><th>Situação</th><th></th></tr></thead>
                <tbody>
                  {itens.map((item) => (
                    <tr key={item.id}>
                      <td>{item.nome}{item.descricao && <span className="tabela__secundario">{item.descricao}</span>}</td>
                      {colunaExtra && <td>{colunaExtra.render(item)}</td>}
                      <td>{textoPessoas(item)}</td>
                      <td>{situacao(item)}</td>
                      <td><Acoes item={item} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="so-celular lista-cartoes">
            {itens.map((item) => (
              <div key={item.id} className="cartao-linha">
                <div className="cartao-linha__topo">
                  <span className="cartao-linha__titulo">{item.nome}</span>
                  {situacao(item)}
                </div>
                {item.descricao && <p className="suave">{item.descricao}</p>}
                <div className="cartao-linha__detalhes">
                  <span>{textoPessoas(item)}</span>
                  {colunaExtra && <span>{colunaExtra.titulo}: {colunaExtra.render(item)}</span>}
                </div>
                <Acoes item={item} />
              </div>
            ))}
          </div>
        </>
      )}

      <Dialogo
        aberto={Boolean(editando)}
        aoFechar={() => setEditando(null)}
        titulo={editando?.id ? `Editar ${singular}` : `${artigoNovo} ${singular}`}
        acoes={
          <>
            <Botao variante="secundario" onClick={() => setEditando(null)} disabled={salvando}>Cancelar</Botao>
            <Botao type="submit" form="form-cadastro-simples" carregando={salvando}>Salvar</Botao>
          </>
        }
      >
        {editando && (
          <form id="form-cadastro-simples" className="formulario" onSubmit={salvar}>
            <Campo rotulo="Nome" value={editando.nome} onChange={(e) => setEditando((x) => ({ ...x, nome: e.target.value, erro: '' }))}
              placeholder={exemploNome} maxLength={80} required data-foco-inicial />
            <AreaTexto rotulo="Descrição" opcional value={editando.descricao} rows={3} maxLength={300}
              onChange={(e) => setEditando((x) => ({ ...x, descricao: e.target.value }))} placeholder={exemploDescricao} />
            {editando.erro && <Alerta tom="problema">{editando.erro}</Alerta>}
          </form>
        )}
      </Dialogo>

      <Confirmacao
        aberta={Boolean(mudandoSituacao)}
        titulo={mudandoSituacao?.ativo ? `Desativar ${singular}?` : `Ativar ${singular}?`}
        textoConfirmar={mudandoSituacao?.ativo ? 'Desativar' : 'Ativar'}
        carregando={salvando}
        aoConfirmar={alternarSituacao}
        aoCancelar={() => setMudandoSituacao(null)}
      >
        {mudandoSituacao?.ativo
          ? `“${mudandoSituacao?.nome}” deixa de aparecer para novas escolhas. Quem já está vinculado continua vinculado.`
          : `“${mudandoSituacao?.nome}” volta a aparecer para novas escolhas.`}
      </Confirmacao>

      <Confirmacao
        aberta={Boolean(excluindo)}
        titulo={`Excluir ${singular}?`}
        textoConfirmar="Excluir"
        perigo
        carregando={salvando}
        aoConfirmar={excluir}
        aoCancelar={() => setExcluindo(null)}
      >
        “{excluindo?.nome}” será excluído. Ninguém está vinculado a ele, então nenhum cadastro de pessoa é afetado.
      </Confirmacao>
    </div>
  )
}
