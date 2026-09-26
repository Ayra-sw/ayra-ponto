import { ShieldCheck } from 'lucide-react'
import Botao from '../ui/Botao'

// Versão do texto. Se o texto mudar, troque a versão: todos verão o aviso
// de novo e o aceite novo fica registrado.
export const VERSAO_AVISO = 'v1-2026-09'

// Aviso de privacidade do reconhecimento facial (LGPD: dado biométrico é
// dado pessoal sensível). Texto a ser validado por um advogado antes da venda.
export default function AvisoBiometria({ aoAceitar, aoRecusar, aceitando = false, textoRecusar = 'Agora não' }) {
  return (
    <div className="aviso-biometria">
      <div className="aviso-biometria__icone" aria-hidden="true"><ShieldCheck /></div>
      <h3 tabIndex={-1} data-foco-inicial>Como usamos o seu rosto</h3>
      <p className="suave">
        Sua empresa usa o reconhecimento facial para confirmar que é você quem está registrando o ponto.
        Antes de continuar, leia com atenção:
      </p>
      <dl className="aviso-biometria__itens">
        <dt>O que guardamos</dt>
        <dd>Uma foto de cadastro do seu rosto, uma foto a cada marcação de ponto e um código numérico tirado do rosto, usado só para comparar as fotos.</dd>
        <dt>Para quê</dt>
        <dd>Somente para confirmar a sua identidade no registro de ponto. Não usamos para nenhuma outra finalidade.</dd>
        <dt>Quem pode ver</dt>
        <dd>Você, o RH e os administradores da sua empresa. As fotos ficam num armazenamento privado e protegido.</dd>
        <dt>Por quanto tempo</dt>
        <dd>Pelo prazo em que a empresa é obrigada a guardar os registros de ponto.</dd>
        <dt>Seus direitos</dt>
        <dd>Você pode pedir ao RH para ver, corrigir ou saber mais sobre os seus dados, conforme a Lei Geral de Proteção de Dados (LGPD).</dd>
        <dt>Se preferir não usar</dt>
        <dd>Você continua podendo registrar o ponto normalmente. A marcação fica sem foto e o RH confere depois.</dd>
      </dl>
      <div className="acoes acoes--centro">
        <Botao onClick={aoAceitar} carregando={aceitando}>Li e concordo</Botao>
        {aoRecusar && <Botao variante="secundario" onClick={aoRecusar} disabled={aceitando}>{textoRecusar}</Botao>}
      </div>
    </div>
  )
}
