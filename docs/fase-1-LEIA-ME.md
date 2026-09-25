# Ayra Ponto — Fase 1: fundamentos

Pacote preparado em 25/09/2026 a partir do commit `fef5628` ("Fase 0: correções de segurança e cadastro por convite").

Esta é a fase que muda a cara do sistema. Ela traz o design system, a nova estrutura com menu, a nova tela de ponto, o painel "Hoje" do gestor, o cadastro completo da empresa com CNPJ alfanumérico e as Unidades.

## O que muda para quem usa

**Para todos**
- Visual novo, com o design system do Ayra: azul e dourado, fontes IBM Plex, tema claro e escuro. Sem escolha salva, o tema segue o do aparelho.
- Telas pensadas para computador, tablet e celular.
- Entrada separada em endereços próprios: `/entrar`, `/criar-conta` e `/convite`.
- **Link de convite:** `ayra-ponto.vercel.app/convite/CODIGO`. Quem abre o link cria a conta, e o código já aparece preenchido depois.
- Nova tela **Minha conta**: alterar o próprio nome, trocar a senha e escolher o tema.

**Colaborador (tela de ponto)**
- **Um botão principal** com a próxima marcação esperada (entrada, início do intervalo, fim do intervalo ou saída).
- **"Registrar outro tipo"** abre as 4 opções. A sugestão nunca bloqueia nenhuma escolha.
- Depois de cada marcação aparece o **comprovante**: hora do servidor, data, NSR, CPF parcialmente oculto, empresa, unidade e código de integridade.
- **Marcações de hoje** com o NSR de cada uma. Tocar no NSR abre o comprovante.
- A situação do momento (trabalhando, em intervalo…) e o tempo trabalhado no dia.
- A localização é pedida com o aviso "Obtendo localização…" e continua sendo opcional.

**Administrador e RH (gestão)**
- **Menu lateral**, que no celular vira gaveta e no tablet vira ícones, e o botão **"Registrar ponto"** sempre no topo, porque eles também batem o ponto.
- **Hoje**, a tela inicial:
  - o que precisa de atenção (solicitações pendentes, CNPJ inválido);
  - o checklist "Vamos configurar seu Ayra Ponto", com progresso;
  - quem está trabalhando, em intervalo ou sem marcação;
  - a equipe com a situação de cada pessoa e a última marcação;
  - filtro por unidade e atualização automática a cada minuto.
- **Colaboradores:**
  - busca e filtros por unidade e situação, com paginação;
  - edição num painel lateral: dados, cargo, categoria, admissão, unidade e situação. O papel só o administrador altera;
  - confirmação explicando a consequência antes de desligar alguém ou de promover alguém a administrador;
  - botão "Convidar colaboradores", com o link e uma mensagem pronta para copiar.
- **Solicitações:** a lista de pendentes, agora com uma janela de confirmação.
- **Empresa:**
  - nome fantasia, razão social, **CNPJ alfanumérico**, inscrições estadual e municipal, contato e endereço (o CEP preenche o resto do endereço sozinho);
  - o código e o link de convite, com a opção **"Gerar novo código"**.
  - O RH só consulta essa tela.
- **Unidades:**
  - cadastrar, editar, desativar, reativar e excluir;
  - documento (CNPJ da filial, CEI, CAEPF ou CNO), endereço e fuso horário;
  - uma unidade com pessoas não pode ser desativada nem excluída, e a empresa sempre fica com pelo menos uma unidade ativa.

**Sobre o CNPJ:** o campo aceita letras e números nas 12 primeiras posições (novo padrão da Receita Federal para empresas abertas desde julho de 2026). Os CNPJs antigos, só com números, continuam valendo. O CNPJ passa a ser guardado sem pontuação e é conferido pelo dígito verificador, tanto na tela quanto no banco. **Se o CNPJ que já está gravado for inválido, ele é mantido, mas o sistema pede a correção antes de salvar outras alterações da empresa.**

## Arquivos do pacote

52 arquivos: 36 novos e 16 alterados. **Nenhum arquivo é apagado** e nenhum fica sem uso.

