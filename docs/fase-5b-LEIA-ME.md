# Ayra Ponto — Fase 5B: assinatura digital

Pacote preparado em 04/10/2026 a partir do commit `49ddc94` ("Fase 5A: arquivos oficiais AFD e AEJ").

Com este pacote, **a Fase 5 fica completa no código**. A partir daqui, o que falta para vender não é programação: o certificado de verdade, o INPI, o advogado e o contato do suporte.

**Decisões suas, respeitadas:**

- **testar já com um certificado de teste**, trocando pelo e-CNPJ A1 depois, sem mexer no código;
- **só o comprovante** ganha PDF assinado; o espelho continua como está;
- o **Atestado Técnico** fica para depois, com o advogado.

## O que muda para quem usa

### Comprovante em PDF assinado (todo mundo que bate ponto)

- No comprovante que aparece depois de cada marcação, há o botão **Baixar comprovante em PDF**.
- No **Histórico**, cada marcação ganhou um botão de PDF ao lado do NSR.
- O PDF é o **Comprovante de Registro de Ponto do Trabalhador** da Portaria 671 (art. 79), com todos os dados exigidos:
  - o NSR, o empregador (nome e CNPJ), o local de trabalho, o trabalhador (nome e CPF) e a data e o horário;
  - o número do INPI e o código SHA-256 da marcação;
  - a **assinatura digital PAdES**.
- Ele fica disponível para **todas as marcações**, não só as das últimas 48 horas, que é o mínimo da lei.

### AFD e AEJ assinados (administrador e RH)

- Em **Arquivos fiscais**, o AFD e o AEJ agora vêm num **.zip** com o arquivo de texto e a **assinatura .p7s** (padrão CAdES), como a Portaria pede. Os dois devem ser entregues juntos.
- A tela mostra qual certificado está assinando:
  - **"Certificado de TESTE em uso"** (aviso amarelo): é o de agora. As assinaturas funcionam, mas **não valem para fiscalização**.
  - **"Assinatura digital ICP-Brasil ativa"** (verde): quando o e-CNPJ A1 de verdade estiver instalado.
  - **"Assinatura digital ainda não configurada"**: sem certificado, os arquivos saem sem o .p7s, como na 5A.

### Onde fica o certificado

- O certificado fica guardado num **cofre privado do Supabase** (Storage, pasta `certificados`). **Ninguém do app consegue ler**: só a função de assinatura, pelo servidor.
- A **senha** fica num **segredo** da função, que não aparece em lugar nenhum.
- **Nunca coloque o certificado nem a senha no GitHub.** O repositório é público.

## Arquivos do pacote

**ZIP para o GitHub:** 14 arquivos, sendo 7 novos e 7 alterados. **Nenhum arquivo é apagado.**

| Pasta | Novos | Alterados |
|---|---|---|
| raiz | — | `README.md` |
| `docs/` | `fase-5b-LEIA-ME.md` (este guia) | — |
| `supabase/functions/assinar/` (pasta nova) | `index.ts` (a função de assinatura) | — |
| `supabase/migrations/` | `2026-10-06_fase-5b_assinatura.sql` e `…_DESFAZER.sql` | — |
| `supabase/testes/` | `conferencia-fase-5b.sql` | — |
| `src/components/ponto/` | `BotaoComprovantePdf.jsx` | `Comprovante.jsx` |
| `src/components/marcacoes/` | — | `HistoricoMarcacoes.jsx` |
| `src/lib/` | `assinatura.js` | `ajuda/artigosGestao.js`, `ajuda/artigosPessoais.js` |
| `src/pages/gestao/` | — | `ArquivosFiscais.jsx` |
| `src/` | — | `styles.css` |

**Arquivo separado (NÃO vai para o GitHub):** `certificado-a1.pfx`, o certificado de teste. A senha é `ayra-teste-2026`.

**Dependências novas no site:** nenhuma. A função de assinatura usa bibliotecas que o próprio Supabase baixa.

## Passo a passo

**Antes de tudo:** no Supabase, confira se no alto da tela está escrito **AYRA SOLUÇÕES / Ayra Ponto**.

São 5 passos. Os passos 3, 4 e 5 são novidade: tudo pelo painel do Supabase, sem terminal.

### Passo 1: rodar a migração (SQL Editor)

