# Ayra Ponto — Fase 3B: relatórios (e cálculo das horas mais rápido)

Pacote preparado em 29/09/2026 a partir do commit `30564e2` ("Fase 3A: gestor da equipe, central de solicitações e atestado").

A Fase 3 ficou assim:

- **Fase 3A (no ar):** gestor da equipe, central de solicitações e atestado.
- **Fase 3B (este pacote):** os quatro relatórios e um cálculo das horas mais rápido.
- **Fase 3C (a próxima):** o sininho de avisos e o histórico de alterações.

**Decisões suas, respeitadas:** os quatro relatórios (frequência, pedidos, banco de horas e marcações), e o gestor vendo os relatórios **só da equipe dele**. Para o gestor, os relatórios vêm sem abonos e sem reconhecimento facial.

## O que muda para quem usa

**Administrador e RH:** novo item **Relatórios** no menu, no grupo Gestão. No alto você escolhe o relatório:

- **Frequência:** para cada pessoa, horas previstas e trabalhadas, atrasos, faltas, horas extras, abonos e dias com aviso. O botão **Por dia** mostra dia a dia, e por padrão só os dias com alguma ocorrência. O período vai até **3 meses**.
- **Pedidos:** quantos pedidos de ajuste, abono e folga chegaram, quantos foram aprovados, recusados, cancelados e quantos ainda esperam, e o **tempo médio de resposta**. A visão **Lista de pedidos** mostra um por um.
- **Banco de horas:** o saldo, as horas que vencem em 30 dias e as vencidas de cada pessoa, **na data que você escolher** (por exemplo, no fim do mês passado).
- **Marcações:** todas as marcações do período (até **62 dias**), com dia, hora (no relógio da unidade), tipo, NSR, unidade, origem e o resultado do reconhecimento facial. Marcações corrigidas por ajuste aprovado aparecem com um lápis.

Em todos os relatórios há:

- botões prontos de período: **Este mês, Mês passado, Últimos 7 dias, Últimos 30 dias**;
- busca por nome e filtro por departamento;
- a opção **Incluir pessoas desligadas** (útil para fechar a folha de quem saiu no meio do mês);
- **Baixar planilha**, que abre no Excel com acentos e horas em número decimal (por exemplo, 1,50 = 1h30);
- **Imprimir ou PDF**, que imprime só o relatório, com o nome da empresa, o período e a data de emissão.

**Gestor:** em **Equipe**, uma aba nova, **Relatórios**, com os mesmos quatro relatórios só da equipe. Não aparecem abonos nem o resultado do reconhecimento facial.

## Cálculo das horas mais rápido

Nos testes com uma empresa de **50 pessoas** e 3 meses de marcações, apareceu um problema de velocidade que já existia desde a Fase 2C. A tela **Banco de horas** da equipe levaria cerca de **13 segundos**, e o Supabase interrompe consultas que passam de **8 segundos**. Na sua empresa de hoje isso não aparecia, porque há pouca gente.

Esta fase corrige isso:

| Consulta (50 pessoas) | Antes | Depois |
|---|---|---|
| Espelho de 3 meses de uma pessoa | 0,11 s | 0,02 s |
| Tela "Banco de horas" da equipe | 12,8 s | 1,5 s |
| Horas da equipe no mês | 5,2 s | 0,7 s |
| Relatório de frequência de 3 meses | 4,1 s | 0,3 s |

**O resultado das contas é exatamente o mesmo.** Comparei o cálculo antigo com o novo em 5.796 dias de 63 pessoas, com férias, folgas, abonos, feriados e escalas: todos iguais.

## Arquivos do pacote

18 arquivos: 12 novos e 6 alterados. **Nenhum arquivo é apagado.**

