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
  { teste: /departamentos_nome_unico/i, msg: () => 'Já existe um departamento com esse nome.' },
  { teste: /cargos_nome_unico/i, msg: () => 'Já existe um cargo com esse nome.' },
  { teste: /modelos_jornada_nome_unico/i, msg: () => 'Já existe uma jornada com esse nome.' },
  { teste: /feriados_unico/i, msg: () => 'Esse feriado já está cadastrado para essa data.' },
  { teste: /perfis_matricula_unica/i, msg: () => 'Já existe uma pessoa com essa matrícula.' },
  { teste: /perfis_telefone_check/i, msg: () => 'O telefone precisa ter DDD e 8 ou 9 números.' },
  { teste: /(departamentos|cargos|modelos_jornada|feriados)_nome_check/i, msg: () => 'O nome precisa ter entre 2 e 80 letras.' },
  { teste: /tolerancia_minutos_check/i, msg: () => 'A tolerância pode ser de 0 a 60 minutos.' },
  { teste: /dia_carga_positiva|dia_trabalho_completo|dia_intervalo/i, msg: () => 'Confira os horários da jornada: entrada, saída e intervalo.' },
  { teste: /could not find the function .*apurar_periodo|could not find the function .*resumo_equipe/i, msg: () => 'O cálculo das horas ainda não foi instalado no banco. Rode a migração da Fase 2B no Supabase (passo a passo no guia da fase).' },
  { teste: /could not find the function .*banco_horas|could not find the function .*resumo_banco_horas|could not find the table .*(banco_horas_lancamentos|afastamentos)|column .*(usa_banco_horas|banco_horas_validade_meses|banco_horas_inicio)/i, msg: () => 'O banco de horas e os afastamentos ainda não foram instalados no banco. Rode a migração da Fase 2C no Supabase (passo a passo no guia da fase).' },
  { teste: /could not find the table .*(turnos|escala_dias)|column .*(tipo_escala|escala_turno_id|escala_referencia)/i, msg: () => 'As escalas ainda não foram instaladas no banco. Rode a migração da Fase 2D no Supabase (passo a passo no guia da fase).' },
  { teste: /turnos_nome_unico/i, msg: () => 'Já existe um turno com esse nome.' },
  { teste: /turnos_sigla_unica/i, msg: () => 'Já existe um turno com essa sigla. Escolha outra.' },
  { teste: /turno_carga_positiva|turno_horario|turno_intervalo/i, msg: () => 'Confira os horários do turno: entrada, saída e intervalo.' },
  { teste: /escala_dias_unico/i, msg: () => 'Esse dia já está na escala.' },
  { teste: /duplicate key/i, msg: () => 'Esse cadastro já existe.' },
  { teste: /payload too large|exceeded the maximum allowed size|entity too large/i, msg: () => 'A foto ficou grande demais. Tente de novo.' },
  { teste: /mime type .* is not supported|invalid mime/i, msg: () => 'Formato de foto não aceito.' },
  { teste: /bucket not found/i, msg: () => 'O armazenamento de fotos ainda não foi configurado. Avise o administrador.' },
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