1. Extraia o ZIP. Abra `supabase/migrations/2026-10-06_fase-5b_assinatura.sql` (o arquivo **sem** "DESFAZER" no nome) no **Bloco de Notas**.
2. Aperte **Ctrl+A** e depois **Ctrl+C**.
3. No Supabase, clique em **SQL Editor** → **+ New query**, cole com **Ctrl+V** e clique em **Run**.
4. Deve aparecer **"Success. No rows returned"**.
5. Clique em **+ New query**, cole o conteúdo de `supabase/testes/conferencia-fase-5b.sql` e clique em **Run**.
6. As **3 linhas** devem mostrar **true**.

### Passo 2: enviar para o GitHub

1. Abra `github.com/Ayra-sw/ayra-ponto` e clique em **Add file** → **Upload files**.
2. Na pasta extraída há **3 pastas** (`docs`, `src`, `supabase`) e **1 arquivo** (`README.md`). Selecione os 4 com **Ctrl+A** e arraste para o quadro grande.
3. Devem aparecer **14 arquivos**. **Confira que não há nenhum arquivo .pfx na lista.**
4. Na **caixinha pequena de cima**, escreva: `Fase 5B: assinatura digital`
5. Deixe a caixa grande vazia, clique em **Commit changes** e espere o **✓ verde**.

### Passo 3: criar a função de assinatura (Edge Functions)

1. Na pasta extraída, entre em `supabase` → `functions` → `assinar` e abra o arquivo `index.ts` no **Bloco de Notas**.
2. Aperte **Ctrl+A** e depois **Ctrl+C**.
3. No Supabase, clique em **Edge Functions** no menu da esquerda.
4. Clique em **Deploy a new function** e escolha **Via Editor**.
5. No campo do nome da função, apague o que estiver escrito e escreva exatamente: **`assinar`** (tudo minúsculo).
6. Clique dentro do editor de código, apague todo o código de exemplo (**Ctrl+A** e depois **Delete**) e cole com **Ctrl+V**.
7. Clique em **Deploy function**. Espere de 10 a 30 segundos.
8. A função **assinar** aparece na lista.

### Passo 4: guardar a senha do certificado (segredo)

1. Ainda em **Edge Functions**, clique em **Secrets**. Pode aparecer como **Edge Function Secrets**.
2. Em **Key** (nome), escreva: **`CERTIFICADO_SENHA`**
3. Em **Value** (valor), escreva a senha do certificado de teste: **`ayra-teste-2026`**
4. Clique em **Save**.

### Passo 5: guardar o certificado no cofre (Storage)

1. Baixe o arquivo **`certificado-a1.pfx`** que mandei separado, aqui no chat. Não renomeie: o nome precisa ser exatamente este.
2. No Supabase, clique em **Storage** no menu da esquerda.
3. Clique no cofre **certificados**. Ele foi criado pelo Passo 1 e tem um cadeado, porque é privado.
4. Clique em **Upload file** (ou arraste o arquivo para dentro) e escolha o `certificado-a1.pfx`.
5. O arquivo aparece na lista.

## Testar

Abra `ayra-ponto.vercel.app` e aperte **Ctrl+F5**.

1. **Gestão → Arquivos fiscais:** aparece o aviso amarelo **"Certificado de TESTE em uso"**, com "AYRA SOLUCOES - CERTIFICADO DE TESTE". Isso mostra que a função, a senha e o certificado estão funcionando juntos.
2. Clique em **Baixar AFD**.
   - Vem um arquivo **.zip**.
   - Abra (clique duas vezes): dentro há o **.txt** e o **.txt.p7s**.
3. **Meu ponto:** em **Marcações de hoje**, clique no **NSR** de uma marcação e depois em **Baixar comprovante em PDF**.
   - Abra o PDF: é o comprovante com todos os dados e, no fim, a frase sobre a assinatura.
   - Se abrir no **Adobe Reader**, ele vai dizer que a assinatura é **"desconhecida"** ou **"não confiável"**. **Isso é esperado com o certificado de teste**, porque ele não é da ICP-Brasil. Com o e-CNPJ de verdade, o Adobe mostra a assinatura como válida.
4. **Meu histórico:** cada marcação tem um botão de PDF ao lado do NSR.
5. **Celular:** abra o Histórico no celular e baixe um comprovante.

## Quando comprar o e-CNPJ A1 de verdade

