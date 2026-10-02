# Ayra Ponto — Fase 3C: sininho de avisos e histórico de alterações

Pacote preparado em 02/10/2026 a partir do commit `02d1dfb` ("Fase 3B: relatórios e cálculo das horas mais rápido").

Com este pacote, a **Fase 3 fica completa**:

- **Fase 3A (no ar):** gestor da equipe, central de solicitações e atestado.
- **Fase 3B (no ar):** relatórios e cálculo das horas mais rápido.
- **Fase 3C (este pacote):** o sininho de avisos e o histórico de alterações.

**Decisões suas, respeitadas:**

- o sininho avisa sobre **pedidos**, **dia incompleto**, **banco de horas vencendo**, **pessoa nova** e **fotos de rosto**;
- os avisos aparecem **só dentro do sistema**, sem e-mail por enquanto;
- o histórico de alterações é visto **só por administrador e RH**.

## O que muda para quem usa

### O sininho (todo mundo)

Na barra de cima, ao lado do botão de tema, aparece um **sininho**. Quando há aviso novo, ele mostra uma bolinha vermelha com o número. Clicar abre a lista, e clicar num aviso leva direto à tela certa e marca o aviso como lido. Também há o botão **Marcar todos como lidos**.

| Aviso | Quem recebe | Clicar leva para |
|---|---|---|
| **Pedido novo** (ajuste, folga) | Os gestores do departamento da pessoa. Se o departamento não tiver gestor, o RH e o administrador | Solicitações |
| **Pedido novo de abono** | RH e administrador (abono é com eles) | Solicitações |
| **Pedido respondido** (aprovado ou recusado, com a resposta) | Quem pediu | Meus pedidos |
| **Ficou faltando uma marcação** | A própria pessoa, para os últimos 3 dias. Não avisa se já existe um pedido de ajuste para aquele dia | O espelho daquele mês |
| **Banco de horas vencendo** | RH e administrador, **1 vez por semana**: quantas pessoas têm horas vencendo nos próximos 30 dias e quantas já venceram | Banco de horas |
| **Pessoa nova** (entrou pelo convite) | RH e administrador | A ficha da pessoa, para completar o cadastro |
| **Foto de rosto para aprovar** | RH e administrador | Reconhecimento facial |
| **Foto aprovada ou recusada** | A própria pessoa | Reconhecimento facial |

Detalhes que deixam o sininho tranquilo:

- Quando um pedido é respondido, o aviso de "pedido novo" some do sininho de todos os gestores, para ninguém abrir algo que já foi resolvido.
- Se a pessoa corrige o dia incompleto, o aviso daquele dia some sozinho.
- O mesmo aviso nunca aparece duas vezes.
- Ninguém se avisa sobre o próprio pedido.
- Avisos lidos são apagados depois de 90 dias, e todos depois de 180 dias.
- O sininho confere avisos novos a cada minuto e sempre que você troca de tela.

### Histórico de alterações (administrador e RH)

No menu, no grupo **Gestão**, aparece o item **Histórico de alterações**. Cada linha conta, em frase simples, quem fez o quê e quando. Por exemplo: "Beto Almeida alterou o cadastro de Duda Souza", e logo abaixo **Matrícula: (vazio) → 0042**.

- O que é anotado: cadastro de pessoas, pedidos e respostas, jornadas e feriados, escalas e turnos, afastamentos, banco de horas, departamentos, cargos e gestores, empresa e unidades, e o reconhecimento facial. São 16 tabelas.
- Mudanças feitas juntas aparecem numa linha só. Por exemplo: "mudou 3 dias da escala de Duda Souza" ou "alterou os horários da jornada Comercial 40h".
- Filtros: **De**, **Até** (por padrão, os últimos 30 dias), **O que mudou** e **Buscar** por nome.
- Na ficha de cada pessoa há uma aba nova, **Histórico**, só com as mudanças dela.
- **Ninguém consegue apagar nem editar o histórico**, nem você. É isso que dá valor a ele numa fiscalização ou numa discussão trabalhista.
- **Proteção de dados (LGPD):** CPF e telefone aparecem só como "(alterado)", sem o número. Fotos e dados do rosto não entram no histórico, só a situação da foto (por exemplo, "Esperando aprovação → Aprovada").
- As marcações de ponto não aparecem aqui, porque já têm o registro próprio, com NSR, que nunca muda.

**Importante:** o histórico **começa a anotar a partir do momento em que você instalar esta fase**. O que mudou antes disso não aparece. Por isso, logo depois de instalar, a tela fica vazia e explica isso.

## Arquivos do pacote

17 arquivos: 9 novos e 8 alterados. **Nenhum arquivo é apagado.**

