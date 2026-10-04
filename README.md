# Ayra Ponto

Controle de jornada e ponto eletrônico para startups e PMEs (até 50 colaboradores).
React + Vite + Supabase, publicado na Vercel. Base legal: Portaria 671/2021, categoria REP-P.

## O que já está aqui

- **Acesso:** entrar, "Criar conta da minha empresa", "Recebi um convite" (inclusive por link
  `/convite/CODIGO`), recuperação de senha. Quem entra por convite é sempre colaborador.
- **Colaborador:** tela de ponto com a próxima marcação sugerida (sem nunca bloquear outro tipo),
  comprovante de cada marcação com NSR, marcações do dia, minha conta.
- **Gestão (administrador e RH):** painel "Hoje", colaboradores (busca, filtros e ficha completa
  com abas), departamentos, cargos, jornadas (modelos de horário), feriados, solicitações
  pendentes, reconhecimento facial, empresa (CNPJ alfanumérico, endereço, convite), unidades, meu ponto.
- **Histórico e pedidos de ajuste:** o colaborador vê as marcações dia a dia e pede correção,
  marcação esquecida, abono ou folga; o RH analisa em Solicitações.
- **Espelho de ponto e horas da equipe:** o banco calcula, dia a dia, horas trabalhadas, atrasos,
  horas extras, faltas, feriados, folgas e abonos (ajuste aprovado vale no cálculo, sem mexer na
  marcação original). O colaborador vê o próprio espelho; administrador e RH veem o de cada pessoa
  e o resumo da equipe, com impressão/PDF e planilha.
- **Banco de horas (opcional por jornada):** horas extras viram crédito, horas a menos consomem o
  crédito mais antigo, e o crédito não compensado no prazo (padrão 6 meses) vence e fica "a pagar".
  Lançamentos de saldo inicial, compensação, pagamento e ajuste (nunca apagados nem editados).
  Saldo e extrato na ficha da pessoa, no "Meu espelho" e na tela "Banco de horas" da equipe.
- **Afastamentos:** férias, atestado, licença e INSS por período; nesses dias não há falta.
  Só se cancela (com motivo), nunca se apaga. O espelho também avisa quando o intervalo é curto demais.
- **Escalas:** turnos (Manhã, Tarde, Noite, Plantão 12h...), escala 12x36 (turno e primeiro dia; os
  plantões são calculados sozinhos) e escala por calendário (grade do mês, clique a clique, com
  "repetir semana"). Folga da escala não vira falta; na 12x36 o feriado trabalhado só avisa
  (Súmula 444 do TST). O colaborador vê os próximos turnos em "Minha escala".
- **Gestor da equipe (por departamento):** o administrador ou o RH escolhe os gestores de cada
  departamento. O gestor acompanha a equipe (espelho, marcações, banco de horas, escala) em
  "Equipe" e aprova ou recusa os pedidos de ajuste e folga dela, sem ver CPF, telefone ou atestados.
- **Central de solicitações:** pendentes, aprovadas, recusadas, canceladas e todas, com busca e
  filtros; comentário na resposta (obrigatório para recusar); a pessoa pode cancelar o próprio pedido.
- **Atestado anexado** ao pedido de abono e ao afastamento (PDF ou foto, até 5 MB), num
  armazenamento privado: só a própria pessoa, o RH e o administrador abrem. Abonos são analisados pelo RH.
- **Relatórios:** frequência (por pessoa e por dia, até 3 meses), pedidos (quantidade, situação e
  tempo de resposta), banco de horas numa data e marcações do período (NSR, unidade, origem,
  reconhecimento facial), com planilha e impressão. O gestor vê os da própria equipe.
- **Sininho de avisos:** pedido novo (para quem aprova), pedido respondido, dia com marcação
  faltando, banco de horas vencendo (semanal, para RH e administrador), pessoa nova e foto de rosto
  para aprovar. Cada aviso leva direto à tela certa.
