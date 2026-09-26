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

export const RESULTADO_FACIAL = {
  reconhecido: { rotulo: 'Rosto reconhecido', tom: 'ok' },
  nao_reconhecido: { rotulo: 'Rosto não reconhecido', tom: 'atencao' },
  sem_referencia: { rotulo: 'Sem foto de cadastro aprovada', tom: 'info' },
  sem_foto: { rotulo: 'Sem foto', tom: 'neutra' },
}

export const CONFERENCIA_FACIAL = {
  pendente: { rotulo: 'A conferir pelo RH', tom: 'atencao' },
  confirmada: { rotulo: 'Conferida pelo RH', tom: 'ok' },
  contestada: { rotulo: 'Contestada pelo RH', tom: 'problema' },
}

export const MOTIVO_SEM_FOTO = {
  sem_camera: 'Aparelho sem câmera',
  permissao_negada: 'Câmera bloqueada no aparelho',
  aviso_nao_aceito: 'Não aceitou o aviso de privacidade',
  falha_envio: 'A foto não chegou (internet)',
  rosto_nao_encontrado: 'A câmera não encontrou o rosto',
  app_sem_camera: 'Registrado sem câmera',
  outro: 'Registrado sem foto',
}
