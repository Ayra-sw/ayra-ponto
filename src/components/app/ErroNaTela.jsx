import { Component } from 'react'
import { CircleAlert, RefreshCw } from 'lucide-react'

// Se uma tela quebrar, mostra uma mensagem clara (e o menu continua funcionando)
// em vez de deixar a página em branco.
export default class ErroNaTela extends Component {
  constructor(props) {
    super(props)
    this.state = { erro: null, chave: props.chave }
  }

  static getDerivedStateFromError(erro) { return { erro } }

  // Trocou de tela: tenta de novo
  static getDerivedStateFromProps(props, state) {
    if (props.chave !== state.chave) return { erro: null, chave: props.chave }
    return null
  }

  componentDidCatch(erro, info) {
    console.error('Erro na tela:', erro, info?.componentStack)
  }

  render() {
    if (!this.state.erro) return this.props.children
    return (
      <div className="pagina" style={{ maxWidth: 640 }}>
        <div className="estado-vazio" role="alert">
          <CircleAlert aria-hidden="true" />
          <strong>Algo deu errado nesta tela</strong>
          <p className="suave pequeno">
            {navigator.onLine === false
              ? 'Parece que a internet caiu. Quando a conexão voltar, recarregue a página.'
              : 'Recarregue a página. Se continuar, use o botão de ajuda (?) para falar com o suporte.'}
          </p>
          <button type="button" className="btn btn--secundario" onClick={() => window.location.reload()}>
            <RefreshCw aria-hidden="true" /> Recarregar a página
          </button>
        </div>
      </div>
    )
  }
}
