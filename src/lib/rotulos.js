// Nomes que aparecem na tela. O banco guarda os códigos internos
// (por exemplo, "funcionario" aparece como "Colaborador" e "filiais" como
// "Unidades").

export const PAPEL = {
  administrador: 'Administrador',
  rh: 'RH',
  funcionario: 'Colaborador',
}

export const PAPEL_DESCRICAO = {
  administrador: 'Acesso total: empresa, unidades, pessoas e permissões.',
  rh: 'Gerencia pessoas e analisa solicitações. Não altera papéis nem a empresa.',
  funcionario: 'Registra o próprio ponto e acompanha as próprias informações.',
}

export const SITUACAO = {
  ativo: 'Ativo',
  afastado: 'Afastado',
  desligado: 'Desligado',
}

export const CATEGORIA = {
  clt: 'CLT',
  estagiario: 'Estagiário',
  menor_aprendiz: 'Menor aprendiz',
  trainee: 'Trainee',
}

export const TIPO_SOLICITACAO = {
  correcao_marcacao: 'Correção de marcação',
  abono: 'Abono',
  folga: 'Folga',
  inclusao_esquecida: 'Marcação esquecida',
}

export const TIPO_IDENTIFICADOR = {
  cnpj: 'CNPJ',
  cei: 'CEI',
  caepf: 'CAEPF',
  cno: 'CNO',
}
