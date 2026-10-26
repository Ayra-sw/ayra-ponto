import { useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { Mail, MessageCircle, Save } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { useAvisos } from '../../contexts/AvisosContext'
import { traduzirErro } from '../../lib/mensagensErro'
import { formatarTelefone } from '../../lib/formatos'
import { SUPORTE } from '../../lib/suporte'
import Botao from '../../components/ui/Botao'
import Alerta from '../../components/ui/Alerta'
import { Campo } from '../../components/ui/Campo'
import { Esqueleto } from '../../components/ui/Estados'

const soDigitos = (v) => String(v || '').replace(/\D/g, '')

// WhatsApp e e-mail do suporte: aparecem na Central de ajuda de todos os clientes
// e no aviso de empresa suspensa.
export default function CentralContato() {
  const { chamar } = useOutletContext()
  const avisar = useAvisos()
  const [zap, setZap] = useState('')
  const [email, setEmail] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [erros, setErros] = useState({})
  const [erro, setErro] = useState('')

  useEffect(() => {
    supabase.from('plataforma_config').select('whatsapp, email').eq('id', 1).maybeSingle().then(({ data }) => {
      setZap(data?.whatsapp ? formatarTelefone(data.whatsapp) : '')
      setEmail(data?.email || '')
      setCarregando(false)
    })
  }, [])

  async function salvar(e) {
    e.preventDefault()
    setErro('')
    const d = soDigitos(zap)
    const x = {}
    if (d && !(d.length === 10 || d.length === 11)) x.zap = 'Use o DDD e o número, como (41) 99999-8888.'
    if (email.trim() && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) x.email = 'Confira o e-mail.'
    setErros(x)
    if (Object.keys(x).length) return
    setSalvando(true)
    const r = await chamar('central_salvar_contato', { p_whatsapp: d || null, p_email: email.trim() || null })
    setSalvando(false)
    if (r.error) return setErro(r.error.cancelada ? '' : traduzirErro(r.error))
    SUPORTE.whatsapp = d
    SUPORTE.email = email.trim().toLowerCase()
    avisar('Contato do suporte salvo. Já aparece para todos os clientes.')
  }

  return (
    <div className="pagina" style={{ maxWidth: 720 }}>
      <div className="pagina__cabecalho">
        <div className="pagina__titulo">
          <span className="pagina__trilha">Central Ayra</span>
          <h1>Contato do suporte</h1>
          <p className="suave">Aparece na Central de ajuda de todos os clientes e no aviso de empresa suspensa.</p>
        </div>
      </div>
      {carregando ? <Esqueleto linhas={3} /> : (
        <form className="cartao formulario" onSubmit={salvar} noValidate>
          <Campo rotulo="WhatsApp do suporte" inputMode="tel" placeholder="(41) 99999-8888" value={zap}
            onChange={(e) => { setZap(formatarTelefone(e.target.value)); setErros((x) => ({ ...x, zap: '' })) }} erro={erros.zap}
            ajuda="Com DDD. O botão abre uma conversa já com o nome da empresa do cliente." />
          <Campo rotulo="E-mail do suporte" type="email" inputMode="email" placeholder="suporte@ayra.com.br" value={email}
            onChange={(e) => { setEmail(e.target.value); setErros((x) => ({ ...x, email: '' })) }} erro={erros.email} />
          {!soDigitos(zap) && !email.trim() && (
            <Alerta tom="atencao">Sem contato, os clientes não veem botão de suporte na ajuda.</Alerta>
          )}
          <div className="suporte suporte--previa" aria-label="Como o cliente vê">
            <strong>Como o cliente vê</strong>
            <p className="suave pequeno">Fale com o suporte do Ayra Ponto.</p>
            <div className="linha">
              {soDigitos(zap) && <span className="btn btn--secundario btn--pequeno" aria-hidden="true"><MessageCircle /> WhatsApp</span>}
              {email.trim() && <span className="btn btn--secundario btn--pequeno" aria-hidden="true"><Mail /> E-mail</span>}
            </div>
          </div>
          {erro && <Alerta tom="problema">{erro}</Alerta>}
          <div className="acoes"><Botao type="submit" icone={Save} carregando={salvando}>Salvar contato</Botao></div>
        </form>
      )}
    </div>
  )
}
