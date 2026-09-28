# Ayra Ponto — Fase 2B: cálculo das horas e espelho de ponto

Pacote preparado em 28/09/2026 a partir do commit `0bdb0d0` ("Ajuste 2A.1: lista de colaboradores com uma pessoa só").

A Fase 2 foi dividida em três partes:

- **Fase 2A (já no ar):** departamentos, cargos, jornadas, feriados, ficha do colaborador, histórico e pedidos de ajuste.
- **Fase 2B (este pacote):** o cálculo das horas (trabalhadas, atrasos, extras, faltas), o ajuste aprovado valendo no cálculo, o espelho de ponto do mês e o resumo da equipe.
- **Fase 2C (a próxima):** banco de horas e escalas.

**Decisão A, sua, respeitada:** o arquivo oficial de marcações (AFD) continua guardando só o que a pessoa bateu de verdade. Esta fase **não grava nada novo no banco e não altera nenhuma marcação**. A conta é refeita na hora, a cada vez que alguém abre o espelho. O ajuste aprovado entra só no cálculo (e aparece marcado com um lápis), sempre ligado à marcação original, que continua guardada.

## O que muda para quem usa

**Colaborador**
- Novo item no menu: **Espelho**. Mostra o mês dia a dia: as marcações, quanto era previsto trabalhar, quanto foi trabalhado, horas a menos, horas extras e o saldo. No alto ficam os totais do mês.
- Dias com problema (falta de uma marcação, por exemplo) aparecem com um aviso e o botão **"Pedir ajuste"** dentro do próprio dia.
- Botão **"Imprimir ou salvar em PDF"**: gera o espelho numa página A4 com o cabeçalho (empresa, nome, CPF, matrícula, jornada) e linha para conferência.

**Administrador e RH**
- Novo item no menu (grupo Jornada): **Horas da equipe**. Mostra, para o mês escolhido, uma linha por pessoa com previsto, trabalhado, atrasos, faltas, extras e quantos dias têm aviso. Tem busca, filtro por departamento e o botão **"Baixar planilha"** (abre no Excel).
- Clicar no nome da pessoa abre a ficha dela, na nova aba **Espelho**.
- **Meu espelho** (parte de baixo do menu): o seu próprio espelho, como o de qualquer colaborador.

## Como a conta é feita (em português)

- **O dia** é o dia do relógio da unidade onde a pessoa trabalha (respeita o fuso horário cadastrado em Unidades).
- **Horas trabalhadas:** soma dos trechos entre uma **entrada** (ou fim de intervalo) e a marcação seguinte de **saída** (ou início de intervalo). Turno da noite funciona: o trecho conta no dia em que começou.
- **Previsto:** vem da jornada da pessoa, do dia da semana, menos o intervalo. Sem jornada cadastrada, nada é previsto (o dia aparece como "Sem jornada").
- **Tolerância da jornada** (10 minutos, por padrão): se a diferença do dia for até a tolerância, nada conta. Passou disso, conta a diferença toda.
- **Falta:** dia com jornada prevista, sem nenhuma marcação, que já passou, sem abono, folga ou feriado.
- **Hoje:** se ainda não há marcação, aparece "Em andamento" (nunca vira falta antes do dia acabar).
- **Marcação sem par** (entrada sem saída, por exemplo): o dia fica **"Incompleto"** com aviso. O sistema **não inventa** atraso, extra ou falta nesse dia. O saldo aparece como "?" até alguém ajustar.
- **Feriado:** nada é previsto. Se a pessoa trabalhou, tudo é hora extra, com aviso.
- **Folga aprovada:** nada é previsto e não vira falta. Se trabalhou, tudo é hora extra, com aviso.
- **Abono aprovado:** a diferença para a jornada não vira falta nem atraso (aparece como "Abonado").
- **Ajuste "esqueci de bater":** depois de aprovado, vira uma marcação a mais no cálculo. **Ajuste "horário errado":** depois de aprovado, o cálculo usa o horário corrigido. Pedidos pendentes ou recusados **não** valem.
- **Dias antes da data de admissão** não contam (por isso vale preencher a data de admissão na ficha).
- **Intervalo:** o intervalo previsto **não é descontado sozinho**. Só vale o que a pessoa marcou. Se a jornada tem intervalo e a pessoa não marcou, o dia recebe o aviso "Sem marcação de intervalo. O intervalo não foi descontado das horas."

