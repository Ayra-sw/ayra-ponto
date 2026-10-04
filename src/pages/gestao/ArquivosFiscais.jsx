import { useEffect, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { Download, FileCheck2, FileClock, ShieldCheck } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { traduzirErro } from '../../lib/mensagensErro'
import { cnpjValido } from '../../lib/cnpj'
import { PERIODOS_PRONTOS, periodoPronto, diasNoPeriodo } from '../../lib/relatorios'
import { diaIso } from '../../lib/ajustes'
import { abrirAjuda } from '../../lib/abrirAjuda'
import { baixarTextoLatin1, nomeArquivoFiscal } from '../../lib/arquivosFiscais'
import Botao from '../../components/ui/Botao'
import Alerta from '../../components/ui/Alerta'
import { Campo, Selecao } from '../../components/ui/Campo'

function Periodo({ id, inicio, fim, aoMudar, max }) {
  return (
    <>
      <div className="grade-campos">
        <Campo id={`${id}-ini`} rotulo="Primeiro dia" type="date" value={inicio} max={max} onChange={(e) => aoMudar({ inicio: e.target.value, fim })} />
        <Campo id={`${id}-fim`} rotulo="Último dia" type="date" value={fim} max={max} onChange={(e) => aoMudar({ inicio, fim: e.target.value })} />
      </div>
      <div className="linha" role="group" aria-label="Períodos prontos" style={{ gap: 6 }}>
        {PERIODOS_PRONTOS.filter((p) => ['mes', 'mes_passado'].includes(p.id)).map((p) => {
          const per = periodoPronto(p.id)
          return (
            <button key={p.id} type="button" className="ficha" aria-pressed={per.inicio === inicio && per.fim === fim}
              onClick={() => aoMudar(per)}>{p.rotulo}</button>
          )
        })}
      </div>
    </>
  )
}

// Arquivos que a fiscalização do trabalho pode pedir (Portaria 671):
// AFD (as marcações como foram feitas) e AEJ (a jornada tratada).
export default function ArquivosFiscais() {
  const { empresa, unidades } = useOutletContext()
  const [sistema, setSistema] = useState(null)
  const [unidade, setUnidade] = useState('')
  const [afd, setAfd] = useState(periodoPronto('mes_passado'))
  const [aej, setAej] = useState(periodoPronto('mes_passado'))
  const [gerando, setGerando] = useState('')
  const [erro, setErro] = useState({ afd: '', aej: '' })
  const [feito, setFeito] = useState({ afd: '', aej: '' })

  useEffect(() => {
    supabase.from('ayra_sistema').select('*').maybeSingle().then(({ data, error }) => setSistema(error ? false : (data || false)))
  }, [])
  useEffect(() => {
    if (!unidade && unidades.length) setUnidade((unidades.find((u) => u.ativa !== false) || unidades[0]).id)
  }, [unidades, unidade])

  const und = unidades.find((u) => u.id === unidade)
  const semCnpj = !empresa?.cnpj || !cnpjValido(empresa.cnpj)
  const pendenteAyra = sistema && (!sistema.inpi_registro || !sistema.desenvolvedor_doc)
  const naoInstalado = sistema === false

  function conferir(qual, per) {
    if (!per.inicio || !per.fim) return 'Escolha o primeiro e o último dia.'
    if (per.fim < per.inicio) return 'O último dia precisa ser depois do primeiro.'
    if (qual === 'aej' && per.fim > diaIso()) return 'Escolha um período até hoje.'
    if (qual === 'aej' && diasNoPeriodo(per.inicio, per.fim) > 93) return 'O AEJ pode ter no máximo 3 meses por arquivo. Gere em partes.'
    if (qual === 'afd' && diasNoPeriodo(per.inicio, per.fim) > 367) return 'O AFD pode ter no máximo 1 ano por arquivo. Gere em partes.'
    return ''
  }

  async function gerar(qual) {
    const per = qual === 'afd' ? afd : aej
    const problema = conferir(qual, per)
    setFeito((f) => ({ ...f, [qual]: '' }))
    if (problema) { setErro((e) => ({ ...e, [qual]: problema })); return }
    setErro((e) => ({ ...e, [qual]: '' }))
    setGerando(qual)
    const { data, error } = await supabase.rpc(qual === 'afd' ? 'gerar_afd' : 'gerar_aej', { p_filial: unidade, p_inicio: per.inicio, p_fim: per.fim })
    setGerando('')
    if (error) { setErro((e) => ({ ...e, [qual]: traduzirErro(error) })); return }
    const nome = nomeArquivoFiscal(qual, { empresa, unidade: und, inicio: per.inicio, fim: per.fim })
    baixarTextoLatin1(String(data || ''), nome)
    setFeito((f) => ({ ...f, [qual]: nome }))
  }

  return (
    <div className="pagina" style={{ maxWidth: 980 }}>
      <div className="pagina__cabecalho">
        <div className="pagina__titulo">
          <span className="pagina__trilha">Gestão</span>
          <h1>Arquivos fiscais</h1>
          <p className="suave">Os arquivos que a fiscalização do trabalho pode pedir, no formato oficial da Portaria 671.</p>
        </div>
        <Botao variante="secundario" onClick={() => abrirAjuda('arquivos-fiscais')}>Como funciona</Botao>
      </div>

      {naoInstalado && (
        <Alerta tom="atencao" titulo="Os arquivos fiscais ainda não foram instalados no banco">
          Rode a migração da Fase 5A no Supabase (passo a passo no guia da fase).
        </Alerta>
      )}
      {semCnpj && (
        <Alerta tom="atencao" titulo="Falta o CNPJ da empresa" acao={<Link to="/gestao/configuracoes/empresa" className="link">Abrir Empresa</Link>}>
          O AFD e o AEJ identificam o empregador pelo CNPJ. Cadastre o CNPJ antes de gerar os arquivos.
        </Alerta>
      )}
      {pendenteAyra && (
        <Alerta tom="info" titulo="Dados do Ayra Ponto em conclusão">
          O número de registro do programa no INPI e os dados da empresa desenvolvedora ainda estão sendo concluídos.
          Os arquivos já podem ser gerados; esses campos saem zerados ou em branco até lá.
        </Alerta>
      )}
      <Alerta tom="info" titulo="Assinatura digital">
        A assinatura digital ICP-Brasil (o arquivo .p7s que acompanha o AFD e o AEJ) chega na próxima atualização do Ayra Ponto.
      </Alerta>

      {unidades.length > 1 && (
        <div style={{ maxWidth: 360 }}>
          <Selecao rotulo="Unidade" value={unidade} onChange={(e) => setUnidade(e.target.value)}
            ajuda="Cada unidade tem a própria sequência de NSR e o próprio arquivo."
            opcoes={unidades.map((u) => ({ valor: u.id, rotulo: u.nome + (u.ativa === false ? ' (desativada)' : '') }))} />
        </div>
      )}

      <div className="grade-2">
        <section className="cartao pilha" aria-labelledby="t-afd">
          <div className="linha" style={{ gap: 10 }}>
            <FileClock aria-hidden="true" className="arquivo-fiscal__icone" />
            <div>
              <h2 id="t-afd" style={{ margin: 0 }}>AFD</h2>
              <p className="suave pequeno" style={{ margin: 0 }}>Arquivo Fonte de Dados</p>
            </div>
          </div>
          <p className="pequeno" style={{ margin: 0 }}>
            Todas as marcações <strong>exatamente como foram feitas</strong>, com NSR e código de integridade, mais os
            cadastros da empresa e das pessoas. Ajustes aprovados não mudam o AFD.
          </p>
          <Periodo id="afd" inicio={afd.inicio} fim={afd.fim} aoMudar={setAfd} />
          <p className="suave pequeno" style={{ margin: 0 }}>Até 1 ano por arquivo.</p>
          {erro.afd && <Alerta tom="problema">{erro.afd}</Alerta>}
          {feito.afd && <Alerta tom="ok">Pronto: {feito.afd} foi baixado.</Alerta>}
          <div><Botao icone={Download} onClick={() => gerar('afd')} carregando={gerando === 'afd'} disabled={!unidade || naoInstalado}>Baixar AFD</Botao></div>
        </section>

        <section className="cartao pilha" aria-labelledby="t-aej">
          <div className="linha" style={{ gap: 10 }}>
            <FileCheck2 aria-hidden="true" className="arquivo-fiscal__icone" />
            <div>
              <h2 id="t-aej" style={{ margin: 0 }}>AEJ</h2>
              <p className="suave pequeno" style={{ margin: 0 }}>Arquivo Eletrônico de Jornada</p>
            </div>
          </div>
          <p className="pequeno" style={{ margin: 0 }}>
            A jornada <strong>já tratada</strong>: horários contratuais, marcações com os ajustes aprovados (e o motivo),
            faltas e movimentos do banco de horas.
          </p>
          <Periodo id="aej" inicio={aej.inicio} fim={aej.fim} aoMudar={setAej} max={diaIso()} />
          <p className="suave pequeno" style={{ margin: 0 }}>Até 3 meses por arquivo, até hoje.</p>
          {erro.aej && <Alerta tom="problema">{erro.aej}</Alerta>}
          {feito.aej && <Alerta tom="ok">Pronto: {feito.aej} foi baixado.</Alerta>}
          <div><Botao icone={Download} onClick={() => gerar('aej')} carregando={gerando === 'aej'} disabled={!unidade || naoInstalado}>Baixar AEJ</Botao></div>
        </section>
      </div>

      <p className="suave pequeno linha" style={{ gap: 6 }}>
        <ShieldCheck aria-hidden="true" className="icone-inline" />
        Os arquivos seguem os leiautes oficiais (Anexos V e VI da Portaria 671), em texto ISO-8859-1. Só o administrador e o RH podem baixar.
      </p>
    </div>
  )
}
