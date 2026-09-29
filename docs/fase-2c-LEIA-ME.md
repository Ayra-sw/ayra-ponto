# Ayra Ponto — Fase 2C: banco de horas, afastamentos e intervalo mínimo

Pacote preparado em 28/09/2026 a partir do commit `9a119b0` ("Fase 2B: cálculo das horas, espelho de ponto e horas da equipe").

A Fase 2 ficou assim:

- **Fase 2A e 2B (já no ar):** cadastros, jornadas, histórico, pedidos de ajuste, cálculo das horas e espelho de ponto.
- **Fase 2C (este pacote):** banco de horas, afastamentos (férias, atestado etc.) e aviso de intervalo curto.
- **Fase 2D (a próxima):** escalas 12x36 e escala por calendário.

**Decisões suas, respeitadas:** o banco de horas é **opcional por jornada, com prazo** (padrão de 6 meses, a empresa pode mudar), e o cálculo continua sendo feito **no banco de dados**, sem gravar nada por cima das marcações. O arquivo oficial de marcações (AFD) segue guardando só o que a pessoa bateu de verdade.

## O que muda para quem usa

**Administrador e RH**
- Em **Jornadas**, ao criar ou editar uma jornada, há uma seção nova **Banco de horas**: uma caixinha "Usar banco de horas nesta jornada", o **prazo para compensar** (1 a 12 meses, padrão 6) e o dia **a partir do qual o banco vale**. Quem trabalha numa jornada sem essa caixinha marcada não muda em nada.
- Na ficha da pessoa há duas abas novas:
  - **Banco de horas:** saldo, horas que vencem em 30 dias, horas vencidas (a pagar) e o extrato. O botão **Novo lançamento** registra saldo inicial, compensação, pagamento em folha ou ajuste. **Lançamento não se apaga nem se edita**: para corrigir, faz-se um ajuste.
  - **Afastamentos:** lista de férias, atestados, licenças e afastamentos pelo INSS. O botão **Registrar afastamento** pede o tipo e o período. Para desfazer, use **Cancelar afastamento** (com motivo); o registro fica guardado.
- Novo item no menu, no grupo Jornada: **Banco de horas**. Mostra a equipe toda que usa banco de horas, com saldo, vencimentos e o botão **Baixar planilha**.
- **Regra de segurança:** ninguém registra lançamento nem afastamento na **própria** ficha. Peça a outra pessoa da gestão.

**Colaborador**
- No **Espelho** há duas abas: **Espelho do mês** e **Banco de horas** (só leitura: saldo e extrato).
- Dias de afastamento aparecem no espelho como **Férias**, **Atestado**, **Licença** etc., e **não viram falta**.
- Se o intervalo do dia foi mais curto que o mínimo, o dia recebe um aviso.

## Como o banco de horas conta (em português)

- **O banco começa** na data escolhida na jornada (ou na admissão da pessoa, se for depois). Dias antes disso não entram. Para levar um saldo antigo, use o lançamento **Saldo inicial**.
- **Hora extra vira crédito.** Cada crédito tem um **vencimento**: o dia em que nasceu mais o prazo da jornada (6 meses, por exemplo).
- **Hora a menos** (atraso ou falta) consome primeiro o **crédito mais antigo**. Se não há crédito, o saldo fica **negativo** (horas a compensar).
- **Crédito que passou do prazo** sai do saldo e vira **"vencido, a pagar"**. Ele continua aparecendo até alguém lançar o **Pagamento**, que quita primeiro as horas vencidas.
- **Compensação** (folga, por exemplo) tira horas do saldo.
- **Dia incompleto** (marcação faltando) **não entra no saldo** até ser ajustado; a tela avisa quantos dias estão assim.
- O saldo de cada dia é **o mesmo do espelho**: um número só, em todas as telas.
- Ajuste aprovado vale no cálculo, como já valia no espelho.
- Nota legal (confirme com seu contador ou advogado): a CLT permite compensar em até 6 meses por acordo individual por escrito e em até 12 meses por acordo ou convenção coletiva.

