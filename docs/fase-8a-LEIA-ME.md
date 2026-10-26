# Ayra Ponto — Fase 8A: Central Ayra (a sua área de dona)

Pacote preparado em 15/10/2026 a partir do commit `4495fdc` ("Ajuste: administrador aprova o proprio pedido").

Primeira das 3 etapas da **Fase 8**. É a sua área de dona do "shopping": você vê todas as empresas clientes e cuida delas.

**Decisões suas, respeitadas:**

- a Central tem **conta separada**, com um e-mail só para ela;
- empresa suspensa: **a gestão fica bloqueada** e vê só um aviso pedindo para entrar em contato; **os funcionários continuam batendo ponto**.

(As decisões sobre o modo suporte entram na 8B.)

## O que muda

**Para você, na Central Ayra** (endereço: `ayra-ponto.vercel.app/central`):

- **Empresas:** os números de todas as empresas (quantas são, em teste, ativas, suspensas, pessoas, marcações de hoje) e a lista com situação, número de pessoas, último ponto e "cliente desde". Tem filtro por situação e busca por nome, CNPJ ou cidade.
- **Detalhe de cada empresa:**
  - números e o contato da empresa;
  - **Situação no Ayra**, com os botões **Marcar como ativa** (quando o cliente passa a pagar), **Voltar para teste**, **Suspender** (pede o motivo, que só a Central vê) e **Liberar a empresa**;
  - **Quem cuida do Ayra nesta empresa** (administradores e RH), com o e-mail, o último acesso, se o e-mail foi confirmado e o botão **Enviar link de nova senha**;
  - tudo o que a Central já fez nesta empresa.
- **Registro:** tudo o que foi feito pela Central, com data e hora.
- **Contato do suporte:** você digita o WhatsApp e o e-mail do suporte. Eles passam a aparecer na Central de ajuda de **todos os clientes** e no aviso de empresa suspensa, sem precisar mexer no código.
- **Segurança:** a Central pede a sua **senha de novo** de tempos em tempos (para ver: a cada 12 horas; para suspender, liberar ou mandar link: se a última confirmação foi há mais de 30 minutos). O banco confere isso, não só a tela.
- **Privacidade:** a Central mostra **só números**. Marcações, CPF e dados dos funcionários continuam só com cada cliente.

**Para os clientes:**

- Empresas novas aparecem para você como **"em teste"**. A sua empresa atual fica **"ativa"**.
- **Empresa suspensa:**
  - o administrador, o RH e os gestores veem só o aviso **"O acesso da gestão está suspenso"**, com os botões do WhatsApp e do e-mail do suporte;
  - eles ainda conseguem **bater o próprio ponto** (Meu ponto, Meu histórico, Meu espelho, Minha conta e Ajuda continuam abertos);
  - os **funcionários não percebem nada** e continuam batendo ponto normalmente;
  - o **motivo** da suspensão **não aparece** para o cliente.
- A conta da Central **não entra** na gestão de nenhum cliente e não cria empresa.

## Importante saber

- Para **levar ao advogado**: mesmo suspensa, a empresa continua obrigada a entregar o AFD e o AEJ se a fiscalização pedir. Hoje a tela de Arquivos fiscais fica bloqueada junto com a gestão. Se o advogado orientar, liberamos só ela.
- A Central é a única forma de mudar a situação de uma empresa. Nem o administrador do cliente consegue se "liberar" sozinho.

## Arquivos do pacote

23 arquivos: 12 novos e 11 alterados. **Nenhum arquivo é apagado.**

| Pasta | Novos | Alterados |
|---|---|---|
| raiz | — | `README.md` |
| `docs/` | `fase-8a-LEIA-ME.md` (este guia) | — |
| `supabase/migrations/` | `2026-10-15_fase-8a_central-ayra.sql` e `…_DESFAZER.sql` | — |
| `supabase/testes/` | `conferencia-fase-8a.sql` | — |
| `supabase/central/` | `tornar-dona-da-central.sql` | — |
| `src/` | — | `App.jsx`, `main.jsx`, `telas.js`, `styles.css` |
| `src/contexts/` | — | `AuthContext.jsx` |
| `src/routes/` | — | `ProtectedRoute.jsx` |
| `src/lib/` | `central.js` | `suporte.js`, `historico.js` |
| `src/pages/central/` | `CentralInicio.jsx`, `CentralEmpresa.jsx`, `CentralRegistro.jsx`, `CentralContato.jsx` | — |
| `src/components/layout/` | `ShellCentral.jsx` | `ShellGestao.jsx` |
| `src/components/gestao/` | `EmpresaSuspensa.jsx` | — |
| `src/components/ui/` | — | `Estados.jsx` |

