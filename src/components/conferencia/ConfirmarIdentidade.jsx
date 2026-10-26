import { useEffect, useState } from 'react'
import { Fingerprint, ShieldCheck } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { aparelhoTemDigital, ativadaAqui } from '../../lib/digital'
import { confirmarIdentidade } from '../../lib/conferencia'
import Botao from '../ui/Botao'
import Alerta from '../ui/Alerta'
import { CampoSenha } from '../ui/Campo'
import { Dialogo } from '../ui/Dialogo'

// Janela "Confirme que é você": pede a digital ou a senha de novo, para ações
// que exigem confirmação recente (Central Ayra, liberar o suporte, etc.).
// O banco confere a hora da confirmação.
export default function ConfirmarIdentidade({
  aberta, aoConfirmar, aoCancelar,
  titulo = 'Confirme que é você',
  texto = 'Por segurança, peça para confirmar a sua digital ou a sua senha de novo.',
  rotuloSenha = 'Sua senha',
}) {
  const { perfil, session } = useAuth()
  const [temDigital, setTemDigital] = useState(false)
  const [usarSenha, setUsarSenha] = useState(true)
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    if (!aberta) return
    setSenha(''); setErro('')
    if (ativadaAqui()) aparelhoTemDigital().then((sim) => { setTemDigital(sim); setUsarSenha(!sim) })
  }, [aberta])

  async function confirmar(e) {
    e?.preventDefault?.()
    setErro('')
    const jeito = usarSenha ? 'senha' : 'digital'
    if (jeito === 'senha' && !senha) return setErro('Digite a sua senha.')
    setEnviando(true)
    const r = await confirmarIdentidade({ jeito, email: session?.user?.email, senha, perfilId: perfil.id })
    setEnviando(false)
    if (!r.ok) { if (r.mensagem) setErro(r.mensagem); return }
    aoConfirmar()
  }

  return (
    <Dialogo
      aberto={aberta}
      aoFechar={enviando ? undefined : aoCancelar}
      titulo={titulo}
      acoes={usarSenha ? (
        <>
          <Botao variante="secundario" onClick={aoCancelar} disabled={enviando}>Cancelar</Botao>
          <Botao type="submit" form="form-confirmar-identidade" icone={ShieldCheck} carregando={enviando}>Confirmar</Botao>
        </>
      ) : (
        <>
          <Botao variante="secundario" onClick={aoCancelar} disabled={enviando}>Cancelar</Botao>
          <Botao icone={Fingerprint} onClick={confirmar} carregando={enviando} data-foco-inicial>Confirmar com a digital</Botao>
        </>
      )}
    >
      <div className="pilha">
        <p className="suave" style={{ margin: 0 }}>{texto}</p>
        {usarSenha && (
          <form id="form-confirmar-identidade" onSubmit={confirmar} noValidate>
            <CampoSenha rotulo={rotuloSenha} value={senha} onChange={(e) => { setSenha(e.target.value); setErro('') }} autoComplete="current-password" />
          </form>
        )}
        {temDigital && (
          <button type="button" className="link conferir__trocar" onClick={() => { setUsarSenha((x) => !x); setErro('') }} disabled={enviando}>
            {usarSenha ? 'Usar a digital' : 'Usar a senha'}
          </button>
        )}
        {erro && <Alerta tom="problema">{erro}</Alerta>}
      </div>
    </Dialogo>
  )
}
