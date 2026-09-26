import { useCallback, useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Clock, History, ScanFace } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../contexts/AuthContext'
import { useAvisos } from '../../contexts/AvisosContext'
import useRosto from '../../hooks/useRosto'
import { obterLocalizacao } from '../../lib/localizacao'
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
import PontoFacial from '../rosto/PontoFacial'
import { EtiquetaVerificacao } from '../rosto/EtiquetaVerificacao'

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
  const [verificacoes, setVerificacoes] = useState({}) // registro_id -> verificação facial
  const [fluxoFacial, setFluxoFacial] = useState(false)
  const rosto = useRosto()
  const local = useLocation()
  const linkConta = local.pathname.startsWith('/gestao') ? '/gestao/conta' : '/conta'

  const carregar = useCallback(async () => {
    setErroCarga(false)
    const [regs, uni, emp, ver] = await Promise.all([
      supabase.from('registros_ponto').select('*').eq('perfil_id', perfil.id)
        .gte('marcado_em', inicioDeHoje()).order('marcado_em', { ascending: true }),
      perfil.filial_id
        ? supabase.from('filiais').select('id, nome').eq('id', perfil.filial_id).maybeSingle()
        : Promise.resolve({ data: null }),
      supabase.from('empresas').select('id, nome, reconhecimento_facial').eq('id', perfil.empresa_id).maybeSingle(),
      supabase.from('verificacoes_faciais').select('registro_id, resultado, conferencia')
        .eq('perfil_id', perfil.id).gte('criado_em', inicioDeHoje()),
    ])
    if (regs.error) setErroCarga(true)
    setRegistros(regs.data || [])
    setUnidade(uni.data || null)
    setEmpresa(emp.data || null)
    setVerificacoes(Object.fromEntries((ver.data || []).map((v) => [v.registro_id, v])))
    setCarregando(false)
  }, [perfil.id, perfil.filial_id, perfil.empresa_id])

  useEffect(() => { carregar() }, [carregar])

  const sugerido = sugerirProximaMarcacao(registros)
  const tipo = tipoEscolhido || sugerido
  const agora = situacaoAgora(registros)

  const usaRosto = Boolean(empresa?.reconhecimento_facial)

  function concluirFacial(data) {
    const { verificacao_facial: verificacao, ...registro } = data
    setFluxoFacial(false)
    if (verificacao) setVerificacoes((v) => ({ ...v, [registro.id]: { registro_id: registro.id, ...verificacao } }))
    finalizar(registro)
  }

  function finalizar(data) {
    setComprovante(data)
    setTipoEscolhido(null)
    setEscolherOutro(false)
    avisar(`${rotuloMarcacao(data.tipo)} registrada às ${hora(data.marcado_em)} · NSR ${Number(data.nsr)}`)
    setRegistros((lista) => [...lista, data])
  }

  async function registrar() {
    setErro('')
    if (usaRosto) {
      setFluxoFacial(true)
      return
    }
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
    finalizar(data)
  }

  if (carregando) return <div className="cartao"><Esqueleto blocos={1} linhas={3} /></div>

  const semUnidade = !perfil.filial_id
  const estado = SITUACAO_AGORA[agora]
  const trabalhados = minutosTrabalhados(registros)
  const textoBotao = etapa === 'localizacao' ? 'Obtendo localização…' : etapa === 'registrando' ? 'Registrando…' : acaoMarcacao(tipo)

  return (
    <div className="ponto">
      {comprovante && (
        <Comprovante registro={comprovante} verificacao={verificacoes[comprovante.id]} perfil={perfil} unidade={unidade} empresa={empresa} aoFechar={() => setComprovante(null)} />
      )}
      {fluxoFacial && (
        <PontoFacial tipo={tipo} rosto={rosto} aoConcluir={concluirFacial} aoFechar={() => setFluxoFacial(false)} />
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
            <Botao tamanho="grande" bloco icone={usaRosto ? ScanFace : Clock} onClick={registrar} carregando={Boolean(etapa)}>
              {textoBotao}
            </Botao>
            {usaRosto && !rosto.carregando && !rosto.aprovada && (
              <p className="suave pequeno" style={{ textAlign: 'center' }}>
                {rosto.pendente
                  ? 'Sua foto de cadastro está aguardando aprovação do RH.'
                  : <>Você ainda não cadastrou seu rosto. <Link to={linkConta} className="link">Cadastrar agora</Link></>}
              </p>
            )}
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
                <span>{rotuloMarcacao(r.tipo)} <EtiquetaVerificacao verificacao={verificacoes[r.id]} compacta /></span>
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
