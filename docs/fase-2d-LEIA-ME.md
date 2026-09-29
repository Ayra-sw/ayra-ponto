# Ayra Ponto — Fase 2D: escalas (12x36 e escala por calendário)

Pacote preparado em 29/09/2026 a partir do commit `b56d1e5` ("Fase 2C: banco de horas, afastamentos e aviso de intervalo").

Com esta fase, a Fase 2 fica completa:

- **2A, 2B e 2C (já no ar):** cadastros, jornadas, histórico, pedidos de ajuste, cálculo das horas, espelho, banco de horas e afastamentos.
- **2D (este pacote):** turnos, escala 12x36 e escala por calendário.

**Decisões suas, respeitadas:**
- **Feriado na 12x36:** não vira hora extra, só avisa. É o que diz a Súmula 444 do TST: na 12x36 o feriado já está compensado pela própria escala. (Confirme com seu contador se a convenção coletiva da empresa diz algo diferente.)
- **Escala por calendário:** grade do mês com turnos prontos, pessoas nas linhas e dias nas colunas, com "repetir semana".

**Quem já usa jornada semanal não muda em nada.** Todo mundo continua na "Jornada semanal" até alguém mudar na ficha.

## O que muda para quem usa

**Administrador e RH**
- Novo item no menu, no grupo Jornada: **Escalas**, com duas abas:
  - **Turnos:** cadastre os horários que você distribui nas escalas (por exemplo Manhã 06:00–14:00, Plantão 12h 07:00–19:00). Cada turno tem nome, sigla (1 a 3 letras, aparece na grade), entrada, saída e intervalo, se houver. Há turnos prontos para começar.
  - **Calendário do mês:** a grade com as pessoas que trabalham em escala. No alto fica o "pincel": escolha um turno (ou "Folga") e clique nos dias. **Cada clique já salva.** O link **repetir semana**, ao lado do nome, copia os dias 1 a 7 para o resto do mês. Fins de semana ficam cinza e feriados ficam amarelos. Embaixo, a linha **Trabalham no dia** mostra quantas pessoas trabalham em cada dia.
- Na ficha da pessoa, aba **Trabalho**, há um campo novo: **Como a pessoa trabalha**.
  - **Jornada semanal:** como sempre foi.
  - **Escala 12x36:** escolha o **turno** e o **primeiro dia de trabalho**. O sistema calcula sozinho: trabalha nesse dia, folga no seguinte, e assim por diante. A ficha mostra os próximos 3 plantões para você conferir.
  - **Escala por calendário:** os dias são marcados na grade, em Escalas.
  - Quem está em escala pode continuar com uma **jornada** escolhida. Ela passa a valer só para a **tolerância de atraso** e para o **banco de horas**. Os horários vêm da escala. Sem jornada, a tolerância é de 10 minutos.

**Colaborador**
- Quem trabalha em escala ganha, no **Espelho**, a aba **Minha escala**, com os turnos e folgas dos próximos 21 dias.
- No espelho do mês, cada dia mostra o turno (por exemplo "Manhã 06:00–14:00"), e os dias de folga da escala aparecem como **Folga da escala**, sem falta.

## Como o espelho conta nas escalas

- **Dia com turno:** o previsto é o do turno (entrada até saída, menos o intervalo). Atraso, hora extra e falta funcionam como na jornada semanal.
- **Dia sem turno (folga da escala):** nada é previsto e não vira falta. Se a pessoa trabalhar mesmo assim, tudo é hora extra, com o aviso "Trabalhou em dia de folga da escala".
- **Feriado na 12x36, em dia de plantão:** o previsto continua o do turno e o feriado **não** vira hora extra. O dia recebe o aviso "Trabalhou em feriado…". Se o feriado cair numa folga da escala, aparece como feriado.
- **Feriado na escala por calendário:** vale a mesma regra da jornada semanal. Mesmo com turno marcado, o dia conta como feriado: nada é previsto e, se a pessoa trabalhar, as horas viram hora extra, com o aviso "Trabalhou em feriado".
- **Afastamento** (férias, atestado etc.) continua valendo por cima da escala.
- **Turno da noite:** todas as marcações de um turno ficam no dia em que ele começou, mesmo que o intervalo caia depois da meia-noite. (Isso vale para todo mundo, inclusive na jornada semanal.)
- **Turno já usado não muda de horário.** Se um turno já foi usado em dias que passaram, o horário dele fica travado, porque mudar mudaria o espelho do passado. Para trocar o horário, crie um turno novo e desative o antigo. Nome e sigla podem mudar sempre.

## Arquivos do pacote

19 arquivos: 9 novos e 10 alterados. **Nenhum arquivo é apagado.**

