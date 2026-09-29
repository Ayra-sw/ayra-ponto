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
- **Ponto com reconhecimento facial** (opcional por empresa) e corrente de integridade das marcações.
- **Design system próprio** (`src/styles.css` e `src/components/ui/`), tema claro/escuro,
  telas responsivas para computador, tablet e celular.
- **Banco pensado para a Portaria 671:** marcações imutáveis, NSR sequencial por unidade,
  ajustes sempre ligados ao registro original, isolamento por empresa com RLS.

A estrutura do banco e as migrações ficam em `supabase/`. Cada fase tem um guia em `docs/`.

## Próximas fases

- **Fase 3C:** avisos dentro do sistema (sininho) e histórico de alterações.
- **Fase 4:** central de ajuda, onboarding guiado, acessibilidade, performance, app instalável.
- **Fase 5:** AFD, AEJ e documentos assinados com certificado ICP-Brasil; registro no INPI.

## Como rodar localmente (opcional)

1. `npm install`
2. Copie `.env.example` para `.env` e preencha com a URL e a chave "anon" do seu
   projeto Supabase (Project Settings → API)
3. `npm run dev`

## Publicando na Vercel

A Vercel publica sozinha a cada envio para a branch `main`. As variáveis
`VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` ficam em Settings → Environment Variables.
