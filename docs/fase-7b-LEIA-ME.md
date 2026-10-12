# Ayra Ponto — Fase 7B: fechar o mês

Pacote preparado em 11/10/2026 a partir do commit `7f18361` ("Fase 7A: regras de calculo").

Segunda das 3 etapas do **Fechamento do mês**. Agora o mês tem começo, meio e fim: **conferir → fechar → enviar ao contador**.

**Decisões suas, respeitadas:**

- fechar **trava o mês**; só o **administrador reabre**, e o motivo vai para o Histórico de alterações;
- **administrador e RH** podem fechar;
- com pendências, o Ayra **avisa e deixa fechar** ("Fechar mesmo assim?");
- a planilha é o **Excel padrão do Ayra** (modelos de sistemas de folha específicos só quando um cliente pedir).

## O que muda para quem usa

- **Nova tela: Gestão → Fechamento do mês** (abre no mês passado; as setas trocam o mês). No topo, as três etapas: **Conferir**, **Fechar** e **Enviar ao contador**.
  - **Conferir:** lista o que falta, cada item com um círculo que fica verde quando está certo:
    - **dias sem saída marcada**, com o nome da pessoa (clicando, abre o espelho dela naquele mês) e os dias;
    - **pedidos esperando resposta**, com o botão **Ver pedidos**;
    - **pessoas sem jornada**, com link para a ficha.
  - **Fechar:** o botão **Fechar setembro de 2026** (por exemplo). Se ainda houver pendências, aparece **"Fechar mesmo assim?"**. O mês do calendário só pode ser fechado depois que termina (a tela diz a data).
  - **Enviar ao contador:** com o mês fechado, aparecem quem fechou e quando, o botão **Baixar planilha para o contador** e os totais de cada pessoa.
  - **Reabrir o mês:** só o administrador vê. Pede o motivo (fica no Histórico de alterações). O RH vê o aviso de que só o administrador reabre.
- **A planilha (Excel, .xlsx)** tem 4 abas:
  - **Resumo:** uma linha por pessoa (nome, CPF, matrícula, unidade, departamento, cargo, jornada, dias trabalhados, faltas, horas previstas e trabalhadas, atrasos, faltas em horas, abonos, extras 50%, extras 100%, horas noturnas, intervalo a pagar, descanso a pagar, DSR perdidos, banco de horas, saldo, dias com aviso e código de integridade). Horas em **horas:minutos**;
  - **Horas decimais:** os mesmos totais em horas decimais (12,50 = doze horas e meia), que muitos sistemas de folha pedem;
  - **Dia a dia:** cada dia de cada pessoa, com as marcações;
  - **Sobre:** empresa, CNPJ, mês, quem fechou, quando, e as regras de cálculo usadas.
- **Mês travado:** com o mês fechado, ninguém aprova pedidos nem muda afastamentos, banco de horas, escalas ou feriados daquele mês. A equipe ainda pode **fazer** pedidos: eles esperam até o mês ser reaberto.
- **Espelho de ponto** de um mês fechado mostra o aviso **"Mês fechado"** e o espelho **guardado no fechamento**. Mudar uma jornada ou uma regra depois não muda o mês fechado.
- **Visão geral:** lembrete "Setembro de 2026 ainda não foi fechado", com o link **Fechar o mês** (não aparece para empresa criada neste mês).
- **Histórico de alterações:** "Ana fechou o mês de setembro de 2026", "Ana reabriu o mês…" (com o motivo).
- **Ajuda:** artigo novo, **Fechar o mês e mandar a planilha ao contador**.

## Importante saber

- Ao fechar, o Ayra guarda uma **foto do espelho** de cada pessoa, com um **código de integridade** (SHA-256). A Fase 7C (o colaborador confere e assina) vai usar essa foto.
- **Reabrir apaga a foto**; fechar de novo cria outra, com os números atualizados. Se a planilha já foi para o contador, avise que vai sair uma nova.
- O **CPF** guardado na foto só é lido pelo administrador e pelo RH (na planilha). O gestor de equipe continua vendo só o espelho.
- A planilha é montada **no próprio navegador**, sem programa extra: abre no Excel, no LibreOffice e no Google Planilhas.

## Arquivos do pacote

16 arquivos: 7 novos e 9 alterados. **Nenhum arquivo é apagado.**

| Pasta | Novos | Alterados |
|---|---|---|
| raiz | — | `README.md` |
| `docs/` | `fase-7b-LEIA-ME.md` (este guia) | — |
| `supabase/migrations/` | `2026-10-12_fase-7b_fechamento-mes.sql` e `…_DESFAZER.sql` | — |
| `supabase/testes/` | `conferencia-fase-7b.sql` | — |
| `src/` | — | `App.jsx`, `telas.js`, `styles.css` |
| `src/pages/` | — | `GestaoDashboard.jsx` |
| `src/pages/gestao/` | `Fechamento.jsx` | — |
| `src/lib/` | `fechamento.js`, `xlsx.js` | `historico.js`, `ajuda/artigosGestao.js` |
| `src/components/espelho/` | — | `EspelhoMensal.jsx` |
| `src/components/layout/` | — | `ShellGestao.jsx` |

