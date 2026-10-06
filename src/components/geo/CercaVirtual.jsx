import { useState } from 'react'
import { LocateFixed, MapPinned, Search, Trash2 } from 'lucide-react'
import { buscarEndereco, RAIO_MAX, RAIO_MIN } from '../../lib/geo'
import Mapa from './Mapa'
import Botao from '../ui/Botao'
import Alerta from '../ui/Alerta'
import { Campo } from '../ui/Campo'

const CENTRO_BRASIL = { lat: -14.235, lon: -51.925, zoom: 4 }

// Parte do formulário da unidade: marcar o local no mapa e escolher o raio.
//   valor: { lat, lon, raio }  (lat e lon nulos = cerca desligada; raio em texto)
export default function CercaVirtual({ valor, aoMudar, endereco, erroRaio }) {
  const temPonto = valor.lat != null && valor.lon != null
  const [foco, setFoco] = useState(temPonto ? { lat: valor.lat, lon: valor.lon, zoom: 17 } : CENTRO_BRASIL)
  const [buscando, setBuscando] = useState(false)
  const [aviso, setAviso] = useState('')

  const marcar = (lat, lon) => aoMudar({ ...valor, lat: Number(lat.toFixed(6)), lon: Number(lon.toFixed(6)) })

  async function pelaEndereco() {
    setAviso('')
    setBuscando(true)
    const achou = await buscarEndereco(endereco)
    setBuscando(false)
    if (!achou) {
      setAviso(endereco.cidade || endereco.cep
        ? 'Não encontramos esse endereço no mapa. Clique no mapa para marcar o local exato.'
        : 'Preencha pelo menos a cidade (ou o CEP) acima e tente de novo. Você também pode clicar direto no mapa.')
      return
    }
    marcar(achou.lat, achou.lon)
    setFoco({ lat: achou.lat, lon: achou.lon, zoom: 17 })
  }

  function minhaLocalizacao() {
    setAviso('')
    if (!navigator.geolocation) { setAviso('Este aparelho não informa a localização. Clique no mapa para marcar o local.'); return }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        marcar(pos.coords.latitude, pos.coords.longitude)
        setFoco({ lat: pos.coords.latitude, lon: pos.coords.longitude, zoom: 17 })
      },
      () => setAviso('Não foi possível pegar a sua localização. Permita o acesso no navegador ou clique no mapa para marcar o local.'),
      { timeout: 8000, enableHighAccuracy: true },
    )
  }

  function remover() {
    setAviso('')
    aoMudar({ ...valor, lat: null, lon: null })
    setFoco(CENTRO_BRASIL)
  }

  const raio = Number(valor.raio)
  const raioValido = Number.isFinite(raio) && raio >= RAIO_MIN && raio <= RAIO_MAX

  return (
    <section className="cerca" aria-labelledby="cerca-titulo">
      <h3 className="cerca__titulo" id="cerca-titulo"><MapPinned aria-hidden="true" /> Localização e cerca virtual</h3>
      <p className="suave pequeno" style={{ margin: 0 }}>
        Marque no mapa onde fica a unidade. Quando alguém registrar o ponto longe daqui, o RH vê um aviso na marcação.
        O ponto <strong>nunca é bloqueado</strong>: a cerca só ajuda a conferir.
      </p>
      <div className="cerca__acoes">
        <Botao type="button" variante="secundario" tamanho="pequeno" icone={Search} onClick={pelaEndereco} carregando={buscando}>Buscar pelo endereço</Botao>
        <Botao type="button" variante="secundario" tamanho="pequeno" icone={LocateFixed} onClick={minhaLocalizacao}>Estou na unidade agora</Botao>
        {temPonto && <Botao type="button" variante="discreto" tamanho="pequeno" icone={Trash2} onClick={remover}>Desligar a cerca</Botao>}
      </div>
      {aviso && <Alerta tom="info">{aviso}</Alerta>}
      <Mapa
        rotulo="Mapa para marcar o local da unidade. Clique para marcar o ponto; com o teclado, mova o mapa com as setas e aperte Enter para marcar o centro."
        foco={foco}
        altura={280}
        aoEscolher={marcar}
        marcadores={temPonto ? [{ lat: valor.lat, lon: valor.lon, tom: 'unidade', rotulo: 'Local da unidade' }] : []}
        circulo={temPonto && raioValido ? { lat: valor.lat, lon: valor.lon, raio } : null}
      />
      <p className="cerca__coords" aria-live="polite">
        {temPonto
          ? `Local marcado (${valor.lat.toFixed(5)}, ${valor.lon.toFixed(5)}). Clique no mapa para ajustar o ponto exato.`
          : 'Cerca desligada. Busque pelo endereço ou clique no mapa para marcar o local e ligar a cerca.'}
      </p>
      {temPonto && (
        <Campo
          rotulo="Raio da cerca (metros)"
          type="number" inputMode="numeric" min={RAIO_MIN} max={RAIO_MAX} step="10"
          value={valor.raio}
          onChange={(e) => aoMudar({ ...valor, raio: e.target.value })}
          erro={erroRaio}
          ajuda={`Entre ${RAIO_MIN} m e 5 km. O padrão é 200 m. Em lugares grandes ou abertos, use um raio maior: a localização do computador e do celular pode errar por algumas dezenas de metros.`}
        />
      )}
    </section>
  )
}
