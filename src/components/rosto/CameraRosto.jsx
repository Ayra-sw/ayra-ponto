import { useCallback, useEffect, useRef, useState } from 'react'
import { CameraOff, LoaderCircle, RefreshCw, ScanFace } from 'lucide-react'
import {
  CONFIG_ENQUADRAMENTO, CONFIG_LEITURA, abrirCamera, avaliarEnquadramento, canvasParaJpeg,
  capturarQuadro, carregarMotor, fecharCamera, piscou,
} from '../../lib/rosto'
import Botao from '../ui/Botao'
import Alerta from '../ui/Alerta'

const TEMPO_LIMITE = 25000 // ms procurando o rosto antes de oferecer alternativas
const QUADROS_BONS = 3 // quadros seguidos bem enquadrados antes da foto
const ESPERA_PISCADA = 3500 // ms esperando a piscada; depois tira a foto assim mesmo

const MENSAGENS_ERRO = {
  permissao_negada: 'A câmera foi bloqueada. Para liberar, toque no cadeado ao lado do endereço do site e permita a câmera.',
  sem_camera: 'Não encontramos uma câmera neste aparelho.',
  motor: 'Não foi possível carregar o reconhecimento facial. Confira sua internet e tente de novo.',
}

// Câmera frontal com guia de enquadramento. Quando o rosto está bem
// posicionado (e, se possível, depois de uma piscada), tira a foto sozinha e
// devolve a foto + a leitura do rosto em aoCapturar.
export default function CameraRosto({ aoCapturar, aoDesistir, textoDesistir = 'Cancelar', dica }) {
  const videoRef = useRef(null)
  const aoCapturarRef = useRef(aoCapturar)
  aoCapturarRef.current = aoCapturar
  const [tentativa, setTentativa] = useState(0)
  const [estado, setEstado] = useState('iniciando') // iniciando | enquadrando | lendo | tempo | erro
  const [mensagem, setMensagem] = useState('Abrindo a câmera…')
  const [erro, setErro] = useState(null) // { motivo, texto }
  const [pronto, setPronto] = useState(false)

  const rodar = useCallback(async (sinal) => {
    let stream = null
    try {
      setEstado('iniciando')
      setMensagem('Abrindo a câmera…')
      const [s, human] = await Promise.all([
        abrirCamera(),
        carregarMotor().catch((e) => { e.motivo = 'motor'; throw e }),
      ])
      stream = s
      if (sinal.cancelado) return
      const video = videoRef.current
      video.srcObject = stream
      await video.play().catch(() => {})
      if (!video.videoWidth) await new Promise((r) => { video.onloadedmetadata = r })

      setEstado('enquadrando')
      const inicio = performance.now()
      let bons = 0
      let primeiroBom = 0
      let viuPiscada = false

      while (!sinal.cancelado) {
        if (performance.now() - inicio > TEMPO_LIMITE) {
          setEstado('tempo')
          break
        }
        const res = await human.detect(video, CONFIG_ENQUADRAMENTO)
        if (sinal.cancelado) break
        const aval = avaliarEnquadramento(res, video)
        if (piscou(res)) viuPiscada = true
        if (aval.pronto) {
          bons += 1
          if (!primeiroBom) primeiroBom = performance.now()
        } else {
          bons = 0
          primeiroBom = 0
        }
        setPronto(aval.pronto)
        const esperandoPiscada = aval.pronto && !viuPiscada && performance.now() - primeiroBom < ESPERA_PISCADA
        setMensagem(esperandoPiscada ? 'Agora pisque os olhos uma vez' : aval.mensagem)

        if (bons >= QUADROS_BONS && !esperandoPiscada) {
          setEstado('lendo')
          setMensagem('Lendo o rosto…')
          const canvas = capturarQuadro(video)
          const leitura = await human.detect(canvas, CONFIG_LEITURA)
          const rosto = leitura.face?.length === 1 ? leitura.face[0] : null
          if (sinal.cancelado) break
          if (rosto?.embedding?.length) {
            const blob = await canvasParaJpeg(canvas)
            fecharCamera(stream)
            stream = null
            aoCapturarRef.current({
              blob,
              imagem: canvas.toDataURL('image/jpeg', 0.8),
              descritor: Array.from(rosto.embedding),
              qualidade: rosto.faceScore ?? rosto.boxScore ?? null,
              antispoof: rosto.real ?? null,
              vivacidade: rosto.live ?? null,
              piscou: viuPiscada,
            })
            return
          }
          bons = 0
          primeiroBom = 0
          setEstado('enquadrando')
        }
        await new Promise((r) => setTimeout(r, 90))
      }
    } catch (e) {
      if (sinal.cancelado) return
      const motivo = e?.motivo || 'motor'
      console.error('Câmera/reconhecimento:', e)
      setErro({ motivo, texto: MENSAGENS_ERRO[motivo] || MENSAGENS_ERRO.motor })
      setEstado('erro')
    } finally {
      if (stream) fecharCamera(stream)
    }
  }, [])

  useEffect(() => {
    const sinal = { cancelado: false }
    setErro(null)
    rodar(sinal)
    return () => { sinal.cancelado = true }
  }, [rodar, tentativa])

  const tentarDeNovo = () => { setPronto(false); setTentativa((t) => t + 1) }

  return (
    <div className="camera-rosto">
      <div className={`camera-rosto__visor${pronto ? ' camera-rosto__visor--pronto' : ''}`}>
        <video ref={videoRef} playsInline muted autoPlay aria-label="Imagem da câmera frontal" />
        <div className="camera-rosto__moldura" aria-hidden="true" />
        {(estado === 'iniciando' || estado === 'lendo') && (
          <div className="camera-rosto__carregando"><LoaderCircle className="btn__giro" aria-hidden="true" /></div>
        )}
        {estado === 'erro' && (
          <div className="camera-rosto__carregando"><CameraOff aria-hidden="true" /></div>
        )}
      </div>

      {estado !== 'erro' && estado !== 'tempo' && (
        <p className="camera-rosto__mensagem" role="status" aria-live="polite">
          <ScanFace aria-hidden="true" /> {mensagem}
        </p>
      )}
      {estado === 'iniciando' && (
        <p className="suave pequeno" style={{ textAlign: 'center' }}>
          Na primeira vez pode levar alguns segundos para carregar.
        </p>
      )}
      {dica && estado === 'enquadrando' && <p className="suave pequeno" style={{ textAlign: 'center' }}>{dica}</p>}

      {estado === 'tempo' && (
        <Alerta tom="atencao" titulo="Não conseguimos ver seu rosto direito">
          Tente num lugar mais claro, sem boné ou óculos escuros, com o rosto inteiro dentro do círculo.
        </Alerta>
      )}
      {estado === 'erro' && <Alerta tom="problema">{erro?.texto}</Alerta>}

      <div className="acoes acoes--centro">
        {(estado === 'tempo' || estado === 'erro') && (
          <Botao icone={RefreshCw} onClick={tentarDeNovo}>Tentar de novo</Botao>
        )}
        {aoDesistir && (
          <Botao variante="secundario" onClick={() => aoDesistir(estado === 'tempo' ? 'rosto_nao_encontrado' : erro?.motivo === 'motor' ? 'outro' : erro?.motivo || 'outro')}>
            {textoDesistir}
          </Botao>
        )}
      </div>
    </div>
  )
}