## Afastamentos e intervalo

- **Dia afastado:** não vira falta e não há horas previstas a cumprir. Se a pessoa bater ponto mesmo assim, as horas contam como hora extra e o dia recebe o aviso "Trabalhou durante um afastamento".
- **Sem sobreposição:** o sistema não deixa registrar dois afastamentos no mesmo período da mesma pessoa.
- **Não escreva diagnóstico nem CID** na observação (dado de saúde é sensível pela LGPD). Use só "atestado" ou "licença", por exemplo.
- **Intervalo curto:** se a pessoa marcou o intervalo e ele foi menor que o mínimo, o espelho mostra um aviso (só aviso; nada bloqueia a marcação). O mínimo é **1 hora** em dia de mais de 6 horas trabalhadas e **15 minutos** em dia de mais de 4 até 6 horas. Sem nenhuma marcação de intervalo em dia de mais de 6 horas, o aviso também aparece.

## Arquivos do pacote

18 arquivos: 9 novos e 9 alterados. **Nenhum arquivo é apagado.**

| Pasta | Novos | Alterados |
|---|---|---|
| raiz | — | `README.md` |
| `docs/` | `fase-2c-LEIA-ME.md` (este guia) | — |
| `supabase/migrations/` | `2026-09-29_fase-2c_banco-horas-afastamentos.sql` e `…_DESFAZER.sql` | `2026-09-28_fase-2b_apuracao.sql` (veja o aviso abaixo) |
| `supabase/testes/` | `conferencia-fase-2c.sql` | — |
| `src/` | — | `App.jsx` (rota nova) |
| `src/components/afastamentos/` | `Afastamentos.jsx` | — |
| `src/components/banco/` | `BancoHoras.jsx`, `NovoLancamento.jsx` | — |
| `src/components/layout/` | — | `ShellGestao.jsx` (menu) |
| `src/lib/` | `bancoHoras.js` | `apuracao.js`, `mensagensErro.js` |
| `src/pages/` | — | `MeuEspelho.jsx` (abas) |
| `src/pages/gestao/` | `BancoHoras.jsx` | `Jornadas.jsx`, `PerfilPessoa.jsx` (abas novas) |

**Aviso sobre `2026-09-28_fase-2b_apuracao.sql`:** este arquivo da Fase 2B muda só por dentro (uma linha para recriar a função do zero, já que a 2C acrescentou uma coluna a ela). **Você NÃO precisa rodar esse arquivo de novo.** Ele só vai para o GitHub para o histórico ficar certo.

**Dependências novas:** nenhuma. O `package.json` não muda.

## Mudanças no banco (migração da Fase 2C)

Tudo é **acrescentado**; nenhum dado existente é alterado ou apagado.

- **Jornadas** ganham 3 campos: usa banco de horas (padrão: não), prazo em meses (padrão: 6) e data de início do banco.
- **Tabela `banco_horas_lancamentos`:** saldo inicial, compensação, pagamento e ajuste. Não pode ser editada nem apagada.
- **Tabela `afastamentos`:** férias, atestado, licença, INSS e outro. Não pode ser editada nem apagada; só cancelada, com motivo.
- **Função `apurar_periodo` atualizada** (o espelho): dia afastado sem falta e aviso de intervalo curto.
- **Funções novas `banco_horas` e `resumo_banco_horas`:** saldo, vencimentos e extrato; a segunda é a equipe toda (só administrador e RH).
- **Segurança:** as duas tabelas têm proteção por linha (RLS). O colaborador vê só o que é dele; administrador e RH veem a própria empresa; uma empresa nunca enxerga a outra; visitante sem login não vê nada.

## Passo a passo

### Passo 0: conferir o GitHub

Eu já conferi: o último envio é o `9a119b0`. Se você fizer algum envio antes de aplicar este pacote, me avise primeiro.

