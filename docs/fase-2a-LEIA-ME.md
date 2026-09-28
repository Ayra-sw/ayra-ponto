# Ayra Ponto — Fase 2A: organização da empresa e jornadas

Pacote preparado em 28/09/2026 a partir do commit `4abe23f` ("Add files via upload", o ajuste 1.5a da foto).

A Fase 2 foi dividida em duas partes, para você testar uma de cada vez:

- **Fase 2A (este pacote):** departamentos, cargos, jornadas (modelos de horário), feriados, ficha completa do colaborador, histórico de marcações e pedido de ajuste pelo colaborador.
- **Fase 2B (a próxima):** cálculo de horas trabalhadas, atrasos e horas extras, o ajuste aprovado valendo no cálculo, espelho de ponto, banco de horas e escalas.

**Sobre os ajustes (decisão A, sua):** o arquivo oficial de marcações (AFD) guarda só o que a pessoa bateu de verdade. Nada disso muda nesta fase. O pedido de ajuste é registrado e analisado, e a marcação original nunca é apagada nem alterada. O ajuste aprovado passa a valer no espelho e no cálculo de horas na Fase 2B.

## O que muda para quem usa

**Colaborador**
- Novo item no menu: **Histórico**. Mostra as marcações do mês, dia a dia, com o horário, o número de registro (NSR) e o total trabalhado no dia. Dá para ver os meses anteriores.
- Dias sem a marcação de saída aparecem com o aviso **"Falta a saída"**.
- Botão **"Pedir ajuste"**, com quatro opções:
  - **Esqueci de bater o ponto:** pede para incluir uma marcação (entrada, saída…).
  - **Bati no horário errado:** escolhe a marcação do dia e informa o horário correto.
  - **Abonar falta ou atraso:** atestado, declaração… pode ser um período de vários dias.
  - **Pedir folga.**
- Aba **"Meus pedidos"**: cada pedido com a situação (aguardando análise, aprovada ou recusada).
- Em **Minha conta**, o cartão **"Meu trabalho"** mostra cargo, departamento, matrícula e a jornada com os horários.

**Administrador e RH**
- **Ficha completa do colaborador.** Ao clicar numa pessoa em Colaboradores, abre uma página com abas:
  - **Dados:** nome, CPF, matrícula, telefone.
  - **Trabalho:** unidade, departamento, cargo, jornada, categoria, admissão e situação.
  - **Acesso:** papel no sistema (só o administrador altera).
  - **Marcações:** o histórico completo da pessoa, mês a mês.
  - **Solicitações:** os pedidos da pessoa.
- A lista de colaboradores ganhou a coluna e o filtro de **Departamento** e a busca por **matrícula**.
- **Departamentos** e **Cargos:** cadastrar, editar, desativar, reativar e excluir. Um cadastro com pessoas vinculadas não pode ser excluído (só desativado).
- **Jornadas:** modelos de horário com os 7 dias da semana (entrada, saída e intervalo de cada dia), tolerância diária e a carga semanal calculada na hora. Vêm 3 modelos prontos para começar (Comercial 40h, Comercial 44h e Estágio 30h). Dá para duplicar uma jornada e ajustar. Turno da noite funciona: se a saída for antes da entrada, o sistema entende que é no dia seguinte.
- **Feriados:** cadastro por data, para a empresa toda ou só para uma unidade. O botão **"Feriados nacionais"** adiciona os feriados do ano de uma vez (com opção de incluir Carnaval e Corpus Christi, que são pontos facultativos).
- **Solicitações:** agora mostram exatamente o que foi pedido (por exemplo "Saída em 27/09 18:00" ou "De 20/09 a 22/09") e o nome da pessoa abre a ficha dela.
- **Hoje:** o checklist "Vamos configurar seu Ayra Ponto" ganhou a etapa "Cadastre a jornada de trabalho".
- No **menu lateral**, os itens novos: Departamentos e Cargos (grupo Pessoas), o grupo Jornada (Jornadas e Feriados) e **Meu histórico**.

**Quem pode o quê:** administrador e RH criam e alteram departamentos, cargos, jornadas e feriados e os vínculos das pessoas. Colaborador só enxerga o que é da própria empresa e **não** altera o próprio departamento, cargo, jornada nem matrícula (o banco garante isso, não só a tela).

## Arquivos do pacote

28 arquivos: 17 novos e 11 alterados. **Nenhum arquivo é apagado.**

