import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../contexts/AuthContext'
import { traduzirErro } from '../lib/mensagensErro'
import TopBar from '../components/TopBar'

// Nomes que aparecem na tela (o banco guarda os códigos internos).
const PAPEL = { administrador: 'Administrador', rh: 'RH', funcionario: 'Colaborador' }
const SITUACAO = { ativo: 'Ativo', afastado: 'Afastado', desligado: 'Desligado' }
const TIPO_SOLICITACAO = {
  correcao_marcacao: 'Correção de marcação',
  abono: 'Abono',
  folga: 'Folga',
  inclusao_esquecida: 'Marcação esquecida',
}

function formatarDataHora(valor) {
  if (!valor) return '—'
  return new Date(valor).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

export default function GestaoDashboard() {
  const { perfil } = useAuth()
  const [empresa, setEmpresa] = useState(null)
  const [equipe, setEquipe] = useState([])
  const [ajustesPendentes, setAjustesPendentes] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState('')
  const [confirmando, setConfirmando] = useState(null) // { id, status }
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    async function carregar() {
      setErro('')
      const [emp, perfis, ajustes] = await Promise.all([
        supabase.from('empresas').select('*').eq('id', perfil.empresa_id).single(),
        supabase.from('perfis').select('*').eq('empresa_id', perfil.empresa_id).order('nome_completo'),
        // ajustes_ponto tem duas ligações com perfis (quem pediu e quem analisou);
        // aqui indicamos a de quem pediu.
        supabase
          .from('ajustes_ponto')
          .select('*, solicitante:perfis!ajustes_ponto_perfil_id_fkey(nome_completo)')
          .eq('status', 'pendente')
          .order('criado_em', { ascending: true }),
      ])
      const falha = emp.error || perfis.error || ajustes.error
      if (falha) setErro(traduzirErro(falha, 'Não conseguimos carregar todas as informações. Atualize a página.'))
      setEmpresa(emp.data)
      setEquipe(perfis.data || [])
      setAjustesPendentes(ajustes.data || [])
      setCarregando(false)
    }
    if (perfil?.empresa_id) carregar()
  }, [perfil])

  async function analisarAjuste(id, novoStatus) {
    setErro('')
    setAviso('')
    setSalvando(true)
    // quem analisou e quando são preenchidos pelo próprio banco
    const { data, error } = await supabase
      .from('ajustes_ponto')
      .update({ status: novoStatus })
      .eq('id', id)
      .select('id')
    setSalvando(false)
    setConfirmando(null)

    if (error) {
      setErro(traduzirErro(error))
      return
    }
    if (!data || data.length === 0) {
      setErro('Não foi possível analisar esta solicitação. Ela pode já ter sido analisada por outra pessoa.')
      return
    }
    setAjustesPendentes((prev) => prev.filter((a) => a.id !== id))
    setAviso(novoStatus === 'aprovado' ? 'Solicitação aprovada.' : 'Solicitação recusada.')
  }

  if (carregando) {
    return (
      <>
        <TopBar />
        <div className="container container--wide">Carregando…</div>
      </>
    )
  }

  return (
    <>
      <TopBar />
      <div className="container container--wide">
        {erro && <p className="error-text" role="alert" style={{ marginTop: 0 }}>{erro}</p>}
        {aviso && <p role="status" style={{ color: 'var(--success)', fontWeight: 600, marginTop: 0 }}>{aviso}</p>}

        <div className="card" style={{ marginBottom: 16 }}>
          <h2>{empresa?.nome}</h2>
          <p style={{ color: 'var(--text-muted)' }}>
            Código de convite da empresa (compartilhe com RH e colaboradores):{' '}
            <strong style={{ color: 'var(--accent)' }}>{empresa?.codigo_convite}</strong>
          </p>
        </div>

        <div className="card" style={{ marginBottom: 16 }}>
          <h3>Equipe ({equipe.length})</h3>
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Papel</th>
                  <th>Situação</th>
                </tr>
              </thead>
              <tbody>
                {equipe.map((p) => (
                  <tr key={p.id}>
                    <td>{p.nome_completo || '—'}</td>
                    <td>{PAPEL[p.tipo] || p.tipo}</td>
                    <td>{SITUACAO[p.status] || p.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <h3>Solicitações pendentes ({ajustesPendentes.length})</h3>
          {ajustesPendentes.length === 0 ? (
            <p style={{ color: 'var(--text-muted)' }}>Nada pendente por aqui.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>Colaborador</th>
                    <th>Tipo</th>
                    <th>Horário pedido</th>
                    <th>Motivo</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {ajustesPendentes.map((a) => {
                    const ehMinha = a.perfil_id === perfil.id
                    const emConfirmacao = confirmando?.id === a.id
                    return (
                      <tr key={a.id}>
                        <td>{a.solicitante?.nome_completo || '—'}</td>
                        <td>{TIPO_SOLICITACAO[a.tipo] || a.tipo}</td>
                        <td>{formatarDataHora(a.marcacao_solicitada)}</td>
                        <td>{a.motivo}</td>
                        <td>
                          {ehMinha ? (
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                              Sua solicitação: outra pessoa precisa analisar
                            </span>
                          ) : emConfirmacao ? (
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                              <span style={{ fontSize: '0.85rem' }}>
                                {confirmando.status === 'aprovado' ? 'Aprovar' : 'Recusar'}? Não dá para desfazer.
                              </span>
                              <button className="btn-accent" disabled={salvando} onClick={() => analisarAjuste(a.id, confirmando.status)}>
                                {salvando ? 'Salvando…' : 'Confirmar'}
                              </button>
                              <button className="btn-secondary" disabled={salvando} onClick={() => setConfirmando(null)}>
                                Voltar
                              </button>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                              <button className="btn-accent" onClick={() => setConfirmando({ id: a.id, status: 'aprovado' })}>Aprovar</button>
                              <button className="btn-secondary" onClick={() => setConfirmando({ id: a.id, status: 'rejeitado' })}>Recusar</button>
                            </div>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