### Passo 1: rodar a migração no Supabase

1. No seu computador, clique com o botão direito em `ayra-ponto-fase-2c.zip` e escolha **Extrair tudo** → **Extrair**.
2. Na pasta que abriu, entre em **supabase** e depois em **migrations**.
3. Clique com o botão direito em `2026-09-29_fase-2c_banco-horas-afastamentos.sql` (o arquivo que **não** tem "DESFAZER" no nome). Escolha **Abrir com** → **Bloco de Notas**.
4. No Bloco de Notas, aperte **Ctrl+A** e depois **Ctrl+C**.
5. Entre no Supabase, abra o projeto **Ayra Ponto**, clique em **SQL Editor** no menu da esquerda e depois em **+ New query**.
6. Clique dentro do editor em branco e aperte **Ctrl+V**.
7. Clique no botão verde **Run**.
8. Deve aparecer **"Success. No rows returned"**.

Se aparecer "Antes desta migração é preciso aplicar a Fase 2B", nada foi alterado: me mande um print.

### Passo 2: conferir

1. No SQL Editor, clique em **+ New query**.
2. Abra `supabase/testes/conferencia-fase-2c.sql` no Bloco de Notas, copie tudo e cole no editor.
3. Clique em **Run**.
4. As **6 linhas** devem mostrar **true** na coluna **ok**. Mande um print para o Claude.

(Um detalhe: a conferência da Fase 2B tinha **5** linhas, não 6 como o guia dela dizia. Foi erro meu no texto; o resultado que você me mandou estava certo.)

### Passo 3: enviar para o GitHub

1. Abra `github.com/Ayra-sw/ayra-ponto`.
2. Clique no botão **Add file** (perto do botão verde "<> Code") e depois em **Upload files**.
3. Na pasta extraída do ZIP você vai ver **3 pastas** (`docs`, `src`, `supabase`) e **1 arquivo** (`README.md`).
4. Selecione tudo de uma vez: clique em qualquer item e aperte **Ctrl+A**. Os 4 itens ficam azulados.
5. Arraste os itens selecionados para o quadro grande do GitHub.
6. Espere a lista carregar. Devem aparecer **18 arquivos**.
7. Na **caixinha pequena de cima** de "Commit changes", escreva: `Fase 2C: banco de horas, afastamentos e aviso de intervalo`
8. Deixe a caixa grande de baixo vazia e a bolinha **"Commit directly to the main branch"** marcada.
9. Clique no botão verde **Commit changes**.
10. Espere cerca de 2 minutos até a Vercel publicar (aparece um ✓ verde ao lado do commit).

### Passo 4: testar

Entre com a sua conta de administrador em `ayra-ponto.vercel.app`.

1. **Ligar o banco de horas:** no menu, **Jornadas**. Clique em **Editar** na jornada (por exemplo Comercial 40h). Desça até **Banco de horas**, marque **Usar banco de horas nesta jornada**, deixe o prazo em **6 meses** e em "O banco vale a partir de" coloque o dia em que você começou a usar o sistema. Clique em **Salvar jornada**. No cartão da jornada deve aparecer "Banco de horas: Sim, 6 meses…".
2. **Ver o seu banco:** no menu de baixo, **Meu espelho**, aba **Banco de horas**. Se você tem horas extras ou atrasos, verá o saldo e o extrato; se não, verá "Ainda não há movimentos".
3. **Equipe:** no menu, grupo Jornada, **Banco de horas**. Você deve aparecer na lista. Teste **Baixar planilha**.
4. **Lançamentos e afastamentos (precisam de outra pessoa):** por segurança, ninguém lança na própria ficha. Para testar, abra a ficha de **outro colaborador** (pode ser um colaborador de teste que você convidou), com a mesma jornada, e:
   - aba **Banco de horas** → **Novo lançamento** → tipo **Saldo inicial**, "Coloca horas no banco", 2 horas, motivo "teste". O saldo deve subir 2h;
   - aba **Afastamentos** → **Registrar afastamento** → **Férias** de amanhã até depois de amanhã. Depois, **Cancelar afastamento** com um motivo.
