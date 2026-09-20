import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../contexts/AuthContext'
import TopBar from '../components/TopBar'

export default function GestaoDashboard() {
  const { perfil } = useAuth()
  const [empresa, setEmpresa] = useState(null)
  const [equipe, setEquipe] = useState([])
  const [ajustesPendentes, setAjustesPendentes] = useState([])
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    async function carregar() {
      const [{ data: emp }, { data: perfis }, { data: ajustes }] = await Promise.all([
        supabase.from('empresas').select('*').eq('id', perfil.empresa_id).single(),
        supabase.from('perfis').select('*').eq('empresa_id', perfil.empresa_id),
        supabase
          .from('ajustes_ponto')
          .select('*, perfis(nome_completo)')
          .eq('status', 'pendente'),
      ])
      setEmpresa(emp)
      setEquipe(perfis || [])
      setAjustesPendentes(ajustes || [])
      setCarregando(false)
    }
    if (perfil?.empresa_id) carregar()
  }, [perfil])

  async function analisarAjuste(id, novoStatus) {
    await supabase
      .from('ajustes_ponto')
      .update({ status: novoStatus, analisado_por: perfil.id, analisado_em: new Date().toISOString() })
      .eq('id', id)
    setAjustesPendentes((prev) => prev.filter((a) => a.id !== id))
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
        <div className="card" style={{ marginBottom: 16 }}>
          <h2>{empresa?.nome}</h2>
          <p style={{ color: 'var(--text-muted)' }}>
            Código de convite da empresa (compartilhe com RH e colaboradores):{' '}
            <strong style={{ color: 'var(--accent)' }}>{empresa?.codigo_convite}</strong>
          </p>
        </div>

        <div className="card" style={{ marginBottom: 16 }}>
          <h3>Equipe ({equipe.length})</h3>
          <table>
            <thead>
              <tr>
                <th>Nome</th>
                <th>Tipo</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {equipe.map((p) => (
                <tr key={p.id}>
                  <td>{p.nome_completo}</td>
                  <td>{p.tipo}</td>
                  <td>{p.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card">
          <h3>Solicitações pendentes ({ajustesPendentes.length})</h3>
          {ajustesPendentes.length === 0 ? (
            <p style={{ color: 'var(--text-muted)' }}>Nada pendente por aqui.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Colaborador</th>
                  <th>Tipo</th>
                  <th>Motivo</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {ajustesPendentes.map((a) => (
                  <tr key={a.id}>
                    <td>{a.perfis?.nome_completo}</td>
                    <td>{a.tipo}</td>
                    <td>{a.motivo}</td>
                    <td style={{ display: 'flex', gap: 8 }}>
                      <button className="btn-accent" onClick={() => analisarAjuste(a.id, 'aprovado')}>Aprovar</button>
                      <button className="btn-secondary" onClick={() => analisarAjuste(a.id, 'rejeitado')}>Rejeitar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  )
}
