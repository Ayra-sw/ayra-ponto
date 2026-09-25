import { Dialogo } from './ui/Dialogo'
import BotaoCopiar from './ui/BotaoCopiar'
import Botao from './ui/Botao'
import { linkConvite } from '../lib/convite'

// Janela com o link e o código de convite da empresa.
export default function ConvidarPessoas({ aberto, aoFechar, empresa }) {
  const codigo = empresa?.codigo_convite || ''
  const link = codigo ? linkConvite(codigo) : ''
  const mensagem = `Olá! Use este link para criar sua conta no Ayra Ponto e registrar seu ponto na ${empresa?.nome || 'empresa'}: ${link}`
  return (
    <Dialogo
      aberto={aberto}
      aoFechar={aoFechar}
      titulo="Convidar colaboradores"
      acoes={<Botao variante="secundario" onClick={aoFechar}>Fechar</Botao>}
    >
      <p className="suave">
        Envie o link por WhatsApp ou e-mail. Cada pessoa cria a própria senha e entra como <strong>colaborador</strong>, na unidade principal.
        Depois você pode mudar o papel e a unidade em Colaboradores.
      </p>
      <div className="pilha">
        <div className="campo">
          <span className="campo__rotulo">Link de convite</span>
          <input className="entrada entrada--mono" value={link} readOnly onFocus={(e) => e.target.select()} aria-label="Link de convite" />
        </div>
        <div className="acoes">
          <BotaoCopiar texto={link} rotulo="Copiar link" variante="primario" />
          <BotaoCopiar texto={mensagem} rotulo="Copiar mensagem pronta" />
        </div>
        <p className="suave pequeno">
          Se a pessoa já tiver conta, ela pode digitar o código <span className="mono"><strong>{codigo}</strong></span> ao entrar.
        </p>
      </div>
    </Dialogo>
  )
}
