# Ayra Ponto — Fase 3A: gestor da equipe, central de solicitações e atestado

Pacote preparado em 29/09/2026 a partir do commit `07d3311` ("Fase 2D: escalas 12x36 e por calendário").

A Fase 3 foi dividida em duas partes:

- **Fase 3A (este pacote):** o papel de gestor, a central de solicitações e o atestado anexado.
- **Fase 3B (a próxima):** relatórios, avisos dentro do sistema (sininho) e histórico de alterações.

**Decisões suas, respeitadas:**
- **Gestor por departamento.** Em Departamentos você escolhe o gestor de cada um, e pode haver mais de um gestor. A equipe é quem está no departamento.
- **O gestor aprova pedidos e vê a equipe.** Ele não mexe em cadastro, jornada, turnos nem escala.
- **Atestado só para RH e administrador.** O arquivo é aberto só pela própria pessoa, pelo RH e pelo administrador. Por isso os **abonos vão direto para o RH**. O gestor analisa correção de marcação, marcação esquecida e folga.
- **Avisos só dentro do sistema**, e eles chegam na Fase 3B.

## O que muda para quem usa

**Administrador e RH**
- **Departamentos** ganhou a coluna **Gestores** e o botão **Gestores** em cada departamento. Ao clicar, você marca quem é gestor e clica em **Salvar gestores**. O gestor pode ser qualquer pessoa da empresa, inclusive alguém de outro departamento.
- **Solicitações** agora é uma central completa:
  - abas **Pendentes, Aprovadas, Recusadas, Canceladas e Todas**;
  - busca por nome e filtros por tipo e por departamento;
  - o botão **Ver atestado**, quando a pessoa anexou um arquivo;
  - ao **Aprovar**, um comentário opcional; ao **Recusar**, o motivo é **obrigatório**, e a pessoa lê a resposta.
- Nos **Afastamentos** (ficha da pessoa) dá para anexar o atestado ou documento, e o botão **Ver anexo** abre o arquivo.
- Um pedido pode ser analisado pelo RH ou pelo gestor. Quem analisar primeiro fica registrado, e o outro vê o pedido já analisado.

**Gestor** (quem foi escolhido em Departamentos)
- Ganha o item **Equipe** no menu, com um número mostrando quantos pedidos esperam por ele.
  - Aba **Pedidos:** os pedidos da equipe para aprovar ou recusar (abonos não aparecem aqui).
  - Aba **Pessoas:** as horas do mês de cada pessoa. Ao clicar numa pessoa, abrem o **Espelho**, as **Marcações**, a **Escala** (se ela trabalha em escala), o **Banco de horas** e os **Pedidos** dela, só para ver.
- O gestor **não vê** CPF, telefone nem outros dados pessoais, **não abre** atestados e **não analisa** os próprios pedidos. Os pedidos dele vão para outro gestor do departamento ou para o RH.

**Colaborador**
- Em **Histórico → Meus pedidos**, cada pedido mostra a **resposta** de quem analisou e quem analisou.
- O botão **Cancelar pedido** desiste de um pedido que ainda não foi analisado.
- No pedido de **abono**, dá para **anexar o atestado** (PDF ou foto, até 5 MB, direto da câmera do celular). O próprio formulário avisa que só a pessoa, o RH e o administrador abrem o arquivo.

## Proteção de dados (LGPD)

- Os atestados ficam num **armazenamento privado**, separado por empresa e por pessoa. Para abrir, o sistema cria um link que vale **só 2 minutos**.
- Ninguém troca nem apaga um atestado pelo sistema, porque ele é o documento do pedido.
- O gestor enxerga a equipe por funções que **não entregam** CPF, telefone e outros dados do cadastro.
- **Não escreva diagnóstico nem CID** no motivo ou na observação. O próprio formulário avisa.

## Arquivos do pacote

27 arquivos: 10 novos e 17 alterados. **Nenhum arquivo é apagado.**

| Pasta | Novos | Alterados |
|---|---|---|
| raiz | — | `README.md` |
| `docs/` | `fase-3a-LEIA-ME.md` (este guia) | — |
| `supabase/migrations/` | `2026-10-01_fase-3a_gestor-solicitacoes.sql` e `…_DESFAZER.sql` | — |
| `supabase/testes/` | `conferencia-fase-3a.sql` | — |
| `src/` | — | `App.jsx` (rotas da equipe), `styles.css` |
| `src/components/` | — | `CadastroSimples.jsx` (coluna de gestores) |
| `src/components/solicitacoes/` | `CentralSolicitacoes.jsx`, `CampoAnexo.jsx` | — |
| `src/components/marcacoes/` | — | `ListaSolicitacoes.jsx`, `PedirAjuste.jsx` |
| `src/components/afastamentos/` | — | `Afastamentos.jsx` (anexo) |
| `src/components/banco/` | — | `BancoHoras.jsx` (texto para o gestor) |
| `src/components/escalas/` | — | `MinhaEscala.jsx` (texto para o gestor) |
| `src/components/espelho/` | — | `EspelhoMensal.jsx` (nome da pessoa para o gestor) |
| `src/components/layout/` | — | `ShellColaborador.jsx` (item Equipe) |
| `src/hooks/` | `useEquipe.js` | — |
| `src/lib/` | `atestados.js` | `ajustes.js`, `mensagensErro.js` |
| `src/pages/` | — | `MeuHistorico.jsx` (cancelar e ver atestado) |
| `src/pages/equipe/` | `MinhaEquipe.jsx`, `PessoaDaEquipe.jsx` | — |
| `src/pages/gestao/` | — | `Departamentos.jsx`, `Solicitacoes.jsx`, `PerfilPessoa.jsx` |