| Pasta | Novos | Alterados |
|---|---|---|
| raiz | — | `README.md` |
| `docs/` | `fase-3c-LEIA-ME.md` (este guia) | — |
| `supabase/migrations/` | `2026-10-03_fase-3c_avisos-historico.sql` e `…_DESFAZER.sql` | — |
| `supabase/testes/` | `conferencia-fase-3c.sql` | — |
| `src/` | — | `App.jsx` (rota nova), `styles.css` (sininho, histórico e um ajuste para o celular) |
| `src/components/` | `sininho/Sininho.jsx`, `historico/ListaHistorico.jsx` | `TopBar.jsx` (o sininho na barra) |
| `src/components/layout/` | — | `ShellGestao.jsx` (item de menu) |
| `src/hooks/` | `useSininho.js` | — |
| `src/lib/` | `historico.js` | `mensagensErro.js` |
| `src/pages/` | — | `MeuHistorico.jsx` (abre direto em "Meus pedidos" pelo aviso) |
| `src/pages/gestao/` | `Historico.jsx` | `PerfilPessoa.jsx` (aba Histórico) |

**Dependências novas:** nenhuma. O `package.json` não muda.

## Mudanças no banco (migração da Fase 3C)

Nenhum dado que já existe é alterado ou apagado.

- **3 tabelas novas:**
  - `avisos`: os avisos do sininho. Cada pessoa vê e marca como lido só os próprios;
  - `avisos_verificados`: anota o que já foi conferido no dia, para não repetir aviso;
  - `historico_alteracoes`: o histórico. Só administrador e RH leem, e ninguém insere, edita ou apaga pelo app.
- **Avisos automáticos:** o próprio banco cria os avisos quando chega um pedido, quando ele é respondido, quando entra uma pessoa nova e quando chega ou é analisada uma foto de rosto.
- **Conferência ao entrar:** quando a pessoa abre o sistema, o banco confere o dia incompleto e, para RH e administrador, o banco de horas vencendo. Isso roda **uma vez por login**, não a cada tela.
- **Anotação do histórico:** fica ligada em 16 tabelas.

## Passo a passo

### Passo 0: conferir o GitHub

Eu já conferi: o último envio é o `02d1dfb`. Se você fizer algum envio antes de aplicar este pacote, me avise primeiro.

### Passo 1: rodar a migração no Supabase

1. No seu computador, clique com o botão direito em `ayra-ponto-fase-3c.zip` e escolha **Extrair tudo** → **Extrair**.
2. Na pasta que abriu, entre em **supabase** e depois em **migrations**.
3. Clique com o botão direito em `2026-10-03_fase-3c_avisos-historico.sql` (o arquivo que **não** tem "DESFAZER" no nome). Escolha **Abrir com** → **Bloco de Notas**.
4. No Bloco de Notas, aperte **Ctrl+A** e depois **Ctrl+C**.
5. Entre no Supabase, abra o projeto **Ayra Ponto**, clique em **SQL Editor** no menu da esquerda e depois em **+ New query**.
6. Clique dentro do editor em branco e aperte **Ctrl+V**.
7. Clique no botão verde **Run**.
8. Deve aparecer **"Success. No rows returned"**.

Se aparecer "Antes desta migração é preciso aplicar a Fase 3B", nada foi alterado: me mande um print.

### Passo 2: conferir

1. No SQL Editor, clique em **+ New query**.
2. Abra `supabase/testes/conferencia-fase-3c.sql` no Bloco de Notas, copie tudo e cole no editor.
3. Clique em **Run**.
4. As **5 linhas** devem mostrar **true** na coluna **ok**. Mande um print para o Claude.

### Passo 3: enviar para o GitHub

1. Abra `github.com/Ayra-sw/ayra-ponto`.
2. Clique no botão **Add file** (perto do botão verde "<> Code") e depois em **Upload files**.
3. Na pasta extraída do ZIP você vai ver **3 pastas** (`docs`, `src`, `supabase`) e **1 arquivo** (`README.md`).
4. Selecione tudo de uma vez: clique em qualquer item e aperte **Ctrl+A**. Os 4 itens ficam azulados.
5. Arraste os itens selecionados para o quadro grande do GitHub.
6. Espere a lista carregar. Devem aparecer **17 arquivos**.
7. Na **caixinha pequena de cima** de "Commit changes", escreva: `Fase 3C: sininho de avisos e histórico de alterações`
8. Deixe a caixa grande de baixo vazia e a bolinha **"Commit directly to the main branch"** marcada.
9. Clique no botão verde **Commit changes**.
10. Espere cerca de 2 minutos até a Vercel publicar. Primeiro aparece a bolinha laranja e depois o ✓ verde; se precisar, aperte **F5** para atualizar a página.