| Pasta | Novos | Alterados |
|---|---|---|
| raiz | — | `README.md` |
| `docs/` | `fase-2a-LEIA-ME.md` (este guia) | — |
| `supabase/migrations/` | `2026-09-28_fase-2a_organizacao-jornadas.sql` e `…_DESFAZER.sql` | — |
| `supabase/testes/` | `conferencia-fase-2a.sql` | — |
| `src/` | — | `App.jsx` (rotas novas), `styles.css` (barra de salvar e botão da barra superior no celular estreito) |
| `src/components/` | `CadastroSimples.jsx`, `MeuTrabalho.jsx` | — |
| `src/components/marcacoes/` | `HistoricoMarcacoes.jsx`, `ListaSolicitacoes.jsx`, `PedirAjuste.jsx` | — |
| `src/components/layout/` | — | `ShellGestao.jsx` (menu), `ShellColaborador.jsx` (menu) |
| `src/components/ui/` | — | `Campo.jsx` (campo de texto grande) |
| `src/lib/` | `ajustes.js`, `jornadas.js` | `mensagensErro.js` |
| `src/pages/` | `MeuHistorico.jsx` | `GestaoDashboard.jsx`, `MinhaConta.jsx` |
| `src/pages/gestao/` | `Cargos.jsx`, `Departamentos.jsx`, `Feriados.jsx`, `Jornadas.jsx`, `PerfilPessoa.jsx` | `Pessoas.jsx`, `Solicitacoes.jsx` |

**Dependências novas:** nenhuma. O `package.json` não muda.

## Mudanças no banco (migração da Fase 2A)

Tudo é acrescentado. Nenhuma tabela é recriada e nenhum dado é apagado.

- **Tabelas novas:** `departamentos`, `cargos`, `modelos_jornada`, `modelos_jornada_dias` (os 7 dias de cada jornada) e `feriados`. Todas separadas por empresa e com proteção por linha (RLS): quem é de uma empresa nunca vê nem altera dados de outra.
- **`perfis` (cadastro das pessoas):** campos novos `matricula`, `telefone`, `departamento_id`, `cargo_id` e `modelo_jornada_id`. O campo de texto `cargo` continua existindo e passa a acompanhar o cargo escolhido na lista.
- **`ajustes_ponto` (solicitações):** campos novos `tipo_marcacao`, `data_referencia` e `data_fim`.
- **Regras novas no banco:**
  - o vínculo de uma pessoa com departamento, cargo ou jornada só vale se eles forem da mesma empresa;
  - colaborador não altera o próprio departamento, cargo, jornada nem matrícula;
  - não é possível excluir departamento, cargo ou jornada que ainda tem gente (desativar é permitido);
  - nomes não se repetem dentro da empresa (sem diferença de maiúsculas e espaços);
  - matrícula não se repete dentro da empresa;
  - pedido de ajuste: motivo obrigatório (mínimo de 5 letras), marcações dos últimos 90 dias, horário no passado, período de abono de no máximo 60 dias, no máximo 20 pedidos aguardando por pessoa, e quem foi desligado não abre pedido;
  - na análise, só a situação do pedido muda (o dia e o tipo pedidos ficam travados).
- **Função nova:** `salvar_modelo_jornada`, que grava a jornada e os 7 dias de uma só vez (ou grava tudo, ou não grava nada).

## Passo a passo

### Passo 0: conferir o GitHub

Eu já conferi: o último envio é o `4abe23f`. Se você fizer algum envio antes de aplicar este pacote, me avise primeiro.

### Passo 1: rodar a migração no Supabase

1. No seu computador, clique com o botão direito em `ayra-ponto-fase-2a.zip` e escolha **Extrair tudo** → **Extrair**.
2. Na pasta que abriu, entre em **supabase** e depois em **migrations**.
3. Clique com o botão direito em `2026-09-28_fase-2a_organizacao-jornadas.sql` (o arquivo que **não** tem "DESFAZER" no nome). Escolha **Abrir com** → **Bloco de Notas**.
4. No Bloco de Notas, aperte **Ctrl+A** e depois **Ctrl+C**.
5. Entre no Supabase, abra o projeto **Ayra Ponto**, clique em **SQL Editor** no menu da esquerda e depois em **+ New query**.
6. Clique dentro do editor em branco e aperte **Ctrl+V**.
7. Clique no botão verde **Run**.
8. Deve aparecer **"Success. No rows returned"**. Avisos amarelos com a palavra "skipping" são normais.

Se aparecer uma mensagem começando com "As fases anteriores (0, 1 e 1.5) não foram encontradas", nada foi alterado: me mande um print.

### Passo 2: conferir

1. No SQL Editor, clique em **+ New query**.
2. Abra `supabase/testes/conferencia-fase-2a.sql` no Bloco de Notas, copie tudo e cole no editor.
3. Clique em **Run**.
4. As 9 linhas devem mostrar **true** na coluna **ok**. Mande um print para o Claude.

