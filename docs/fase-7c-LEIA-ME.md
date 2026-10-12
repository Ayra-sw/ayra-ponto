# Ayra Ponto — Fase 7C: o colaborador confere e assina o espelho

Pacote preparado em 12/10/2026 a partir do commit `272a40d` ("Fase 7B: fechamento do mes").

Última das 3 etapas do **Fechamento do mês**. Depois que a empresa fecha o mês, cada pessoa confere o próprio espelho e assina.

**Decisões suas, respeitadas:**

- a pessoa assina com o botão **Está certo** e confirma com a **digital** ou a **senha**;
- **Encontrei um problema**: a pessoa escolhe o dia e explica; vira um **pedido de ajuste** para o RH, e o espelho fica marcado "com problema" até ser resolvido;
- quem não assina recebe **só lembrete** (não existe "aceite automático");
- o aviso chega pelo **sininho** do Ayra e por um cartão na tela inicial.

## O que muda para quem usa

**Para o colaborador** (e também para o administrador e o RH, no "Meu espelho" de cada um):

- Quando o mês é fechado, chega no sininho: **"Seu espelho de setembro de 2026 está pronto"**.
- Na tela inicial aparece o cartão **"Seu espelho de … está pronto"** com o botão **Conferir e assinar**.
- No espelho do mês fechado aparece o cartão **"Confira e assine seu espelho"**, com dois botões:
  - **Está certo:** abre a janela "Assinar o espelho". Quem ativou a digital no aparelho vê **Assinar com a digital** (e pode trocar para a senha). Os outros digitam a **senha do Ayra Ponto**.
  - **Encontrei um problema:** pergunta **em qual dia** (já sugere o primeiro dia com aviso) e abre o **Pedir ajuste** daquele dia, para a pessoa contar o que está errado.
- Depois de assinar, o cartão vira **"Você assinou o espelho de …"**, com a data, a hora e se foi com a digital ou a senha.
- **Imprimir ou salvar em PDF:** no lugar de "Conferido por: ____", a folha mostra **"Assinado eletronicamente por … em …"** e o código de integridade.

**Para o administrador e o RH**, em **Fechamento do mês** (com o mês fechado):

- Cartão **Assinaturas dos colaboradores**: "5 de 8 assinaram", uma barra de progresso, quem ainda não conferiu e a última assinatura.
- Quem **encontrou um problema** aparece com o nome, o dia e o que escreveu. O sininho também avisa: "Duda encontrou um problema no espelho de setembro".
- Botão **Lembrar quem falta**: manda um aviso no sininho para quem ainda não conferiu (no máximo um por dia para cada pessoa).
- Na tabela de totais, uma coluna nova: **Assinatura** (Assinou / Problema / Falta assinar).

**Histórico de alterações:** "Duda assinou o espelho de setembro de 2026", "Caio encontrou um problema…".

**Ajuda:** artigo novo, **Conferir e assinar o espelho do mês**, e o artigo do fechamento ganhou a parte das assinaturas.

## Importante saber

- **A assinatura vale para aquela versão do espelho.** Ela guarda o código de integridade da foto do fechamento.
- **Reabrir o mês** guarda as assinaturas como "substituídas" (elas não são apagadas). Ao **fechar de novo**:
  - quem já tinha assinado e **não teve nada mudado** no espelho **continua assinado**, sem precisar fazer nada;
  - quem teve o espelho mudado recebe um aviso para assinar de novo.
- **Segurança:** o banco só aceita a assinatura se a pessoa confirmou a digital ou a senha **nos últimos 10 minutos**. Isso é conferido no próprio login, não só na tela.
- A assinatura guarda também o **endereço de internet (IP)** e o **aparelho** de onde foi feita, como prova. Esses dados não aparecem no histórico. Vale incluir na revisão do advogado (LGPD).
- Para aprovar o pedido de um problema, o mês precisa ser **reaberto** (a trava da 7B continua valendo).
- A assinatura **não é obrigatória** para mandar a planilha ao contador.

## Arquivos do pacote

18 arquivos: 7 novos e 11 alterados. **Nenhum arquivo é apagado.**

| Pasta | Novos | Alterados |
|---|---|---|
| raiz | — | `README.md` |
| `docs/` | `fase-7c-LEIA-ME.md` (este guia) | — |
| `supabase/migrations/` | `2026-10-13_fase-7c_assinatura-espelho.sql` e `…_DESFAZER.sql` | — |
| `supabase/testes/` | `conferencia-fase-7c.sql` | — |
| `src/` | — | `styles.css` |
| `src/pages/` | — | `FuncionarioDashboard.jsx`, `GestaoDashboard.jsx`, `MeuEspelho.jsx` |
| `src/pages/gestao/` | — | `Fechamento.jsx` |
| `src/lib/` | `conferencia.js` | `historico.js`, `ajuda/artigosGestao.js`, `ajuda/artigosPessoais.js` |
| `src/components/espelho/` | `ConferirEspelho.jsx`, `AvisoAssinar.jsx` | `EspelhoMensal.jsx` |
| `src/components/sininho/` | — | `Sininho.jsx` |

