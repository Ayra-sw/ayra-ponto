import RegistrarPonto from '../../components/ponto/RegistrarPonto'

// Administrador e RH também são colaboradores e batem o próprio ponto.
export default function MeuPonto() {
  return (
    <div className="pagina" style={{ maxWidth: 640 }}>
      <h1 className="sr-only">Meu ponto: registrar ponto</h1>
      <RegistrarPonto />
    </div>
  )
}