**Dependências novas:** nenhuma. **Segredos novos:** nenhum.

## Mudanças no banco (migração da Fase 7B)

**Nenhuma marcação, pedido ou cálculo antigo é alterado.** Precisa da Fase 7A já instalada (a migração confere).

- **Tabela nova `fechamentos`:** um registro por empresa e mês (fechado ou reaberto, quem, quando, motivo, regras usadas). Todos da empresa leem; ninguém grava pelo app, só as funções abaixo.
- **Tabela nova `fechamento_espelhos`:** a foto do espelho de cada pessoa no fechamento. Leem: a própria pessoa, o administrador e o RH, e o gestor da equipe (sem os dados de cadastro).
- **Travas:** pedidos (aprovar), afastamentos, banco de horas, escalas e feriados de um mês fechado são recusados com a mensagem "O mês de … está fechado…".
- **Funções novas:** `pendencias_fechamento` (adm. e RH), `fechar_mes` (adm. e RH), `reabrir_mes` (só adm.) e `planilha_fechamento` (adm. e RH).

## Passo a passo

**Antes de tudo:** no Supabase, confira se no alto da tela está escrito **AYRA SOLUÇÕES / Ayra Ponto**.

### Passo 0: conferir o GitHub

Eu já conferi: o último envio é o `7f18361` (Fase 7A). Se você fizer algum envio antes de aplicar este pacote, me avise primeiro.

### Passo 1: rodar a migração no Supabase

1. Extraia o ZIP: clique com o botão direito em `ayra-ponto-fase-7b-fechamento-mes.zip` e escolha **Extrair tudo** → **Extrair**.
2. Entre em **supabase** → **migrations** e abra `2026-10-12_fase-7b_fechamento-mes.sql` (o arquivo **sem** "DESFAZER" no nome) no **Bloco de Notas**.
3. Aperte **Ctrl+A** e depois **Ctrl+C**.
4. No Supabase, clique em **SQL Editor** e depois em **+ New query**.
5. Clique no editor e aperte **Ctrl+V**.
6. Clique em **Run**.
   - Se aparecer um aviso sobre operação destrutiva ("destructive operation"), pode clicar em **Run this query**. São só linhas que recriam regras de acesso; nenhum dado é apagado.
7. Deve aparecer **"Success. No rows returned"**.

### Passo 2: conferir

1. No SQL Editor, clique em **+ New query**.
2. Abra `supabase/testes/conferencia-fase-7b.sql` no Bloco de Notas, copie tudo, cole no editor e clique em **Run**.
3. As **5 linhas** devem mostrar **true**. Mande um print para o Claude.

### Passo 3: enviar para o GitHub

1. **Confira que é o pacote certo:** dentro de `src` → `pages` → `gestao` tem que existir o arquivo **`Fechamento.jsx`**.
2. Abra `github.com/Ayra-sw/ayra-ponto` e clique em **Add file** → **Upload files**.
3. Na pasta extraída há **3 pastas** (`docs`, `src`, `supabase`) e **1 arquivo** (`README.md`). Selecione os 4 com **Ctrl+A** e arraste para o quadro grande.
4. Devem aparecer **16 arquivos**.
5. Na **caixinha pequena de cima**, escreva: `Fase 7B: fechamento do mes`
6. Deixe a caixa grande vazia e clique em **Commit changes**.
7. Espere o **✓ verde**.

### Passo 4: testar

1. Abra `ayra-ponto.vercel.app` e aperte **Ctrl+F5**.
2. No menu, em **Gestão**, clique em **Fechamento do mês**. Vai abrir o mês passado, com a lista do que falta.
3. Se quiser testar até o fim: clique em **Fechar**, depois em **Baixar planilha para o contador** e abra o arquivo. Para desfazer o teste, clique em **Reabrir o mês** e escreva "Teste do fechamento".

## Se algo der errado

- **A tela diz "Ainda não instalado":** o Passo 1 não foi rodado.
- **A migração diz "Antes desta migração é preciso aplicar a Fase 7A":** a 7A não está no banco. Me avise.
- **Não consigo aprovar um pedido / lançar um afastamento:** o mês dele está fechado. O administrador reabre em Fechamento do mês.
- **A planilha não baixa:** confira se o navegador não bloqueou o download (ícone no canto da barra de endereço).
- **Para desligar:** rode `2026-10-12_fase-7b_fechamento-mes_DESFAZER.sql`. As travas e as funções saem; os fechamentos ficam guardados, sem uso. Nada é apagado.

## Próxima etapa

- **7C: O colaborador confere e assina:** "Está certo" com a digital ou a senha, ou "Encontrei um problema" (abre um pedido), e um painel do RH com quem já assinou. Vai usar a foto e o código de integridade desta fase.