| Pasta | Novos | Alterados |
|---|---|---|
| raiz | — | `README.md` |
| `docs/` | `fase-2d-LEIA-ME.md` (este guia) | — |
| `supabase/migrations/` | `2026-09-30_fase-2d_escalas.sql` e `…_DESFAZER.sql` | `2026-09-29_fase-2c_banco-horas-afastamentos.sql` (veja o aviso abaixo) |
| `supabase/testes/` | `conferencia-fase-2d.sql` | — |
| `src/` | — | `App.jsx` (rota nova), `styles.css` (grade e turnos) |
| `src/components/escalas/` | `Turnos.jsx`, `CalendarioMes.jsx`, `MinhaEscala.jsx` | — |
| `src/components/espelho/` | — | `EspelhoMensal.jsx` (turno do dia) |
| `src/components/layout/` | — | `ShellGestao.jsx` (menu) |
| `src/lib/` | `escalas.js` | `apuracao.js`, `mensagensErro.js` |
| `src/pages/` | — | `MeuEspelho.jsx` (aba Minha escala) |
| `src/pages/gestao/` | `Escalas.jsx` | `PerfilPessoa.jsx` (como a pessoa trabalha) |

**Aviso sobre `2026-09-29_fase-2c_banco-horas-afastamentos.sql`:** este arquivo da Fase 2C muda só numa checagem do começo, para poder ser rodado de novo depois de um DESFAZER. **Você NÃO precisa rodar esse arquivo de novo.** Ele só vai para o GitHub para o histórico ficar certo.

**Dependências novas:** nenhuma. O `package.json` não muda.

## Mudanças no banco (migração da Fase 2D)

Tudo é **acrescentado**; nenhum dado existente é alterado ou apagado.

- **Tabela `turnos`:** nome, sigla, entrada, saída e intervalo. Nome e sigla não se repetem na empresa.
- **Pessoas** ganham 3 campos: tipo de escala (padrão: jornada semanal), turno da 12x36 e primeiro dia de trabalho da 12x36.
- **Tabela `escala_dias`:** em que dia cada pessoa da escala por calendário faz qual turno. Dia sem linha é folga.
- **Função `apurar_periodo` atualizada** (o espelho): lê a escala do dia e devolve o turno. O banco de horas e as Horas da equipe usam essa mesma função, então já funcionam com escalas.
- **Segurança:** as duas tabelas têm proteção por linha (RLS). Só administrador e RH criam turnos e marcam a grade. O colaborador vê só a própria escala e não muda o próprio tipo de escala. Uma empresa nunca enxerga a outra, e visitante sem login não vê nada.

## Passo a passo

### Passo 0: conferir o GitHub

Eu já conferi: o último envio é o `b56d1e5`. Se você fizer algum envio antes de aplicar este pacote, me avise primeiro.

### Passo 1: rodar a migração no Supabase

1. No seu computador, clique com o botão direito em `ayra-ponto-fase-2d.zip` e escolha **Extrair tudo** → **Extrair**.
2. Na pasta que abriu, entre em **supabase** e depois em **migrations**.
3. Clique com o botão direito em `2026-09-30_fase-2d_escalas.sql` (o arquivo que **não** tem "DESFAZER" no nome). Escolha **Abrir com** → **Bloco de Notas**.
4. No Bloco de Notas, aperte **Ctrl+A** e depois **Ctrl+C**.
5. Entre no Supabase, abra o projeto **Ayra Ponto**, clique em **SQL Editor** no menu da esquerda e depois em **+ New query**.
6. Clique dentro do editor em branco e aperte **Ctrl+V**.
7. Clique no botão verde **Run**.
8. Deve aparecer **"Success. No rows returned"**.

Se aparecer "Antes desta migração é preciso aplicar a Fase 2C", nada foi alterado: me mande um print.

### Passo 2: conferir

1. No SQL Editor, clique em **+ New query**.
2. Abra `supabase/testes/conferencia-fase-2d.sql` no Bloco de Notas, copie tudo e cole no editor.
3. Clique em **Run**.
4. As **6 linhas** devem mostrar **true** na coluna **ok**. Mande um print para o Claude.

### Passo 3: enviar para o GitHub

1. Abra `github.com/Ayra-sw/ayra-ponto`.
2. Clique no botão **Add file** (perto do botão verde "<> Code") e depois em **Upload files**.
3. Na pasta extraída do ZIP você vai ver **3 pastas** (`docs`, `src`, `supabase`) e **1 arquivo** (`README.md`).
4. Selecione tudo de uma vez: clique em qualquer item e aperte **Ctrl+A**. Os 4 itens ficam azulados.
5. Arraste os itens selecionados para o quadro grande do GitHub.
6. Espere a lista carregar. Devem aparecer **19 arquivos**.
7. Na **caixinha pequena de cima** de "Commit changes", escreva: `Fase 2D: escalas 12x36 e por calendário`
8. Deixe a caixa grande de baixo vazia e a bolinha **"Commit directly to the main branch"** marcada.
9. Clique no botão verde **Commit changes**.
10. Espere cerca de 2 minutos até a Vercel publicar (aparece um ✓ verde ao lado do commit).

### Passo 4: testar

