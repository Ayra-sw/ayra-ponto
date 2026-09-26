import { useCallback, useState } from 'react'
import { CircleCheck, RefreshCw } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../contexts/AuthContext'
import { traduzirErro } from '../../lib/mensagensErro'
import { MOTOR, novoNomeArquivo } from '../../lib/rosto'
import { PainelLateral } from '../ui/Dialogo'
import Botao from '../ui/Botao'
import Alerta from '../ui/Alerta'
import AvisoBiometria, { VERSAO_AVISO } from './AvisoBiometria'
import CameraRosto from './CameraRosto'

// Cadastro (ou troca) da foto do rosto: aviso de privacidade → câmera →
// conferir a foto → enviar. A foto fica aguardando aprovação do RH.
export default function CadastroRosto({ aberto, aceitou, aoFechar, aoConcluir }) {
  const { perfil } = useAuth()
  const [etapa, setEtapa] = useState(aceitou ? 'camera' : 'aviso') // aviso | camera | conferir | enviado
  const [captura, setCaptura] = useState(null)
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState('')

  const aoCapturar = useCallback((c) => { setCaptura(c); setEtapa('conferir') }, [])

  async function aceitar() {
    setOcupado(true)
    setErro('')
    const { error } = await supabase.rpc('aceitar_aviso_biometria', { p_versao: VERSAO_AVISO })
    setOcupado(false)
    if (error) return setErro(traduzirErro(error))
    setEtapa('camera')
  }

  async function enviar() {
    setOcupado(true)
    setErro('')
    const caminho = `${perfil.empresa_id}/${perfil.id}/cadastro/${novoNomeArquivo()}`
    const envio = await supabase.storage.from('rostos').upload(caminho, captura.blob, { contentType: 'image/jpeg', upsert: false })
    if (envio.error) {
      setOcupado(false)
      return setErro(traduzirErro(envio.error, 'Não conseguimos enviar a foto. Confira sua internet e tente de novo.'))
    }
    const { error } = await supabase.rpc('enviar_rosto_referencia', {
      p_foto_path: caminho,
      p_descritor: captura.descritor,
      p_modelo: MOTOR,
      p_qualidade: captura.qualidade,
    })
    setOcupado(false)
    if (error) return setErro(traduzirErro(error))
    setEtapa('enviado')
    aoConcluir?.()
  }

  const rodape = etapa === 'conferir' ? (
    <>
      <Botao variante="secundario" icone={RefreshCw} onClick={() => { setCaptura(null); setEtapa('camera') }} disabled={ocupado}>Tirar outra</Botao>
      <Botao onClick={enviar} carregando={ocupado}>Usar esta foto</Botao>
    </>
  ) : etapa === 'enviado' ? (
    <Botao onClick={aoFechar}>Concluir</Botao>
  ) : null

  return (
    <PainelLateral
      aberto={aberto}
      aoFechar={ocupado ? undefined : aoFechar}
      titulo="Cadastrar meu rosto"
      subtitulo="Uma foto de frente, usada para reconhecer você ao registrar o ponto."
      rodape={rodape}
    >
      <div className="pilha pilha--16">
        {etapa === 'aviso' && <AvisoBiometria aoAceitar={aceitar} aoRecusar={aoFechar} aceitando={ocupado} />}

        {etapa === 'camera' && (
          <>
            <ul className="dicas-foto">
              <li>Fique num lugar bem iluminado, de frente para a luz.</li>
              <li>Tire boné, óculos escuros e máscara.</li>
              <li>Segure o celular na altura dos olhos.</li>
            </ul>
            <CameraRosto aoCapturar={aoCapturar} aoDesistir={aoFechar} textoDesistir="Cancelar" exigirRosto />
          </>
        )}

        {etapa === 'conferir' && captura && (
          <>
            <img className="foto-rosto foto-rosto--grande" src={captura.imagem} alt="Sua foto de cadastro" />
            <p className="suave" style={{ textAlign: 'center' }}>A foto ficou nítida, com o rosto inteiro e sem sombras fortes?</p>
          </>
        )}

        {etapa === 'enviado' && (
          <div className="estado-vazio">
            <CircleCheck aria-hidden="true" style={{ color: 'var(--ok)' }} />
            <strong>Foto enviada!</strong>
            <p className="suave pequeno">
              Agora o RH ou o administrador da sua empresa vai conferir a foto. Enquanto isso, você já pode registrar o ponto normalmente.
            </p>
          </div>
        )}

        {erro && <Alerta tom="problema">{erro}</Alerta>}
      </div>
    </PainelLateral>
  )
}
