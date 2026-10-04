// =============================================================================
// Ayra Ponto — Edge Function "assinar" (Fase 5B)
//
// Assina com o certificado digital A1 da Ayra Soluções (ICP-Brasil):
//   * AFD e AEJ  → assinatura CAdES em arquivo .p7s destacado (Portaria 671)
//   * Comprovante de Registro de Ponto do Trabalhador → PDF com assinatura PAdES
//
// O certificado fica no Storage, no cofre privado "certificados", com o nome
// "certificado-a1.pfx". A senha fica no segredo CERTIFICADO_SENHA da função.
// Nenhum dos dois aparece no código nem no GitHub.
//
// Quem pode o quê é decidido pelo banco (as mesmas regras do app): a função
// chama gerar_afd, gerar_aej e dados_comprovante com o login de quem pediu.
//
// Pedidos (POST, JSON):
//   { "acao": "status" }
//   { "acao": "afd" | "aej", "filial": "<uuid>", "inicio": "AAAA-MM-DD", "fim": "AAAA-MM-DD" }
//   { "acao": "comprovante", "registro": "<uuid>" }
// =============================================================================
import forge from 'npm:node-forge@1.3.1'
import { PDFDocument, PDFHexString, PDFName, PDFString, StandardFonts, rgb } from 'npm:pdf-lib@1.17.1'
import { createClient } from 'npm:@supabase/supabase-js@2.45.4'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const ARQUIVO_CERTIFICADO = 'certificado-a1.pfx'
const RESERVA_ASSINATURA = 16384 // bytes reservados no PDF para a assinatura

const asn1 = forge.asn1
const oids = {
  data: '1.2.840.113549.1.7.1',
  signedData: '1.2.840.113549.1.7.2',
  contentType: '1.2.840.113549.1.9.3',
  messageDigest: '1.2.840.113549.1.9.4',
  signingTime: '1.2.840.113549.1.9.5',
  signingCertificateV2: '1.2.840.113549.1.9.16.2.47',
  sha256: '2.16.840.1.101.3.4.2.1',
  rsaEncryption: '1.2.840.113549.1.1.1',
}

// ------------------------------------------------------------ utilidades
function bytesParaBinario(b: Uint8Array): string {
  let s = ''
  for (let i = 0; i < b.length; i += 8192) s += String.fromCharCode(...b.subarray(i, i + 8192))
  return s
}
function binarioParaBytes(s: string): Uint8Array {
  const b = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i) & 0xff
  return b
}
export function paraLatin1(texto: string): Uint8Array {
  const b = new Uint8Array(texto.length)
  for (let i = 0; i < texto.length; i++) { const c = texto.charCodeAt(i); b[i] = c <= 0xff ? c : 0x3f }
  return b
}
function base64(b: Uint8Array): string { return forge.util.encode64(bytesParaBinario(b)) }
function nomeCampo(dn: any, campo: string): string { try { return dn.getField(campo)?.value || '' } catch { return '' } }

// ------------------------------------------------------------ certificado
export type Certificado = {
  chave: any
  cert: any
  cadeia: any[]
  info: { titular: string; emissor: string; valido_ate: string; teste: boolean; vencido: boolean }
}

export function lerCertificado(pfx: Uint8Array, senha: string): Certificado {
  const p12 = forge.pkcs12.pkcs12FromAsn1(asn1.fromDer(bytesParaBinario(pfx)), senha)
  const chaves = [
    ...(p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag] || []),
    ...(p12.getBags({ bagType: forge.pki.oids.keyBag })[forge.pki.oids.keyBag] || []),
  ]
  const certs = (p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag] || []).map((b: any) => b.cert)
  if (!chaves.length || !certs.length) throw new Error('O arquivo do certificado não tem a chave ou o certificado.')
  const chave = chaves[0].key
  const cert = certs.find((c: any) => c.publicKey.n && c.publicKey.n.equals(chave.n)) || certs[0]
  const emissorTexto = cert.issuer.attributes.map((a: any) => a.value).join(' ')
  const info = {
    titular: nomeCampo(cert.subject, 'CN'),
    emissor: nomeCampo(cert.issuer, 'CN'),
    valido_ate: cert.validity.notAfter.toISOString(),
    // certificado de teste: não é da cadeia ICP-Brasil (ou diz TESTE)
    teste: !/ICP-Brasil/i.test(emissorTexto) || /TESTE/i.test(emissorTexto + ' ' + nomeCampo(cert.subject, 'CN')),
    vencido: cert.validity.notAfter.getTime() < Date.now(),
  }
  return { chave, cert, cadeia: certs.filter((c: any) => c !== cert), info }
}

