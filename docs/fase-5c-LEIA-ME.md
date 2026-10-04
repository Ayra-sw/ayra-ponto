# Ayra Ponto — Fase 5C: comprovante por e-mail

Pacote preparado em 04/10/2026 a partir do commit `e867fd7` ("Fase 5B: assinatura digital").

A cada marcação, o **Comprovante de Registro de Ponto do Trabalhador** em PDF assinado vai para o e-mail da pessoa. É o mesmo PDF da Fase 5B.

**Decisões suas, respeitadas:**

- o envio é feito pelo **Resend**, que é grátis até 100 e-mails por dia (3.000 por mês);
- vai o **PDF anexado**, com um resumo da marcação no corpo do e-mail;
- **começa em modo teste**, porque ainda não temos domínio próprio. Até lá, os e-mails só chegam no **seu** e-mail;
- **cada pessoa pode desligar** em Minha conta. Vem ligado.

## O que muda para quem usa

- **Depois de cada marcação**, chega um e-mail com o assunto "Comprovante de ponto: Entrada em 05/10/2026 às 08:02 (NSR 12)". Ele traz:
  - um resumo da marcação: tipo, data, horário, NSR, empresa e unidade;
  - o PDF assinado em anexo.
- O e-mail vai para o **endereço com que a pessoa entra** no Ayra Ponto.
- **Em Minha conta** aparece o cartão **Comprovante por e-mail**, com a caixa **Receber o comprovante de cada marcação** e o e-mail mostrado. Quem desmarcar para de receber, e o comprovante continua na tela e no Meu histórico.
- **Se a internet cair** logo depois da marcação, ou se o Resend estiver fora do ar, o servidor tenta de novo sozinho, a cada 5 minutos, por até 48 horas. É o prazo do art. 80 da Portaria 671.
- **Na ajuda** há um artigo novo: **Comprovante por e-mail** (como ligar, desligar e o que fazer se não chegar).

### Modo teste (agora)

- O e-mail sai do endereço de testes do Resend (`onboarding@resend.dev`) e o assunto começa com **[TESTE]**.
- **Só vai para o seu e-mail**, o que você cadastrar no segredo `EMAIL_TESTE`. O Resend não deixa enviar para outras pessoas sem domínio próprio.
- As marcações das outras pessoas ficam marcadas como "ignoradas no teste". Nada quebra.

### Quando tiver domínio (depois)

Você compra um domínio no Registro.br (ex.: `ayraponto.com.br`, cerca de R$ 40 por ano) e liga ao Resend. Depois cria o segredo `EMAIL_REMETENTE`. A partir daí, todos recebem. Eu te guio quando chegar a hora.

## Arquivos do pacote

11 arquivos: 5 novos e 6 alterados. **Nenhum arquivo é apagado.**

| Pasta | Novos | Alterados |
|---|---|---|
| raiz | — | `README.md` |
| `docs/` | `fase-5c-LEIA-ME.md` (este guia) | — |
| `supabase/functions/assinar/` | — | `index.ts` (a função ganha o envio de e-mail) |
| `supabase/migrations/` | `2026-10-07_fase-5c_comprovante-email.sql` e `…_DESFAZER.sql` | — |
| `supabase/testes/` | `conferencia-fase-5c.sql` | — |
| `src/components/conta/` (pasta nova) | `ComprovantePorEmail.jsx` | — |
| `src/components/ponto/` | — | `RegistrarPonto.jsx` |
| `src/lib/` | — | `assinatura.js`, `ajuda/artigosPessoais.js` |
| `src/pages/` | — | `MinhaConta.jsx` |

**Dependências novas:** nenhuma.

## Mudanças no banco (migração da Fase 5C)

**Nenhuma marcação é alterada.**

- **Tabela nova `preferencias_email`:** guarda a escolha de cada pessoa. Cada um vê e muda só a sua.
- **Tabela nova `fila_comprovantes_email`:** cada marcação nova entra nessa fila. Ninguém do app lê, só o servidor.
  - **Se a fila der problema, a marcação acontece mesmo assim.** O e-mail nunca atrapalha o ponto.
- **Agendamento:** a cada 5 minutos, o banco olha a fila. Se tiver algo para enviar, chama a função `assinar`. Se a fila estiver vazia, não faz nada.
  - Para isso, a migração liga duas extensões que já vêm no Supabase: `pg_cron` (o relógio) e `pg_net` (para chamar a função).
- **Senha da fila:** a migração cria uma senha aleatória, guardada só no banco. Só o agendamento a usa para pedir os envios à função.
- **`dados_comprovante`:** continua igual para quem usa. A montagem foi separada para o servidor usar a mesma no e-mail.

## Passo a passo

**Antes de tudo:** no Supabase, confira se no alto da tela está escrito **AYRA SOLUÇÕES / Ayra Ponto**.

