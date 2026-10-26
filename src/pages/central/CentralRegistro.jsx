import { useCallback, useEffect, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { ScrollText } from 'lucide-react'
import { traduzirErro } from '../../lib/mensagensErro'
import { dataHora } from '../../lib/formatos'
import { textoDoRegistro } from '../../lib/central'
import { Esqueleto, EstadoErro, EstadoVazio } from '../../components/ui/Estados'

// Tudo o que a Central fez, do mais novo para o mais antigo.
export default function CentralRegistro() {
  const { chamar } = useOutletContext()
  const [lista, setLista] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')

  const carregar = useCallback(async () => {
    setErro(''); setCarregando(true)
    const r = await chamar('central_registro', { p_limite: 300 })
    if (r.error) setErro(r.error.cancelada ? 'Para ver o registro, confirme que é você.' : traduzirErro(r.error))
    else setLista(Array.isArray(r.data) ? r.data : [])
    setCarregando(false)
  }, [chamar])

  useEffect(() => { carregar() }, [carregar])

  return (
    <div className="pagina" style={{ maxWidth: 900 }}>
      <div className="pagina__cabecalho">
        <div className="pagina__titulo">
          <span className="pagina__trilha">Central Ayra</span>
          <h1>Registro</h1>
          <p className="suave">Tudo o que foi feito pela Central: suspensões, liberações, links de senha e mudanças no contato do suporte.</p>
        </div>
      </div>
      {carregando ? <Esqueleto linhas={6} /> : erro ? <EstadoErro aoTentarDeNovo={carregar}>{erro}</EstadoErro> : lista.length === 0 ? (
        <EstadoVazio icone={ScrollText} titulo="Nada registrado ainda">Quando você suspender, liberar ou ajudar alguém a entrar, aparece aqui.</EstadoVazio>
      ) : (
        <section className="cartao">
          <ul className="central-registro">
            {lista.map((r, i) => (
              <li key={i}>
                <span>
                  {textoDoRegistro(r)}
                  {r.empresa_id && <> · <Link className="link" to={`/central/empresas/${r.empresa_id}`}>{r.empresa_nome || 'empresa'}</Link></>}
                </span>
                <span className="suave pequeno">{dataHora(r.em)}{r.dono_nome ? ` · ${r.dono_nome}` : ''}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
