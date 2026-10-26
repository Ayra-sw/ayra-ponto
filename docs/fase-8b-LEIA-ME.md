# Fase 8B: suporte autorizado (Ayra Ponto)

Esta fase deixa a equipe da Ayra ajudar a ajustar os cadastros da sua empresa, mas só quando a própria empresa liberar, por um prazo que ela escolhe.

Resumo do que muda:

- O administrador libera o suporte por 1, 3 ou 7 dias, em **Configurações → Suporte da Ayra**. Ele confirma a identidade com a digital ou a senha.
- A equipe da Ayra entra pela Central e vê e ajusta cadastros (pessoas, unidades, departamentos, cargos, jornadas, escalas, feriados, regras e dados da empresa).
- O suporte **não** bate ponto, **não** aprova nem recusa pedidos, **não** fecha nem reabre o mês, **não** assina nada e **não** muda o tipo de acesso das pessoas. Isso é barrado no banco, não só na tela.
- Tudo o que o suporte faz aparece no Histórico de alterações como **Suporte Ayra**. A própria empresa vê o histórico de liberações e entradas na tela Suporte da Ayra.
- O administrador pode encerrar quando quiser. O acesso também acaba sozinho quando o prazo passa.
- Se a empresa estiver suspensa, o suporte não entra.

Nenhuma marcação, pedido ou cálculo muda. Não há segredo novo, nem Edge Function nova, nem dependência nova.

## Passo 1: baixar e extrair o pacote

1. Baixe o arquivo `ayra-ponto-fase-8b-suporte.zip`.
2. Clique com o botão direito nele e escolha **Extrair tudo**. Você vai ficar com uma pasta com o mesmo nome.

## Passo 2: rodar a migração no Supabase

1. Entre no site do Supabase e confira, no alto da tela, se o projeto é **Ayra Ponto** (organização **AYRA SOLUÇÕES**). Não é o projeto **Atlas Comercial**.
2. No menu da esquerda, clique em **SQL Editor**.
3. Clique em **+ New query** (ou **New query**).
4. Abra, no Bloco de Notas, o arquivo `supabase/migrations/2026-10-26_fase-8b_suporte-autorizado.sql` da pasta extraída. Selecione tudo (Ctrl+A), copie (Ctrl+C) e cole no SQL Editor (Ctrl+V).
5. Clique em **Run**. Deve aparecer **Success**. Se aparecer erro, pare e me mande a mensagem.

Se você precisar desfazer esta fase, rode o arquivo `..._DESFAZER.sql` do mesmo jeito. Os dados ficam guardados.

## Passo 3: conferir

1. Em **SQL Editor**, clique em **+ New query**.
2. Abra `supabase/testes/conferencia-fase-8b.sql`, copie tudo e cole no SQL Editor.
3. Clique em **Run**. Devem aparecer **6 linhas**, todas com **true** na última coluna.

## Passo 4: subir os arquivos no GitHub

1. Entre em `github.com/Ayra-sw/ayra-ponto`.
2. Clique em **Add file** e depois em **Upload files**.
3. Arraste para a área de envio **as pastas e arquivos** da pasta extraída, mantendo a estrutura (`src`, `supabase`, `docs`). Os arquivos desta fase são:
   - novos: `supabase/migrations/2026-10-26_fase-8b_suporte-autorizado.sql`, `supabase/migrations/2026-10-26_fase-8b_suporte-autorizado_DESFAZER.sql`, `supabase/testes/conferencia-fase-8b.sql`, `src/components/conferencia/ConfirmarIdentidade.jsx`, `src/components/suporte/FaixaSuporte.jsx`, `src/pages/gestao/SuporteAyra.jsx`, `docs/fase-8b-LEIA-ME.md`;
   - alterados (substituem os atuais): `src/App.jsx`, `src/telas.js`, `src/contexts/AuthContext.jsx`, `src/routes/ProtectedRoute.jsx`, `src/components/layout/ShellCentral.jsx`, `src/components/layout/ShellGestao.jsx`, `src/pages/central/CentralEmpresa.jsx`, `src/styles.css`, `src/lib/ajuda/artigosGestao.js`.
4. No campo de mensagem do commit, escreva: **Fase 8B: suporte autorizado**.
5. Clique em **Commit changes**.

Espere alguns minutos. A Vercel publica o site sozinha depois do commit.

## Passo 5: testar como administradora da empresa

Use uma janela anônima do navegador (ou o celular), para não misturar com a sua conta da Central.

1. Entre com a conta de administrador de uma empresa de teste.
2. Vá em **Configurações → Suporte da Ayra**.
3. Clique em **1 dia**. A janela **Confirme que é você** pede a senha (ou a digital). Digite e clique em **Confirmar**.
4. A tela deve mostrar **Liberado até…** e o botão **Encerrar agora**. No histórico aparece a sua liberação.

## Passo 6: testar como a Central

1. Entre na Central com a sua conta da Central.
2. Clique na empresa de teste. Na seção **Suporte da empresa** deve aparecer **Liberado até…** e o botão **Entrar como suporte**.
3. Clique no botão. Você cai na gestão da empresa e, no alto, aparece a faixa **Modo suporte: nome da empresa**. Some o menu de Solicitações, Fechamento do mês, Reconhecimento facial e Meu ponto.
4. Faça uma mudança de teste num cadastro (por exemplo, o nome de um departamento). Depois abra **Histórico de alterações** e confira que aparece **Suporte Ayra**.
5. Clique em **Sair do modo suporte**. Você volta para a Central.
6. Entre de novo como administradora e clique em **Encerrar agora**. Na Central, o botão **Entrar como suporte** deixa de funcionar.

Se algo não bater com o que está escrito aqui, me conte o que apareceu na tela.
