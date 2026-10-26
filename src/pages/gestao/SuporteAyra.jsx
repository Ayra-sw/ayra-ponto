import { useCallback, useEffect, useRef, useState } from 'react'
import { LifeBuoy, ShieldCheck } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../contexts/AuthContext'
import { useAvisos } from '../../contexts/AvisosContext'
import { traduzirErro } from '../../lib/mensagensErro'
import { dataHora } from '../../lib/formatos'
import { pedeConfirmacao } from '../../lib/central'
import ConfirmarIdentidade from '../../components/conferencia/ConfirmarIdentidade'
import Botao from '../../components/ui/Botao'
import Alerta from '../../components/ui/Alerta'
import Etiqueta from '../../components/ui/Etiqueta'
import { Confirmacao } from '../../components/ui/Dialogo'
import { Esqueleto, EstadoErro } from '../../components/ui/Estados'

const PRAZOS = [1, 3, 7]

const TEXTO_EVENTO = {
  liberou: (e) => `${e.quem} liberou o suporte por ${e.detalhe?.dias === 1 ? '1 dia' : `${e.detalhe?.dias} dias`}`,
  encerrou: (e) => `${e.quem} encerrou o suporte`,
  entrou: () => 'A equipe da Ayra entrou no suporte',
  saiu: () => 'A equipe da Ayra saiu do suporte',
}