**Dependências novas:** nenhuma. **Segredos novos:** nenhum.

## Passo a passo

**Antes de tudo:** no Supabase, confira se no alto da tela está escrito **AYRA SOLUÇÕES / Ayra Ponto**.

### Passo 1: rodar a migração

1. Extraia o ZIP: botão direito em `ayra-ponto-fase-8a-central-ayra.zip` → **Extrair tudo** → **Extrair**.
2. Abra **supabase** → **migrations** → `2026-10-15_fase-8a_central-ayra.sql` (o **sem** "DESFAZER") no **Bloco de Notas**.
3. **Ctrl+A**, **Ctrl+C**.
4. No Supabase: **SQL Editor** → **+ New query** → clique no editor → **Ctrl+V** → **Run**.
5. Deve aparecer **"Success. No rows returned"**.

### Passo 2: conferir

1. **+ New query**, cole o conteúdo de `supabase/testes/conferencia-fase-8a.sql` e clique em **Run**.
2. As **5 linhas** devem mostrar **true**. Mande um print para o Claude.

### Passo 3: criar a conta da Central

1. No Supabase, no menu da esquerda, clique em **Authentication**.
2. Clique em **Users**.
3. No canto direito, clique em **Add user** → **Create new user**.
4. Em **Email**, digite o e-mail novo da Central.
5. Em **Password**, crie uma senha forte (você mesma digita; não mande a senha para ninguém, nem para o Claude).
6. Deixe marcado **Auto Confirm User**.
7. Clique em **Create user**.

### Passo 4: ligar a conta à Central

1. Volte em **SQL Editor** → **+ New query**.
2. Abra `supabase/central/tornar-dona-da-central.sql` no Bloco de Notas, copie tudo e cole no editor.
3. No editor, troque `COLOQUE-O-EMAIL-AQUI` pelo e-mail da Central (mantenha as aspas simples).
4. Clique em **Run**.
5. Deve aparecer: **"Pronto: … agora entra na Central Ayra."**

### Passo 5: enviar para o GitHub

1. **Confira que é o pacote certo:** dentro de `src` → `pages` tem que existir a pasta **`central`**.
2. Em `github.com/Ayra-sw/ayra-ponto`: **Add file** → **Upload files**.
3. Arraste as **3 pastas** (`docs`, `src`, `supabase`) e o **README.md**. Devem aparecer **23 arquivos**.
4. Caixinha pequena de cima: `Fase 8A: Central Ayra`
5. Caixa grande vazia → **Commit changes** → espere o **✓ verde**.

### Passo 6: testar

1. Abra uma **janela anônima** no Chrome (**Ctrl+Shift+N**), para não sair da sua conta de administradora.
2. Entre em `ayra-ponto.vercel.app` com o **e-mail e a senha da Central**.
3. Vai abrir a **Central Ayra** pedindo a senha de novo. Digite e clique em **Confirmar**.
4. Você vê a sua empresa como **Ativa**.
5. Clique em **Contato do suporte**, preencha o WhatsApp e o e-mail do suporte e clique em **Salvar contato**.

## Se algo der errado

- **Entrei com a conta da Central e caiu na tela de criar empresa:** o Passo 4 não foi rodado (ou o e-mail estava diferente). Rode de novo.
- **O Passo 4 disse "já é de uma empresa":** esse e-mail é de uma conta que já tem empresa. Use um e-mail novo.
- **A Central fica pedindo a senha:** é normal de tempos em tempos. Se pedir toda hora, me avise.
- **Para desligar:** rode `2026-10-15_fase-8a_central-ayra_DESFAZER.sql`. A Central para de funcionar e nenhuma empresa fica suspensa. Nada é apagado.

## Próximas etapas

- **8B: Acesso do suporte:** o cliente libera por 1, 3 ou 7 dias; você entra pela Central, vê tudo e ajusta cadastros, sem nunca bater ponto, aprovar pedido, fechar mês ou assinar pelo cliente.
- **8C: Empresa de demonstração**, com botão "Restaurar".