| Pasta | Novos | Alterados |
|---|---|---|
| raiz | — | `README.md` |
| `docs/` | `fase-3b-LEIA-ME.md` (este guia) | — |
| `supabase/migrations/` | `2026-10-02_fase-3b_relatorios.sql` e `…_DESFAZER.sql` | — |
| `supabase/testes/` | `conferencia-fase-3b.sql` | — |
| `src/` | — | `App.jsx` (rota nova), `styles.css` (relatórios e impressão) |
| `src/components/relatorios/` | `Relatorios.jsx`, `Comum.jsx`, `RelFrequencia.jsx`, `RelPedidos.jsx`, `RelBancoHoras.jsx`, `RelMarcacoes.jsx` | — |
| `src/components/layout/` | — | `ShellGestao.jsx` (menu) |
| `src/lib/` | `relatorios.js` | `mensagensErro.js` |
| `src/pages/equipe/` | — | `MinhaEquipe.jsx` (aba Relatórios) |
| `src/pages/gestao/` | `Relatorios.jsx` | — |

**Dependências novas:** nenhuma. O `package.json` não muda.

## Mudanças no banco (migração da Fase 3B)

Nenhuma tabela, coluna ou dado é criado, alterado ou apagado.

- **Funções novas:** `relatorio_frequencia`, `relatorio_banco_horas` e `relatorio_marcacoes`, mais uma função de apoio que decide quem entra em cada relatório. Administrador e RH veem a empresa, o gestor vê a equipe e o colaborador não vê ninguém.
- **Funções melhoradas (mesmo resultado, mais rápidas):** `apurar_periodo`, que é o cálculo do espelho e é usado por todas as telas de horas, e `resumo_banco_horas`, da tela Banco de horas da equipe.

## Passo a passo

### Passo 0: conferir o GitHub

Eu já conferi: o último envio é o `30564e2`. Se você fizer algum envio antes de aplicar este pacote, me avise primeiro.

### Passo 1: rodar a migração no Supabase

1. No seu computador, clique com o botão direito em `ayra-ponto-fase-3b.zip` e escolha **Extrair tudo** → **Extrair**.
2. Na pasta que abriu, entre em **supabase** e depois em **migrations**.
3. Clique com o botão direito em `2026-10-02_fase-3b_relatorios.sql` (o arquivo que **não** tem "DESFAZER" no nome). Escolha **Abrir com** → **Bloco de Notas**.
4. No Bloco de Notas, aperte **Ctrl+A** e depois **Ctrl+C**.
5. Entre no Supabase, abra o projeto **Ayra Ponto**, clique em **SQL Editor** no menu da esquerda e depois em **+ New query**.
6. Clique dentro do editor em branco e aperte **Ctrl+V**.
7. Clique no botão verde **Run**.
8. Deve aparecer **"Success. No rows returned"**.

Se aparecer "Antes desta migração é preciso aplicar a Fase 3A", nada foi alterado: me mande um print.

### Passo 2: conferir

1. No SQL Editor, clique em **+ New query**.
2. Abra `supabase/testes/conferencia-fase-3b.sql` no Bloco de Notas, copie tudo e cole no editor.
3. Clique em **Run**.
4. As **4 linhas** devem mostrar **true** na coluna **ok**. Mande um print para o Claude.

### Passo 3: enviar para o GitHub

1. Abra `github.com/Ayra-sw/ayra-ponto`.
2. Clique no botão **Add file** (perto do botão verde "<> Code") e depois em **Upload files**.
3. Na pasta extraída do ZIP você vai ver **3 pastas** (`docs`, `src`, `supabase`) e **1 arquivo** (`README.md`).
4. Selecione tudo de uma vez: clique em qualquer item e aperte **Ctrl+A**. Os 4 itens ficam azulados.
5. Arraste os itens selecionados para o quadro grande do GitHub.
6. Espere a lista carregar. Devem aparecer **18 arquivos**.
7. Na **caixinha pequena de cima** de "Commit changes", escreva: `Fase 3B: relatórios e cálculo das horas mais rápido`
8. Deixe a caixa grande de baixo vazia e a bolinha **"Commit directly to the main branch"** marcada.
9. Clique no botão verde **Commit changes**.
10. Espere cerca de 2 minutos até a Vercel publicar. Primeiro aparece a bolinha laranja e depois o ✓ verde; se precisar, aperte **F5** para atualizar a página.

### Passo 4: testar