5. **Espelho:** no espelho dessa pessoa, os dias do afastamento aparecem como **Férias** (não como falta).
6. **Celular:** abra o mesmo endereço no celular e confira **Espelho → Banco de horas** e o menu **Banco de horas**.

Se você ainda não tem outra pessoa cadastrada, pode pular o item 4: a parte de lançamentos e afastamentos foi testada por mim e você pode testá-la quando tiver o primeiro colaborador.

## Se algo der errado

- **A tela do banco mostra "O banco de horas e os afastamentos ainda não foram instalados no banco":** a migração do Passo 1 ainda não rodou. Faça o Passo 1.
- **O espelho ficou sem cálculo depois de rodar o DESFAZER:** rode de novo `2026-09-28_fase-2b_apuracao.sql`.
- **O site não abre depois do envio:** na Vercel, vá em **Deployments**, clique nos três pontinhos do deploy anterior e escolha **Instant Rollback**. Depois me avise com um print.
- **Precisa desligar a Fase 2C no banco:** rode `2026-09-29_fase-2c_banco-horas-afastamentos_DESFAZER.sql` do mesmo jeito do Passo 1 e, **logo em seguida**, rode `2026-09-28_fase-2b_apuracao.sql` (isso devolve o espelho da 2B). Nenhum lançamento nem afastamento é apagado. Para ligar de novo, rode a migração da 2C outra vez.

## Como foi testado

- **Banco:** numa cópia local com todas as fases anteriores aplicadas, com duas empresas:
  - **136 cenários passaram** (60 da 2B, que continuam passando, mais 76 novos): crédito que nasce e vence no prazo; consumo do crédito mais antigo; saldo negativo; vencido a pagar; pagamento quitando o vencido primeiro; saldo inicial positivo e negativo; compensação; ajuste; início do banco pela admissão; dia incompleto fora do saldo; limites de valor e de período;
  - afastamento: dia sem falta, período sem sobreposição, cancelamento com motivo, edição e exclusão bloqueadas, ninguém registra para si mesmo;
  - segurança: colaborador vê só o próprio banco, RH só a própria empresa, administrador de outra empresa barrado, visitante sem login barrado; a equipe toda só para administrador e RH;
  - lançamentos e afastamentos não podem ser alterados nem apagados, nem pelo app;
  - a migração rodou duas vezes sem erro e o DESFAZER funcionou (e foi reaplicada em seguida, com a 2B e a 2C).
- **Telas:** o app foi compilado como na Vercel e aberto num navegador, com o Supabase simulado:
  - **72 verificações novas passaram** (e as 43 da 2B continuam passando): editor de jornada com banco de horas, ficha com abas Banco de horas e Afastamentos, sinais dos lançamentos (pagamento sai, saldo inicial entra), validações dos formulários, cancelamento sem apagar nada, tela da equipe (filtro, busca, planilha), espelho do colaborador com aba nova, dia de férias sem "Falta", mensagem clara quando a migração não foi instalada, celular de 360 e 390 px sem rolagem lateral, tema escuro, colaborador barrado da tela da equipe;
  - nenhum erro de JavaScript inesperado.

## O que fica para as próximas fases

- **Fase 2D:** escalas 12x36 e escala por calendário (com o tratamento de feriado da Súmula 444 do TST para 12x36).
- **Fase 3:** papel Gestor, central de solicitações, relatórios, notificações, histórico, anexo de atestado.
- **Fase 4:** ajuda, onboarding guiado, acessibilidade, desempenho, app instalável.
- **Fase 5:** AFD e AEJ oficiais, assinatura ICP-Brasil, INPI.
- **Antes de vender:** revisão de um advogado (LGPD, regras do banco de horas, feriados) e o serviço profissional de reconhecimento facial.