| Pasta | Novos | Alterados |
|---|---|---|
| raiz | — | `index.html` (ícone da aba, descrição, tema sem piscar), `package.json` (dependências), `README.md` |
| `src/` | — | `App.jsx` (rotas), `main.jsx`, `styles.css` (design system completo) |
| `src/components/ui/` | `Alerta`, `Botao`, `BotaoCopiar`, `Campo`, `Dialogo`, `Dica`, `Estados`, `Etiqueta`, `Indicador` | — |
| `src/components/layout/` | `BotaoTema`, `Marca`, `ShellColaborador`, `ShellGestao`, `ShellPublico` | — |
| `src/components/ponto/` | `Comprovante`, `RegistrarPonto`, `Relogio` | — |
| `src/components/` | `ConvidarPessoas` | `TopBar` (agora é a barra superior das duas áreas) |
| `src/contexts/` | `AvisosContext` | `ThemeContext` (segue o tema do aparelho) |
| `src/hooks/` | `useEmpresa` | — |
| `src/lib/` | `cep`, `cnpj`, `convite`, `formatos`, `marcacoes`, `rotulos` | `mensagensErro` |
| `src/pages/` | `MinhaConta` | `FuncionarioDashboard` (tela de ponto), `GestaoDashboard` (Hoje), `Login`, `NaoEncontrada`, `Onboarding`, `RedefinirSenha` |
| `src/pages/gestao/` | `Empresa`, `MeuPonto`, `Pessoas`, `Solicitacoes`, `Unidades` | — |
| `src/routes/` | — | `ProtectedRoute` |
| `supabase/migrations/` | `2026-09-25_fase-1_empresa-unidades.sql` e `…_DESFAZER.sql` | — |
| `supabase/testes/` | `conferencia-fase-1.sql` | — |
| `docs/` | `fase-1-LEIA-ME.md` (este arquivo) | — |

**Dependências novas** (a Vercel instala sozinha, pelo `package.json`):
- `lucide-react`: os ícones do sistema.
- `@fontsource/ibm-plex-sans` e `@fontsource/ibm-plex-mono`: as fontes, guardadas junto com o site, sem depender do Google.

**Serviço externo novo:** o ViaCEP (gratuito), usado só para preencher o endereço a partir do CEP. Se ele estiver fora do ar, a pessoa preenche o endereço à mão.

## Mudanças no banco (migração da Fase 1)

Tudo é acrescentado. Nenhuma tabela é recriada e nenhum dado é apagado.

- **`empresas`:** campos novos de inscrição estadual e municipal, telefone, e-mail, CEP, rua, número, complemento, bairro, cidade e UF. O CNPJ passa a ser guardado sem pontuação e é validado. O campo `nome` continua sendo o nome fantasia.
- **`filiais` (Unidades):** campos novos `ativa` (todas começam ativas), tipo de documento, endereço em campos e fuso horário (padrão: Brasília).
- **Regras novas:**
  - uma unidade com pessoas não pode ser desativada nem excluída;
  - uma unidade com marcações não pode ser excluída (só desativada);
  - a empresa sempre fica com pelo menos uma unidade ativa.
- **Convite e troca de unidade** passam a usar só unidades ativas.
- **Funções novas:** `cnpj_valido` e `normalizar_documento`.

## Passo a passo

### Passo 0: conferir o GitHub

Eu já conferi: o último envio é o da Fase 0. Se você fizer algum envio antes de aplicar este pacote, me avise primeiro.

### Passo 1: rodar a migração no Supabase

1. No seu computador, clique com o botão direito em `ayra-ponto-fase-1.zip` e escolha **Extrair tudo** → **Extrair**.
2. Na pasta que abriu, entre em **supabase** e depois em **migrations**.
3. Clique com o botão direito em `2026-09-25_fase-1_empresa-unidades.sql` (o arquivo que **não** tem "DESFAZER" no nome). Escolha **Abrir com** → **Bloco de Notas**.
4. No Bloco de Notas, aperte **Ctrl+A** e depois **Ctrl+C**.
5. Entre no Supabase, abra o projeto **Ayra Ponto**, clique em **SQL Editor** no menu da esquerda e depois em **+ New query**.
6. Clique dentro do editor em branco e aperte **Ctrl+V**.
7. Clique no botão verde **Run**.
8. Deve aparecer **"Success. No rows returned"**. Avisos amarelos com a palavra "skipping" são normais.

