# Ayra Ponto — Fase 4B: app instalável, desempenho e acessibilidade

Pacote preparado em 04/10/2026 a partir do commit `808aee6` ("Fase 4A: primeiros passos e central de ajuda").

Com este pacote, a **Fase 4 fica completa**:

- **Fase 4A (no ar):** primeiros passos, boas-vindas e central de ajuda.
- **Fase 4B (este pacote):** app instalável, desempenho e acessibilidade.

**Decisão sua, respeitada:** **o ponto precisa de internet**, mesmo no app instalado. Sem conexão, nada é registrado nem guardado para enviar depois. Assim, a hora e o NSR vêm sempre do servidor, como pede a Portaria 671.

**Esta fase não mexe no banco.** Não há SQL para rodar: é só enviar para o GitHub.

## O que muda para quem usa

### App no celular

- O Ayra Ponto pode ficar na **tela inicial do celular**, com o ícone da marca, e abre em tela cheia, como um aplicativo. Não precisa de loja de aplicativos.
- **Android:** quando o navegador permite, aparece o botão **Instalar o app**:
  - no Início do celular, num convite discreto, com **Instalar** e **Agora não**;
  - em **Minha conta**, no cartão **App no celular**.
- **iPhone:** a Apple não deixa sites mostrarem esse botão. Em **Como instalar**, aparece o passo a passo do Safari: **Compartilhar** → **Adicionar à Tela de Início**.
- O convite aparece **depois das boas-vindas**, nunca junto com elas. **Agora não** vale para sempre. Para quem já instalou, o convite não aparece.
- Na ajuda, há um artigo novo: **Instalar o app no celular**. A ajuda agora tem 40 artigos.

### Sem internet

- Se a internet cair, aparece no alto de todas as telas a faixa **"Sem internet. O ponto e as informações voltam quando a conexão voltar."**
- Na tela de ponto, o botão vira **Sem internet** e fica desativado, com uma explicação curta do motivo. Quando a conexão volta, tudo volta sozinho.
- Mesmo sem internet, o app instalado **abre** e mostra o aviso, em vez de uma tela de erro do navegador.

### Mais rápido

- Antes, o site baixava todas as telas de uma vez. Agora **cada tela é baixada só quando é aberta**, e as mais usadas são baixadas em segundo plano logo depois que a pessoa entra.
- A câmera e o reconhecimento facial também só são baixados quando vão ser usados.

| Arquivo principal do site | Antes | Depois |
|---|---|---|
| Tamanho (compactado, o que vai pela internet) | 229 kB | 141 kB (**38% menor**) |

- Na segunda visita, os arquivos do site já estão no celular e o app abre ainda mais rápido.
- **Uma tela com erro não derruba mais o app.** Em vez de uma página em branco, aparece "Algo deu errado nesta tela", com o botão **Recarregar a página**, e o menu continua funcionando.
- Se você publicar uma versão nova enquanto alguém está com o site aberto, ele se atualiza sozinho ao abrir uma tela nova.

### Acessibilidade

Fiz uma varredura automática (padrão internacional **WCAG 2.1 AA**) em todas as telas: gestão, colaborador, ajuda e telas de entrada, nos temas claro e escuro. Apareceram 5 tipos de problema, e todos foram corrigidos:

- dias de folga no espelho com texto claro demais para ler (contraste);
- colunas de botões nas tabelas sem nome para o leitor de tela;
- as telas de ponto sem um título principal para o leitor de tela;
- a ordem dos títulos no Histórico;
- cada aba do navegador agora mostra o nome da tela (por exemplo, "Jornadas · Ayra Ponto"), o que também ajuda quem usa leitor de tela.

**Resultado: nenhum problema na varredura**, em 34 telas, nos dois temas.

Sobre o fundo do menu lateral que parecia terminar antes do fim da página: conferi, e isso só acontecia nas minhas fotos de página inteira. Na tela de verdade, o menu fica fixo e inteiro enquanto a página rola.

## Arquivos do pacote

35 arquivos: 15 novos e 20 alterados. **Nenhum arquivo é apagado.**

| Pasta | Novos | Alterados |
|---|---|---|
| raiz | — | `README.md`, `index.html` (ícones e app), `vercel.json` (regras do app) |
| `docs/` | `fase-4b-LEIA-ME.md` (este guia) | — |
| `public/` (pasta nova) | `manifest.webmanifest`, `sw.js`, `icons/` (5 ícones) | — |
| `src/` | `telas.js` | `App.jsx`, `main.jsx`, `styles.css` |
| `src/components/app/` (pasta nova) | `AvisoSemInternet.jsx`, `InstalarApp.jsx`, `ErroNaTela.jsx` | — |
| `src/components/` | `ajuda/PainelAjuda.jsx` | `BoasVindas.jsx`, `CadastroSimples.jsx`, `ajuda/BotaoAjuda.jsx`, `layout/ShellColaborador.jsx`, `layout/ShellGestao.jsx`, `marcacoes/HistoricoMarcacoes.jsx`, `ponto/RegistrarPonto.jsx`, `primeiros-passos/PrimeirosPassos.jsx` |
| `src/lib/` | `pwa.js`, `abrirAjuda.js` | `ajuda.js`, `ajuda/artigosPessoais.js` |
| `src/pages/` | — | `FuncionarioDashboard.jsx`, `MinhaConta.jsx`, `gestao/Feriados.jsx`, `gestao/MeuPonto.jsx` |

