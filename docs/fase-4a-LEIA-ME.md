# Ayra Ponto — Fase 4A: primeiros passos e central de ajuda

Pacote preparado em 03/10/2026 a partir do commit `060959a` ("Fase 3C: sininho de avisos e histórico de alterações").

A Fase 4 ficou assim:

- **Fase 4A (este pacote):** primeiros passos guiados, boas-vindas do colaborador e central de ajuda.
- **Fase 4B (a próxima):** app instalável no celular, desempenho e acessibilidade.

**Decisões suas, respeitadas:**

- **lista de tarefas na Visão geral** para a empresa nova, e boas-vindas curtas para o colaborador;
- **suporte por WhatsApp e e-mail**;
- no app instalável (Fase 4B), **o ponto precisa de internet**.

## O que muda para quem usa

### Primeiros passos (administrador e RH)

Na **Visão geral** aparece a lista **Primeiros passos**. Ela substitui a lista antiga de 4 itens e tem 8 itens:

1. Complete os dados da empresa
2. Confira o endereço da unidade
3. Cadastre a jornada de trabalho
4. Cadastre os feriados do ano
5. Crie os departamentos
6. Convide sua equipe
7. Defina como cada pessoa trabalha (mostra quantas pessoas ainda estão sem jornada)
8. Faça a primeira marcação de ponto

Como a lista funciona:

- Cada item **fica marcado sozinho** quando é feito. Não há nada para clicar como "feito".
- Cada item tem o botão **Abrir**, que leva à tela certa, e um **?** ("Como fazer"), que abre a explicação ali mesmo.
- Para o RH, os itens da empresa e da unidade avisam que só o administrador altera.
- **Esconder lista** guarda a escolha da pessoa, e ela vale em qualquer aparelho. Para trazer a lista de volta, use **Central de ajuda → Mostrar os primeiros passos de novo**.
- Quando tudo fica pronto, aparece **Tudo pronto!** uma vez, com o botão **Fechar**.

### Boas-vindas do colaborador

No primeiro acesso à tela **Início**, o colaborador vê uma janela curta: como bater o ponto, o que fazer se esquecer, onde ver as horas e onde fica a ajuda.

- Se a empresa usa reconhecimento facial, a janela lembra de cadastrar o rosto.
- Se a pessoa é gestora, a janela explica a área **Equipe**.
- A janela aparece **uma vez só**: depois de **Começar** ou **Ver a ajuda**, não volta.
- Quem já usa o sistema também vai ver a janela uma vez, depois que esta fase entrar no ar. Assim todo mundo conhece o botão de ajuda.

### Central de ajuda e o botão "?"

- **Em todas as telas**, ao lado do sininho, há um **?**. Ele abre um painel com a **ajuda daquela tela**, os artigos mais procurados e uma busca. A busca entende palavras sem acento, como "ferias".
- A **Central de ajuda** fica no menu da gestão, no fim da lista. O colaborador chega até ela por **Minha conta → Abrir a central de ajuda**. Os artigos são organizados por assunto.
- São **39 artigos curtos**, escritos com os nomes exatos dos botões. Alguns exemplos: convidar a equipe, criar jornada, escala 12x36, feriados, banco de horas, aprovar pedidos, relatórios, esqueci de bater o ponto, abono com atestado, espelho, cadastrar o rosto, esqueci minha senha, Portaria 671 e privacidade.
- Cada pessoa vê só o que faz sentido para ela:
  - o colaborador não vê artigos da gestão;
  - o gestor vê também o artigo "Sou gestor".
- Os links dentro dos artigos levam direto à tela certa.
- **Telas sem login** (entrar, criar conta, convite) ganharam o botão **Precisa de ajuda?**, com os artigos de senha, convite e e-mail que não chegou.

### Quem atende cada dúvida

- **Administrador e RH, e quem ainda não entrou:** os botões **WhatsApp** e **E-mail** do suporte do Ayra Ponto. A mensagem já vem com o nome da empresa e a tela.
- **Colaborador:** a ajuda orienta a **falar com o RH da própria empresa**. Ele não vê o contato do Ayra. Assim, dúvidas como "minhas horas estão erradas" vão para quem pode resolver, e o seu suporte não recebe dúvidas que são da empresa cliente.

**Importante:** os botões de WhatsApp e e-mail só aparecem depois que você me passar o número e o endereço. Eu coloco no arquivo `src/lib/suporte.js` e te mando de novo só esse arquivo.

## Arquivos do pacote

24 arquivos: 15 novos e 9 alterados. **Nenhum arquivo é apagado.**

