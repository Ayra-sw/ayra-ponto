import { useEffect, useState } from 'react'
import { ScanFace } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../contexts/AuthContext'
import { data } from '../../lib/formatos'
import useRosto from '../../hooks/useRosto'
import Botao from '../ui/Botao'
import Etiqueta from '../ui/Etiqueta'
import Alerta from '../ui/Alerta'
import { Esqueleto } from '../ui/Estados'
import CadastroRosto from './CadastroRosto'
import FotoRosto from './FotoRosto'

// Seção "Reconhecimento facial" em Minha conta: situação da foto de cadastro
// e botão para cadastrar ou trocar.
export default function MeuRosto() {
  const { perfil } = useAuth()
  const rosto = useRosto()
  const [ligado, setLigado] = useState(null)
  const [cadastroAberto, setCadastroAberto] = useState(false)

  useEffect(() => {
    supabase.from('empresas').select('reconhecimento_facial').eq('id', perfil.empresa_id).maybeSingle()
      .then(({ data: e }) => setLigado(Boolean(e?.reconhecimento_facial)))
  }, [perfil.empresa_id])

  if (ligado === null || rosto.carregando) return <section className="cartao"><Esqueleto linhas={2} /></section>
  if (!ligado && !rosto.aprovada && !rosto.pendente) return null

  const atual = rosto.pendente || rosto.aprovada
  let situacao
  if (rosto.pendente) situacao = <Etiqueta tom="atencao">Aguardando aprovação do RH</Etiqueta>
  else if (rosto.recusada) situacao = <Etiqueta tom="problema">Foto recusada</Etiqueta>
  else if (rosto.aprovada) situacao = <Etiqueta tom="ok">Foto aprovada</Etiqueta>
  else situacao = <Etiqueta tom="neutra">Rosto não cadastrado</Etiqueta>

  return (
    <section className="cartao" aria-labelledby="t-rosto">
      <div className="cartao__cabecalho">
        <div>
          <h2 id="t-rosto">Reconhecimento facial</h2>
          <p className="suave pequeno">Sua empresa usa o rosto para confirmar quem está registrando o ponto.</p>
        </div>
        {situacao}
      </div>
      <div className="meu-rosto">
        {atual ? <FotoRosto caminho={atual.foto_path} alt="Sua foto de cadastro" /> : <div className="foto-rosto foto-rosto--vazia"><ScanFace aria-hidden="true" /></div>}
        <div className="pilha">
          {rosto.recusada && (
            <Alerta tom="problema" titulo="Sua última foto foi recusada">
              {rosto.recusada.motivo_recusa ? `Motivo: ${rosto.recusada.motivo_recusa}. ` : ''}Tire uma nova foto seguindo as dicas.
            </Alerta>
          )}
          {rosto.pendente && <p className="suave pequeno">Enviada em {data(rosto.pendente.enviada_em)}. Enquanto isso, suas marcações são conferidas pelo RH.</p>}
          {!rosto.pendente && rosto.aprovada && <p className="suave pequeno">Aprovada em {data(rosto.aprovada.analisada_em)}. Troque se a sua aparência mudar bastante.</p>}
          {!atual && !rosto.recusada && <p className="suave pequeno">Cadastre uma foto de frente para ser reconhecido ao registrar o ponto.</p>}
          <div>
            <Botao icone={ScanFace} variante={atual ? 'secundario' : 'primario'} onClick={() => setCadastroAberto(true)}>
              {atual ? 'Trocar foto' : 'Cadastrar meu rosto'}
            </Botao>
          </div>
        </div>
      </div>
      {cadastroAberto && (
        <CadastroRosto aberto aceitou={rosto.aceitou} aoFechar={() => setCadastroAberto(false)} aoConcluir={rosto.recarregar} />
      )}
    </section>
  )
}
