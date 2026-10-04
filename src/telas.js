import { lazy } from 'react'

// Cada tela é baixada só quando é aberta (o app abre mais rápido, sobretudo no celular).
const IMPORTS = {
  RedefinirSenha: () => import('./pages/RedefinirSenha'),
  Onboarding: () => import('./pages/Onboarding'),
  GestaoDashboard: () => import('./pages/GestaoDashboard'),
  MinhaConta: () => import('./pages/MinhaConta'),
  Pessoas: () => import('./pages/gestao/Pessoas'),
  Solicitacoes: () => import('./pages/gestao/Solicitacoes'),
  Empresa: () => import('./pages/gestao/Empresa'),
  Unidades: () => import('./pages/gestao/Unidades'),
  MeuPonto: () => import('./pages/gestao/MeuPonto'),
  Reconhecimento: () => import('./pages/gestao/Reconhecimento'),
  PerfilPessoa: () => import('./pages/gestao/PerfilPessoa'),
  Departamentos: () => import('./pages/gestao/Departamentos'),
  Cargos: () => import('./pages/gestao/Cargos'),
  Jornadas: () => import('./pages/gestao/Jornadas'),
  Feriados: () => import('./pages/gestao/Feriados'),
  MeuHistorico: () => import('./pages/MeuHistorico'),
  MeuEspelho: () => import('./pages/MeuEspelho'),
  Espelhos: () => import('./pages/gestao/Espelhos'),
  BancoHorasEquipe: () => import('./pages/gestao/BancoHoras'),
  Escalas: () => import('./pages/gestao/Escalas'),
  RelatoriosGestao: () => import('./pages/gestao/Relatorios'),
  Historico: () => import('./pages/gestao/Historico'),
  MinhaEquipe: () => import('./pages/equipe/MinhaEquipe'),
  PessoaDaEquipe: () => import('./pages/equipe/PessoaDaEquipe'),
  CentralAjuda: () => import('./pages/CentralAjuda'),
}

// Se uma versão nova do site foi publicada enquanto a pessoa estava com a aba
// aberta, o arquivo antigo da tela some. Nesse caso, recarrega a página uma vez.
function comRecarga(fn) {
  return () => fn().catch((erro) => {
    const chave = 'ayra-recarregou'
    let ja = false
    try { ja = sessionStorage.getItem(chave) === '1'; sessionStorage.setItem(chave, '1') } catch { /* sem armazenamento */ }
    if (!ja && navigator.onLine !== false) { window.location.reload(); return new Promise(() => {}) }
    throw erro
  }).then((m) => { try { sessionStorage.removeItem('ayra-recarregou') } catch { /* sem armazenamento */ } return m })
}

export const telas = Object.fromEntries(Object.entries(IMPORTS).map(([nome, fn]) => [nome, lazy(comRecarga(fn))]))

const MAIS_USADAS = {
  colaborador: ['MeuHistorico', 'MeuEspelho', 'MinhaConta'],
  gestao: ['GestaoDashboard', 'Pessoas', 'Solicitacoes', 'MeuPonto'],
}
export function preCarregar(perfil) {
  const fazer = () => (MAIS_USADAS[perfil] || []).forEach((n) => IMPORTS[n]().catch(() => {}))
  if ('requestIdleCallback' in window) window.requestIdleCallback(fazer, { timeout: 4000 })
  else setTimeout(fazer, 2000)
}