**Dependências novas:** nenhuma. **Segredos novos:** nenhum. **Nada muda no Supabase além do SQL** (a digital já está ligada desde a 6B).

## Mudanças no banco (migração da Fase 7C)

**Nenhuma marcação, pedido ou cálculo antigo é alterado.** Precisa da Fase 7B já instalada (a migração confere).

- **Tabela nova `espelho_conferencias`:** a assinatura (ou o problema apontado) de cada pessoa em cada fechamento. A própria pessoa vê a dela; o administrador e o RH veem as da empresa. Ninguém grava pelo app, só as funções.
- **Funções novas:** `assinar_espelho` (a própria pessoa), `minhas_conferencias` (a própria pessoa), `lembrar_assinaturas` (adm. e RH).
- **Automático:** aviso no sininho ao fechar; pedido para um dia de mês fechado marca o espelho "com problema" e avisa o administrador e o RH; ao reabrir, as assinaturas viram "substituídas".
- **Sininho:** aceita os dois tipos novos de aviso.

## Passo a passo

**Antes de tudo:** no Supabase, confira se no alto da tela está escrito **AYRA SOLUÇÕES / Ayra Ponto**.

### Passo 0: conferir o GitHub

Eu já conferi: o último envio é o `272a40d` (Fase 7B). Se você fizer algum envio antes de aplicar este pacote, me avise primeiro.

### Passo 1: rodar a migração no Supabase

1. Extraia o ZIP: clique com o botão direito em `ayra-ponto-fase-7c-assinatura-espelho.zip` e escolha **Extrair tudo** → **Extrair**.
2. Entre em **supabase** → **migrations** e abra `2026-10-13_fase-7c_assinatura-espelho.sql` (o arquivo **sem** "DESFAZER" no nome) no **Bloco de Notas**.
3. Aperte **Ctrl+A** e depois **Ctrl+C**.
4. No Supabase, clique em **SQL Editor** e depois em **+ New query**.
5. Clique no editor e aperte **Ctrl+V**.
6. Clique em **Run**.
   - Se aparecer um aviso sobre operação destrutiva ("destructive operation"), pode clicar em **Run this query**. São só linhas que recriam regras de acesso; nenhum dado é apagado.
7. Deve aparecer **"Success. No rows returned"**.

### Passo 2: conferir

1. No SQL Editor, clique em **+ New query**.
2. Abra `supabase/testes/conferencia-fase-7c.sql` no Bloco de Notas, copie tudo, cole no editor e clique em **Run**.
3. As **5 linhas** devem mostrar **true**. Mande um print para o Claude.

### Passo 3: enviar para o GitHub

1. **Confira que é o pacote certo:** dentro de `src` → `components` → `espelho` tem que existir o arquivo **`ConferirEspelho.jsx`**.
2. Abra `github.com/Ayra-sw/ayra-ponto` e clique em **Add file** → **Upload files**.
3. Na pasta extraída há **3 pastas** (`docs`, `src`, `supabase`) e **1 arquivo** (`README.md`). Selecione os 4 com **Ctrl+A** e arraste para o quadro grande.
4. Devem aparecer **18 arquivos**.
5. Na **caixinha pequena de cima**, escreva: `Fase 7C: assinatura do espelho`
6. Deixe a caixa grande vazia e clique em **Commit changes**.
7. Espere o **✓ verde**.

### Passo 4: testar

1. Abra `ayra-ponto.vercel.app` e aperte **Ctrl+F5**.
2. Se o mês de setembro ainda estiver fechado do teste da 7B, o administrador pode **Reabrir** e **Fechar** de novo para ver os avisos chegarem.
3. No menu da gestão, clique em **Meu espelho** e escolha o mês fechado. Aparece o cartão **Confira e assine**. Toque em **Está certo** e confirme com a sua senha (ou digital).
4. Em **Fechamento do mês**, veja o cartão **Assinaturas dos colaboradores**.

## Se algo der errado

- **O cartão de assinar não aparece:** confira se o mês está **fechado** e aperte **Ctrl+F5**. Se continuar, confira o Passo 1.
- **"Para assinar, confirme que é você…":** a confirmação demorou mais de 10 minutos. Toque em **Está certo** de novo.
- **"O espelho mudou desde que você abriu a tela":** o mês foi reaberto e fechado de novo enquanto a tela estava aberta. Atualize a página.
- **A migração diz "Antes desta migração é preciso aplicar a Fase 7B":** a 7B não está no banco. Me avise.
- **Para desligar:** rode `2026-10-13_fase-7c_assinatura-espelho_DESFAZER.sql`. As assinaturas já feitas ficam guardadas; só param de ser pedidas. Nada é apagado.

## Fase 7 completa

Com a 7C, o **Fechamento do mês** fica completo: regras de cálculo (7A), fechar e mandar ao contador (7B), e o colaborador confere e assina (7C).
