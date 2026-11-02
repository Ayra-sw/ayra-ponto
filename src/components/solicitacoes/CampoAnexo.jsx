import { useId, useRef } from 'react'
import { Camera, FileText, Paperclip, Upload, X } from 'lucide-react'
import { ACEITOS, conferirArquivo } from '../../lib/atestados'

// Escolher um atestado (PDF ou foto). O arquivo só é enviado quando o formulário é salvo.
// Com "doisBotoes": um botão abre a câmera (Foto) e o outro escolhe um arquivo.
export default function CampoAnexo({ arquivo, aoEscolher, rotulo = 'Atestado ou declaração', ajuda, erro, doisBotoes = false }) {
  const id = useId()
  const entrada = useRef(null)
  const camera = useRef(null)
  const escolher = (e) => { const f = e.target.files?.[0] || null; aoEscolher(f, conferirArquivo(f)); e.target.value = '' }
  const tamanho = arquivo ? `${Math.max(1, Math.round(arquivo.size / 1024))} KB` : ''
  return (
    <div className={`campo${erro ? ' campo--erro' : ''}`}>
      <span className="campo__rotulo">
        <label htmlFor={id}>{rotulo}</label>
        <span className="campo__opcional">(opcional)</span>
      </span>
      <input
        ref={entrada} id={id} type="file" accept={ACEITOS} className="sr-only"
        aria-describedby={`${id}-ajuda`}
        onChange={(e) => { const f = e.target.files?.[0] || null; aoEscolher(f, conferirArquivo(f)); e.target.value = '' }}
      />
      {doisBotoes && (
        <input ref={camera} type="file" accept="image/*" capture="environment" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={escolher} />
      )}
      {arquivo ? (
        <div className="anexo-escolhido">
          <FileText aria-hidden="true" />
          <span className="anexo-escolhido__nome">{arquivo.name}</span>
          <span className="suave pequeno">{tamanho}</span>
          <button type="button" className="anexo-escolhido__tirar" onClick={() => aoEscolher(null, '')} aria-label="Tirar o arquivo escolhido">
            <X aria-hidden="true" />
          </button>
        </div>
      ) : doisBotoes ? (
        <div className="anexo-dois">
          <button type="button" className="btn btn--secundario anexo-botao" onClick={() => camera.current?.click()}>
            <Camera aria-hidden="true" /> Foto
          </button>
          <button type="button" className="btn btn--secundario anexo-botao" onClick={() => entrada.current?.click()}>
            <Upload aria-hidden="true" /> Arquivo
          </button>
        </div>
      ) : (
        <button type="button" className="btn btn--secundario anexo-botao" onClick={() => entrada.current?.click()}>
          <Paperclip aria-hidden="true" /> Escolher arquivo ou tirar foto
        </button>
      )}
      {erro
        ? <span id={`${id}-ajuda`} className="campo__erro" role="alert">{erro}</span>
        : <span id={`${id}-ajuda`} className="campo__ajuda">{ajuda || 'PDF ou foto, até 5 MB. Só você, o RH e o administrador abrem este arquivo.'}</span>}
    </div>
  )
}
