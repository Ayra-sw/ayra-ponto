import { ShieldCheck } from 'lucide-react'
import Botao from '../ui/Botao'
import { dataHora } from '../../lib/formatos'

// Faixa do modo suporte (Fase 8B): aparece em toda a gestão enquanto a equipe
// da Ayra está ajustando os cadastros desta empresa.
export default function FaixaSuporte({ suporte, saindo, aoSair }) {
  return (
    <div className="faixa-suporte" role="status">
      <ShieldCheck aria-hidden="true" />
      <p className="faixa-suporte__texto">
        <strong>Modo suporte: {suporte.empresa_nome}</strong>, até {dataHora(suporte.ate)}.
        Você está ajustando os cadastros desta empresa. Ponto, pedidos, fechamento e assinaturas ficam com a empresa.
      </p>
      <Botao variante="secundario" carregando={saindo} onClick={aoSair}>Sair do modo suporte</Botao>
    </div>
  )
}