Entre com a sua conta de administrador em `ayra-ponto.vercel.app` (se a página já estava aberta, aperte **Ctrl+F5**).

1. **Criar turnos:** no menu, grupo Jornada, clique em **Escalas** e depois na aba **Turnos**. Clique em **Novo turno**, escolha o pronto **Manhã** e clique em **Salvar turno**. Faça o mesmo com **Tarde** e **Plantão 12h dia**.
2. **Pôr alguém na 12x36:** abra a ficha de um colaborador (**Colaboradores** → nome), aba **Trabalho**. Em **Como a pessoa trabalha**, escolha **Escala 12x36**. Escolha o turno **Plantão 12h dia** e o **primeiro dia de trabalho**. Confira os "Próximos plantões" que aparecem embaixo e clique em **Salvar alterações**.
3. **Pôr alguém no calendário:** em outra pessoa (ou na mesma, se preferir testar só isso), escolha **Escala por calendário** e salve.
4. **Montar a grade:** volte em **Escalas**, aba **Calendário do mês**. No "pincel", clique em **Manhã** e depois clique em alguns dias da pessoa do calendário. Troque o pincel para **Tarde** e clique em outros dias. Use **Folga** para apagar um dia. Depois teste **repetir semana**.
5. **Espelho:** abra a ficha dessa pessoa, aba **Espelho**. Os dias marcados mostram o turno, e os outros aparecem como **Folga da escala**.
6. **Celular:** abra o site no celular e veja **Escalas**. A grade rola de lado com o dedo, e o nome das pessoas fica parado à esquerda.

Se você ainda não tem outro colaborador cadastrado, pode testar a 12x36 e o calendário na **sua própria ficha**: como administradora, você pode mudar a sua escala. Depois volte para **Jornada semanal**, se quiser.

## Se algo der errado

- **A tela Escalas mostra "As escalas ainda não foram instaladas no banco":** a migração do Passo 1 ainda não rodou. Faça o Passo 1.
- **O site não abre depois do envio:** na Vercel, vá em **Deployments**, clique nos três pontinhos do deploy anterior e escolha **Instant Rollback**. Depois me avise com um print.
- **Precisa desligar a Fase 2D no banco:** rode `2026-09-30_fase-2d_escalas_DESFAZER.sql` do mesmo jeito do Passo 1 e, **logo em seguida**, rode `2026-09-29_fase-2c_banco-horas-afastamentos.sql` (isso devolve o espelho da 2C). Nenhum turno nem dia da escala é apagado; enquanto a 2D estiver desligada, todo mundo é calculado pela jornada semanal. Para ligar de novo, rode a migração da 2D outra vez.

## Como foi testado

- **Banco:** numa cópia local com todas as fases anteriores aplicadas, com duas empresas:
  - **114 cenários novos passaram**, e os 136 da 2B e da 2C continuam passando. Na 12x36: dia de plantão certinho, folga sem falta, falta em dia de plantão, trabalho na folga virando extra com aviso, atraso e hora extra, contagem para trás do primeiro dia, feriado trabalhado sem hora extra (só aviso) e feriado na folga. Plantão da noite com intervalo depois da meia-noite, tudo no dia em que começou. No calendário: turnos diferentes por dia, dia sem turno, afastamento e feriado por cima, banco de horas e Horas da equipe com escala.
  - **Segurança:** só administrador e RH criam turnos e marcam a grade; colaborador não muda a própria escala nem a dos outros; ninguém de outra empresa vê ou mexe; turno em uso não é excluído e, se já foi usado, não muda de horário; sigla e nome repetidos recusados.
  - A migração rodou duas vezes sem erro; o DESFAZER funcionou sem apagar dados; a 2C foi reinstalada e a 2D aplicada de novo.
- **Telas:** o app foi compilado como na Vercel e aberto num navegador, com o Supabase simulado:
  - **85 verificações novas passaram**, e as 43 da 2B e as 72 da 2C continuam passando. Foram testados: turnos (criar, validar, turno pronto, editar, excluir em uso e sem uso), grade (pintar, trocar, apagar, repetir semana, busca, departamento, mês seguinte, feriado, aviso de mês passado), ficha (12x36 com próximos plantões, calendário, volta para semanal), espelho com turno e folga da escala, "Minha escala", celular de 360 e 390 px sem rolagem lateral, tema escuro, colaborador barrado de Escalas e mensagem clara quando a migração não foi instalada;
  - nenhum erro de JavaScript inesperado.

## O que fica para as próximas fases

- **Fase 3:** papel Gestor, central de solicitações, relatórios, notificações, histórico, anexo de atestado.
- **Fase 4:** ajuda, onboarding guiado, acessibilidade, desempenho, app instalável.
- **Fase 5:** AFD e AEJ oficiais, assinatura ICP-Brasil, INPI.
- **Antes de vender:** revisão de um advogado (LGPD, banco de horas, feriado na 12x36 e convenções coletivas) e o serviço profissional de reconhecimento facial.
