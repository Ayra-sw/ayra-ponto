import { useCallback, useEffect, useState } from 'react'
import { Fingerprint, Trash2 } from 'lucide-react'
import { useAvisos } from '../../contexts/AvisosContext'
import { data as formatarData } from '../../lib/formatos'
import {
  aparelhoTemDigital, ativarDigital, listarDigitais, marcarAtivadaAqui, nomeDoAparelho, removerDigital,
} from '../../lib/digital'
import Botao from '../ui/Botao'
import Alerta from '../ui/Alerta'
import { Confirmacao } from '../ui/Dialogo'

// Minha conta: ligar a entrada com a digital neste aparelho e ver/remover os
// aparelhos já ligados. Se o recurso não estiver ligado no Supabase, o cartão
// não aparece.
export default function EntrarComDigital() {
  const avisar = useAvisos()
  const [lista, setLista] = useState(null) // null = carregando ou indisponível
  const [suporta, setSuporta] = useState(false)
  const [ativando, setAtivando] = useState(false)
  const [erro, setErro] = useState('')
  const [remover, setRemover] = useState(null)
  const [removendo, setRemovendo] = useState(false)
  const [indisponivel, setIndisponivel] = useState(false)

  const carregar = useCallback(async () => {
    const r = await listarDigitais()
    if (r.desligado) { setIndisponivel(true); return }
    setLista(r.lista || [])
  }, [])

  useEffect(() => {
    carregar()
    aparelhoTemDigital().then(setSuporta)
  }, [carregar])

  if (indisponivel || lista === null) return null

  async function ativar() {
    setErro('')
    setAtivando(true)
    const r = await ativarDigital()
    setAtivando(false)
    if (!r.ok) { if (r.mensagem) setErro(r.mensagem); await carregar(); return }
    await carregar()
    avisar('Digital ativada. Na próxima vez, toque em "Entrar com a digital".')
  }

  async function confirmarRemocao() {
    setRemovendo(true)
    const r = await removerDigital(remover.id)
    setRemovendo(false)
    setRemover(null)
    if (!r.ok) return setErro(r.mensagem)
    const nova = (lista || []).filter((x) => x.id !== remover.id)
    setLista(nova)
    if (nova.length === 0) marcarAtivadaAqui(false)
    avisar('Aparelho removido. Ele não entra mais com a digital.')
  }

  return (
    <section className="cartao" aria-labelledby="t-digital">
      <div className="cartao__cabecalho"><h2 id="t-digital">Entrar com a digital</h2></div>
      <div className="pilha">
        <p className="suave pequeno" style={{ margin: 0 }}>
          Entre sem digitar a senha, com a digital ou o rosto, do mesmo jeito que você desbloqueia o celular.
          <strong> O Ayra Ponto não vê nem guarda a sua digital</strong>: quem confere é o próprio aparelho. A senha continua valendo.
        </p>

        {lista.length > 0 && (
          <ul className="lista-digitais" aria-label="Aparelhos com a digital ativada">
            {lista.map((d) => (
              <li key={d.id}>
                <Fingerprint aria-hidden="true" />
                <span className="lista-digitais__texto">
                  <strong>{nomeDoAparelho(d.friendly_name)}</strong>
                  <span className="suave pequeno">
                    Ativada em {formatarData(d.created_at)}{d.last_used_at ? ` · último uso em ${formatarData(d.last_used_at)}` : ''}
                  </span>
                </span>
                <Botao variante="discreto" tamanho="pequeno" icone={Trash2} onClick={() => setRemover(d)}
                  aria-label={`Remover ${nomeDoAparelho(d.friendly_name)}`}>Remover</Botao>
              </li>
            ))}
          </ul>
        )}

        {suporta ? (
          <div>
            <Botao icone={Fingerprint} variante={lista.length ? 'secundario' : 'primario'} onClick={ativar} carregando={ativando}>
              {lista.length ? 'Ativar também neste aparelho' : 'Ativar a digital neste aparelho'}
            </Botao>
          </div>
        ) : (
          <p className="suave pequeno" style={{ margin: 0 }}>
            Este aparelho ou navegador não permite usar a digital. Abra o Ayra Ponto no seu celular para ativar.
          </p>
        )}
        {erro && <Alerta tom="atencao">{erro}</Alerta>}
        <p className="suave pequeno" style={{ margin: 0 }}>Ative só no <strong>seu</strong> celular: qualquer digital cadastrada nele consegue entrar na sua conta.</p>
      </div>

      <Confirmacao
        aberta={Boolean(remover)}
        titulo="Remover este aparelho?"
        textoConfirmar="Remover"
        perigo
        carregando={removendo}
        aoConfirmar={confirmarRemocao}
        aoCancelar={() => setRemover(null)}
      >
        {remover && <><strong>{nomeDoAparelho(remover.friendly_name)}</strong> não vai mais entrar com a digital. Para voltar a usar, é só ativar de novo.</>}
      </Confirmacao>
    </section>
  )
}