| Pasta | Novos | Alterados |
|---|---|---|
| raiz | — | `README.md` |
| `docs/` | `fase-4a-LEIA-ME.md` (este guia) | — |
| `supabase/migrations/` | `2026-10-04_fase-4a_primeiros-passos.sql` e `…_DESFAZER.sql` | — |
| `supabase/testes/` | `conferencia-fase-4a.sql` | — |
| `src/` | — | `App.jsx` (rotas da ajuda), `styles.css` |
| `src/components/` | `BoasVindas.jsx`, `ajuda/BotaoAjuda.jsx`, `ajuda/ConteudoArtigo.jsx`, `ajuda/Suporte.jsx`, `primeiros-passos/PrimeirosPassos.jsx` | `TopBar.jsx` (o "?") |
| `src/components/layout/` | — | `ShellGestao.jsx` (menu), `ShellColaborador.jsx` (boas-vindas), `ShellPublico.jsx` ("Precisa de ajuda?") |
| `src/hooks/` | `useMarcos.js` | — |
| `src/lib/` | `ajuda.js`, `suporte.js`, `ajuda/artigosGestao.js`, `ajuda/artigosPessoais.js` | — |
| `src/pages/` | `CentralAjuda.jsx` | `GestaoDashboard.jsx` (nova lista), `MinhaConta.jsx` (cartão Ajuda) |

**Dependências novas:** nenhuma. O `package.json` não muda.

## Mudanças no banco (migração da Fase 4A)

Nenhum dado que já existe é alterado ou apagado. A migração é pequena:

- **Tabela nova `marcos_usuario`:** anota o que cada pessoa já viu ou dispensou, como as boas-vindas e a lista escondida. Cada pessoa lê, cria e apaga só as próprias anotações, e ninguém pode editá-las. Há um limite de 50 por pessoa, para evitar abuso.
- **Função nova `primeiros_passos()`:** conta, numa consulta só, o que a empresa já configurou.
  - Só administrador e RH recebem a resposta. O colaborador recebe vazio.
  - Ela respeita as regras de acesso: cada empresa só conta o que é dela.

## Passo a passo

**Antes de tudo:** no Supabase, confira se no alto da tela está escrito **AYRA SOLUÇÕES / Ayra Ponto**, e não **Atlas Comercial**.

### Passo 0: conferir o GitHub

Eu já conferi: o último envio é o `060959a`. Se você fizer algum envio antes de aplicar este pacote, me avise primeiro.

### Passo 1: rodar a migração no Supabase

1. No seu computador, clique com o botão direito em `ayra-ponto-fase-4a.zip` e escolha **Extrair tudo** → **Extrair**.
2. Na pasta que abriu, entre em **supabase** e depois em **migrations**.
3. Clique com o botão direito em `2026-10-04_fase-4a_primeiros-passos.sql` (o arquivo que **não** tem "DESFAZER" no nome) e escolha **Abrir com** → **Bloco de Notas**.
4. No Bloco de Notas, aperte **Ctrl+A** e depois **Ctrl+C**.
5. No Supabase (projeto **Ayra Ponto**), clique em **SQL Editor** e depois em **+ New query**.
6. Clique dentro do editor em branco e aperte **Ctrl+V**.
7. Clique em **Run**.
8. Deve aparecer **"Success. No rows returned"**.

Se aparecer "Antes desta migração é preciso aplicar a Fase 3C", confira se está no projeto certo. Nada foi alterado.

### Passo 2: conferir

1. No SQL Editor, clique em **+ New query**.
2. Abra `supabase/testes/conferencia-fase-4a.sql` no Bloco de Notas, copie tudo e cole no editor.
3. Clique em **Run**.
4. As **3 linhas** devem mostrar **true** na coluna **ok**. Mande um print para o Claude.

### Passo 3: enviar para o GitHub

1. Abra `github.com/Ayra-sw/ayra-ponto`.
2. Clique em **Add file** e depois em **Upload files**.
3. Na pasta extraída do ZIP você vai ver **3 pastas** (`docs`, `src`, `supabase`) e **1 arquivo** (`README.md`).
4. Clique em qualquer item e aperte **Ctrl+A**. Os 4 itens ficam azulados.
5. Arraste os itens selecionados para o quadro grande do GitHub.
6. Espere a lista carregar. Devem aparecer **24 arquivos**.
7. Na **caixinha pequena de cima**, escreva: `Fase 4A: primeiros passos e central de ajuda`
8. Deixe a caixa grande de baixo vazia e a bolinha **"Commit directly to the main branch"** marcada.
9. Clique no botão verde **Commit changes**.
10. Espere cerca de 2 minutos até a bolinha laranja virar o **✓ verde**. Se precisar, aperte **F5**.

