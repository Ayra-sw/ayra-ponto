import { X } from 'lucide-react'
import { data, hora, mascararCpf, nsr } from '../../lib/formatos'
import { rotuloMarcacao } from '../../lib/marcacoes'
import Etiqueta from '../ui/Etiqueta'
import Botao from '../ui/Botao'
import { EtiquetaVerificacao } from '../rosto/EtiquetaVerificacao'

// Comprovante de marcação exibido logo após cada registro (Portaria 671).
// A versão em PDF assinado (PAdES) entra na fase de conformidade.
export default function Comprovante({ registro, verificacao, perfil, unidade, empresa, aoFechar }) {
  if (!registro) return null
  const cpf = mascararCpf(perfil?.cpf)
  return (
    <section className="comprovante" aria-label="Comprovante de marcação">
      <div className="comprovante__topo">
        <Etiqueta tom="ok">{rotuloMarcacao(registro.tipo)} registrada</Etiqueta>
        {aoFechar && <Botao variante="discreto" className="btn--icone" icone={X} onClick={aoFechar} aria-label="Fechar comprovante" />}
      </div>
      <div className="comprovante__hora">{hora(registro.marcado_em, { segundos: true })}</div>
      <dl>
        <dt>Data</dt><dd>{data(registro.marcado_em)}</dd>
        <dt>NSR</dt><dd>{nsr(registro.nsr)}</dd>
        <dt>Colaborador</dt><dd>{perfil?.nome_completo || '—'}</dd>
        <dt>CPF</dt><dd>{cpf || 'não informado'}</dd>
        {empresa?.nome && (<><dt>Empresa</dt><dd>{empresa.nome}</dd></>)}
        <dt>Unidade</dt><dd>{unidade?.nome || '—'}</dd>
        {verificacao && (<><dt>Reconhecimento facial</dt><dd><EtiquetaVerificacao verificacao={verificacao} /></dd></>)}
        <dt>Código de integridade</dt><dd>{registro.hash_integridade ? `${registro.hash_integridade.slice(0, 8)}…${registro.hash_integridade.slice(-6)}` : '—'}</dd>
      </dl>
      <p className="comprovante__nota">Horário registrado pelo servidor do Ayra Ponto. {!cpf && 'Peça ao RH para cadastrar o seu CPF, que identifica você no comprovante.'}</p>
    </section>
  )
}
