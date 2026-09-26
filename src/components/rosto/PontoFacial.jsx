import { useCallback, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../contexts/AuthContext'
import { traduzirErro } from '../../lib/mensagensErro'
import { acaoMarcacao } from '../../lib/marcacoes'
import { obterLocalizacao } from '../../lib/localizacao'
import { MOTOR, carregarMotor, novoNomeArquivo, sha256, similaridade } from '../../lib/rosto'
import { PainelLateral } from '../ui/Dialogo'
import Botao from '../ui/Botao'
import Alerta from '../ui/Alerta'
import { Esqueleto } from '../ui/Estados'
import AvisoBiometria, { VERSAO_AVISO } from './AvisoBiometria'
import CameraRosto from './CameraRosto'

// Registro de ponto com reconhecimento facial. Qualquer problema (sem
// câmera, rosto não reconhecido, falha no envio da foto) NUNCA impede a
// marcação: ela é registrada e fica "a conferir" pelo RH.
export default function PontoFacial({ tipo, rosto, aoConcluir, aoFechar }) {
  const { perfil } = useAuth()
  const [etapa, setEtapa] = useState(rosto.aceitou ? 'camera' : 'aviso') // aviso | camera | registrando | erro
  const [aceitando, setAceitando] = useState(false)
  const [erro, setErro] = useState('')

  async function chamarRegistro(extra) {
    const coords = await obterLocalizacao()
    const { data, error } = await supabase.rpc('registrar_ponto_facial', {
      p_tipo: tipo,
      p_origem: 'web',
      p_motor: MOTOR,
      ...coords,
      ...extra,
    })
    if (error) {
      setErro(traduzirErro(error))
      setEtapa('erro')
      return
    }
    aoConcluir(data)
  }

  async function registrarSemFoto(motivo) {
    setEtapa('registrando')
    await chamarRegistro({ p_motivo_sem_foto: motivo })
  }

  const aoCapturar = useCallback(async (c) => {
    setEtapa('registrando')
    let sim = null
    if (rosto.aprovada?.descritor?.length) {
      try {
        sim = similaridade(await carregarMotor(), c.descritor, rosto.aprovada.descritor)
      } catch (e) {
        console.error('Comparação facial:', e)
      }
    }
    const caminho = `${perfil.empresa_id}/${perfil.id}/marcacoes/${novoNomeArquivo()}`
    const [envio, hash] = await Promise.all([
      supabase.storage.from('rostos').upload(caminho, c.blob, { contentType: 'image/jpeg', upsert: false }),
      sha256(c.blob).catch(() => null),
    ])
    if (envio.error) {
      console.error('Envio da selfie:', envio.error)
      await chamarRegistro({ p_motivo_sem_foto: 'falha_envio' })
      return
    }
    await chamarRegistro({
      p_foto_path: caminho,
      p_foto_sha256: hash,
      p_referencia_id: rosto.aprovada?.id ?? null,
      p_similaridade: sim,
      p_antispoof: c.antispoof,
      p_vivacidade: c.vivacidade,
      p_piscou: c.piscou,
    })
  }, [rosto.aprovada, perfil.empresa_id, perfil.id]) // eslint-disable-line react-hooks/exhaustive-deps

  async function aceitar() {
    setAceitando(true)
    const { error } = await supabase.rpc('aceitar_aviso_biometria', { p_versao: VERSAO_AVISO })
    setAceitando(false)
    if (error) {
      setErro(traduzirErro(error))
      setEtapa('erro')
      return
    }
    rosto.recarregar()
    setEtapa('camera')
  }

  const ocupado = etapa === 'registrando'

  return (
    <PainelLateral
      aberto
      aoFechar={ocupado ? undefined : aoFechar}
      titulo={acaoMarcacao(tipo)}
      subtitulo="Olhe para a câmera. A foto é tirada sozinha."
      rodape={etapa === 'erro' ? <Botao onClick={aoFechar}>Fechar</Botao> : null}
    >
      <div className="pilha pilha--16">
        {etapa === 'aviso' && (
          <AvisoBiometria aoAceitar={aceitar} aceitando={aceitando}
            aoRecusar={() => registrarSemFoto('aviso_nao_aceito')} textoRecusar="Registrar sem foto" />
        )}

        {etapa === 'camera' && (
          <>
            {!rosto.aprovada && (
              <Alerta tom="info">
                {rosto.pendente
                  ? 'Sua foto de cadastro ainda está aguardando aprovação. A marcação será registrada e conferida pelo RH.'
                  : 'Você ainda não cadastrou seu rosto. A marcação será registrada e conferida pelo RH. Cadastre o rosto em "Minha conta".'}
              </Alerta>
            )}
            <CameraRosto aoCapturar={aoCapturar} aoDesistir={registrarSemFoto} textoDesistir="Registrar sem foto" />
          </>
        )}

        {etapa === 'registrando' && (
          <div className="pilha" aria-live="polite">
            <p style={{ textAlign: 'center' }}><strong>Registrando seu ponto…</strong></p>
            <Esqueleto linhas={2} />
          </div>
        )}

        {etapa === 'erro' && <Alerta tom="problema" titulo="O ponto não foi registrado">{erro}</Alerta>}
      </div>
    </PainelLateral>
  )
}
