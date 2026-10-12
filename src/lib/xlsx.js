// Planilha Excel (.xlsx) feita no próprio navegador, sem biblioteca extra.
// Um .xlsx é um .zip com alguns arquivos XML dentro; aqui o zip é montado
// sem compressão (o Excel, o LibreOffice e o Google Planilhas abrem igual).
//
// gerarXlsx([{ nome, colunas: [{ titulo, largura, tipo }], linhas: [[...]], titulo }])
// Tipos de coluna: 'texto' (padrão), 'duracao' (minutos → h:mm), 'decimal',
// 'inteiro', 'data' ("AAAA-MM-DD"). Uma célula pode ser { v, tipo } para
// mudar o tipo só dela, ou { v, negrito: true }.

const ESTILO = { texto: 0, cabecalho: 1, duracao: 2, data: 3, decimal: 4, titulo: 5, inteiro: 6, quebra: 7, direita: 8, duracaoNegrito: 9, negrito: 10 }

const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="2"><numFmt numFmtId="164" formatCode="[h]:mm"/><numFmt numFmtId="165" formatCode="0.00"/></numFmts>
<fonts count="4">
<font><sz val="11"/><name val="Calibri"/><family val="2"/></font>
<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/><family val="2"/></font>
<font><b/><sz val="14"/><color rgb="FF1B2A47"/><name val="Calibri"/><family val="2"/></font>
<font><b/><sz val="11"/><name val="Calibri"/><family val="2"/></font>
</fonts>
<fills count="3">
<fill><patternFill patternType="none"/></fill>
<fill><patternFill patternType="gray125"/></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FF1B2A47"/><bgColor indexed="64"/></patternFill></fill>
</fills>
<borders count="2">
<border><left/><right/><top/><bottom/><diagonal/></border>
<border><left/><right/><top/><bottom style="medium"><color rgb="FFA8843A"/></bottom><diagonal/></border>
</borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="11">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>
<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="14" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="1" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="right"/></xf>
<xf numFmtId="164" fontId="3" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/>
<xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1"/>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`

// & < > " e caracteres que o XML não aceita
export function escaparXml(texto) {
  return String(texto)
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

// 0 → A, 25 → Z, 26 → AA
export function letraDaColuna(i) {
  let s = ''
  let n = i + 1
  while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26) }
  return s
}

// "2026-09-14" → número de série do Excel (dias desde 30/12/1899)
export function serialDaData(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '')
  if (!m) return null
  return Math.round((Date.UTC(+m[1], +m[2] - 1, +m[3]) - Date.UTC(1899, 11, 30)) / 86400000)
}

// Nome de aba: até 31 letras, sem : \ / ? * [ ]
export function nomeDeAba(nome, usados = new Set()) {
  let base = String(nome || 'Planilha').replace(/[:\\/?*[\]]/g, ' ').trim().slice(0, 31) || 'Planilha'
  let n = base
  let i = 2
  while (usados.has(n.toLowerCase())) { const suf = ` (${i++})`; n = base.slice(0, 31 - suf.length) + suf }
  usados.add(n.toLowerCase())
  return n
}

function celula(ref, valor, tipoColuna) {
  const bruto = valor && typeof valor === 'object' && !Array.isArray(valor) ? valor : { v: valor }
  const v = bruto.v
  if (v === null || v === undefined || v === '') return ''
  const tipo = bruto.tipo || tipoColuna || 'texto'
  if (tipo === 'duracao' && typeof v === 'number') {
    // minutos → fração do dia (o formato [h]:mm passa de 24h sem voltar a zero)
    return `<c r="${ref}" s="${bruto.negrito ? ESTILO.duracaoNegrito : ESTILO.duracao}"><v>${Math.max(0, Math.round(v)) / 1440}</v></c>`
  }
  if (tipo === 'data') {
    const s = serialDaData(v)
    if (s !== null) return `<c r="${ref}" s="${ESTILO.data}"><v>${s}</v></c>`
  }
  if ((tipo === 'decimal' || tipo === 'inteiro') && typeof v === 'number' && Number.isFinite(v)) {
    return `<c r="${ref}" s="${tipo === 'decimal' ? ESTILO.decimal : ESTILO.inteiro}"><v>${tipo === 'decimal' ? Math.round(v * 100) / 100 : Math.round(v)}</v></c>`
  }
  const estilo = bruto.estilo ? ESTILO[bruto.estilo] : bruto.negrito ? ESTILO.negrito : tipo === 'direita' ? ESTILO.direita : tipo === 'quebra' ? ESTILO.quebra : ESTILO.texto
  return `<c r="${ref}" t="inlineStr"${estilo ? ` s="${estilo}"` : ''}><is><t xml:space="preserve">${escaparXml(v)}</t></is></c>`
}