// Suporte da Ayra (Fase 8B): a empresa libera, por um prazo, a equipe da Ayra para
// ajustar cadastros. Só o administrador libera e encerra; o RH só acompanha.
export default function SuporteAyra() {
  const { perfil, suporte } = useAuth()
  const avisar = useAvisos()
  const podeAgir = perfil.tipo === 'administrador'
  const [s, setS] = useState(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erroAcao, setErroAcao] = useState('')
  const [encerrar, setEncerrar] = useState(false)
  const [confirmando, setConfirmando] = useState(false)
  const pendente = useRef(null)

  const carregar = useCallback(async () => {
    setErro(''); setCarregando(true)
    const r = await supabase.rpc('suporte_da_empresa')
    if (r.error) setErro(traduzirErro(r.error))
    else setS(r.data)
    setCarregando(false)
  }, [])

  useEffect(() => { if (!suporte) carregar(); else setCarregando(false) }, [carregar, suporte])

  // Liberar pede a digital ou a senha de novo: abre a janela e tenta de novo
  const comConfirmacao = useCallback(async (fazer) => {
    const r = await fazer()
    if (!pedeConfirmacao(r.error)) return r
    const ok = await new Promise((resolve) => { pendente.current = resolve; setConfirmando(true) })
    if (!ok) return { data: null, error: { message: 'cancelada', cancelada: true } }
    return fazer()
  }, [])

  function fecharConfirmacao(ok) {
    setConfirmando(false)
    pendente.current?.(ok)
    pendente.current = null
  }

  async function liberar(dias) {
    setSalvando(true); setErroAcao('')
    const r = await comConfirmacao(() => supabase.rpc('suporte_liberar', { p_dias: dias }))
    setSalvando(false)
    if (r.error) { if (!r.error.cancelada) setErroAcao(traduzirErro(r.error)); return }
    avisar(`Suporte liberado por ${dias === 1 ? '1 dia' : `${dias} dias`}. Você pode encerrar quando quiser.`)
    carregar()
  }

  async function encerrarAgora() {
    setSalvando(true); setErroAcao('')
    const r = await supabase.rpc('suporte_encerrar')
    setSalvando(false)
    setEncerrar(false)
    if (r.error) return setErroAcao(traduzirErro(r.error))
    avisar('Suporte encerrado. A equipe da Ayra não tem mais acesso à empresa.')
    carregar()
  }

  const cabecalho = (
    <div className="pagina__cabecalho">
      <div className="pagina__titulo">
        <span className="pagina__trilha">Configurações</span>
        <h1>Suporte da Ayra</h1>
        <p className="suave">Quando você precisa de ajuda para ajustar cadastros, a equipe da Ayra pode entrar por um prazo que você escolhe.</p>
      </div>
    </div>
  )

  if (suporte) {
    return (
      <div className="pagina" style={{ maxWidth: 820 }}>
        {cabecalho}
        <Alerta tom="info" titulo="Você está no modo suporte">Esta tela fica fechada enquanto o suporte está usando a empresa.</Alerta>
      </div>
    )
  }

  if (carregando) return <div className="pagina" style={{ maxWidth: 820 }}>{cabecalho}<Esqueleto blocos={2} linhas={3} /></div>
  if (erro || !s) return <div className="pagina" style={{ maxWidth: 820 }}>{cabecalho}<EstadoErro aoTentarDeNovo={carregar}>{erro || 'Não conseguimos carregar esta informação.'}</EstadoErro></div>

  return (
    <div className="pagina" style={{ maxWidth: 820 }}>
      {cabecalho}

      {erroAcao && <Alerta tom="problema">{erroAcao}</Alerta>}

      <section className="cartao" aria-labelledby="t-suporte">
        <div className="cartao__cabecalho"><h2 id="t-suporte">Como funciona</h2></div>
        <p style={{ margin: 0 }}>
          O suporte pode <strong>ver e ajustar cadastros</strong>: pessoas, unidades, departamentos, cargos, jornadas, escalas, feriados, regras de cálculo e os dados da empresa.
        </p>
        <p className="suave" style={{ margin: 0 }}>
          Ele <strong>não bate ponto, não aprova nem recusa pedidos, não fecha nem reabre o mês, não assina nada e não muda o tipo de acesso das pessoas</strong>. Tudo o que ele faz fica no histórico de alterações, marcado como Suporte Ayra. Você pode encerrar quando quiser.
        </p>
      </section>

      <section className="cartao" aria-labelledby="t-estado">
        <div className="cartao__cabecalho"><h2 id="t-estado">Agora</h2></div>
        {s.liberado ? (
          <>
            <Etiqueta tom={s.conectado ? 'atencao' : 'ok'}>{s.conectado ? 'Suporte usando a empresa agora' : 'Liberado, ainda sem uso'}</Etiqueta>
            <p style={{ margin: 0 }}>
              Liberado por {s.liberado_nome || 'a administração'} até <strong>{dataHora(s.ate)}</strong>.
            </p>
            {podeAgir && (
              <div className="acoes">
                <Botao variante="perigo" icone={ShieldCheck} onClick={() => setEncerrar(true)} disabled={salvando}>Encerrar agora</Botao>
              </div>
            )}
          </>
        ) : (
          <>
            <Etiqueta tom="neutra">Não liberado</Etiqueta>
            {podeAgir ? (
              <>
                <p className="suave" style={{ margin: 0 }}>Escolha por quanto tempo a equipe da Ayra pode entrar. Vamos pedir a sua digital ou a sua senha para confirmar.</p>
                <div className="acoes">
                  {PRAZOS.map((dias) => (
                    <Botao key={dias} variante="secundario" icone={LifeBuoy} onClick={() => liberar(dias)} disabled={salvando}>
                      {dias === 1 ? '1 dia' : `${dias} dias`}
                    </Botao>
                  ))}
                </div>
              </>
            ) : (
              <p className="suave" style={{ margin: 0 }}>Só o administrador da empresa pode liberar ou encerrar o suporte.</p>
            )}
          </>
        )}
      </section>

      <section className="cartao" aria-labelledby="t-historico">
        <div className="cartao__cabecalho"><h2 id="t-historico">Histórico do suporte</h2></div>
        {s.eventos?.length ? (
          <ul className="central-registro">
            {s.eventos.map((e, i) => (
              <li key={i}>
                <span>{(TEXTO_EVENTO[e.acao] || (() => e.acao))(e)}</span>
                <span className="suave pequeno">{dataHora(e.em)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="suave" style={{ margin: 0 }}>Ainda não houve suporte nesta empresa.</p>
        )}
      </section>

      <Confirmacao
        aberta={encerrar}
        titulo="Encerrar o suporte agora?"
        textoConfirmar="Encerrar"
        perigo
        carregando={salvando}
        aoConfirmar={encerrarAgora}
        aoCancelar={() => setEncerrar(false)}
      >
        A equipe da Ayra perde o acesso à sua empresa na hora. O que já foi ajustado continua como está.
      </Confirmacao>

      <ConfirmarIdentidade
        aberta={confirmando}
        aoConfirmar={() => fecharConfirmacao(true)}
        aoCancelar={() => fecharConfirmacao(false)}
        texto="Para liberar o suporte, confirme que é você com a sua digital ou a sua senha."
        rotuloSenha="Sua senha"
      />
    </div>
  )
}