### Passo 4: testar

Abra `ayra-ponto.vercel.app` e aperte **Ctrl+F5**.

1. **Visão geral:** aparece a lista **Primeiros passos**, com os itens que você já fez marcados em verde. Se tudo já estiver feito, aparece **Tudo pronto!** Nesse caso, clique em **Fechar**.
2. Num item pendente, clique no **?** ("Como fazer"). Abre a explicação do lado direito. Aperte **Esc** para fechar.
3. Em qualquer tela, clique no **?** da barra de cima (ao lado do sininho). Digite **senha** na busca e veja os artigos.
4. No menu, no fim da lista, clique em **Central de ajuda**. Os artigos aparecem por assunto. Abra um.
5. Se a lista de primeiros passos estiver aparecendo, clique em **Esconder lista** e depois traga de volta pela Central de ajuda.
6. **Celular:** abra a Visão geral e o **?** no celular e confira que dá para ler sem arrastar a tela para os lados.
7. **Tela de entrada:** saia da conta. Embaixo do formulário aparece **Precisa de ajuda?**.

As boas-vindas do colaborador ficam para o teste com a segunda conta, como combinamos.

## Se algo der errado

- **A lista mostra só 4 itens e não tem "Esconder lista":** a migração do Passo 1 ainda não rodou. Faça o Passo 1 e aperte **Ctrl+F5**.
- **O site não abre depois do envio:** na Vercel, vá em **Deployments**, clique nos três pontinhos do deploy anterior e escolha **Instant Rollback**. Depois me avise com um print.
- **Precisa desligar a Fase 4A no banco:** rode `2026-10-04_fase-4a_primeiros-passos_DESFAZER.sql` do mesmo jeito do Passo 1.
  - Saem só a contagem dos primeiros passos e as anotações de "já vi".
  - A Visão geral volta à lista simples, e a ajuda continua funcionando.
  - Nenhum dado de ponto, cadastro ou pedido é tocado.

## Como foi testado

- **Banco:** numa cópia local com todas as fases aplicadas.
  - **50 cenários novos passaram.** Foram testados:
    - cada pessoa só vê, cria e apaga as próprias anotações, nem o administrador vê as dos outros;
    - ninguém edita uma anotação;
    - chave estranha é recusada, há o limite de 50 e, quando a pessoa sai, as anotações saem junto;
    - visitante sem login não acessa nada;
    - a contagem bate com o banco (pessoas sem desligados, jornadas ativas, departamentos ativos, feriados do ano, pessoas sem jornada, marcação), e cada empresa só conta o que é dela;
    - numa empresa recém-criada a lista começa vazia e anda conforme a configuração.
  - **Os 500 cenários das fases anteriores continuam passando.**
  - A migração rodou duas vezes sem erro; o DESFAZER funcionou e a 4A foi aplicada de novo.
- **Telas:** o app foi compilado como na Vercel e aberto num navegador, com o Supabase simulado.
  - **59 verificações novas passaram.** Foram testados:
    - a lista: progresso, "Como fazer", "Abrir", esconder e mostrar de novo, "Tudo pronto!", RH, e o funcionamento sem a migração;
    - o "?": ajuda da tela, busca, artigo, links, Esc e foco;
    - a central: assuntos, busca, artigo e artigo inexistente;
    - as boas-vindas: uma vez só, item de rosto e "Ver a ajuda";
    - o colaborador: não vê artigos da gestão e é orientado a falar com o RH;
    - a tela de entrada sem login;
    - celular de 360 px e tema escuro;
    - nenhum erro de JavaScript.
  - **Conferência automática dos 39 artigos:** nomes únicos, assuntos certos, todos os links internos existem, e a busca e o filtro por pessoa funcionam.
  - Os links de WhatsApp e e-mail foram testados com um número e um e-mail de exemplo.
  - **Fases anteriores:** as 43 verificações da 2B, as 72 da 2C, as 85 da 2D, as 75 da 3A, as 49 da 3B e as 40 da 3C continuam passando.

## O que fica para as próximas fases

- **Fase 4B:** app instalável no celular (o ponto precisa de internet, como você decidiu), desempenho e acessibilidade.
- **Fase 5:** AFD e AEJ oficiais, assinatura ICP-Brasil, INPI.
- **Antes de vender:** revisão de um advogado e o serviço profissional de reconhecimento facial.
