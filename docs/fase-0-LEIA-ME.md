# Ayra Ponto — Fase 0: correções de base

Pacote preparado em 24/09/2026 a partir do commit `a1e01d9` ("Add discrete link button styles to styles.css").

Esta fase fecha as falhas críticas encontradas na auditoria antes de qualquer tela nova. Ela não muda o visual do sistema; isso começa na Fase 1.

## O que muda para quem usa

- **Ninguém escolhe mais o próprio papel no cadastro.** A tela de entrada agora tem dois caminhos: "Criar conta da minha empresa" e "Recebi um convite". Quem cria a empresa vira administrador. Quem entra por convite entra sempre como colaborador, ligado à unidade principal, e o administrador pode mudar o papel depois.
- **Só dá para bater o próprio ponto.** O banco confere quem está logado e usa a unidade do cadastro da pessoa. Visitantes sem login não conseguem mais registrar nada.
- **Quem entra por convite já consegue bater ponto** (antes ficava sem unidade).
- **A lista de solicitações pendentes volta a aparecer.** Aprovar e recusar agora pedem confirmação, porque a análise passa a ser definitiva. Ninguém analisa a própria solicitação.
- **O colaborador deixa de ver CPF e dados dos colegas.** Administrador e RH continuam vendo a equipe.
- **Só o administrador muda papéis e cria, edita ou exclui unidades.** Antes o RH também podia mexer em unidades, mas não havia tela usando isso.
- **O NSR (número sequencial) de uma unidade não pode mais ser editado à mão.**
- Mensagens de erro em português, página "não encontrada" para endereços inválidos e aviso com "Tentar de novo" quando o cadastro não carrega.
- Depois de bater o ponto, a mensagem mostra a hora registrada pelo servidor e o NSR.

**Ainda não muda nesta fase:** aprovar uma solicitação continua só mudando a situação dela. A marcação corrigida entra na Fase 2, depois de uma decisão sobre como registrar ajustes (ver "Decisões pendentes" no fim).

## Arquivos do pacote

| Arquivo | Situação | O que é |
|---|---|---|
| `supabase/migrations/2026-09-24_fase-0_seguranca.sql` | novo | Migração do banco (passo 2) |
| `supabase/migrations/2026-09-24_fase-0_seguranca_DESFAZER.sql` | novo | Volta o banco ao estado anterior. Só para emergência |
| `supabase/testes/conferencia-fase-0.sql` | novo | Consulta de conferência, somente leitura (passo 3) |
| `supabase/estrutura-antes-fase-0.sql` | novo | Registro da estrutura do banco antes desta fase. Referência, não executar |
| `src/lib/mensagensErro.js` | novo | Traduz erros técnicos para mensagens claras |
| `src/pages/NaoEncontrada.jsx` | novo | Página "não encontrada" |
| `src/App.jsx` | alterado | Rota para a página "não encontrada" |
| `src/contexts/AuthContext.jsx` | alterado | Sabe quando o cadastro falhou ao carregar |
| `src/routes/ProtectedRoute.jsx` | alterado | Aviso com "Tentar de novo" no lugar do carregamento infinito |
| `src/pages/Login.jsx` | alterado | Dois caminhos de cadastro, sem escolha de papel |
| `src/pages/Onboarding.jsx` | alterado | Criar empresa ou usar convite, conforme o caminho escolhido |
| `src/pages/GestaoDashboard.jsx` | alterado | Lista de solicitações corrigida, confirmação, nomes legíveis |
| `src/pages/FuncionarioDashboard.jsx` | alterado | "Unidade" no lugar de "filial", hora e NSR na confirmação |
| `src/pages/RedefinirSenha.jsx` | alterado | Mensagens em português, botão de senha acessível pelo teclado |
| `docs/fase-0-LEIA-ME.md` | novo | Este arquivo |

**Dependências:** nenhuma biblioteca nova. O `package.json` não muda.

**Nenhum arquivo é apagado.** No banco, nenhuma tabela é recriada e nenhuma linha é apagada.

## Passo a passo

### Passo 0: conferir se o repositório está como esperado

1. Abra `github.com/Ayra-sw/ayra-ponto`.
2. Logo acima da lista de arquivos aparece o último commit. Ele deve ser **"Add discrete link button styles to styles.css"**.
3. Se aparecer outro commit mais recente, pare aqui e avise o Claude, para não sobrescrever nenhuma alteração feita depois.

### Passo 1: fazer um backup rápido do banco (recomendado)

1. No Supabase, abra o projeto **Ayra Ponto**.
2. Vá em **Database → Backups** e veja se há algum backup listado.
3. No plano gratuito eles podem não aparecer. Tudo bem seguir assim mesmo: a migração não apaga dados e existe o arquivo DESFAZER.

### Passo 2: rodar a migração no Supabase

