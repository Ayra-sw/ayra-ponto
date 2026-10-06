import { useMemo } from 'react'
import { extremosDoCirculo, formatarDistancia, pontoDe } from '../../lib/geo'
import { dataHora } from '../../lib/formatos'
import { rotuloMarcacao } from '../../lib/marcacoes'
import { Dialogo } from '../ui/Dialogo'
import Botao from '../ui/Botao'
import Mapa from './Mapa'

// "Ver no mapa": onde a pessoa estava na marcação e, se a unidade tem cerca,
// o local da unidade com o círculo do raio (como estava na hora da marcação).
export default function MapaDaMarcacao({ registro, local, nome, aoFechar }) {
  const ponto = pontoDe(registro)
  const unidade = local ? { lat: Number(local.filial_latitude), lon: Number(local.filial_longitude) } : null
  const fora = local?.situacao === 'fora'

  const foco = useMemo(() => {
    if (!ponto) return null
    const pts = [ponto]
    if (unidade) pts.push(unidade, ...extremosDoCirculo(unidade, local.raio_m))
    return { pontos: pts }
  }, [registro?.id, local?.registro_id]) // eslint-disable-line react-hooks/exhaustive-deps

  const marcadores = []
  if (unidade) marcadores.push({ chave: 'u', ...unidade, tom: 'unidade', rotulo: 'Local da unidade' })
  if (ponto) marcadores.push({ chave: 'm', ...ponto, tom: fora ? 'atencao' : 'ok', rotulo: 'Onde a marcação foi feita' })

  const titulo = `${rotuloMarcacao(registro.tipo)} · ${dataHora(registro.marcado_em)}`

  return (
    <Dialogo aberto aoFechar={aoFechar} titulo={titulo}
      acoes={<Botao variante="secundario" onClick={aoFechar} data-foco-inicial>Fechar</Botao>}>
      <div className="mapa-marcacao">
        {nome && <p className="suave">{nome}</p>}
        {ponto ? (
          <>
            <Mapa foco={foco} marcadores={marcadores} circulo={unidade ? { ...unidade, raio: local.raio_m } : null}
              altura={300} rotulo="Mapa com o local da marcação" />
            <p>
              {!local && 'Local onde a marcação foi feita. Esta unidade não tinha cerca virtual na hora.'}
              {local?.situacao === 'dentro' && <>Marcação <strong>dentro da cerca</strong>, a {formatarDistancia(local.distancia_m)} do ponto da unidade (raio de {formatarDistancia(local.raio_m)}).</>}
              {fora && <>Marcação <strong>fora da cerca</strong>: a {formatarDistancia(local.distancia_m)} do ponto da unidade (raio de {formatarDistancia(local.raio_m)}).</>}
            </p>
            <p className="suave pequeno">
              A localização vem do navegador ou do celular e pode variar de algumas dezenas a centenas de metros, principalmente em computadores. Use como indício, não como prova.
              {unidade && ' O círculo mostra a cerca como estava na hora da marcação.'}
            </p>
          </>
        ) : (
          <p>Esta marcação foi registrada sem localização: a pessoa não permitiu o acesso ou o aparelho não informou.</p>
        )}
      </div>
    </Dialogo>
  )
}
