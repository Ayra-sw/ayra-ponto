import { useState } from 'react'
import { FileSpreadsheet, Printer } from 'lucide-react'
import Botao from '../ui/Botao'

// Botões de planilha e impressão, e a paginação "Mostrar mais"
export function AcoesRelatorio({ aoBaixar, desativado, children }) {
  return (
    <div className="linha linha--espacada nao-imprimir" style={{ flexWrap: 'wrap', gap: 8 }}>
      <div className="linha" style={{ flexWrap: 'wrap', gap: 6 }}>{children}</div>
      <div className="linha" style={{ gap: 8 }}>
        <Botao variante="secundario" tamanho="pequeno" icone={FileSpreadsheet} onClick={aoBaixar} disabled={desativado}>Baixar planilha</Botao>
        <Botao variante="secundario" tamanho="pequeno" icone={Printer} onClick={() => window.print()} disabled={desativado}>Imprimir ou PDF</Botao>
      </div>
    </div>
  )
}

export function usePaginas(total, porPagina = 200) {
  const [visiveis, setVisiveis] = useState(porPagina)
  return {
    visiveis,
    reiniciar: () => setVisiveis(porPagina),
    Mais: () => (total > visiveis ? (
      <div className="paginacao nao-imprimir">
        <span>Mostrando {visiveis} de {total}</span>
        <Botao variante="secundario" tamanho="pequeno" onClick={() => setVisiveis((v) => v + porPagina)}>Mostrar mais</Botao>
      </div>
    ) : null),
  }
}

// Escolha entre duas visões (ex.: por pessoa / por dia)
export function Visoes({ valor, opcoes, aoMudar }) {
  return (
    <div className="linha" role="group" aria-label="Como ver" style={{ gap: 6 }}>
      {opcoes.map((o) => (
        <button key={o.id} type="button" className="ficha" aria-pressed={valor === o.id} onClick={() => aoMudar(o.id)}>{o.rotulo}</button>
      ))}
    </div>
  )
}