### Passo 2: conferir

1. No SQL Editor, clique em **+ New query**.
2. Abra `supabase/testes/conferencia-fase-1.sql` no Bloco de Notas, copie tudo e cole no editor.
3. Clique em **Run**.
4. As 8 linhas devem mostrar **true** na coluna **ok**. Mande um print para o Claude.

### Passo 3: enviar para o GitHub

1. Abra `github.com/Ayra-sw/ayra-ponto`.
2. Clique no botão **Add file** (fica perto do botão verde "<> Code") e depois em **Upload files**.
3. Na pasta extraída do ZIP você vai ver **4 pastas** (`docs`, `src`, `supabase`) e **3 arquivos** (`index.html`, `package.json` e `README.md`).
4. Selecione tudo de uma vez: clique em qualquer item e aperte **Ctrl+A**. Os 7 itens ficam azulados.
5. Arraste os itens selecionados para o quadro grande do GitHub.
6. Espere a lista carregar. Devem aparecer **52 arquivos**.
7. Na **caixinha pequena de cima** de "Commit changes", escreva: `Fase 1: design system, nova tela de ponto, painel Hoje, empresa e unidades`
8. Deixe a caixa grande de baixo vazia e a bolinha **"Commit directly to the main branch"** marcada.
9. Clique no botão verde **Commit changes**.
10. Espere uns 2 minutos, um pouco mais que da outra vez, porque a Vercel vai instalar as dependências novas.

### Passo 4: testar

1. Abra `ayra-ponto.vercel.app` e entre com a sua conta de administrador.
2. Você deve cair na tela **Hoje**, com o menu à esquerda.
3. Vá em **Empresa** e preencha razão social, CNPJ e endereço. Teste digitar só o CEP e clicar fora do campo: o endereço se completa sozinho.
4. Vá em **Colaboradores** e clique em **Convidar colaboradores** para ver o link de convite.
5. Clique em **Registrar ponto** no topo e registre uma marcação. O comprovante deve aparecer.
6. No celular, abra o mesmo endereço e confira o menu (o botão com três risquinhos no canto superior esquerdo).

## Se algo der errado

- **O site não abre depois do envio:** na Vercel, vá em **Deployments**, clique nos três pontinhos do deploy anterior e escolha **Instant Rollback**. Depois me avise com um print.
- **Precisa voltar o banco:** rode `2026-09-25_fase-1_empresa-unidades_DESFAZER.sql` do mesmo jeito do passo 1. Os campos novos e os dados preenchidos neles continuam lá; só as regras novas são desligadas.

## Como foi testado

- **Banco:** numa cópia local da estrutura real, com a Fase 0 aplicada:
  - 12 cenários novos: CNPJ válido e inválido (numérico e alfanumérico), permissão só do administrador, unidade com pessoas, última unidade ativa, convite indo para a unidade ativa e registro de ponto continuando a funcionar;
  - os 28 cenários de segurança da Fase 0 rodaram de novo e continuaram passando;
  - a migração rodou duas vezes sem erro, e o DESFAZER funcionou;
  - um CNPJ antigo inválido foi mantido, só sem pontuação.
- **Telas:** o app foi compilado e aberto num navegador, com o Supabase simulado, em computador (tema claro e escuro), tablet e celular:
  - fluxo completo de marcação com comprovante;
  - "Registrar outro tipo";
  - painel Hoje, colaboradores e edição, empresa com CNPJ válido e inválido, unidades, confirmação de aprovação, minha conta, entrada, convite por link, onboarding e página não encontrada;
  - nenhum erro de JavaScript e nenhuma rolagem lateral no celular.

## O que fica para as próximas fases

- **Fase 2 (operação):** perfil completo do colaborador com abas, departamentos, cargos, jornadas, escalas, feriados, cálculo de horas, atrasos e extras, espelho de ponto, banco de horas, histórico de marcações e pedido de ajuste pelo colaborador.
- **Fase 3 (gestão):** papel Gestor (limitado aos departamentos dele, também no banco), central de solicitações com histórico, relatórios, notificações e histórico de ações.
