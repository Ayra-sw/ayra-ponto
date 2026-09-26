// Reconhecimento facial feito no próprio aparelho (biblioteca Human, gratuita).
// A biblioteca e os modelos só são baixados quando a câmera é aberta, para
// não deixar o resto do sistema mais pesado.
//
// Limitação conhecida: como a comparação acontece no aparelho, ela pode ser
// enganada por alguém com conhecimento técnico. Por isso toda selfie é
// guardada e o RH confere as marcações duvidosas. Antes da venda, a troca
// por um serviço profissional com prova de vida acontece aqui e na função
// registrar_ponto_facial do banco.

export const VERSAO_BIBLIOTECA = '3.3.6'
export const MOTOR = `human-${VERSAO_BIBLIOTECA}-faceres`
export const LIMIAR = 0.5 // igual ao limiar do banco (registrar_ponto_facial)
const OPCOES_COMPARACAO = { order: 2, multiplier: 25, min: 0.2, max: 0.8 }

const CONFIG = {
  // modelos servidos pelo jsDelivr; VITE_MODELOS_ROSTO permite hospedar em outro lugar
  modelBasePath: import.meta.env.VITE_MODELOS_ROSTO || `https://cdn.jsdelivr.net/npm/@vladmandic/human@${VERSAO_BIBLIOTECA}/models/`,
  backend: 'webgl',
  debug: false,
  cacheSensitivity: 0,
  filter: { enabled: true, equalization: false, flip: false },
  face: {
    enabled: true,
    detector: { rotation: false, maxDetected: 2, minConfidence: 0.3, return: false },
    mesh: { enabled: true },
    iris: { enabled: false },
    attention: { enabled: false },
    description: { enabled: true },
    emotion: { enabled: false },
    antispoof: { enabled: true },
    liveness: { enabled: true },
  },
  body: { enabled: false },
  hand: { enabled: false },
  object: { enabled: false },
  segmentation: { enabled: false },
  gesture: { enabled: true },
}

// Durante o enquadramento só procura o rosto (mais leve); a leitura completa
// (descritor, antispoof, vivacidade) roda uma vez, na foto final.
export const CONFIG_ENQUADRAMENTO = {
  face: { description: { enabled: false }, antispoof: { enabled: false }, liveness: { enabled: false } },
}
export const CONFIG_LEITURA = {
  face: { description: { enabled: true }, antispoof: { enabled: true }, liveness: { enabled: true } },
}

let promessa = null

const TEMPO_MAX_CARGA = 45000 // ms; depois disso a câmera segue com foto manual

// Confere se os modelos carregaram de verdade, rodando uma leitura numa imagem vazia.
async function testar(human) {
  const canvas = document.createElement('canvas')
  canvas.width = 64
  canvas.height = 64
  await human.detect(canvas)
}

export function carregarMotor() {
  if (!promessa) {
    const carga = (async () => {
      const { Human } = await import('@vladmandic/human')
      let human = new Human(CONFIG)
      try {
        await human.load()
        await human.warmup()
        await testar(human)
      } catch (erro) {
        // aparelho sem WebGL: tenta o modo mais lento, que funciona em qualquer um
        console.warn('Reconhecimento facial: tentando o modo CPU.', erro)
        human = new Human({ ...CONFIG, backend: 'cpu' })
        await human.load()
        await testar(human)
      }
      return human
    })()
    const limite = new Promise((_, rejeitar) =>
      setTimeout(() => rejeitar(new Error('O reconhecimento facial demorou demais para carregar.')), TEMPO_MAX_CARGA))
    promessa = Promise.race([carga, limite]).catch((erro) => {
      promessa = null
      throw erro
    })
  }
  return promessa
}

export function similaridade(human, a, b) {
  if (!a?.length || !b?.length) return null
  return human.match.similarity(Array.from(a), Array.from(b), OPCOES_COMPARACAO)
}

// Abre a câmera frontal. Devolve o stream ou lança um erro com .motivo
// ('sem_camera' | 'permissao_negada').
export async function abrirCamera() {
  if (!navigator.mediaDevices?.getUserMedia) {
    const erro = new Error('Este aparelho ou navegador não permite usar a câmera.')
    erro.motivo = 'sem_camera'
    throw erro
  }
  try {
    return await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 960 } },
    })
  } catch (e) {
    const erro = new Error(e?.message || 'Câmera indisponível')
    erro.motivo = e?.name === 'NotAllowedError' || e?.name === 'SecurityError' ? 'permissao_negada' : 'sem_camera'
    throw erro
  }
}

export function fecharCamera(stream) {
  stream?.getTracks().forEach((t) => t.stop())
}

// Copia o quadro atual do vídeo para uma imagem de no máximo 640 px.
export function capturarQuadro(video, larguraMax = 640) {
  const escala = Math.min(1, larguraMax / video.videoWidth)
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(video.videoWidth * escala)
  canvas.height = Math.round(video.videoHeight * escala)
  canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height)
  return canvas
}

export function canvasParaJpeg(canvas, qualidade = 0.85) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Não foi possível gerar a foto.'))), 'image/jpeg', qualidade)
  })
}

export async function sha256(blob) {
  const buffer = await blob.arrayBuffer()
  const hash = await crypto.subtle.digest('SHA-256', buffer)
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

export function novoNomeArquivo() {
  return `${crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2)}.jpg`
}

// Analisa o que a câmera está vendo e diz o que falta para a foto ficar boa.
// Devolve { pronto, mensagem }.
export function avaliarEnquadramento(resultado, video) {
  const rostos = resultado?.face || []
  if (rostos.length === 0) return { pronto: false, mensagem: 'Posicione o rosto dentro do círculo' }
  if (rostos.length > 1) return { pronto: false, mensagem: 'Só uma pessoa por vez na câmera' }
  const rosto = rostos[0]
  const [, , largura, altura] = rosto.box || [0, 0, 0, 0]
  const menorLado = Math.min(video.videoWidth, video.videoHeight) || 1
  if (Math.min(largura, altura) < menorLado * 0.28) return { pronto: false, mensagem: 'Aproxime um pouco o rosto' }
  if (Math.max(largura, altura) > menorLado * 0.95) return { pronto: false, mensagem: 'Afaste um pouco o rosto' }
  if ((rosto.faceScore ?? rosto.boxScore ?? 0) < 0.6) return { pronto: false, mensagem: 'Procure um lugar com mais luz' }
  const gestos = (resultado.gesture || []).map((g) => g.gesture)
  if (!gestos.includes('facing center')) return { pronto: false, mensagem: 'Olhe de frente para a câmera' }
  return { pronto: true, mensagem: 'Perfeito, fique parado' }
}

export function piscou(resultado) {
  const gestos = (resultado?.gesture || []).map((g) => g.gesture)
  return gestos.includes('blink left eye') || gestos.includes('blink right eye')
}
