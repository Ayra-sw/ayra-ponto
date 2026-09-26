import { useCallback, useEffect, useRef, useState } from 'react'
import { Camera, CameraOff, LoaderCircle, RefreshCw, ScanFace } from 'lucide-react'
import {
  CONFIG_ENQUADRAMENTO, CONFIG_LEITURA, abrirCamera, avaliarEnquadramento, canvasParaJpeg,
  capturarQuadro, carregarMotor, fecharCamera, piscou,
} from '../../lib/rosto'
import Botao from '../ui/Botao'
import Alerta from '../ui/Alerta'

const QUADROS_BONS = 3 // quadros seguidos bem enquadrados antes da foto automática
const ESPERA_PISCADA = 3500 // ms esperando a piscada; depois tira a foto assim mesmo
const MOSTRAR_BOTAO_FOTO = 4000 // ms até oferecer o botão "Tirar foto agora"
const TEMPO_DICA = 20000 // ms sem conseguir a foto automática até mostrar as dicas

const MENSAGENS_ERRO = {
  permissao_negada: 'A câmera foi bloqueada. Para liberar, toque no cadeado ao lado do endereço do site e permita a câmera.',
  sem_camera: 'Não encontramos uma câmera neste aparelho.',
}

// Câmera frontal com guia de enquadramento.
// - Com o reconhecimento carregado: tira a foto sozinha quando o rosto está
//   bem posicionado (e, se possível, depois de uma piscada).
// - Sempre existe o botão "Tirar foto agora": a selfie é a prova da marcação
//   e nunca pode depender do reconhecimento ter funcionado.
// - Se o reconhecimento não carregar, a câmera continua e a foto é manual.
// aoCapturar recebe { blob, imagem, descritor (ou null), qualidade, antispoof, vivacidade, piscou, manual }.
// exigirRosto: no cadastro, a foto só vale se tiver um rosto legível.
export default function CameraRosto({ aoCapturar, aoDesistir, textoDesistir = 'Cancelar', dica, exigirRosto = false }) {
  const videoRef = useRef(null)
  const humanRef = useRef(null)
  const piscadaRef = useRef(false)
  const capturandoRef = useRef(false)
  const aoCapturarRef = useRef(aoCapturar)
  aoCapturarRef.current = aoCapturar
  const [tentativa, setTentativa] = useState(0)
  const [estado, setEstado] = useState('iniciando') // iniciando | ao_vivo | lendo | erro
  const [motor, setMotor] = useState('carregando') // carregando | pronto | falhou
  const [mensagem, setMensagem] = useState('Abrindo a câmera…')
  const [erro, setErro] = useState(null) // { motivo, texto }
  const [aviso, setAviso] = useState('')
  const [pronto, setPronto] = useState(false)
  const [mostrarBotao, setMostrarBotao] = useState(false)
  const [mostrarDicas, setMostrarDicas] = useState(false)
  const streamRef = useRef(null)

  // Lê o quadro atual e entrega a foto. manual = a pessoa tocou no botão.
  const capturar = useCallback(async (manual) => {
    const video = videoRef.current
    if (capturandoRef.current || !video?.videoWidth) return false
    capturandoRef.current = true
    setEstado('lendo')
    setMensagem(manual ? 'Salvando a foto…' : 'Lendo o rosto…')
    const canvas = capturarQuadro(video)
    let rosto = null
    if (humanRef.current) {
      try {
        const leitura = await humanRef.current.detect(canvas, CONFIG_LEITURA)
        rosto = leitura.face?.length === 1 ? leitura.face[0] : null
      } catch (e) {
        console.error('Leitura do rosto:', e)
      }
    }
    const descritor = rosto?.embedding?.length ? Array.from(rosto.embedding) : null
    if (!descritor && (exigirRosto || !manual)) {
      capturandoRef.current = false
      setEstado('ao_vivo')
      if (manual) setAviso('Não encontramos um rosto nessa foto. Olhe de frente para a câmera, num lugar claro, e tente de novo.')
      return false
    }
    const blob = await canvasParaJpeg(canvas)
    fecharCamera(streamRef.current)
    streamRef.current = null
    aoCapturarRef.current({
      blob,
      imagem: canvas.toDataURL('image/jpeg', 0.8),
      descritor,
      qualidade: rosto ? rosto.faceScore ?? rosto.boxScore ?? null : null,
      antispoof: rosto?.real ?? null,
      vivacidade: rosto?.live ?? null,
      piscou: humanRef.current ? piscadaRef.current : null,
      manual,
    })
    return true
  }, [exigirRosto])

  useEffect(() => {
    const sinal = { cancelado: false }
    capturandoRef.current = false
    piscadaRef.current = false
    setErro(null)
    setAviso('')
    setPronto(false)
    setMostrarBotao(false)
    setMostrarDicas(false)
    setEstado('iniciando')
    setMensagem('Abrindo a câmera…')

    // o reconhecimento carrega em paralelo; se falhar, a câmera continua
    if (!humanRef.current) {
      setMotor('carregando')
      carregarMotor()
        .then((h) => { humanRef.current = h; if (!sinal.cancelado) setMotor('pronto') })
        .catch((e) => { console.error('Reconhecimento facial não carregou:', e); if (!sinal.cancelado) setMotor('falhou') })
    } else {
      setMotor('pronto')
    }

    ;(async () => {
      try {
        const stream = await abrirCamera()
        if (sinal.cancelado) { fecharCamera(stream); return }
        streamRef.current = stream
        const video = videoRef.current
        video.srcObject = stream
        await video.play().catch(() => {})
        if (!video.videoWidth) await new Promise((r) => { video.onloadedmetadata = r })
        if (sinal.cancelado) return
        setEstado('ao_vivo')
        setMensagem('Posicione o rosto dentro do círculo')
        const inicio = performance.now()
        setTimeout(() => { if (!sinal.cancelado) setMostrarBotao(true) }, MOSTRAR_BOTAO_FOTO)
        setTimeout(() => { if (!sinal.cancelado) setMostrarDicas(true) }, TEMPO_DICA)

        let bons = 0
        let primeiroBom = 0
        while (!sinal.cancelado && streamRef.current) {
          const human = humanRef.current
          if (!human || capturandoRef.current) {
            await new Promise((r) => setTimeout(r, 200))
            continue
          }
          let res
          try {
            res = await human.detect(video, CONFIG_ENQUADRAMENTO)
          } catch (e) {
            // o reconhecimento quebrou no meio: segue só com a foto manual
            console.error('Reconhecimento facial falhou:', e)
            humanRef.current = null
            setMotor('falhou')
            setPronto(false)
            continue
          }
          if (sinal.cancelado || capturandoRef.current) continue
          const aval = avaliarEnquadramento(res, video)
          if (piscou(res)) piscadaRef.current = true
          if (aval.pronto) {
            bons += 1
            if (!primeiroBom) primeiroBom = performance.now()
          } else {
            bons = 0
            primeiroBom = 0
          }
          setPronto(aval.pronto)
          const esperandoPiscada = aval.pronto && !piscadaRef.current && performance.now() - primeiroBom < ESPERA_PISCADA
          setMensagem(esperandoPiscada ? 'Agora pisque os olhos uma vez' : aval.mensagem)
          if (bons >= QUADROS_BONS && !esperandoPiscada) {
            const foi = await capturar(false)
            if (foi) return
            bons = 0
            primeiroBom = 0
          }
          if (performance.now() - inicio > TEMPO_DICA) setMostrarDicas(true)
          await new Promise((r) => setTimeout(r, 90))
        }
      } catch (e) {
        if (sinal.cancelado) return
        const motivo = e?.motivo || 'sem_camera'
        console.error('Câmera:', e)
        setErro({ motivo, texto: MENSAGENS_ERRO[motivo] || MENSAGENS_ERRO.sem_camera })
        setEstado('erro')
      }
    })()

    return () => {
      sinal.cancelado = true
      fecharCamera(streamRef.current)
      streamRef.current = null
    }
  }, [tentativa, capturar])

  const motorFalhou = motor === 'falhou'
  const aoVivo = estado === 'ao_vivo'
  const podeTirarManual = aoVivo && (mostrarBotao || motorFalhou)

  function desistir() {
    if (erro) return aoDesistir(erro.motivo)
    if (motorFalhou) return aoDesistir('reconhecimento_indisponivel')
    return aoDesistir('usuario_optou')
  }

  let texto = mensagem
  if (aoVivo && motor === 'carregando') texto = mostrarBotao ? 'Ainda preparando o reconhecimento… você pode tirar a foto agora' : 'Preparando o reconhecimento…'
  if (aoVivo && motorFalhou) texto = 'Olhe para a câmera e toque em "Tirar foto"'

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

      {estado !== 'erro' && (
        <p className="camera-rosto__mensagem" role="status" aria-live="polite">
          <ScanFace aria-hidden="true" /> {texto}
        </p>
      )}
      {estado === 'iniciando' && (
        <p className="suave pequeno" style={{ textAlign: 'center' }}>
          Na primeira vez pode levar alguns segundos para carregar.
        </p>
      )}
      {dica && aoVivo && <p className="suave pequeno" style={{ textAlign: 'center' }}>{dica}</p>}

      {motorFalhou && aoVivo && (
        <Alerta tom="atencao">
          O reconhecimento automático não carregou (pode ser a internet). A foto continua sendo guardada; {exigirRosto ? 'tente de novo mais tarde se ela não for aceita.' : 'o RH confere depois.'}
        </Alerta>
      )}
      {mostrarDicas && aoVivo && !motorFalhou && (
        <Alerta tom="info" titulo="Não está conseguindo?">
          Aproxime o rosto da câmera, procure um lugar mais claro e tire boné ou óculos escuros. Ou toque em <strong>Tirar foto agora</strong>.
        </Alerta>
      )}
      {aviso && aoVivo && <Alerta tom="atencao">{aviso}</Alerta>}
      {estado === 'erro' && <Alerta tom="problema">{erro?.texto}</Alerta>}

      <div className="acoes acoes--centro">
        {podeTirarManual && (
          <Botao icone={Camera} onClick={() => { setAviso(''); capturar(true) }}>
            {motorFalhou ? 'Tirar foto' : 'Tirar foto agora'}
          </Botao>
        )}
        {estado === 'erro' && (
          <Botao icone={RefreshCw} onClick={() => setTentativa((t) => t + 1)}>Tentar de novo</Botao>
        )}
        {aoDesistir && (
          <Botao variante="secundario" onClick={desistir} disabled={estado === 'lendo'}>{textoDesistir}</Botao>
        )}
      </div>
    </div>
  )
}