// ------------------------------------------------------------ CAdES (CMS destacado)
// SignedData com os atributos assinados exigidos pelo CAdES-BES:
// content-type, signing-time, message-digest e signing-certificate-v2.
export function assinarCades(dados: Uint8Array, c: Certificado, quando = new Date()): Uint8Array {
  const md = forge.md.sha256.create()
  md.update(bytesParaBinario(dados))
  const resumo = md.digest().getBytes()

  const certAsn1 = forge.pki.certificateToAsn1(c.cert)
  const tbs = certAsn1.value[0]
  const temVersao = tbs.value[0].tagClass === asn1.Class.CONTEXT_SPECIFIC
  const serial = tbs.value[temVersao ? 1 : 0]
  const emissor = tbs.value[temVersao ? 3 : 2]
  const certDer = asn1.toDer(certAsn1).getBytes()
  const mdCert = forge.md.sha256.create(); mdCert.update(certDer)

  const oid = (o: string) => asn1.create(asn1.Class.UNIVERSAL, asn1.Type.OID, false, asn1.oidToDer(o).getBytes())
  const seq = (v: any[]) => asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, v)
  const set = (v: any[]) => asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SET, true, v)
  const octet = (b: string) => asn1.create(asn1.Class.UNIVERSAL, asn1.Type.OCTETSTRING, false, b)
  const algSha256 = seq([oid(oids.sha256), asn1.create(asn1.Class.UNIVERSAL, asn1.Type.NULL, false, '')])
  const atributo = (tipo: string, valor: any) => seq([oid(tipo), set([valor])])

  const atributos = [
    atributo(oids.contentType, oid(oids.data)),
    atributo(oids.signingTime, asn1.create(asn1.Class.UNIVERSAL, asn1.Type.UTCTIME, false, asn1.dateToUtcTime(quando))),
    atributo(oids.messageDigest, octet(resumo)),
    atributo(oids.signingCertificateV2, seq([seq([seq([
      octet(mdCert.digest().getBytes()),
      seq([seq([asn1.create(asn1.Class.CONTEXT_SPECIFIC, 4, true, [asn1.copy(emissor)])]), asn1.copy(serial)]),
    ])])])),
  ]
  // DER: os itens de um SET OF ficam em ordem crescente de codificação
  const ordenados = atributos
    .map((a) => ({ a, der: asn1.toDer(a).getBytes() }))
    .sort((x, y) => (x.der < y.der ? -1 : x.der > y.der ? 1 : 0))
    .map((x) => x.a)
  const conjunto = set(ordenados)
  const mdAttr = forge.md.sha256.create()
  mdAttr.update(asn1.toDer(conjunto).getBytes())
  const assinatura = c.chave.sign(mdAttr)

  const signerInfo = seq([
    asn1.create(asn1.Class.UNIVERSAL, asn1.Type.INTEGER, false, asn1.integerToDer(1).getBytes()),
    seq([asn1.copy(emissor), asn1.copy(serial)]),
    algSha256,
    asn1.create(asn1.Class.CONTEXT_SPECIFIC, 0, true, ordenados),
    seq([oid(oids.rsaEncryption), asn1.create(asn1.Class.UNIVERSAL, asn1.Type.NULL, false, '')]),
    octet(assinatura),
  ])
  const signedData = seq([
    asn1.create(asn1.Class.UNIVERSAL, asn1.Type.INTEGER, false, asn1.integerToDer(1).getBytes()),
    set([algSha256]),
    seq([oid(oids.data)]),
    asn1.create(asn1.Class.CONTEXT_SPECIFIC, 0, true, [certAsn1, ...c.cadeia.map((x: any) => forge.pki.certificateToAsn1(x))]),
    set([signerInfo]),
  ])
  const contentInfo = seq([oid(oids.signedData), asn1.create(asn1.Class.CONTEXT_SPECIFIC, 0, true, [signedData])])
  return binarioParaBytes(asn1.toDer(contentInfo).getBytes())
}