Entre com a sua conta de administrador em `ayra-ponto.vercel.app` (aperte **Ctrl+F5** para carregar a versão nova).

1. No menu, no grupo **Gestão**, clique em **Relatórios**. Abre a **Frequência** do mês.
2. Clique em **Mês passado** e depois em **Este mês**. Os números mudam.
3. Clique em **Por dia**. Aparecem os dias com alguma ocorrência. Desmarque "Só dias com ocorrência" para ver todos.
4. Clique em **Baixar planilha** e abra o arquivo no Excel.
5. Clique em **Imprimir ou PDF** e, em **Destino**, escolha **Salvar como PDF**. Confira o cabeçalho com o nome da empresa e o período.
6. Passe pelas abas **Pedidos**, **Banco de horas** (troque a data em "Saldo em") e **Marcações**.
7. Abra **Meu espelho** e **Banco de horas** da equipe e confira que tudo continua com os mesmos números de antes, só mais rápido.
8. **Celular:** abra **Relatórios** no celular e confira que dá para ler sem arrastar a tela para os lados.

## Se algo der errado

- **Aparece "Os relatórios ainda não foram instalados no banco":** a migração do Passo 1 ainda não rodou. Faça o Passo 1.
- **O site não abre depois do envio:** na Vercel, vá em **Deployments**, clique nos três pontinhos do deploy anterior e escolha **Instant Rollback**. Depois me avise com um print.
- **Precisa desligar a Fase 3B no banco:** rode `2026-10-02_fase-3b_relatorios_DESFAZER.sql` do mesmo jeito do Passo 1. Só as funções de relatório saem. O cálculo mais rápido continua, porque o resultado é o mesmo, e não é preciso rodar outro arquivo.

## Como foi testado

- **Banco:** numa cópia local com todas as fases aplicadas, com três empresas (uma delas com 50 pessoas e 3 meses de marcações). A migração rodou numa transação só, como o SQL Editor do Supabase faz.
  - **36 cenários novos passaram.** Foram testados:
    - quem entra no relatório de cada um (RH, administradora, gestora, colaborador, outra empresa, sem login);
    - números iguais aos do espelho (faltas, atrasos, extras e dias incompletos);
    - dias futuros fora do relatório, turno da escala, filtro por departamento, desligados;
    - limites de período (3 meses e 62 dias);
    - banco de horas numa data igual à tela da pessoa;
    - marcações corrigidas marcadas e o reconhecimento facial só para RH e administrador.
  - **Todos os 366 cenários das fases 2B a 3A rodaram de novo com o cálculo novo e passaram.** O cálculo antigo e o novo deram resultados idênticos em 5.796 dias.
  - A migração rodou duas vezes sem erro; o DESFAZER funcionou e a 3B foi aplicada de novo.
- **Telas:** o app foi compilado como na Vercel e aberto num navegador, com o Supabase simulado:
  - **49 verificações novas passaram**, e as 43 da 2B, as 72 da 2C, as 85 da 2D e as 75 da 3A continuam passando.
  - Foram testados: os quatro relatórios (números, visões, filtros, períodos prontos, avisos de período inválido sem consultar o banco, planilhas com acentos e horas decimais); a impressão (cabeçalho com a empresa, filtros escondidos); a mensagem clara sem a migração; os relatórios da gestora (só a equipe, sem abono, sem reconhecimento facial, sem filtro de departamento); celular de 360 e 390 px sem rolagem lateral; tema escuro;
  - nenhum erro de JavaScript inesperado.

## O que fica para as próximas fases

- **Fase 3C:** o sininho, com avisos de pedido novo e respondido, dia incompleto, banco de horas vencendo, pessoa nova e foto para aprovar, e o histórico de alterações (quem mudou o quê e quando), para administrador e RH.
- **Fase 4:** ajuda, onboarding guiado, acessibilidade, desempenho, app instalável.
- **Fase 5:** AFD e AEJ oficiais, assinatura ICP-Brasil, INPI.
- **Antes de vender:** revisão de um advogado (LGPD, atestados, banco de horas, feriado na 12x36) e o serviço profissional de reconhecimento facial.
