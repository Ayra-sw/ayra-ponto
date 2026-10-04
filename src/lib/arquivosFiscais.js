// AFD e AEJ: o banco devolve o texto; aqui ele vira um arquivo ISO-8859-1
// (o padrão exigido pelos Anexos V e VI da Portaria 671).

// Texto → bytes ISO-8859-1. Caracteres fora da tabela viram "?" (o banco já faz isso; aqui é só garantia).
export function paraLatin1(texto) {
  const bytes = new Uint8Array(texto.length)
  for (let i = 0; i < texto.length; i++) {
    const c = texto.charCodeAt(i)
    bytes[i] = c <= 0xff ? c : 0x3f
  }
  return bytes
}

export function baixarTextoLatin1(texto, nome) {
  const blob = new Blob([paraLatin1(texto)], { type: 'text/plain;charset=ISO-8859-1' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nome
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

const soDocumento = (v) => String(v || '').toUpperCase().replace(/[^0-9A-Z]/g, '')

// AFD: "AFD" + CNPJ/CPF do empregador + "REP_P" (regra do leiaute). Com mais de uma
// unidade sem CNPJ próprio, os nomes coincidiriam: acrescenta o nome da unidade.
export function nomeArquivoFiscal(qual, { empresa, unidade, inicio, fim }) {
  const propria = unidade?.tipo_identificador === 'cnpj' && unidade?.identificador_legal
  const doc = soDocumento(propria ? unidade.identificador_legal : empresa?.cnpj) || 'SEMCNPJ'
  const sufixoUnidade = !propria && unidade?.nome
    ? '_' + unidade.nome.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^0-9A-Za-z]+/g, '').slice(0, 20)
    : ''
  if (qual === 'afd') return `AFD${doc}REP_P${sufixoUnidade}_${inicio}_${fim}.txt`
  return `AEJ${doc}${sufixoUnidade}_${inicio}_${fim}.txt`
}
