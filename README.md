# Ayra Ponto

Software de ponto eletrônico para startups e PMEs (até 50 colaboradores).
React + Vite + Supabase, hospedado na Vercel.

## O que já está aqui (versão inicial)

- Login e cadastro (com escolha de perfil: administrador, RH, funcionário)
- Onboarding: administrador cria a empresa (gera código de convite); RH/funcionário
  entram usando esse código
- Tela do funcionário: bater ponto (entrada, intervalo, saída) e ver as marcações do dia
- Painel de gestão (admin/RH): ver equipe, ver e aprovar/rejeitar solicitações de ajuste
- Tema claro/escuro com a identidade visual (azul escuro + marrom dourado nas telas de gestão)
- Todo o banco de dados já pensado para a Portaria 671/2021 (categoria REP-P): marcações
  imutáveis, NSR sequencial por filial, estrutura pronta para AFD/AEJ/espelho/comprovante

## O que NÃO está aqui ainda (próximos passos)

- Geração e assinatura digital (ICP-Brasil) dos arquivos AFD e AEJ — isso vai virar uma
  Edge Function separada, porque precisa do certificado digital da empresa
- Geração do espelho de ponto mensal em PDF assinado (PAdES)
- Quando um ajuste é aprovado no painel de gestão, ainda falta esse aprovado virar de fato
  um novo registro em `registros_ponto` (hoje só muda o status do pedido)
- Cadastro/gestão de filiais pelo administrador (hoje a empresa nasce só com a filial "Matriz")
- Registro do software no INPI e obtenção do certificado ICP-Brasil — são passos
  administrativos, fora do código, mas obrigatórios antes do lançamento

## Como rodar localmente (opcional — você pode só publicar direto na Vercel)

1. `npm install`
2. Copie `.env.example` para `.env` e preencha com a URL e a chave "anon" do seu
   projeto Supabase (Project Settings → API)
3. `npm run dev`

## Publicando na Vercel

1. Importe este repositório na Vercel (New Project → selecione `ayra-ponto`)
2. Em "Environment Variables", adicione `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`
   com os mesmos valores do seu projeto Supabase
3. Deploy — a Vercel detecta automaticamente que é um projeto Vite