**Dependências novas:** nenhuma. O `package.json` não muda. **Banco:** nada muda.

## Passo a passo

### Passo 0: conferir o GitHub

Eu já conferi: o último envio é o `808aee6`. Se você fizer algum envio antes de aplicar este pacote, me avise primeiro.

### Passo 1: enviar para o GitHub

1. No seu computador, clique com o botão direito em `ayra-ponto-fase-4b.zip` e escolha **Extrair tudo** → **Extrair**.
2. Abra `github.com/Ayra-sw/ayra-ponto`.
3. Clique em **Add file** e depois em **Upload files**.
4. Na pasta extraída você vai ver **3 pastas** (`docs`, `public`, `src`) e **3 arquivos** (`README.md`, `index.html`, `vercel.json`). Desta vez não há a pasta `supabase`.
5. Clique em qualquer item e aperte **Ctrl+A**. Os 6 itens ficam azulados.
6. Arraste os itens selecionados para o quadro grande do GitHub.
7. Espere a lista carregar. Devem aparecer **35 arquivos**, incluindo 5 imagens de ícone.
8. Na **caixinha pequena de cima**, escreva: `Fase 4B: app instalável, desempenho e acessibilidade`
9. Deixe a caixa grande de baixo vazia e a bolinha **"Commit directly to the main branch"** marcada.
10. Clique no botão verde **Commit changes**.
11. Espere cerca de 2 minutos até a bolinha laranja virar o **✓ verde**. Se precisar, aperte **F5**.

### Passo 2: testar no computador

Abra `ayra-ponto.vercel.app` e aperte **Ctrl+F5**.

1. Navegue por algumas telas (Visão geral, Colaboradores, Relatórios). Tudo deve abrir normalmente, e o nome da aba do navegador muda a cada tela.
2. No Chrome, à direita da barra de endereço, pode aparecer um ícone de **instalar** (um monitor com uma seta). Isso mostra que o app está pronto para instalar. Não precisa instalar no computador.
3. Abra **Minha conta**: aparece o cartão **App no celular**.

### Passo 3: testar no celular

**Android (Chrome):**

1. Abra `ayra-ponto.vercel.app` e entre.
2. Em **Minha conta**, toque em **Instalar o app**. Se o botão não aparecer, toque nos três pontinhos do Chrome e em **Instalar app**.
3. Confirme. O ícone dourado e azul do Ayra Ponto aparece na tela do celular.
4. Abra pelo ícone: o app abre em tela cheia, sem a barra do navegador.

**iPhone (Safari):**

1. Abra `ayra-ponto.vercel.app` no **Safari** e entre.
2. Toque em **Compartilhar** (o quadrado com uma seta para cima), depois em **Adicionar à Tela de Início** e em **Adicionar**.
3. Abra pelo ícone.

**Sem internet (em qualquer um):**

1. Com o app aberto na tela de ponto, ligue o **modo avião**.
2. Aparece a faixa **Sem internet**, e o botão do ponto fica desativado.
3. Desligue o modo avião. Em poucos segundos, tudo volta ao normal.

## Se algo der errado

- **O site não abre depois do envio:** na Vercel, vá em **Deployments**, clique nos três pontinhos do deploy anterior e escolha **Instant Rollback**. Depois me avise com um print.
- **O botão "Instalar o app" não aparece no Android:** use os três pontinhos do Chrome → **Instalar app**. Alguns celulares só mostram a opção depois de abrir o site algumas vezes.
- **Depois de uma atualização, uma tela ficou estranha:** feche o app e abra de novo. Ele sempre busca a versão mais nova quando tem internet.

## Como foi testado

- O app foi compilado como na Vercel e aberto num navegador, com o Supabase simulado.
- **40 verificações novas passaram.** Foram testados:
  - manifesto e ícones;
  - o service worker registrado e no controle, sem nunca guardar dados do Supabase;
  - sem internet: a faixa, o botão desativado, nenhuma marcação enviada, o app abrindo da cópia guardada e voltando ao normal quando a conexão volta;
  - o convite no Android (Instalar e Agora não) e no iPhone (passo a passo), o convite esperando as boas-vindas e o app já instalado;
  - telas baixadas só quando abertas e a ajuda baixada só ao abrir;
  - uma tela com erro mostrando a mensagem sem derrubar o app;
  - a varredura de acessibilidade, o teclado ("Pular para o conteúdo"), os títulos das abas e o menu ao rolar.
- **Varredura completa de acessibilidade:** 34 telas, nos temas claro e escuro, sem nenhum problema.
- **Conferência automática dos 40 artigos de ajuda.**
- **Fases anteriores:** as 43 verificações da 2B, as 72 da 2C, as 85 da 2D, as 75 da 3A, as 49 da 3B, as 40 da 3C e as 59 da 4A continuam passando com o app dividido em partes e o service worker ligado.

## O que falta antes do lançamento

- **Contato do suporte:** quando você definir o WhatsApp e o e-mail, eu coloco em `src/lib/suporte.js` e te mando só esse arquivo.
- **Fase 5:** AFD e AEJ oficiais, assinatura ICP-Brasil, INPI.
- **Antes de vender:** revisão de um advogado e o serviço profissional de reconhecimento facial.