### Passo 0: conferir o GitHub

Eu já conferi: o último envio é o `e867fd7`. Se você fizer algum envio antes de aplicar este pacote, me avise primeiro.

### Passo 1: rodar a migração no Supabase

1. Extraia o ZIP: clique com o botão direito em `ayra-ponto-fase-5c.zip` e escolha **Extrair tudo** → **Extrair**.
2. Entre em **supabase** → **migrations** e abra `2026-10-07_fase-5c_comprovante-email.sql` (o arquivo **sem** "DESFAZER" no nome) no **Bloco de Notas**.
3. Aperte **Ctrl+A** e depois **Ctrl+C**.
4. No Supabase, clique em **SQL Editor** e depois em **+ New query**.
5. Clique no editor e aperte **Ctrl+V**.
6. Clique em **Run**.
   - Se aparecer um aviso sobre operação destrutiva ("destructive operation"), pode clicar em **Run this query**. São só linhas que recriam regras de acesso; nenhum dado é apagado.
7. Deve aparecer **"Success. No rows returned"**.

### Passo 2: conferir

1. No SQL Editor, clique em **+ New query**.
2. Abra `supabase/testes/conferencia-fase-5c.sql` no Bloco de Notas, copie tudo, cole no editor e clique em **Run**.
3. As **5 linhas** devem mostrar **true**. Mande um print para o Claude.

### Passo 3: enviar para o GitHub

1. Abra `github.com/Ayra-sw/ayra-ponto` e clique em **Add file** → **Upload files**.
2. Na pasta extraída há **3 pastas** (`docs`, `src`, `supabase`) e **1 arquivo** (`README.md`). Selecione os 4 com **Ctrl+A** e arraste para o quadro grande.
3. Devem aparecer **11 arquivos**.
4. Na **caixinha pequena de cima**, escreva: `Fase 5C: comprovante por e-mail`
5. Deixe a caixa grande vazia e clique em **Commit changes**.
6. Espere o **✓ verde**.

### Passo 4: atualizar a função "assinar"

A função já existe; só vamos trocar o código dela.

1. Na pasta extraída, entre em `supabase` → `functions` → `assinar` e abra `index.ts` no **Bloco de Notas**.
2. Aperte **Ctrl+A** e depois **Ctrl+C**.
3. No Supabase, clique em **Edge Functions** → **Functions** → **assinar**.
4. Clique na aba **Code**.
5. Clique dentro do código, aperte **Ctrl+A** e depois **Delete**. Depois aperte **Ctrl+V**.
6. A segunda linha deve ser `// Ayra Ponto — Edge Function "assinar" (Fases 5B e 5C)`.
7. Clique no botão verde de publicar (**Deploy**) e espere de 10 a 30 segundos.
8. **Não mexa** na aba **Settings**: a chave "Verify JWT" continua como está.

### Passo 5: criar a conta no Resend

1. Abra **resend.com** e clique em **Get Started** (ou **Sign up**).
2. Crie a conta com **o mesmo e-mail que você usa para entrar no Ayra Ponto**. Isso é importante: no modo teste, o Resend só envia para o e-mail da própria conta.
3. Confirme o e-mail, se ele pedir.
4. No menu da esquerda, clique em **API Keys** e depois em **Create API Key**.
   - **Name:** `Ayra Ponto`
   - **Permission:** **Sending access**
   - Clique em **Add** (ou **Create**).
5. Aparece uma chave que começa com **`re_`**. Clique para **copiar**.
   - **Ela só aparece uma vez.** Cole num Bloco de Notas por enquanto, sem salvar o arquivo em lugar público.
   - **Nunca coloque essa chave no GitHub.**

### Passo 6: guardar os segredos do e-mail

1. No Supabase, clique em **Edge Functions** → **Secrets** (a mesma tela do `CERTIFICADO_SENHA`).
2. Preencha o primeiro segredo:
   - **Name:** `RESEND_API_KEY`
   - **Value:** a chave `re_...` que você copiou
3. Clique em **Add another** e preencha o segundo:
   - **Name:** `EMAIL_TESTE`
   - **Value:** o seu e-mail, o mesmo da conta do Resend e do login no Ayra Ponto
4. Clique em **Save**.
5. Em **Custom secrets**, devem aparecer `CERTIFICADO_SENHA`, `RESEND_API_KEY` e `EMAIL_TESTE`.

**Não crie** o `EMAIL_REMETENTE` agora: ele só entra quando tivermos domínio.

### Passo 7: testar

1. Abra `ayra-ponto.vercel.app` e aperte **Ctrl+F5**.
2. Vá em **Minha conta**: aparece o cartão **Comprovante por e-mail**, marcado, com o seu e-mail.
3. Registre uma marcação na sua empresa de teste.
4. Em 1 a 5 minutos, chega no seu e-mail o **"[TESTE] Comprovante de ponto: …"**, com o PDF anexado.
   - Se não aparecer na caixa de entrada, olhe **Spam** e **Promoções**.
