import { useCallback, useEffect, useState } from 'react'
import { Clock, History } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../contexts/AuthContext'
import { useAvisos } from '../../contexts/AvisosContext'
import { traduzirErro } from '../../lib/mensagensErro'
import { duracao, hora, inicioDeHoje, nsr, primeiroNome } from '../../lib/formatos'
import {
  TIPOS_MARCACAO, SITUACAO_AGORA, acaoMarcacao, minutosTrabalhados,
  rotuloMarcacao, situacaoAgora, sugerirProximaMarcacao,
} from '../../lib/marcacoes'
import Relogio from './Relogio'
import Comprovante from './Comprovante'
import Botao from '../ui/Botao'
import Etiqueta from '../ui/Etiqueta'
import Alerta from '../ui/Alerta'
import { Esqueleto, EstadoErro, EstadoVazio } from '../ui/Estados'

// Tela principal de marcação: um botão com a próxima marcação sugerida e,
// se a pessoa precisar, "Registrar outro tipo". A sugestão nunca bloqueia.
export default function RegistrarPonto() {
  const { perfil } = useAuth()
  const avisar = useAvisos()
  const [registros, setRegistros] = useState([])
  const [unidade, setUnidade] = useState(null)
  const [empresa, setEmpresa] = useState(null)
  const [carregando, setCarregando] = useState(true)
  const [erroCarga, setErroCarga] = useState(false)
  const [escolherOutro, setEscolherOutro] = useState(false)
  const [tipoEscolhido, setTipoEscolhido] = useState(null)
  const [etapa, setEtapa] = useState('') // '' | 'localizacao' | 'registrando'
  const [erro, setErro] = useState('')
  const [comprovante, setComprovante] = useState(null)

  const carregar = useCallback(async () => {
    setErroCarga(false)
    const [regs, uni, emp] = await Promise.all([
      supabase.from('registros_ponto').select('*').eq('perfil_id', perfil.id)
        .gte('marcado_em', inicioDeHoje()).order('marcado_em', { ascending: true }),
      perfil.filial_id
        ? supabase.from('filiais').select('id, nome').eq('id', perfil.filial_id).maybeSingle()
        : Promise.resolve({ data: null }),
      supabase.from('empresas').select('id, nome').eq('id', perfil.empresa_id).maybeSingle(),
    ])
    if (regs.error) setErroCarga(true)
    setRegistros(regs.data || [])
    setUnidade(uni.data || null)
    setEmpresa(emp.data || null)
    setCarregando(false)
  }, [perfil.id, perfil.filial_id, perfil.empresa_id])

  useEffect(() => { carregar() }, [carregar])

  const sugerido = sugerirProximaMarcacao(registros)
  const tipo = tipoEscolhido || sugerido
  const agora = situacaoAgora(registros)

  async function obterLocalizacao() {
    if (!navigator.geolocation) return {}
    try {
      const pos = await new Promise((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000, maximumAge: 60000 }))
      return { p_latitude: Number(pos.coords.latitude.toFixed(6)), p_longitude: Number(pos.coords.longitude.toFixed(6)) }
    } catch {
      return {} // localização é opcional
    }
  }

  async function registrar() {
    setErro('')
    setEtapa('localizacao')
    const coords = await obterLocalizacao()
    setEtapa('registrando')
    // O banco sempre registra para a pessoa logada, na unidade do cadastro.
    const { data, error } = await supabase.rpc('registrar_ponto', {
      p_filial_id: perfil.filial_id,
      p_perfil_id: perfil.id,
      p_tipo: tipo,
      p_origem: 'web',
      ...coords,
    })
    setEtapa('')
    if (error) {
      setErro(traduzirErro(error))
      return
    }
    setComprovante(data)
    setTipoEscolhido(null)
    setEscolherOutro(false)
    avisar(`${rotuloMarcacao(data.tipo)} registrada às ${hora(data.marcado_em)} · NSR ${Number(data.nsr)}`)
    setRegistros((lista) => [...lista, data])
  }

  if (carregando) return <div className="cartao"><Esqueleto blocos={1} linhas={3} /></div>

  const semUnidade = !perfil.filial_id
  const estado = SITUACAO_AGORA[agora]
  const trabalhados = minutosTrabalhados(registros)
  const textoBotao = etapa === 'localizacao' ? 'Obtendo localização…' : etapa === 'registrando' ? 'Registrando…' : acaoMarcacao(tipo)

  return (
    <div className="ponto">
      {comprovante && (
        <Comprovante registro={comprovante} perfil={perfil} unidade={unidade} empresa={empresa} aoFechar={() => setComprovante(null)} />
      )}

      <section className="cartao ponto" aria-labelledby="titulo-ponto">
        <h2 id="titulo-ponto" className="sr-only">Registrar ponto</h2>
        <p className="suave pequeno" style={{ textAlign: 'center' }}>
          Olá, {primeiroNome(perfil.nome_completo) || 'tudo bem'}{unidade ? ` · ${unidade.nome}` : ''}
        </p>
        <Relogio />
        <div className="ponto__estado">
          <Etiqueta tom={estado.tom}>{estado.rotulo}{registros.length ? ` · ${duracao(trabalhados)} hoje` : ''}</Etiqueta>
        </div>

        {semUnidade ? (
          <Alerta tom="atencao" titulo="Sua conta ainda não está ligada a uma unidade">
            Fale com o RH da sua empresa para liberar o registro de ponto.
          </Alerta>
        ) : (
          <>
            <p className="ponto__proxima">
              {tipoEscolhido && tipoEscolhido !== sugerido ? 'Você escolheu: ' : 'Próxima marcação esperada: '}
              <strong>{rotuloMarcacao(tipo)}</strong>
            </p>
            <Botao tamanho="grande" bloco icone={Clock} onClick={registrar} carregando={Boolean(etapa)}>
              {textoBotao}
            </Botao>
            {erro && <Alerta tom="problema">{erro}</Alerta>}

            {!escolherOutro ? (
              <div style={{ textAlign: 'center' }}>
                <button type="button" className="link link--suave" onClick={() => setEscolherOutro(true)}>
                  Registrar outro tipo
                </button>
              </div>
            ) : (
              <fieldset className="pilha">
                <legend className="suave pequeno" style={{ marginBottom: 8 }}>Escolha o tipo de marcação:</legend>
                <div className="ponto__tipos">
                  {TIPOS_MARCACAO.map((t) => (
                    <button
                      key={t.valor}
                      type="button"
                      className="ponto__tipo"
                      aria-pressed={tipo === t.valor}
                      onClick={() => setTipoEscolhido(t.valor)}
                    >
                      {t.rotulo}
                      {t.valor === sugerido && <small>sugerida</small>}
                    </button>
                  ))}
                </div>
                <div style={{ textAlign: 'center' }}>
                  <button type="button" className="link link--suave" onClick={() => { setEscolherOutro(false); setTipoEscolhido(null) }}>
                    Voltar para a sugestão
                  </button>
                </div>
              </fieldset>
            )}
          </>
        )}
      </section>

      <section className="cartao" aria-labelledby="titulo-hoje">
        <div className="cartao__cabecalho" style={{ marginBottom: 4 }}>
          <h2 id="titulo-hoje">Marcações de hoje</h2>
        </div>
        {erroCarga ? (
          <EstadoErro aoTentarDeNovo={carregar} />
        ) : registros.length === 0 ? (
          <EstadoVazio icone={History} titulo="Nenhuma marcação hoje">
            Quando você registrar o ponto, a marcação aparece aqui com o horário e o NSR.
          </EstadoVazio>
        ) : (
          <ol className="linha-tempo">
            {registros.map((r) => (
              <li key={r.id}>
                <span className="linha-tempo__hora">{hora(r.marcado_em)}</span>
                <span>{rotuloMarcacao(r.tipo)}</span>
                <button type="button" className="link link--suave linha-tempo__nsr" onClick={() => setComprovante(r)} title="Ver comprovante">
                  NSR {nsr(r.nsr)}
                </button>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  )
}
