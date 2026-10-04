import ARTIGOS_GESTAO from './ajuda/artigosGestao'
import ARTIGOS_PESSOAIS from './ajuda/artigosPessoais'

// Central de ajuda: artigos curtos, em linguagem simples.
// Cada artigo diz para quem é ("publico"):
//   gestao      administrador e RH
//   colaborador quem bate ponto (todo mundo, inclusive administrador e RH)
//   gestor      colaborador escolhido como gestor de um departamento
//   acesso      problemas para entrar (aparece também sem login)
// "telas" liga o artigo às telas onde ele ajuda (o "?" mostra primeiro esses).

export const ARTIGOS = [...ARTIGOS_GESTAO, ...ARTIGOS_PESSOAIS]

export const CATEGORIAS = [
  { id: 'comecando', titulo: 'Começando' },
  { id: 'ponto', titulo: 'Bater o ponto' },
  { id: 'pedidos', titulo: 'Pedidos e ajustes' },
  { id: 'horas', titulo: 'Horas, espelho e banco de horas' },
  { id: 'pessoas', titulo: 'Pessoas e permissões' },
  { id: 'jornada', titulo: 'Jornadas, escalas e feriados' },
  { id: 'relatorios', titulo: 'Relatórios e histórico' },
  { id: 'facial', titulo: 'Reconhecimento facial' },
  { id: 'conta', titulo: 'Conta e acesso' },
  { id: 'lei', titulo: 'Lei e privacidade' },
]

// Endereços usados dentro dos artigos ("rota:chave"), conforme quem lê
const ROTAS = {
  ponto: { colaborador: '/', gestao: '/gestao/meu-ponto' },
  historico: { colaborador: '/historico', gestao: '/gestao/meu-historico' },
  pedidos: { colaborador: '/historico?aba=pedidos', gestao: '/gestao/meu-historico?aba=pedidos' },
  espelho: { colaborador: '/espelho', gestao: '/gestao/meu-espelho' },
  conta: { colaborador: '/conta', gestao: '/gestao/conta' },
  equipe: { colaborador: '/equipe' },
  entrar: { publico: '/entrar' },
  recuperar: { publico: '/recuperar-senha' },
  convite: { publico: '/convite' },
}

export function resolverLink(alvo, contexto) {
  if (!alvo) return null
  if (alvo.startsWith('rota:')) return ROTAS[alvo.slice(5)]?.[contexto] || null
  if (alvo.startsWith('/gestao')) return contexto === 'gestao' ? alvo : null
  return alvo
}

// O que cada contexto pode ler
export function publicosDe(contexto, ehGestor = false) {
  if (contexto === 'gestao') return ['gestao', 'colaborador', 'gestor', 'acesso']
  if (contexto === 'colaborador') return ['colaborador', 'acesso', ...(ehGestor ? ['gestor'] : [])]
  return ['acesso']
}

export function artigosPara(contexto, ehGestor = false) {
  const pode = publicosDe(contexto, ehGestor)
  return ARTIGOS.filter((a) => a.publico.some((p) => pode.includes(p)))
}

export function artigoPorId(id) {
  return ARTIGOS.find((a) => a.id === id) || null
}

export const caminhoCentral = (contexto) => (contexto === 'gestao' ? '/gestao/ajuda' : '/ajuda')

// ---------------------------------------------------------------------------
// Busca: sem acento, sem maiúscula; todas as palavras precisam aparecer.
// ---------------------------------------------------------------------------
export const normalizar = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

function textoDoBloco(b) {
  if (typeof b === 'string') return b
  return [b.titulo, b.texto, ...(b.itens || [])].filter(Boolean).join(' ')
}

const indice = new Map()
function textoDoArtigo(a) {
  if (!indice.has(a.id)) {
    indice.set(a.id, {
      titulo: normalizar(a.titulo),
      resto: normalizar([a.resumo, (a.palavras || []).join(' '), ...a.corpo.map(textoDoBloco)].join(' ')).replace(/\[|\]\([^)]*\)|\*\*/g, ' '),
    })
  }
  return indice.get(a.id)
}

export function buscar(termo, lista) {
  const palavras = normalizar(termo).split(/[^a-z0-9]+/).filter((p) => p.length > 1)
  if (!palavras.length) return []
  return lista
    .map((a) => {
      const t = textoDoArtigo(a)
      let pontos = 0
      for (const p of palavras) {
        if (t.titulo.includes(p)) pontos += 3
        else if (t.resto.includes(p)) pontos += 1
        else return null
      }
      return { a, pontos }
    })
    .filter(Boolean)
    .sort((x, y) => y.pontos - x.pontos || x.a.titulo.localeCompare(y.a.titulo))
    .map((x) => x.a)
}

// Artigos ligados à tela aberta (do mais específico para o mais geral)
export function artigosDaTela(caminho, lista) {
  const c = caminho.replace(/\/+$/, '') || '/'
  const casa = (t) => (t === '/' ? c === '/' : c === t || c.startsWith(t + '/'))
  return lista
    .map((a) => ({ a, tam: Math.max(-1, ...(a.telas || []).filter(casa).map((t) => t.length)) }))
    .filter((x) => x.tam >= 0)
    .sort((x, y) => y.tam - x.tam)
    .map((x) => x.a)
}

export const MAIS_PROCURADOS = {
  gestao: ['primeiros-passos', 'convidar-equipe', 'jornadas', 'analisar-pedidos', 'relatorios', 'portaria-671'],
  colaborador: ['bater-ponto', 'esqueci-ponto', 'abono-atestado', 'espelho', 'cadastrar-rosto', 'minha-conta'],
  publico: ['entrar-convite', 'esqueci-senha', 'nao-recebi-email', 'criar-empresa'],
}

// Pede ao botão "?" da barra de cima que abra a ajuda (num artigo, se vier)
export function abrirAjuda(artigo) {
  window.dispatchEvent(new CustomEvent('ayra:ajuda', { detail: { artigo } }))
}