1. No menu lateral do Supabase, clique em **SQL Editor** e depois em **+ New query**.
2. Abra no seu computador o arquivo `supabase/migrations/2026-09-24_fase-0_seguranca.sql` (pode abrir com o Bloco de Notas).
3. Copie **todo** o conteúdo (Ctrl+A, Ctrl+C) e cole no editor do Supabase (Ctrl+V).
4. Clique em **Run**.
5. O resultado esperado é **"Success. No rows returned"**. Avisos em amarelo com a palavra "skipping" são normais.
6. Se aparecer a mensagem "A estrutura do banco é diferente da esperada", nada foi alterado. Pare e avise o Claude.

### Passo 3: conferir

1. Em **SQL Editor**, clique em **+ New query**.
2. Cole o conteúdo de `supabase/testes/conferencia-fase-0.sql` e clique em **Run**.
3. Todas as 9 linhas devem mostrar **ok = true**. Se alguma mostrar `false`, mande um print para o Claude.

### Passo 4: enviar os arquivos para o GitHub

1. Extraia o arquivo `ayra-ponto-fase-0.zip` no seu computador (botão direito → **Extrair tudo**).
2. Abra a pasta extraída. Dentro dela há três pastas: `docs`, `src` e `supabase`.
3. No GitHub, abra `github.com/Ayra-sw/ayra-ponto`, clique em **Add file → Upload files**.
4. Selecione **as três pastas** (`docs`, `src` e `supabase`) e arraste todas juntas para a área de upload. Não arraste a pasta de fora, só as três de dentro.
5. Espere a lista de arquivos carregar. Devem aparecer 15 arquivos.
6. Em "Commit changes", escreva: `Fase 0: correções de segurança e cadastro por convite`.
7. Deixe marcado **Commit directly to the main branch** e clique em **Commit changes**.
8. A Vercel publica sozinha em cerca de 1 minuto. Você pode acompanhar em **vercel.com → ayra-ponto → Deployments** (o novo deploy deve ficar "Ready").

A ordem recomendada é banco primeiro (passo 2) e GitHub logo depois (passo 4), no mesmo dia.

### Passo 5: testar no site

1. Abra `ayra-ponto.vercel.app/qualquer-coisa`: deve aparecer **"Página não encontrada"**.
2. Entre com a sua conta de administrador: o painel deve abrir normalmente, com a equipe e as solicitações pendentes.
3. Teste o convite com um e-mail de teste. Dica: no Gmail, `pfarinea+teste1@gmail.com` chega na sua própria caixa.
   1. Na tela de entrada, clique em **Recebi um convite** e crie a conta.
   2. Confirme o e-mail e entre com essa conta.
   3. Digite o código de convite que aparece no seu painel de administrador.
   4. Você deve cair na tela de bater ponto. Registre uma entrada: a mensagem deve mostrar a hora e o **NSR**.
4. Volte para a conta de administrador: a conta de teste deve aparecer na equipe como **Colaborador**.

## Se algo der errado

- **O site não abre ou mostra erro depois do upload:** no GitHub, abra o último commit e avise o Claude com um print. Dá para voltar à versão anterior pela Vercel: em **Deployments**, clique nos três pontinhos do deploy anterior e escolha **Instant Rollback** (ou **Promote to Production**).
- **O banco precisa voltar ao estado anterior:** rode `supabase/migrations/2026-09-24_fase-0_seguranca_DESFAZER.sql` no SQL Editor, do mesmo jeito do passo 2. Isso reabre as falhas de segurança, então use só em emergência e avise o Claude.

## Como foi testado

Antes de entregar, a migração foi executada numa cópia local do banco, montada a partir da estrutura real lida em 24/09/2026:

- As falhas foram reproduzidas antes da migração: uma pessoa entrou como RH usando o código de convite, se promoveu a administrador e bateu ponto em nome de outra sem estar logada.
- 28 cenários foram conferidos depois da migração: papéis, convite, isolamento entre duas empresas, NSR, solicitações, desligados e visitantes sem login. Todos passaram.
- A migração roda duas vezes seguidas sem erro, o DESFAZER funciona e os dados existentes foram preservados.
- O app foi compilado sem erros, e as telas de entrada e de "não encontrada" foram abertas no navegador.

## Decisões pendentes (para as próximas fases, não bloqueiam esta)

1. **Como registrar uma solicitação aprovada (antes da Fase 2).** Pela Portaria 671, o AFD guarda as marcações feitas pelo trabalhador, e os ajustes do empregador entram no tratamento (espelho e AEJ). Por isso, criar uma marcação nova no AFD para cada ajuste aprovado pode não ser o correto. A proposta é manter o AFD só com as marcações reais e aplicar os ajustes aprovados no cálculo da jornada, sempre ligados ao original. Isso será confirmado com o leiaute oficial antes de programar.
2. **Encadear o código de integridade das marcações (hash).** Hoje não existe nenhuma marcação real no banco, então este é o momento mais barato para fazer cada marcação incluir o código da anterior, o que torna qualquer adulteração detectável.