function xmlDaAba(aba) {
  const colunas = aba.colunas || []
  const linhasXml = []
  let r = 1
  // Linhas de título acima do cabeçalho (opcional)
  for (const t of aba.titulo || []) {
    linhasXml.push(`<row r="${r}">${celula(`A${r}`, { v: t, estilo: r === 1 ? 'titulo' : 'texto' })}</row>`)
    r += 1
  }
  if ((aba.titulo || []).length) { r += 1 } // uma linha em branco
  const linhaCabecalho = colunas.length ? r : 0
  if (colunas.length) {
    linhasXml.push(`<row r="${r}" ht="32" customHeight="1">${colunas.map((c, i) => celula(`${letraDaColuna(i)}${r}`, { v: c.titulo, estilo: 'cabecalho' })).join('')}</row>`)
    r += 1
  }
  for (const linha of aba.linhas || []) {
    const cels = linha.map((v, i) => celula(`${letraDaColuna(i)}${r}`, v, colunas[i]?.tipo)).join('')
    linhasXml.push(`<row r="${r}">${cels}</row>`)
    r += 1
  }
  const ultimaCol = letraDaColuna(Math.max(colunas.length, 1) - 1)
  // cabeçalho (e, se pedido, as primeiras colunas) fica parado ao rolar
  const xs = aba.congelarColunas || 0
  const congelar = linhaCabecalho
    ? `<sheetViews><sheetView workbookViewId="0"><pane${xs ? ` xSplit="${xs}"` : ''} ySplit="${linhaCabecalho}" topLeftCell="${letraDaColuna(xs)}${linhaCabecalho + 1}" activePane="${xs ? 'bottomRight' : 'bottomLeft'}" state="frozen"/></sheetView></sheetViews>`
    : '<sheetViews><sheetView workbookViewId="0"/></sheetViews>'
  const larguras = colunas.length
    ? `<cols>${colunas.map((c, i) => `<col min="${i + 1}" max="${i + 1}" width="${c.largura || 14}" customWidth="1"/>`).join('')}</cols>`
    : (aba.larguraA ? `<cols><col min="1" max="1" width="${aba.larguraA}" customWidth="1"/><col min="2" max="2" width="${aba.larguraB || 60}" customWidth="1"/></cols>` : '')
  const filtro = linhaCabecalho && (aba.linhas || []).length && aba.filtro !== false
    ? `<autoFilter ref="A${linhaCabecalho}:${ultimaCol}${r - 1}"/>` : ''
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">${congelar}<sheetFormatPr defaultRowHeight="15"/>${larguras}<sheetData>${linhasXml.join('')}</sheetData>${filtro}</worksheet>`
}

// ---------------------------------------------------------------- zip simples
let TABELA_CRC = null
export function crc32(bytes) {
  if (!TABELA_CRC) {
    TABELA_CRC = new Uint32Array(256)
    for (let n = 0; n < 256; n++) {
      let c = n
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1
      TABELA_CRC[n] = c >>> 0
    }
  }
  let crc = 0xFFFFFFFF
  for (let i = 0; i < bytes.length; i++) crc = TABELA_CRC[(crc ^ bytes[i]) & 0xFF] ^ (crc >>> 8)
  return (crc ^ 0xFFFFFFFF) >>> 0
}

