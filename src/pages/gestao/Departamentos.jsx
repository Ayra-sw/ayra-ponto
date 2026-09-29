import { useCallback, useEffect, useMemo, useState } from 'react'
import { Network, UserRoundCog } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../contexts/AuthContext'
import { useAvisos } from '../../contexts/AvisosContext'
import { traduzirErro } from '../../lib/mensagensErro'
import { PAPEL } from '../../lib/rotulos'
import CadastroSimples from '../../components/CadastroSimples'
import Botao from '../../components/ui/Botao'
import Alerta from '../../components/ui/Alerta'
import { PainelLateral } from '../../components/ui/Dialogo'

// Departamentos e os gestores de cada um (quem acompanha a equipe e aprova os pedidos dela).
export default function Departamentos() {
  const { perfil } = useAuth()
  const avisar = useAvisos()
  const [gestores, setGestores] = useState([])     // { departamento_id, perfil_id }
  const [pessoas, setPessoas] = useState([])
  const [indisponivel, setIndisponivel] = useState(false)
  const [editando, setEditando] = useState(null)   // departamento
  const [versao, setVersao] = useState(0)

  const carregar = useCallback(async () => {
    const [g, p] = await Promise.all([
      supabase.from('departamento_gestores').select('departamento_id, perfil_id'),
      supabase.from('perfis').select('id, nome_completo, tipo, status, departamento_id').eq('empresa_id', perfil.empresa_id).order('nome_completo'),
    ])
    setIndisponivel(Boolean(g.error))
    setGestores(g.data || [])
    setPessoas(p.data || [])
  }, [perfil.empresa_id])

  useEffect(() => { carregar() }, [carregar])

  const nomePor = useMemo(() => Object.fromEntries(pessoas.map((p) => [p.id, p.nome_completo])), [pessoas])
  const gestoresDe = (depId) => gestores.filter((g) => g.departamento_id === depId).map((g) => nomePor[g.perfil_id]).filter(Boolean)

  return (
    <>
      <CadastroSimples
        tabela="departamentos" coluna="departamento_id" trilha="Pessoas" titulo="Departamentos"
        subtitulo="Os setores da empresa. O gestor de cada departamento acompanha a equipe e aprova os pedidos dela."
        singular="departamento" icone={Network} versao={versao}
        textoVazio="Departamentos organizam a equipe e definem quem cada gestor acompanha."
        exemploNome="Ex.: Vendas" exemploDescricao="Ex.: Equipe comercial e atendimento"
        colunaExtra={indisponivel ? undefined : {
          titulo: 'Gestores',
          render: (item) => {
            const nomes = gestoresDe(item.id)
            return nomes.length ? nomes.join(', ') : <span className="suave">Sem gestor</span>
          },
        }}
        acaoExtra={indisponivel ? undefined : (item) => (
          <Botao variante="secundario" tamanho="pequeno" icone={UserRoundCog} onClick={() => setEditando(item)}>Gestores</Botao>
        )}
      />
      {editando && (
        <EditorGestores
          departamento={editando} pessoas={pessoas}
          atuais={gestores.filter((g) => g.departamento_id === editando.id).map((g) => g.perfil_id)}
          aoFechar={() => setEditando(null)}
          aoSalvo={() => { setEditando(null); carregar(); setVersao((v) => v + 1); avisar('Gestores atualizados.') }}
        />
      )}
    </>
  )
}

function EditorGestores({ departamento, pessoas, atuais, aoFechar, aoSalvo }) {
  const [escolhidos, setEscolhidos] = useState(() => new Set(atuais))
  const [termo, setTermo] = useState('')
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)

  const candidatas = pessoas.filter((p) => p.status !== 'desligado' || escolhidos.has(p.id))
  const t = termo.trim().toLowerCase()
  const visiveis = candidatas.filter((p) => !t || (p.nome_completo || '').toLowerCase().includes(t))
  const naEquipe = pessoas.filter((p) => p.departamento_id === departamento.id && p.status !== 'desligado').length

  function alternar(id) {
    setErro('')
    setEscolhidos((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })
  }

  async function salvar() {
    const entrar = [...escolhidos].filter((id) => !atuais.includes(id))
    const sair = atuais.filter((id) => !escolhidos.has(id))
    if (!entrar.length && !sair.length) return aoFechar()
    setSalvando(true)
    let falha = null
    if (entrar.length) {
      const r = await supabase.from('departamento_gestores').insert(entrar.map((perfil_id) => ({ departamento_id: departamento.id, perfil_id })))
      falha = r.error
    }
    if (!falha && sair.length) {
      const r = await supabase.from('departamento_gestores').delete().eq('departamento_id', departamento.id).in('perfil_id', sair)
      falha = r.error
    }
    setSalvando(false)
    if (falha) return setErro(traduzirErro(falha))
    aoSalvo()
  }

  return (
    <PainelLateral
      aberto aoFechar={aoFechar}
      titulo={`Gestores de ${departamento.nome}`}
      subtitulo={`${naEquipe} ${naEquipe === 1 ? 'pessoa' : 'pessoas'} no departamento. Pode haver mais de um gestor.`}
      rodape={
        <>
          <Botao variante="secundario" onClick={aoFechar}>Cancelar</Botao>
          <Botao onClick={salvar} carregando={salvando}>Salvar gestores</Botao>
        </>
      }
    >
      <div className="formulario">
        <Alerta tom="info">
          O gestor vê o espelho, as marcações, o banco de horas e a escala de quem é do departamento, e aprova ou recusa os pedidos de ajuste e folga.
          Não vê CPF nem telefone, não abre atestados e não mexe em cadastros. Os abonos continuam com o RH.
        </Alerta>
        <div className="campo campo--busca">
          <label className="campo__rotulo" htmlFor="busca-gestor">Buscar pessoa</label>
          <input id="busca-gestor" className="entrada" type="search" placeholder="Nome" value={termo} onChange={(e) => setTermo(e.target.value)} />
        </div>
        <fieldset className="opcoes" style={{ border: 'none', padding: 0, margin: 0 }}>
          <legend className="campo__rotulo">Quem é gestor deste departamento?</legend>
          {visiveis.length === 0 && <p className="suave pequeno">Ninguém encontrado.</p>}
          {visiveis.map((p) => (
            <label key={p.id} className="opcao" style={{ alignItems: 'center' }}>
              <input type="checkbox" checked={escolhidos.has(p.id)} onChange={() => alternar(p.id)} />
              <span>
                <span className="opcao__titulo">{p.nome_completo || 'Sem nome'}</span><br />
                <span className="opcao__desc">
                  {PAPEL[p.tipo]}{p.departamento_id === departamento.id ? ' · é deste departamento' : ''}{p.status === 'desligado' ? ' · desligada(o)' : ''}
                </span>
              </span>
            </label>
          ))}
        </fieldset>
        {erro && <Alerta tom="problema">{erro}</Alerta>}
      </div>
    </PainelLateral>
  )
}
