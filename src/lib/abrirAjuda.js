// Pede ao botão "?" da barra de cima que abra a ajuda (num artigo, se vier).
// Fica separado de lib/ajuda.js para não carregar os artigos junto.
export function abrirAjuda(artigo) {
  window.dispatchEvent(new CustomEvent('ayra:ajuda', { detail: { artigo } }))
}