- **Histórico de alterações:** quem criou, alterou ou excluiu o quê e quando (cadastros, pedidos,
  jornadas, escalas, afastamentos, banco de horas, organização e reconhecimento facial). Ninguém
  apaga nem edita. Só administrador e RH veem; CPF e telefone aparecem só como "(alterado)".
- **Primeiros passos:** lista na Visão geral (empresa, unidade, jornada, feriados, departamentos,
  convite, jornada de cada pessoa e primeira marcação), marcada sozinha conforme a empresa configura.
  Boas-vindas curtas para o colaborador no primeiro acesso.
- **Central de ajuda:** 41 artigos curtos (`src/lib/ajuda/`), com busca, e o botão "?" em todas as
  telas mostrando a ajuda daquela tela. Suporte por WhatsApp e e-mail para administrador e RH
  (contato em `src/lib/suporte.js`); o colaborador é orientado a falar com o RH da empresa.
- **App instalável (PWA):** ícone na tela do celular e abertura em tela cheia (`public/manifest.webmanifest`,
  `public/sw.js`). O service worker guarda só os arquivos do site, nunca dados do Supabase. Sem internet, o
  app avisa e **não registra o ponto** (a hora e o NSR vêm sempre do servidor).
- **Arquivos fiscais (Portaria 671):** AFD (leiaute 004, com CRC-16 e SHA-256 encadeado) e AEJ (leiaute 002)
  por unidade e período, para administrador e RH. Cada linha do AFD é gravada no momento do fato e nunca muda
  (tabela `afd_registros`); cadastros da empresa e das pessoas usam a mesma sequência de NSR das marcações.
- **Assinatura digital (Edge Function `supabase/functions/assinar`):** AFD e AEJ com assinatura CAdES em
  .p7s destacado (entregues num .zip) e o Comprovante de Registro de Ponto do Trabalhador em PDF com
  assinatura PAdES (arts. 79 e 80). O certificado A1 fica no Storage privado `certificados` e a senha no
  segredo `CERTIFICADO_SENHA` — nunca no código.
- **Comprovante por e-mail (Fase 5C):** cada marcação entra na fila `fila_comprovantes_email` e a função
  `assinar` envia o PDF assinado pelo Resend para o e-mail de login da pessoa (até 48 horas, art. 80). Um
  agendamento (pg_cron) refaz o que falhou a cada 5 minutos. Cada pessoa liga ou desliga em Minha conta.
  Segredos: `RESEND_API_KEY`, `EMAIL_REMETENTE` (sem ele, modo teste) e `EMAIL_TESTE`.
- **Desempenho e acessibilidade:** cada tela é baixada só quando é aberta (`src/telas.js`), uma tela com erro
  não derruba o app, e as telas passam na varredura automática de acessibilidade (WCAG 2.1 AA, temas claro e escuro).
- **Ponto com reconhecimento facial** (opcional por empresa) e corrente de integridade das marcações.
- **Design system próprio** (`src/styles.css` e `src/components/ui/`), tema claro/escuro,
  telas responsivas para computador, tablet e celular.
- **Banco pensado para a Portaria 671:** marcações imutáveis, NSR sequencial por unidade,
  ajustes sempre ligados ao registro original, isolamento por empresa com RLS.

A estrutura do banco e as migrações ficam em `supabase/`. Cada fase tem um guia em `docs/`.

## Próximas fases

- **Contato do suporte:** WhatsApp e e-mail em `src/lib/suporte.js` (antes do lançamento).
- **Certificado e-CNPJ A1 da Ayra Soluções** no lugar do certificado de teste.
- **Domínio próprio** verificado no Resend, para o comprovante por e-mail sair do modo teste.
- **Atestado Técnico e Termo de Responsabilidade** (art. 89), com o advogado.
- **Registro no INPI** e dados do desenvolvedor em `ayra_sistema`.

## Como rodar localmente (opcional)

1. `npm install`
2. Copie `.env.example` para `.env` e preencha com a URL e a chave "anon" do seu
   projeto Supabase (Project Settings → API)
3. `npm run dev`

## Publicando na Vercel

A Vercel publica sozinha a cada envio para a branch `main`. As variáveis
`VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` ficam em Settings → Environment Variables.