**Dependências novas:** nenhuma. O `package.json` não muda.

## Mudanças no banco (migração da Fase 3A)

Tudo é **acrescentado**; nenhum dado existente é alterado ou apagado.

- **Tabela `departamento_gestores`:** quem é gestor de qual departamento.
- **Solicitações:** o status novo **"cancelado"** e os campos novos **comentário da análise** e **anexo**. **Afastamentos** também ganham o campo **anexo**.
- **Regras novas:**
  - quem pediu só pode cancelar, e nunca aprovar o próprio pedido;
  - para recusar é preciso comentário;
  - abono só é analisado pelo RH ou pelo administrador;
  - o anexo precisa estar na pasta da própria pessoa e não muda depois;
  - uma pessoa desligada não pode ser gestora.
- **Leitura para o gestor:** marcações, pedidos, afastamentos, banco de horas e escala da equipe, só para ver. O espelho e o banco de horas passam a aceitar o gestor.
- **Armazenamento `atestados`:** privado, até 5 MB por arquivo, em PDF, JPG, PNG ou WEBP.

## Passo a passo

### Passo 0: conferir o GitHub

Eu já conferi: o último envio é o `07d3311`. Se você fizer algum envio antes de aplicar este pacote, me avise primeiro.

### Passo 1: rodar a migração no Supabase

1. No seu computador, clique com o botão direito em `ayra-ponto-fase-3a.zip` e escolha **Extrair tudo** → **Extrair**.
2. Na pasta que abriu, entre em **supabase** e depois em **migrations**.
3. Clique com o botão direito em `2026-10-01_fase-3a_gestor-solicitacoes.sql` (o arquivo que **não** tem "DESFAZER" no nome). Escolha **Abrir com** → **Bloco de Notas**.
4. No Bloco de Notas, aperte **Ctrl+A** e depois **Ctrl+C**.
5. Entre no Supabase, abra o projeto **Ayra Ponto**, clique em **SQL Editor** no menu da esquerda e depois em **+ New query**.
6. Clique dentro do editor em branco e aperte **Ctrl+V**.
7. Clique no botão verde **Run**.
8. Deve aparecer **"Success. No rows returned"**.

Se aparecer "Antes desta migração é preciso aplicar a Fase 2D", nada foi alterado: me mande um print.

### Passo 2: conferir

1. No SQL Editor, clique em **+ New query**.
2. Abra `supabase/testes/conferencia-fase-3a.sql` no Bloco de Notas, copie tudo e cole no editor.
3. Clique em **Run**.
4. As **6 linhas** devem mostrar **true** na coluna **ok**. Mande um print para o Claude.

### Passo 3: enviar para o GitHub

1. Abra `github.com/Ayra-sw/ayra-ponto`.
2. Clique no botão **Add file** (perto do botão verde "<> Code") e depois em **Upload files**.
3. Na pasta extraída do ZIP você vai ver **3 pastas** (`docs`, `src`, `supabase`) e **1 arquivo** (`README.md`).
4. Selecione tudo de uma vez: clique em qualquer item e aperte **Ctrl+A**. Os 4 itens ficam azulados.
5. Arraste os itens selecionados para o quadro grande do GitHub.
6. Espere a lista carregar. Devem aparecer **27 arquivos**.
7. Na **caixinha pequena de cima** de "Commit changes", escreva: `Fase 3A: gestor da equipe, central de solicitações e atestado`
8. Deixe a caixa grande de baixo vazia e a bolinha **"Commit directly to the main branch"** marcada.
9. Clique no botão verde **Commit changes**.
10. Espere cerca de 2 minutos até a Vercel publicar (aparece um ✓ verde ao lado do commit).

### Passo 4: testar

Entre com a sua conta de administrador em `ayra-ponto.vercel.app` (se a página já estava aberta, aperte **Ctrl+F5**).

1. **Central de solicitações:** no menu, clique em **Solicitações** e passe pelas abas **Pendentes, Aprovadas, Recusadas, Canceladas e Todas**. Os pedidos antigos continuam lá.
2. **Escolher um gestor:** em **Departamentos**, clique em **Gestores** num departamento, marque uma pessoa e clique em **Salvar gestores**. O nome dela aparece na coluna Gestores.
3. **Atestado no afastamento:** abra a ficha de alguém, aba **Afastamentos**, clique em **Registrar afastamento**, escolha **Atestado médico**, as datas e um arquivo (PDF ou foto), e clique em **Registrar**. Depois clique em **Ver anexo**: o arquivo abre numa aba nova.

