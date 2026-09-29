import Relatorios from '../../components/relatorios/Relatorios'

// Relatórios da empresa (administrador e RH)
export default function RelatoriosGestao() {
  return (
    <div className="pagina">
      <div className="pagina__cabecalho nao-imprimir">
        <div className="pagina__titulo">
          <span className="pagina__trilha">Gestão</span>
          <h1>Relatórios</h1>
          <p className="suave">Frequência, pedidos, banco de horas e marcações de qualquer período, com planilha e impressão.</p>
        </div>
      </div>
      <Relatorios modo="gestao" />
    </div>
  )
}