Duas coisas ficam de fora nesta fase, de propósito: períodos de afastamento (dias em que a pessoa está afastada continuam aparecendo como falta, a menos que haja abono ou folga aprovados) e a regra do intervalo mínimo de 1 hora. Ambas entram junto com o banco de horas, na 2C.

## Arquivos do pacote

15 arquivos: 8 novos e 7 alterados. **Nenhum arquivo é apagado.**

| Pasta | Novos | Alterados |
|---|---|---|
| raiz | — | `README.md` |
| `docs/` | `fase-2b-LEIA-ME.md` (este guia) | — |
| `supabase/migrations/` | `2026-09-28_fase-2b_apuracao.sql` e `…_DESFAZER.sql` | — |
| `supabase/testes/` | `conferencia-fase-2b.sql` | — |
| `src/` | — | `App.jsx` (rotas novas), `styles.css` (espelho e impressão) |
| `src/components/espelho/` | `EspelhoMensal.jsx` | — |
| `src/components/layout/` | — | `ShellGestao.jsx`, `ShellColaborador.jsx` (menus) |
| `src/lib/` | `apuracao.js` | `mensagensErro.js` |
| `src/pages/` | `MeuEspelho.jsx` | — |
| `src/pages/gestao/` | `Espelhos.jsx` | `PerfilPessoa.jsx` (aba Espelho) |

**Dependências novas:** nenhuma. O `package.json` não muda.

## Mudanças no banco (migração da Fase 2B)

Nenhuma tabela, coluna ou dado é criado, alterado ou apagado.

- **Função `apurar_periodo`:** dado uma pessoa e um período (até 93 dias), devolve o dia a dia descrito acima.
- **Função `resumo_equipe`:** os totais do período, uma linha por pessoa (até 62 dias). Só administrador e RH.
- **Dois índices** para deixar a consulta rápida.
- **Segurança:** o colaborador só consegue calcular o **próprio** espelho; administrador e RH, o de quem é da própria empresa; uma empresa nunca enxerga a outra; visitante sem login não chama as funções.

## Passo a passo

### Passo 0: conferir o GitHub

Eu já conferi: o último envio é o `0bdb0d0`. Se você fizer algum envio antes de aplicar este pacote, me avise primeiro.

### Passo 1: rodar a migração no Supabase

1. No seu computador, clique com o botão direito em `ayra-ponto-fase-2b.zip` e escolha **Extrair tudo** → **Extrair**.
2. Na pasta que abriu, entre em **supabase** e depois em **migrations**.
3. Clique com o botão direito em `2026-09-28_fase-2b_apuracao.sql` (o arquivo que **não** tem "DESFAZER" no nome). Escolha **Abrir com** → **Bloco de Notas**.
4. No Bloco de Notas, aperte **Ctrl+A** e depois **Ctrl+C**.
5. Entre no Supabase, abra o projeto **Ayra Ponto**, clique em **SQL Editor** no menu da esquerda e depois em **+ New query**.
6. Clique dentro do editor em branco e aperte **Ctrl+V**.
7. Clique no botão verde **Run**.
8. Deve aparecer **"Success. No rows returned"**.

Se aparecer "Antes desta migração é preciso aplicar a Fase 2A", nada foi alterado: me mande um print.

### Passo 2: conferir

1. No SQL Editor, clique em **+ New query**.
2. Abra `supabase/testes/conferencia-fase-2b.sql` no Bloco de Notas, copie tudo e cole no editor.
3. Clique em **Run**.
4. As 6 linhas devem mostrar **true** na coluna **ok**. Mande um print para o Claude.

### Passo 3: enviar para o GitHub

1. Abra `github.com/Ayra-sw/ayra-ponto`.
2. Clique no botão **Add file** (perto do botão verde "<> Code") e depois em **Upload files**.
3. Na pasta extraída do ZIP você vai ver **3 pastas** (`docs`, `src`, `supabase`) e **1 arquivo** (`README.md`).
4. Selecione tudo de uma vez: clique em qualquer item e aperte **Ctrl+A**. Os 4 itens ficam azulados.
5. Arraste os itens selecionados para o quadro grande do GitHub.
6. Espere a lista carregar. Devem aparecer **15 arquivos**.
7. Na **caixinha pequena de cima** de "Commit changes", escreva: `Fase 2B: cálculo das horas, espelho de ponto e horas da equipe`
8. Deixe a caixa grande de baixo vazia e a bolinha **"Commit directly to the main branch"** marcada.
9. Clique no botão verde **Commit changes**.
10. Espere cerca de 2 minutos até a Vercel publicar (aparece um ✓ verde ao lado do commit).