**Para testar o lado do gestor e do colaborador, você precisa de uma segunda conta**, porque ninguém aprova o próprio pedido. Se você tiver um colaborador de teste:

4. Coloque esse colaborador como **gestor** de um departamento que tenha outra pessoa, ou coloque você mesma num departamento e ele como gestor desse departamento.
5. Entre com a conta do colaborador. No menu aparece **Equipe**. Veja as abas **Pedidos** e **Pessoas** e abra o espelho de alguém da equipe.
6. Com a conta de quem é da equipe, faça um pedido de **folga** (em Histórico → Pedir ajuste). O pedido aparece para o gestor em **Equipe → Pedidos**. Recuse sem escrever nada: o sistema pede o motivo. Escreva e recuse.
7. Faça um pedido de **abono** com um atestado anexado. Ele **não** aparece para o gestor, só em **Solicitações** para você (RH/administrador), com o botão **Ver atestado**.
8. **Celular:** abra o site no celular com a conta do gestor e confira o item **Equipe** na barra de baixo.

Se ainda não tiver outra conta, faça só os testes 1 a 3 agora. O resto fica para quando você convidar alguém.

## Se algo der errado

- **Aparece "A gestão da equipe ainda não foi instalada no banco" ou "O envio de atestados ainda não foi instalado":** a migração do Passo 1 ainda não rodou. Faça o Passo 1.
- **O site não abre depois do envio:** na Vercel, vá em **Deployments**, clique nos três pontinhos do deploy anterior e escolha **Instant Rollback**. Depois me avise com um print.
- **Precisa desligar a Fase 3A no banco:** rode `2026-10-01_fase-3a_gestor-solicitacoes_DESFAZER.sql` do mesmo jeito do Passo 1. Os gestores deixam de ver a equipe e as regras novas saem. Nada é apagado: gestores escolhidos, comentários e arquivos continuam guardados. O espelho e o banco de horas continuam funcionando, e não é preciso rodar outro arquivo. Para ligar de novo, rode a migração da 3A outra vez.

## Como foi testado

- **Banco:** numa cópia local com todas as fases anteriores aplicadas, com duas empresas. A migração rodou **numa transação só**, como o SQL Editor do Supabase faz.
  - **116 cenários novos passaram**, e os 250 das fases 2B, 2C e 2D continuam passando.
  - **Gestor:** vê só a equipe (inclusive com dois departamentos e dois gestores); não lê CPF nem telefone; vê espelho, marcações, banco de horas, escala e pedidos só da equipe; aprova e recusa só pedidos da equipe, nunca abono e nunca o próprio; não registra afastamento, não lança banco de horas, não mexe na escala nem no cadastro; perde o acesso ao ser tirado do departamento ou desligado.
  - **Pedidos:** recusa exige comentário; cancelamento só por quem pediu e só enquanto espera; pedido cancelado ou recusado não vale no espelho; aprovado pelo gestor vale.
  - **Atestado:** só no abono; só da pasta da própria pessoa; arquivo inexistente, de outra pessoa, de outro armazenamento, com formato estranho ou com "../" é recusado; o gestor e os colegas não abrem; RH e administrador abrem; ninguém apaga; o anexo não muda depois.
  - A migração rodou duas vezes sem erro; o DESFAZER funcionou sem apagar dados e sem quebrar o espelho; a 3A foi aplicada de novo.
- **Telas:** o app foi compilado como na Vercel e aberto num navegador, com o Supabase simulado:
  - **75 verificações novas passaram**, e as 43 da 2B, as 72 da 2C e as 85 da 2D continuam passando.
  - Foram testados: gestores em Departamentos; a central (abas, filtros, busca, ver atestado, aprovar e recusar com comentário, pedido já analisado por outra pessoa); meus pedidos (resposta, cancelar, ver o próprio atestado); anexo no pedido (arquivo grande, formato errado, envio para a pasta certa, erro no envio sem criar pedido); a área Equipe do gestor (só a equipe, sem abono, sem os próprios pedidos, aprovar com comentário, espelho e impressão com o nome da pessoa, pessoa de fora barrada); afastamento com anexo; celular de 360 e 390 px (barra de baixo com 5 itens cabendo na tela), tema escuro e mensagem clara sem a migração;
  - nenhum erro de JavaScript inesperado.

## O que fica para as próximas fases

- **Fase 3B:** relatórios (horas, faltas, banco de horas, pedidos), avisos dentro do sistema (sininho: pedido novo, pedido respondido, marcação esquecida) e histórico de alterações (quem mudou o quê).
- **Fase 4:** ajuda, onboarding guiado, acessibilidade, desempenho, app instalável.
- **Fase 5:** AFD e AEJ oficiais, assinatura ICP-Brasil, INPI.
- **Antes de vender:** revisão de um advogado (LGPD, atestados e prazo de guarda, banco de horas, feriado na 12x36) e o serviço profissional de reconhecimento facial.
