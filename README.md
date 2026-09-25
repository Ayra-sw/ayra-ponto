# Ayra Ponto

Controle de jornada e ponto eletrônico para startups e PMEs (até 50 colaboradores).
React + Vite + Supabase, publicado na Vercel. Base legal: Portaria 671/2021, categoria REP-P.

## O que já está aqui

- **Acesso:** entrar, "Criar conta da minha empresa", "Recebi um convite" (inclusive por link
  `/convite/CODIGO`), recuperação de senha. Quem entra por convite é sempre colaborador.
- **Colaborador:** tela de ponto com a próxima marcação sugerida (sem nunca bloquear outro tipo),
  comprovante de cada marcação com NSR, marcações do dia, minha conta.
- **Gestão (administrador e RH):** painel "Hoje", colaboradores (busca, filtros, edição),
  solicitações pendentes, empresa (CNPJ alfanumérico, endereço, convite), unidades, meu ponto.
- **Design system próprio** (`src/styles.css` e `src/components/ui/`), tema claro/escuro,
  telas responsivas para computador, tablet e celular.
- **Banco pensado para a Portaria 671:** marcações imutáveis, NSR sequencial por unidade,
  ajustes sempre ligados ao registro original, isolamento por empresa com RLS.

A estrutura do banco e as migrações ficam em `supabase/`. Cada fase tem um guia em `docs/`.

## Próximas fases

- **Fase 2:** perfil completo do colaborador, departamentos, cargos, jornadas, escalas,
  feriados, cálculo de horas, espelho de ponto, banco de horas, pedidos de ajuste.
- **Fase 3:** papel Gestor, central de solicitações, relatórios, notificações, histórico.
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