export function montarZip(arquivos) {
  const enc = new TextEncoder()
  const partes = []
  const central = []
  let deslocamento = 0
  // data fixa no zip (1/1/2026 00:00): o conteúdo é o que importa
  const hora = 0
  const dia = ((2026 - 1980) << 9) | (1 << 5) | 1
  for (const { nome, conteudo } of arquivos) {
    const nomeB = enc.encode(nome)
    const dados = typeof conteudo === 'string' ? enc.encode(conteudo) : conteudo
    const crc = crc32(dados)
    const local = new DataView(new ArrayBuffer(30))
    local.setUint32(0, 0x04034b50, true); local.setUint16(4, 20, true); local.setUint16(6, 0x0800, true)
    local.setUint16(8, 0, true); local.setUint16(10, hora, true); local.setUint16(12, dia, true)
    local.setUint32(14, crc, true); local.setUint32(18, dados.length, true); local.setUint32(22, dados.length, true)
    local.setUint16(26, nomeB.length, true); local.setUint16(28, 0, true)
    partes.push(new Uint8Array(local.buffer), nomeB, dados)
    const c = new DataView(new ArrayBuffer(46))
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true)
    c.setUint16(10, 0, true); c.setUint16(12, hora, true); c.setUint16(14, dia, true)
    c.setUint32(16, crc, true); c.setUint32(20, dados.length, true); c.setUint32(24, dados.length, true)
    c.setUint16(28, nomeB.length, true); c.setUint16(30, 0, true); c.setUint16(32, 0, true)
    c.setUint16(34, 0, true); c.setUint16(36, 0, true); c.setUint32(38, 0, true); c.setUint32(42, deslocamento, true)
    central.push(new Uint8Array(c.buffer), nomeB)
    deslocamento += 30 + nomeB.length + dados.length
  }
  const tamCentral = central.reduce((s, p) => s + p.length, 0)
  const fim = new DataView(new ArrayBuffer(22))
  fim.setUint32(0, 0x06054b50, true); fim.setUint16(8, arquivos.length, true); fim.setUint16(10, arquivos.length, true)
  fim.setUint32(12, tamCentral, true); fim.setUint32(16, deslocamento, true)
  const todas = [...partes, ...central, new Uint8Array(fim.buffer)]
  const total = todas.reduce((s, p) => s + p.length, 0)
  const saida = new Uint8Array(total)
  let pos = 0
  for (const p of todas) { saida.set(p, pos); pos += p.length }
  return saida
}

// ---------------------------------------------------------------- planilha
export function gerarXlsx(abas, { autor = 'Ayra Ponto' } = {}) {
  const usados = new Set()
  const nomes = abas.map((a) => nomeDeAba(a.nome, usados))
  const arquivos = [
    { nome: '[Content_Types].xml', conteudo: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${abas.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>` },
    { nome: '_rels/.rels', conteudo: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>` },
    { nome: 'docProps/core.xml', conteudo: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:creator>${escaparXml(autor)}</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString().slice(0, 19)}Z</dcterms:created></cp:coreProperties>` },
    { nome: 'xl/workbook.xml', conteudo: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView/></bookViews><sheets>${nomes.map((n, i) => `<sheet name="${escaparXml(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>` },
    { nome: 'xl/_rels/workbook.xml.rels', conteudo: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${abas.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${abas.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>` },
    { nome: 'xl/styles.xml', conteudo: STYLES },
    ...abas.map((a, i) => ({ nome: `xl/worksheets/sheet${i + 1}.xml`, conteudo: xmlDaAba(a) })),
  ]
  return montarZip(arquivos)
}

export const TIPO_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

export function baixarArquivo(bytes, nomeArquivo, tipo = TIPO_XLSX) {
  const blob = new Blob([bytes], { type: tipo })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nomeArquivo
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