### Passo 4: testar

Entre com a sua conta de administrador em `ayra-ponto.vercel.app` (aperte **Ctrl+F5** para carregar a versão nova).

1. Olhe a barra de cima: o **sininho** aparece ao lado do botão de tema. Pode já ter um aviso de **Banco de horas**, se alguém tiver horas vencendo.
2. Clique no sininho. A lista abre. Aperte **Esc** e ela fecha.
3. No menu, no grupo **Gestão**, clique em **Histórico de alterações**. A tela explica que o histórico começa agora.
4. Vá em **Departamentos**, abra um departamento, mude o nome (por exemplo, acrescente "Teste 3C") e salve. Depois volte o nome ao original.
5. Volte ao **Histórico de alterações**. Aparecem **2 linhas**: "Seu nome alterou o departamento…", com o nome antigo riscado e o novo ao lado.
6. Abra a ficha de uma pessoa em **Colaboradores**. Há uma aba nova, **Histórico**.
7. **Celular:** abra o sininho e o Histórico de alterações no celular e confira que dá para ler sem arrastar a tela para os lados.

O teste completo do sininho (pedido novo chegando para o gestor, resposta chegando para quem pediu) fica para quando você tiver uma segunda conta, como combinamos na 3A.

## Se algo der errado

- **O sininho não aparece:** a migração do Passo 1 ainda não rodou. Faça o Passo 1 e aperte **Ctrl+F5**. Sem a migração, o resto do sistema funciona normalmente, só sem o sininho.
- **Aparece "O histórico e os avisos ainda não foram instalados no banco":** a migração do Passo 1 ainda não rodou. Faça o Passo 1.
- **O site não abre depois do envio:** na Vercel, vá em **Deployments**, clique nos três pontinhos do deploy anterior e escolha **Instant Rollback**. Depois me avise com um print.
- **Precisa desligar a Fase 3C no banco:** rode `2026-10-03_fase-3c_avisos-historico_DESFAZER.sql` do mesmo jeito do Passo 1. Os avisos novos e a anotação do histórico param, e o sininho some da tela. **Nada é apagado:** o histórico já anotado continua guardado.

## Como foi testado

- **Banco:** numa cópia local com todas as fases aplicadas. A migração rodou numa transação só, como o SQL Editor do Supabase faz.
  - **98 cenários novos passaram.** Foram testados:
    - quem recebe cada aviso: gestor do departamento, RH e administrador quando não há gestor, abono só para RH, nunca para si mesmo, pessoa desligada não recebe;
    - o aviso de pedido novo some quando o pedido é respondido;
    - dia incompleto (só 1 vez, ignora dia com pedido pendente, some quando o dia é corrigido);
    - banco de horas 1 vez por semana e só para RH e administrador;
    - pessoa nova e fotos;
    - ninguém vê nem mexe nos avisos de outra pessoa, nem de outra empresa;
    - o histórico das 16 tabelas: o que anota, o que esconde (CPF, telefone, dados do rosto), mudanças feitas juntas, quem fez;
    - o histórico não pode ser editado nem apagado, nem pelo administrador;
    - o gestor e o colaborador não leem o histórico, e outra empresa também não.
  - **Os 402 cenários das fases anteriores continuam passando.**
  - A migração rodou duas vezes sem erro; o DESFAZER funcionou e a 3C foi aplicada de novo.
- **Telas:** o app foi compilado como na Vercel e aberto num navegador, com o Supabase simulado:
  - **40 verificações novas passaram**, e as 43 da 2B, as 72 da 2C, as 85 da 2D, as 75 da 3A e as 49 da 3B continuam passando.
  - Foram testados:
    - o sininho: contador, lista, clique levando à tela certa, marcar como lido, marcar todos, Esc, clique fora, nada de conferência pesada ao trocar de tela, sininho escondido sem a migração;
    - o histórico: frases, mudanças agrupadas, filtros, busca, período inválido, aba na ficha da pessoa, tela vazia explicando o começo, colaborador sem acesso;
    - celular de 360 px sem rolagem lateral e tema escuro;
    - nenhum erro de JavaScript inesperado.
  - Um ajuste pequeno de layout entrou junto: em celulares muito estreitos, uma lista de opções comprida podia empurrar a tela para os lados. Agora a tela sempre cabe.

## O que fica para as próximas fases

- **Fase 4:** central de ajuda, onboarding guiado, acessibilidade, desempenho, app instalável.
- **Fase 5:** AFD e AEJ oficiais, assinatura ICP-Brasil, INPI.
- **Antes de vender:** revisão de um advogado (LGPD, atestados, banco de horas, feriado na 12x36, tempo de guarda do histórico) e o serviço profissional de reconhecimento facial.