### Passo 3: enviar para o GitHub

1. Abra `github.com/Ayra-sw/ayra-ponto`.
2. Clique no botão **Add file** (perto do botão verde "<> Code") e depois em **Upload files**.
3. Na pasta extraída do ZIP você vai ver **3 pastas** (`docs`, `src`, `supabase`) e **1 arquivo** (`README.md`).
4. Selecione tudo de uma vez: clique em qualquer item e aperte **Ctrl+A**. Os 4 itens ficam azulados.
5. Arraste os itens selecionados para o quadro grande do GitHub.
6. Espere a lista carregar. Devem aparecer **28 arquivos**.
7. Na **caixinha pequena de cima** de "Commit changes", escreva: `Fase 2A: departamentos, cargos, jornadas, feriados, ficha do colaborador e pedidos de ajuste`
8. Deixe a caixa grande de baixo vazia e a bolinha **"Commit directly to the main branch"** marcada.
9. Clique no botão verde **Commit changes**.
10. Espere cerca de 2 minutos até a Vercel publicar (aparece um ✓ verde ao lado do commit).

### Passo 4: testar

Entre com a sua conta de administrador em `ayra-ponto.vercel.app`.

1. **Cadastros:** no menu lateral, entre em **Departamentos** e crie um (por exemplo "Atendimento"). Faça o mesmo em **Cargos**.
2. **Jornada:** entre em **Jornadas**. Como ainda não há nenhuma, aparecem os modelos prontos. Clique em **Comercial 40h**, confira os horários e clique em **Salvar jornada**.
3. **Feriados:** entre em **Feriados**, clique em **Feriados nacionais** e depois em **Adicionar**.
4. **Ficha:** entre em **Colaboradores**, clique no seu nome e vá na aba **Trabalho**. Escolha departamento, cargo e jornada e clique em **Salvar alterações**. Depois abra a aba **Marcações** para ver seu histórico.
5. **Pedido de ajuste:** entre em **Meu histórico**, clique em **Pedir ajuste**, escolha **Pedir folga**, escolha um dia, escreva o motivo e clique em **Enviar pedido**. Depois confira em **Solicitações**: como você mesma pediu, outra pessoa precisa analisar (esse é o comportamento certo).
6. **Celular:** abra o mesmo endereço no celular e confira o **Histórico** e o menu.

## Se algo der errado

- **O site não abre depois do envio:** na Vercel, vá em **Deployments**, clique nos três pontinhos do deploy anterior e escolha **Instant Rollback**. Depois me avise com um print.
- **Precisa desligar as regras novas do banco:** rode `2026-09-28_fase-2a_organizacao-jornadas_DESFAZER.sql` do mesmo jeito do passo 1. As tabelas e os dados cadastrados continuam guardados; só as validações e proteções novas são desligadas.

## Como foi testado

- **Banco:** numa cópia local com as Fases 0, 1, 1.5 e 1.5a aplicadas, com duas empresas para provar o isolamento:
  - 99 cenários passaram: cada papel (administrador, RH e colaborador, das duas empresas) tentando criar, alterar, excluir e ver dados; vínculos entre empresas; matrícula e nomes repetidos; jornadas inválidas (entrada igual à saída, intervalo fora do expediente, sem dia de trabalho); pedidos de ajuste válidos e inválidos; limite de 20 pedidos; pedido em nome de outra pessoa; visitante sem login.
  - as conferências das Fases 0, 1 e 1.5 continuam passando;
  - a migração rodou duas vezes sem erro e o DESFAZER funcionou (e foi reaplicada em seguida).
- **Telas:** o app foi compilado como na Vercel e aberto num navegador, com o Supabase simulado, em computador (claro e escuro) e celular:
  - 36 verificações passaram: ficha com abas e salvamento só do que mudou, histórico com dia incompleto, cadastros, jornada (modelos prontos, 44h somando 44h00, erro de horário), feriados nacionais de 2026 (Sexta-feira Santa em 03/04, Carnaval em 16 e 17/02, Corpus Christi em 04/06), pedidos de ajuste (marcação esquecida, abono de período, correção), Minha conta, menu e checklist;
  - nenhum erro de JavaScript e nenhuma rolagem lateral no celular.

## O que fica para a Fase 2B

- Cálculo de horas trabalhadas, atrasos e horas extras a partir da jornada e dos feriados.
- O ajuste aprovado passando a valer no cálculo e no espelho (sempre ligado à marcação original; o AFD continua só com as marcações reais).
- Espelho de ponto, banco de horas e escalas.
