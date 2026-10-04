import { useState } from 'react'
import { FileDown } from 'lucide-react'
import { useAvisos } from '../../contexts/AvisosContext'
import { baixarBytes, base64ParaBytes, chamarAssinatura } from '../../lib/assinatura'
import { nsr as formatarNsr } from '../../lib/formatos'
import Botao from '../ui/Botao'

// Baixa o Comprovante de Registro de Ponto do Trabalhador em PDF, assinado
// (PAdES) pelo servidor. Portaria 671, arts. 79 e 80.
export default function BotaoComprovantePdf({ registroId, nsr, compacto = false }) {
  const avisar = useAvisos()
  const [baixando, setBaixando] = useState(false)
  async function baixar() {
    setBaixando(true)
    const r = await chamarAssinatura({ acao: 'comprovante', registro: registroId })
    setBaixando(false)
    if (r.indisponivel) { avisar('O comprovante em PDF ainda não está disponível. Fale com o RH da sua empresa.', 'problema'); return }
    if (r.erro) { avisar(r.erro, 'problema'); return }
    baixarBytes(base64ParaBytes(r.dados.pdf), `comprovante-ponto-NSR-${String(nsr).padStart(9, '0')}.pdf`, 'application/pdf')
    avisar(r.dados.assinado ? 'Comprovante em PDF baixado, com assinatura digital.' : 'Comprovante em PDF baixado (ainda sem assinatura digital).', r.dados.assinado ? 'ok' : 'atencao')
  }
  const rotulo = `Baixar comprovante em PDF (NSR ${formatarNsr(nsr)})`
  return compacto
    ? <Botao variante="discreto" tamanho="pequeno" className="btn--icone" icone={FileDown} onClick={baixar} carregando={baixando} aria-label={rotulo} title={rotulo} />
    : <Botao variante="secundario" icone={FileDown} onClick={baixar} carregando={baixando}>Baixar comprovante em PDF</Botao>
}