// ------------------------------------------------------------ comprovante (PDF)
const ROTULO_TIPO: Record<string, string> = {
  entrada: 'Entrada', saida: 'Saída', inicio_intervalo: 'Início do intervalo', fim_intervalo: 'Fim do intervalo',
}
function formatarDoc(doc: string): string {
  const d = String(doc || '').toUpperCase().replace(/[^0-9A-Z]/g, '')
  if (d.length === 14) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`
  if (d.length === 11) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
  return d || 'não informado'
}

export async function montarComprovante(d: any, c: Certificado | null): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  pdf.setTitle(`Comprovante de Registro de Ponto - NSR ${d.nsr}`)
  pdf.setAuthor(d.programa || 'Ayra Ponto')
  pdf.setCreator('Ayra Ponto')
  pdf.setProducer('Ayra Ponto')
  const pagina = pdf.addPage([420, 595]) // A5
  const normal = await pdf.embedFont(StandardFonts.Helvetica)
  const negrito = await pdf.embedFont(StandardFonts.HelveticaBold)
  const mono = await pdf.embedFont(StandardFonts.Courier)
  const azul = rgb(0.106, 0.165, 0.278)
  const cinza = rgb(0.38, 0.42, 0.48)
  let y = 555
  const linha = (rotulo: string, valor: string, fonte = normal, tam = 10) => {
    pagina.drawText(rotulo, { x: 32, y, size: 8, font: negrito, color: cinza })
    y -= 13
    for (const parte of quebrar(valor, fonte, tam, 356)) { pagina.drawText(parte, { x: 32, y, size: tam, font: fonte, color: azul }); y -= tam + 4 }
    y -= 6
  }
  const quebrar = (t: string, f: any, tam: number, largura: number) => {
    const palavras = String(t || '—').split(/(\s+)/)
    const saida: string[] = []; let atual = ''
    for (const p of palavras) {
      if (f.widthOfTextAtSize(atual + p, tam) > largura && atual.trim()) { saida.push(atual.trim()); atual = p.trimStart() }
      else atual += p
      while (f.widthOfTextAtSize(atual, tam) > largura) { // palavra maior que a linha (ex.: hash)
        let n = atual.length; while (n > 1 && f.widthOfTextAtSize(atual.slice(0, n), tam) > largura) n--
        saida.push(atual.slice(0, n)); atual = atual.slice(n)
      }
    }
    if (atual.trim()) saida.push(atual.trim())
    return saida
  }

  pagina.drawText('Comprovante de Registro de Ponto do Trabalhador', { x: 32, y, size: 13, font: negrito, color: azul }); y -= 18
  pagina.drawText(`${ROTULO_TIPO[d.tipo] || d.tipo} · ${d.data} às ${d.hora} (UTC${d.fuso.slice(0, 3)}:${d.fuso.slice(3)})`, { x: 32, y, size: 10, font: normal, color: cinza }); y -= 26
  linha('NSR (NÚMERO SEQUENCIAL DE REGISTRO)', String(d.nsr).padStart(9, '0'), mono, 12)
  linha('DATA E HORÁRIO DO REGISTRO', `${d.data} ${d.hora}`)
  const e = d.empregador || {}
  linha('EMPREGADOR', e.razao_social || '—')
  linha(e.tipo_id === '2' ? 'CPF DO EMPREGADOR' : 'CNPJ DO EMPREGADOR', formatarDoc(e.documento))
  if (e.cno_caepf) linha('CNO / CAEPF', String(e.cno_caepf))
  linha('LOCAL DE PRESTAÇÃO DO SERVIÇO', e.local || d.unidade || '—')
  linha('TRABALHADOR', d.trabalhador?.nome || '—')
  linha('CPF DO TRABALHADOR', formatarDoc(d.trabalhador?.cpf))
  linha('REP-P: NÚMERO DE REGISTRO NO INPI', d.inpi ? String(d.inpi) : 'registro no INPI em andamento')
  linha('CÓDIGO HASH (SHA-256)', d.hash || '—', mono, 8)
  y -= 4
  const nota = c
    ? `Documento assinado eletronicamente (PAdES) com o certificado de ${c.info.titular}${c.info.teste ? ' — CERTIFICADO DE TESTE, sem validade ICP-Brasil' : ''}. Horário registrado pelo servidor do ${d.programa || 'Ayra Ponto'}.`
    : `Documento SEM assinatura eletrônica: o certificado digital ainda não foi configurado. Horário registrado pelo servidor do ${d.programa || 'Ayra Ponto'}.`
  for (const parte of quebrar(nota, normal, 8, 356)) { pagina.drawText(parte, { x: 32, y, size: 8, font: normal, color: cinza }); y -= 11 }

  if (!c) return await pdf.save({ useObjectStreams: false })
  return await assinarPdf(pdf, pagina, c)
}

// PAdES: dicionário de assinatura com espaço reservado, depois o CMS destacado
// cobrindo o arquivo inteiro menos o próprio espaço da assinatura.
async function assinarPdf(pdf: any, pagina: any, c: Certificado): Promise<Uint8Array> {
  const ctx = pdf.context
  const agora = new Date()
  const marcador = PDFName.of('**********')
  const sig = ctx.obj({
    Type: 'Sig',
    Filter: 'Adobe.PPKLite',
    SubFilter: 'ETSI.CAdES.detached',
    ByteRange: [0, marcador, marcador, marcador],
    Contents: PDFHexString.of('0'.repeat(RESERVA_ASSINATURA * 2)),
    Reason: PDFString.of('Comprovante de Registro de Ponto do Trabalhador (Portaria MTP 671/2021)'),
    M: PDFString.fromDate(agora),
    Name: PDFString.of(c.info.titular || 'Ayra Ponto'),
  })
  const sigRef = ctx.register(sig)
  const campo = ctx.obj({
    Type: 'Annot', Subtype: 'Widget', FT: 'Sig', Rect: [0, 0, 0, 0], V: sigRef,
    T: PDFString.of('AssinaturaAyraPonto'), F: 132, P: pagina.ref,
  })
  const campoRef = ctx.register(campo)
  pagina.node.set(PDFName.of('Annots'), ctx.obj([campoRef]))
  pdf.catalog.set(PDFName.of('AcroForm'), ctx.obj({ Fields: [campoRef], SigFlags: 3 }))

  const bytes: Uint8Array = await pdf.save({ useObjectStreams: false })
  const texto = bytesParaBinario(bytes)
  const marcaBR = '/ByteRange [ 0 /********** /********** /********** ]'
  let posBR = texto.indexOf(marcaBR)
  let marca = marcaBR
  if (posBR < 0) { marca = '/ByteRange [0 /********** /********** /**********]'; posBR = texto.indexOf(marca) }
  if (posBR < 0) throw new Error('Não encontrei o espaço da assinatura no PDF.')
  const posC = texto.indexOf('<' + '0'.repeat(RESERVA_ASSINATURA * 2) + '>')
  if (posC < 0) throw new Error('Não encontrei o espaço reservado do /Contents.')
  const fimC = posC + RESERVA_ASSINATURA * 2 + 2
  const br = [0, posC, fimC, bytes.length - fimC]
  let novoBR = `/ByteRange [${br.join(' ')}]`
  if (novoBR.length > marca.length) throw new Error('Espaço do ByteRange insuficiente.')
  novoBR = novoBR + ' '.repeat(marca.length - novoBR.length)
  const saida = new Uint8Array(bytes)
  saida.set(binarioParaBytes(novoBR), posBR)
  const cobertos = new Uint8Array(br[1] + br[3])
  cobertos.set(saida.subarray(0, br[1]), 0)
  cobertos.set(saida.subarray(br[2]), br[1])
  const cms = assinarCades(cobertos, c, agora)
  if (cms.length > RESERVA_ASSINATURA) throw new Error('A assinatura ficou maior que o espaço reservado.')
  const hex = Array.from(cms, (x) => x.toString(16).padStart(2, '0')).join('').padEnd(RESERVA_ASSINATURA * 2, '0')
  saida.set(binarioParaBytes(hex), posC + 1)
  return saida
}

// ------------------------------------------------------------ servidor
let cacheCert: { em: number; valor: Certificado | null; erro?: string } | null = null
async function obterCertificado(admin: any): Promise<{ cert: Certificado | null; erro?: string }> {
  if (cacheCert && Date.now() - cacheCert.em < 5 * 60 * 1000) return { cert: cacheCert.valor, erro: cacheCert.erro }
  const senha = Deno.env.get('CERTIFICADO_SENHA') || ''
  const { data, error } = await admin.storage.from('certificados').download(ARQUIVO_CERTIFICADO)
  let valor: Certificado | null = null
  let erro: string | undefined
  if (error || !data) erro = 'O certificado digital ainda não foi configurado.'
  else if (!senha) erro = 'Falta a senha do certificado (segredo CERTIFICADO_SENHA).'
  else {
    try {
      valor = lerCertificado(new Uint8Array(await data.arrayBuffer()), senha)
      if (valor.info.vencido) { erro = 'O certificado digital está vencido. Renove e troque o arquivo.'; valor = null }
    } catch (e) {
      erro = /password|mac|invalid/i.test(String((e as Error).message)) ? 'A senha do certificado não confere.' : 'Não foi possível ler o certificado.'
    }
  }
  cacheCert = { em: Date.now(), valor, erro }
  return { cert: valor, erro }
}

// Chaves do projeto: as antigas (anon/service_role) ou as novas (publishable/secret)
function chaveDoProjeto(antiga: string, nova: string): string {
  const v = Deno.env.get(antiga)
  if (v) return v
  try {
    const j = JSON.parse(Deno.env.get(nova) || '{}')
    return j.default || (Object.values(j)[0] as string) || ''
  } catch { return '' }
}

function resposta(corpo: unknown, status = 200) {
  return new Response(JSON.stringify(corpo), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })
}

if (typeof Deno !== 'undefined' && Deno.serve && !Deno.env.get('AYRA_SEM_SERVIDOR')) {
  Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
    if (req.method !== 'POST') return resposta({ erro: 'Use POST.' }, 405)
    const autorizacao = req.headers.get('Authorization') || ''
    if (!autorizacao) return resposta({ erro: 'É preciso estar logado.' }, 401)
    const url = Deno.env.get('SUPABASE_URL')!
    const usuario = createClient(url, chaveDoProjeto('SUPABASE_ANON_KEY', 'SUPABASE_PUBLISHABLE_KEYS'), { global: { headers: { Authorization: autorizacao } }, auth: { persistSession: false } })
    const admin = createClient(url, chaveDoProjeto('SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SECRET_KEYS'), { auth: { persistSession: false } })

    let pedido: any
    try { pedido = await req.json() } catch { return resposta({ erro: 'Pedido inválido.' }, 400) }

    try {
      const { cert, erro: erroCert } = await obterCertificado(admin)
      if (pedido.acao === 'status') {
        const { data: u } = await usuario.auth.getUser()
        if (!u?.user) return resposta({ erro: 'É preciso estar logado.' }, 401)
        return resposta({ configurado: Boolean(cert), aviso: erroCert || null, certificado: cert?.info || null })
      }

      if (pedido.acao === 'afd' || pedido.acao === 'aej') {
        const { data, error } = await usuario.rpc(pedido.acao === 'afd' ? 'gerar_afd' : 'gerar_aej',
          { p_filial: pedido.filial, p_inicio: pedido.inicio, p_fim: pedido.fim })
        if (error) return resposta({ erro: error.message, codigo: error.code }, 400)
        const arquivo = paraLatin1(String(data || ''))
        const p7s = cert ? assinarCades(arquivo, cert) : null
        return resposta({
          arquivo: base64(arquivo),
          p7s: p7s ? base64(p7s) : null,
          certificado: cert?.info || null,
          aviso: cert ? null : erroCert,
        })
      }

      if (pedido.acao === 'comprovante') {
        const { data, error } = await usuario.rpc('dados_comprovante', { p_registro: pedido.registro })
        if (error) return resposta({ erro: error.message, codigo: error.code }, 400)
        const pdf = await montarComprovante(data, cert)
        return resposta({ pdf: base64(pdf), assinado: Boolean(cert), certificado: cert?.info || null, aviso: cert ? null : erroCert })
      }

      return resposta({ erro: 'Ação desconhecida.' }, 400)
    } catch (e) {
      console.error(e)
      return resposta({ erro: 'Não foi possível assinar agora. Tente de novo em instantes.' }, 500)
    }
  })
}
