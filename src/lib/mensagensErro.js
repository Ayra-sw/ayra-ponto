// Transforma erros do Supabase em mensagens claras, em português, para o
// usuário. O erro original continua no console para quem for investigar.

const REGRAS = [
  { teste: /invalid login credentials/i, msg: () => 'E-mail ou senha incorretos.' },
  { teste: /email not confirmed/i, msg: () => 'Seu e-mail ainda não foi confirmado. Abra o link que enviamos para ele e tente de novo.' },
  { teste: /user already registered/i, msg: () => 'Este e-mail já tem cadastro. Entre com ele ou use "Esqueci minha senha".' },
  { teste: /password should be at least (\d+)/i, msg: (m) => `A senha precisa ter pelo menos ${m[1]} caracteres.` },
  { teste: /you can only request this after (\d+) seconds/i, msg: (m) => `Por segurança, aguarde ${m[1]} segundos antes de tentar de novo.` },
  { teste: /rate limit/i, msg: () => 'Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente de novo.' },
  { teste: /unable to validate email|invalid format|email address .* is invalid/i, msg: () => 'Esse e-mail não parece válido. Confira se digitou certo.' },
  { teste: /should be different from the old password/i, msg: () => 'A nova senha precisa ser diferente da atual.' },
  { teste: /auth session missing|session.*expired|jwt expired/i, msg: () => 'Sua sessão expirou. Entre novamente para continuar.' },
  { teste: /failed to fetch|networkerror|load failed/i, msg: () => 'Não conseguimos falar com o servidor. Confira sua internet e tente de novo.' },
  { teste: /empresas_cnpj_key/i, msg: () => 'Já existe uma empresa cadastrada com esse CNPJ.' },
  { teste: /empresas_cnpj_valido|filiais_cnpj_valido/i, msg: () => 'Esse CNPJ não é válido. Confira as letras e os números.' },
  { teste: /uf_valida/i, msg: () => 'Escolha um estado (UF) da lista.' },
  { teste: /empresas_codigo_convite_key/i, msg: () => 'Não foi possível gerar um código novo. Tente de novo.' },
  { teste: /duplicate key/i, msg: () => 'Esse cadastro já existe.' },
  { teste: /row-level security|permission denied/i, msg: () => 'Você não tem permissão para fazer isso.' },
]

export function traduzirErro(error, padrao = 'Algo deu errado. Tente de novo em instantes.') {
  if (!error) return ''
  const mensagem = typeof error === 'string' ? error : error.message || ''
  if (typeof error !== 'string') console.error(error)

  // Mensagens criadas pelo próprio banco do Ayra Ponto já estão em português
  if (error?.code === 'P0001' && mensagem) return mensagem

  for (const regra of REGRAS) {
    const m = mensagem.match(regra.teste)
    if (m) return regra.msg(m)
  }
  return padrao
}
