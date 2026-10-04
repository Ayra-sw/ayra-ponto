import { useState } from 'react'
import { Download, Share, SquarePlus, Smartphone } from 'lucide-react'
import { useInstalarApp, ehCelular } from '../../lib/pwa'
import useMarcos from '../../hooks/useMarcos'
import Botao from '../ui/Botao'
import { Dialogo } from '../ui/Dialogo'

function PassosIphone() {
  return (
    <ol className="artigo__passos">
      <li>Abra o Ayra Ponto no <strong>Safari</strong>.</li>
      <li>Toque em <strong>Compartilhar</strong> <Share aria-label="(ícone de quadrado com seta para cima)" className="icone-inline" />, na barra de baixo.</li>
      <li>Role e toque em <strong>Adicionar à Tela de Início</strong> <SquarePlus aria-hidden="true" className="icone-inline" />.</li>
      <li>Toque em <strong>Adicionar</strong>. O ícone do Ayra Ponto aparece na tela do celular.</li>
    </ol>
  )
}

// Cartão de Minha conta: sempre explica como ter o app no celular.
export function CartaoInstalarApp() {
  const app = useInstalarApp()
  return (
    <section className="cartao" aria-labelledby="t-app">
      <div className="cartao__cabecalho"><h2 id="t-app">App no celular</h2></div>
      {app.instalado ? (
        <p className="suave pequeno" style={{ margin: 0 }}>Você já está usando o app instalado. Para abrir, toque no ícone do Ayra Ponto na tela do celular.</p>
      ) : (
        <div className="pilha">
          <p className="suave pequeno" style={{ margin: 0 }}>
            Instale o Ayra Ponto na tela inicial: ele abre em tela cheia, como um aplicativo, sem precisar procurar o site.
            Para bater o ponto, o celular precisa estar com internet.
          </p>
          {app.podeInstalar ? (
            <div><Botao icone={Download} onClick={app.instalar}>Instalar o app</Botao></div>
          ) : app.iphone ? (
            <PassosIphone />
          ) : (
            <ul className="artigo__lista">
              <li><strong>Android:</strong> abra o site no <strong>Chrome</strong>, toque nos três pontinhos e em <strong>Instalar app</strong> (ou <strong>Adicionar à tela inicial</strong>).</li>
              <li><strong>iPhone:</strong> abra no <strong>Safari</strong>, toque em <strong>Compartilhar</strong> e em <strong>Adicionar à Tela de Início</strong>.</li>
            </ul>
          )}
        </div>
      )}
    </section>
  )
}

// Convite discreto na tela Início do celular. "Agora não" vale para sempre.
export function ConviteInstalarApp() {
  const app = useInstalarApp()
  const marcos = useMarcos()
  const [comoFazer, setComoFazer] = useState(false)
  const [fechado, setFechado] = useState(false)
  const mostrar = !fechado && !app.instalado && ehCelular() && (app.podeInstalar || app.iphone) &&
    marcos.disponivel && marcos.tem('boas_vindas') && !marcos.tem('instalar_app_dispensado')
  if (!mostrar) return null
  function dispensar() { setFechado(true); marcos.marcar('instalar_app_dispensado') }
  async function instalar() {
    if (app.podeInstalar) { if (await app.instalar()) dispensar() } else setComoFazer(true)
  }
  return (
    <>
      <section className="convite-app" aria-label="Instalar o app">
        <Smartphone aria-hidden="true" />
        <p><strong>Tenha o Ayra Ponto na tela do celular.</strong> Abre mais rápido, como um aplicativo.</p>
        <div className="convite-app__acoes">
          <Botao tamanho="pequeno" onClick={instalar}>{app.podeInstalar ? 'Instalar' : 'Como instalar'}</Botao>
          <Botao tamanho="pequeno" variante="discreto" onClick={dispensar}>Agora não</Botao>
        </div>
      </section>
      <Dialogo aberto={comoFazer} aoFechar={() => setComoFazer(false)} titulo="Instalar no iPhone"
        acoes={<Botao onClick={() => { setComoFazer(false); dispensar() }}>Entendi</Botao>}>
        <PassosIphone />
      </Dialogo>
    </>
  )
}