1. Compre um **e-CNPJ do tipo A1** (arquivo .pfx), em nome da Ayra Soluções, numa certificadora (Serasa, Certisign, Soluti, Valid…). Tem que ser **A1**: o A3 (token ou cartão) não funciona no servidor.
2. Renomeie o arquivo para **`certificado-a1.pfx`**.
3. Em **Storage → certificados**, apague o arquivo de teste e envie o novo.
4. Em **Edge Functions → Secrets**, troque o valor de **`CERTIFICADO_SENHA`** pela senha do certificado novo e clique em **Save**.
5. Em até 5 minutos, a tela **Arquivos fiscais** mostra **"Assinatura digital ICP-Brasil ativa"**.

Não precisa me mandar o certificado nem a senha: você mesma faz a troca.

## Se algo der errado

- **Aparece "Assinatura digital ainda não instalada":** a função não foi criada, ou o nome não está exatamente `assinar`. Refaça o Passo 3.
- **Aparece "O certificado digital ainda não foi configurado":** o arquivo não está no cofre ou tem outro nome. Refaça o Passo 5 com o nome `certificado-a1.pfx`.
- **Aparece "A senha do certificado não confere":** confira o segredo do Passo 4 (sem espaços antes ou depois).
- **Aparece "A função de assinatura recusou o login (verificação de JWT)":**
  1. Em **Edge Functions**, abra a função **assinar** e vá em **Details** (ou Settings).
  2. Desligue **Enforce JWT Verification** (ou "Verify JWT") e salve.
  3. É seguro: quem decide quem pode baixar cada arquivo continua sendo o banco.
- **O site não abre depois do envio:** na Vercel, use **Instant Rollback** no deploy anterior e me avise.
- **Precisa desligar a Fase 5B:**
  - rode o `…_DESFAZER.sql` no SQL Editor;
  - em **Edge Functions**, apague a função **assinar**.

  O site volta a baixar os arquivos sem assinatura, como na 5A.

## Como foi testado

- **Assinatura de verdade, conferida por ferramentas independentes:**
  - **AFD e AEJ:** o .p7s foi conferido com o **OpenSSL**: "Verification successful". Ele tem os atributos do padrão CAdES: tipo de conteúdo, hora da assinatura, resumo e "signing-certificate-v2".
  - **Comprovante em PDF:** conferido com o **pyHanko**, um validador de PDF assinado. O resultado foi assinatura **íntegra e válida**, cobrindo o arquivo inteiro, no formato **ETSI.CAdES.detached** (PAdES).
- **A função inteira** rodou no mesmo motor do Supabase (Deno), com um Supabase simulado. Foram testados:
  - o status do certificado;
  - o AFD assinado, com o arquivo idêntico ao do banco;
  - a recusa de quem não pode;
  - o comprovante assinado;
  - pedido sem login e ação desconhecida;
  - o certificado lido só com a chave do servidor;
  - sem certificado e com senha errada, os dois com mensagens claras;
  - as chaves antigas e as novas do Supabase.
- **Banco:**
  - **13 cenários novos passaram**: quem vê cada comprovante (a própria pessoa, o RH e o administrador; nem a colega nem outra empresa), os dados exigidos pelo art. 79 e o fuso;
  - a migração rodou duas vezes sem erro.
- **Telas:**
  - **23 verificações novas passaram.** Foram testados:
    - o .zip abrindo certo, com o .p7s que confere no OpenSSL e o AFD que passa no validador do leiaute;
    - os quatro avisos de certificado;
    - a função não instalada, caindo no download sem assinatura da 5A;
    - o erro na tela;
    - o PDF baixado validado pelo pyHanko;
    - os botões do histórico;
    - a acessibilidade e o celular.
  - As verificações das fases 2B a 5A continuam passando: 43, 72, 85, 75, 49, 40, 59, 40 e 24.

## Para conferir com quem entende, antes de vender

- **Validação oficial:** quando o e-CNPJ de verdade estiver instalado, valide um AFD (.txt + .p7s) e um comprovante em PDF no **Verificador de Conformidade do ITI** (verificador.iti.gov.br).
- **Política de assinatura:** a assinatura segue o **CAdES-BES / PAdES-B**. Se o advogado ou o auditor exigir uma política específica da ICP-Brasil (por exemplo, AD-RB), é um ajuste pequeno na função.
- **Atestado Técnico e Termo de Responsabilidade (art. 89):** eu preparo um modelo para o advogado revisar. Ele é assinado por pessoas físicas, com e-CPF, como responsável legal e técnico.
