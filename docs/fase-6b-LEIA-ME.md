# Ayra Ponto — Fase 6B: entrar com a digital

Pacote preparado em 10/10/2026 a partir do commit `f1d00a8` ("Fase 6A: geolocalizacao e cerca virtual").

Agora dá para **entrar no Ayra Ponto com a digital ou o rosto do celular**, sem digitar a senha. Usa as **chaves de acesso (passkeys)** do Supabase, lançadas em maio de 2026.

**Decisões suas, respeitadas:**

- funciona **já no endereço atual** (`ayra-ponto.vercel.app`);
- serve **só para entrar na conta**. Bater o ponto continua igual.

## Como funciona (e por que é seguro)

- **Quem lê a digital é o próprio celular.** O Ayra Ponto **nunca recebe nem guarda a digital**. O celular cria uma chave secreta que não sai dele, e o Supabase guarda só a "parte pública" dessa chave. Para a LGPD é o melhor caminho: não tratamos dado biométrico nenhum.
- **A senha continua valendo sempre.** Se a digital falhar, a pessoa entra com e-mail e senha.
- **Cada pessoa escolhe** se quer usar.

## O que muda para quem usa

- **Tela de entrada (no celular):** aparece o botão **Entrar com a digital**, abaixo do e-mail e senha. Quem já usou a digital naquele celular vê o botão **em primeiro lugar**, em destaque.
- **Depois de entrar com a senha no celular:** aparece um convite discreto, abaixo do botão de bater ponto: **"Entre mais rápido, com a sua digital"**, com **Ativar** e **Agora não**. "Agora não" vale para aquele celular.
- **Minha conta:** cartão novo **Entrar com a digital**, com:
  - o botão **Ativar a digital neste aparelho**;
  - a lista dos aparelhos ligados (por exemplo, "Android ou Chrome (Google)" ou "iPhone, iPad ou Mac (iCloud)"), com a data e o botão **Remover**.
- **No computador:** o botão só aparece se o computador tiver leitor liberado (por exemplo, Windows Hello). Se não tiver, o cartão explica que é para ativar no celular.
- **Ajuda:** artigo novo **Entrar com a digital**.

## Importante saber

- **O recurso do Supabase ainda é "beta".** Funciona, mas o Supabase pode mudar detalhes. Por isso a senha continua sempre como reserva.
- **Endereço do site:** a chave fica presa a `ayra-ponto.vercel.app`. Se um dia o app mudar para um domínio próprio, cada pessoa ativa a digital de novo (1 toque, depois de entrar com a senha). Avisar o Claude antes de mudar o domínio do app.
- **Celular compartilhado:** qualquer digital cadastrada no celular consegue entrar. O app avisa: ative só no seu celular.
- **iPhone e Android guardam a chave na nuvem** (iCloud ou conta Google). Por isso ela pode funcionar também nos outros aparelhos da mesma pessoa.
- **Trocou de celular?** Em Minha conta, remove o antigo e ativa no novo.

## Arquivos do pacote

13 arquivos: 4 novos e 9 alterados. **Nenhum arquivo é apagado.** **Nenhum SQL desta vez.**

| Pasta | Novos | Alterados |
|---|---|---|
| raiz | — | `README.md`, `package.json` (versão mais nova do Supabase no app) |
| `docs/` | `fase-6b-LEIA-ME.md` (este guia) | — |
| `src/components/conta/` | `EntrarComDigital.jsx`, `OfertaDigital.jsx` | — |
| `src/lib/` | `digital.js` | `supabaseClient.js`, `ajuda/artigosPessoais.js` |
| `src/pages/` | — | `Login.jsx`, `MinhaConta.jsx`, `FuncionarioDashboard.jsx`, `GestaoDashboard.jsx` |
| `src/` | — | `styles.css` |

**Dependências novas:** nenhuma (só a do Supabase sobe de versão). **Segredos novos:** nenhum.

## Passo a passo

**Antes de tudo:** no Supabase, confira se no alto da tela está escrito **AYRA SOLUÇÕES / Ayra Ponto**.

### Passo 0: conferir o GitHub

Eu já conferi: o último envio é o `f1d00a8` (Fase 6A). Se você fizer algum envio antes de aplicar este pacote, me avise primeiro.

### Passo 1: ligar as chaves de acesso no Supabase

1. No Supabase, no menu da esquerda, clique em **Authentication**.
2. Procure **Passkeys** (fica na lista do menu de Authentication, perto de "Sign In / Providers").
3. Ligue a chave **Enable Passkey authentication**.
4. Confira os 3 campos (o Supabase costuma preencher sozinho; se estiver diferente, troque):
   - **Relying Party Display Name:** `Ayra Ponto`
   - **Relying Party ID:** `ayra-ponto.vercel.app` (sem `https://` e sem barra no fim)
   - **Relying Party Origins:** `https://ayra-ponto.vercel.app`
5. Clique em **Save**.
6. Mande um print para o Claude.

### Passo 2: enviar para o GitHub

1. Extraia o ZIP: clique com o botão direito em `ayra-ponto-fase-6b-digital.zip` e escolha **Extrair tudo** → **Extrair**.
2. **Confira que é o pacote certo:** dentro da pasta `src` → `lib` tem que existir o arquivo **`digital.js`**.
3. Abra `github.com/Ayra-sw/ayra-ponto` e clique em **Add file** → **Upload files**.
4. Na pasta extraída há **2 pastas** (`docs`, `src`) e **2 arquivos** (`README.md` e `package.json`). Selecione os 4 com **Ctrl+A** e arraste para o quadro grande.
5. Devem aparecer **13 arquivos**.
6. Na **caixinha pequena de cima**, escreva: `Fase 6B: entrar com a digital`
7. Deixe a caixa grande vazia e clique em **Commit changes**.
8. Espere o **✓ verde**. A Vercel publica sozinha (desta vez pode levar uns 2 minutos, porque ela baixa a versão nova do Supabase).

### Passo 3: testar no celular

1. No celular, abra `ayra-ponto.vercel.app`. Se usa o app instalado, feche e abra de novo.
2. Entre com e-mail e senha.
3. Abaixo do botão de bater ponto (ou no alto da Visão geral, para a gestão) aparece **"Entre mais rápido, com a sua digital"**. Toque em **Ativar** e confirme com a digital.
   - Se o convite não aparecer, vá em **Minha conta** → **Entrar com a digital** → **Ativar a digital neste aparelho**.
4. Toque em **Sair da conta** (em Minha conta).
5. Na tela de entrada, toque em **Entrar com a digital** e confirme. Você entra direto.

## Se algo der errado

- **Aparece "A entrada com digital ainda não está ligada":** o Passo 1 não foi salvo. Confira em Authentication → Passkeys.
- **Aparece "ainda não foi configurada para este endereço":** o **Relying Party ID** ou o **Origins** estão diferentes do endereço do site. Confira o Passo 1, item 4.
- **O botão "Entrar com a digital" não aparece:** o celular não tem digital ou rosto cadastrados, ou o navegador não libera. No Android, use o **Chrome**; no iPhone, o **Safari**.
- **Qualquer outro problema:** me mande um print. A senha continua funcionando normalmente.
- **Para desligar:** em Authentication → Passkeys, desligue a chave. O botão para de funcionar, o cartão some de Minha conta e todo mundo entra com a senha, como antes.