### Passo 4: testar

Entre com a sua conta de administrador em `ayra-ponto.vercel.app`.

1. **Preparar o seu cadastro (uma vez):** em **Colaboradores**, clique no seu nome, aba **Trabalho**. Escolha a **Jornada** (por exemplo Comercial 40h) e preencha a **Data de admissão** com o dia em que você começou a usar o sistema (por exemplo 24/09/2026). Clique em **Salvar alterações**. Sem a data de admissão, os dias antes de você usar o sistema apareceriam como falta.
2. **Meu espelho:** no menu lateral, na parte de baixo, clique em **Meu espelho**. Confira o mês: os dias com marcação, os totais no alto e o dia de hoje como **"Em andamento"** (ou com as suas marcações).
3. **Mês anterior:** clique na setinha para voltar um mês e depois na setinha da direita para voltar ao atual (a da direita fica apagada no mês atual).
4. **Horas da equipe:** no menu, em **Jornada**, clique em **Horas da equipe**. Você deve ver a sua linha com previsto, trabalhado e avisos. Teste o botão **Baixar planilha**.
5. **Ficha:** clique no seu nome nessa tabela. Abre a ficha na aba **Espelho**.
6. **Imprimir:** em **Meu espelho**, clique em **Imprimir ou salvar em PDF**. Na janela que abrir, em **Destino**, escolha **Salvar como PDF**. Confira o cabeçalho com o seu nome e a empresa.
7. **Pedir ajuste pelo espelho:** se algum dia tiver o botão **Pedir ajuste**, clique nele: o pedido abre já no dia certo. (Como você é a única administradora, outra pessoa precisaria aprovar; isso é o comportamento certo.)
8. **Celular:** abra o mesmo endereço no celular e confira **Espelho** na barra de baixo e **Horas da equipe** no menu.

## Se algo der errado

- **A tela do espelho mostra "O cálculo das horas ainda não foi instalado no banco":** a migração do Passo 1 ainda não rodou. Faça o Passo 1.
- **O site não abre depois do envio:** na Vercel, vá em **Deployments**, clique nos três pontinhos do deploy anterior e escolha **Instant Rollback**. Depois me avise com um print.
- **Precisa desligar o cálculo no banco:** rode `2026-09-28_fase-2b_apuracao_DESFAZER.sql` do mesmo jeito do Passo 1. Nenhuma marcação nem ajuste é tocado; só as duas funções saem. Para instalar de novo, rode a migração outra vez.

## Como foi testado

- **Banco:** numa cópia local com as Fases 0, 1, 1.5, 1.5a e 2A aplicadas, com duas empresas:
  - 60 cenários passaram: dia certinho; atraso de 5 minutos dentro da tolerância e de 30 minutos fora dela; hora extra; falta; sábado e domingo; trabalho no domingo; marcação sem par; feriado; abono, folga, correção e inclusão aprovados; ajuste pendente e recusado **não** valendo; turno da noite; pessoa sem jornada; dias antes da admissão; fuso horário de Manaus; dia de hoje e dia futuro sem falta;
  - segurança: colaborador vendo só o próprio espelho, RH vendo só a própria empresa, administrador de outra empresa barrado, visitante sem login barrado, limites de período, desligado fora do resumo;
  - as 25 marcações do teste continuaram idênticas depois de todos os cálculos (nada é gravado);
  - a migração rodou duas vezes sem erro e o DESFAZER funcionou (e foi reaplicada em seguida).
  - Um defeito real foi achado e corrigido nos testes: a última marcação do período, sem par, não estava sendo avisada.
- **Telas:** o app foi compilado como na Vercel e aberto num navegador, com o Supabase simulado:
  - 43 verificações passaram: espelho do colaborador (totais, situações, avisos, selo de ajuste, navegação de mês, "Pedir ajuste"), celular de 360 e 390 px sem rolagem lateral, tema escuro, mensagem clara quando a migração não foi instalada, Horas da equipe (filtro por departamento, busca, planilha com acentos), ficha com aba Espelho, colaborador barrado da área de gestão, impressão em A4 (menu escondido, cabeçalho do documento);
  - nenhum erro de JavaScript.

## O que fica para a Fase 2C

- Banco de horas (saldo acumulado, compensação e vencimento).
- Escalas (por exemplo 12x36 e escalas rotativas).
- Afastamentos como período, e a regra do intervalo mínimo.