5. Abra o PDF: é o mesmo comprovante assinado da Fase 5B.

## Se algo der errado

- **O e-mail não chegou:**
  1. Olhe **Spam**, **Lixo eletrônico** e **Promoções**.
  2. No Resend, clique em **Emails** (menu da esquerda): se o envio aparecer lá, ele saiu; o problema é a caixa de entrada.
  3. Confira os nomes dos segredos do Passo 6, letra por letra, e se o `EMAIL_TESTE` é igual ao e-mail do login no Ayra Ponto.
  4. Rode isto no SQL Editor e mande um print para o Claude. A coluna `ultimo_erro` diz o motivo:
     ```sql
     select situacao, ultimo_erro, criado_em from fila_comprovantes_email order by criado_em desc limit 5;
     ```
- **Situação `ignorado_teste`:** o e-mail de quem marcou é diferente do `EMAIL_TESTE`. É o modo teste funcionando.
- **Situação `pendente` com "Falta o segredo RESEND_API_KEY":** o segredo não foi salvo ou o nome está diferente. Refaça o Passo 6. O envio sai sozinho em até 5 minutos.
- **O site não abre depois do envio:** na Vercel, use **Instant Rollback** no deploy anterior e me avise.
- **Precisa desligar a Fase 5C no banco:** rode o `…_DESFAZER.sql` do mesmo jeito do Passo 1.
  - O envio de e-mails para e o agendamento é desligado.
  - As escolhas das pessoas ficam guardadas para quando reinstalar.
  - O comprovante continua na tela e no histórico.

## Como foi testado

- **Banco:** numa cópia local com todas as fases aplicadas. **82 cenários novos passaram**:
  - a marcação entra na fila com o e-mail de login; desligado; sem e-mail;
  - quem vê e quem mexe: a pessoa só na própria escolha; ninguém do app lê a fila, a senha nem as funções do servidor;
  - envio, nova tentativa com espera crescente, desistência na 6ª falha, envio travado que volta para a fila e o limite de 48 horas;
  - a marcação acontece mesmo com a fila quebrada;
  - o agendamento só chama a função quando há algo na fila, com a senha certa e até 6 chamadas juntas.
- **Fases anteriores com a 5C ligada:** os 402 cenários antigos e os da 3C (98), 4A (50), 5A (70) e 5B (13) passaram. A migração rodou duas vezes sem erro, e o DESFAZER e a reinstalação funcionaram.
- **Função:** testada com o Supabase e o Resend simulados. **28 verificações passaram**:
  - modo teste e produção;
  - só os comprovantes de quem está logado;
  - a senha da fila;
  - as respostas do Resend: fora do ar, e-mail recusado, chave errada e envio repetido;
  - o PDF anexado com assinatura íntegra (pyHanko);
  - o texto do e-mail protegido contra códigos maliciosos.
  - As funções da 5B (AFD, AEJ e comprovante) continuam passando.
  - Cada comprovante assinado leva cerca de 0,1 segundo no servidor.
- **Telas:** **18 verificações novas passaram**: o cartão em Minha conta (ligar, desligar, erro ao salvar, sem a 5C no banco, gestão, celular e acessibilidade) e o pedido de envio logo depois da marcação, mesmo sem a função instalada.
  - As verificações das fases 2C a 5B continuam passando: 72, 85, 75, 49, 40, 59, 40, 24 e 23.
  - Na 2B, 4 verificações dependem da data de hoje (início de mês, num domingo). Falham igual na versão que está no ar hoje, então não são efeito desta fase.

## Pontos para o advogado conferir antes de vender

- O comprovante por e-mail leva **nome e CPF** do trabalhador no PDF. Ele vai só para o e-mail de login da própria pessoa. Vale citar esse envio no **aviso de privacidade (LGPD)**.
- O art. 80 pede o comprovante em até **48 horas**. Além do e-mail, ele fica **sempre** disponível na tela e no histórico.
- O e-mail pode ser desligado pela própria pessoa. Confirmar se o advogado concorda, já que o PDF continua disponível no app.

## O que fica para depois

- **Domínio próprio** no Registro.br, verificado no Resend, e o segredo `EMAIL_REMETENTE`. A partir daí, todos recebem.
- **Plano do Resend:** o grátis tem limite de 100 e-mails por dia, o que dá umas 25 pessoas batendo 4 pontos por dia. Antes dos primeiros clientes, o plano pago custa US$ 20 por mês, para 50 mil e-mails, sem limite diário.
- O resto continua igual: e-CNPJ A1, INPI, advogado e contato do suporte.
