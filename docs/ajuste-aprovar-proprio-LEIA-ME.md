# Ayra Ponto — Ajuste: administrador único aprova o próprio pedido

Pacote preparado em 12/10/2026 a partir do commit `f677628` ("Fase 7C: assinatura do espelho").

## O problema

Ao fechar o mês, o Ayra avisava que havia **pedidos esperando resposta**, mas em Solicitações não aparecia nada para aprovar. O pedido era **do próprio administrador**, e o Ayra não deixa ninguém aprovar o próprio pedido. Numa empresa com um administrador só, ninguém conseguia aprovar.

## O que muda (decisão sua: "Aprovar se for o único")

- Quem é a **única pessoa da gestão** na empresa (nenhum outro administrador ou RH **ativo**) pode **aprovar o próprio pedido**. Fica no Histórico de alterações como "aprovou o próprio pedido".
- Com outro administrador ou RH ativo, continua como antes: outra pessoa analisa.
- O próprio pedido não pode ser **recusado** (se não precisar mais, é só **cancelar**).
- **Solicitações:** o seu pedido aparece com o botão **Aprovar** e a frase "Como você é a única pessoa da gestão, pode aprovar".
- **Menu:** o número de Solicitações passa a contar o seu pedido quando você pode aprová-lo.
- **Fechamento do mês:** a lista "pedidos esperando resposta" agora mostra **de quem é cada pedido**, e o seu vem explicado.
- A trava do mês fechado continua: para aprovar um pedido de mês fechado, é preciso reabrir o mês.

## Arquivos do pacote

11 arquivos: 4 novos e 7 alterados. **Nenhum arquivo é apagado.**

| Pasta | Novos | Alterados |
|---|---|---|
| raiz | — | `README.md` |
| `docs/` | `ajuste-aprovar-proprio-LEIA-ME.md` (este guia) | — |
| `supabase/migrations/` | `2026-10-13_ajuste_aprovar-proprio-pedido.sql` e `…_DESFAZER.sql` | — |
| `supabase/testes/` | `conferencia-ajuste-aprovar-proprio.sql` | — |
| `src/` | — | `styles.css` |
| `src/pages/gestao/` | — | `Fechamento.jsx` |
| `src/lib/` | — | `historico.js`, `ajuda/artigosGestao.js` |
| `src/components/solicitacoes/` | — | `CentralSolicitacoes.jsx` |
| `src/components/layout/` | — | `ShellGestao.jsx` |

## Passo a passo

**Antes de tudo:** no Supabase, confira se no alto da tela está escrito **AYRA SOLUÇÕES / Ayra Ponto**.

### Passo 1: rodar a migração no Supabase

1. Extraia o ZIP: botão direito em `ayra-ponto-ajuste-aprovar-proprio-pedido.zip` → **Extrair tudo** → **Extrair**.
2. Entre em **supabase** → **migrations** e abra `2026-10-13_ajuste_aprovar-proprio-pedido.sql` (o **sem** "DESFAZER") no **Bloco de Notas**.
3. **Ctrl+A**, **Ctrl+C**.
4. No Supabase: **SQL Editor** → **+ New query** → clique no editor → **Ctrl+V** → **Run**.
5. Deve aparecer **"Success. No rows returned"**.

### Passo 2: conferir

1. **+ New query**, cole o conteúdo de `supabase/testes/conferencia-ajuste-aprovar-proprio.sql` e clique em **Run**.
2. As **3 linhas** devem mostrar **true**. Mande um print para o Claude.

### Passo 3: enviar para o GitHub

1. **Confira que é o pacote certo:** dentro de `docs` tem que existir **`ajuste-aprovar-proprio-LEIA-ME.md`**.
2. Em `github.com/Ayra-sw/ayra-ponto`: **Add file** → **Upload files**.
3. Arraste as **3 pastas** (`docs`, `src`, `supabase`) e o **README.md**. Devem aparecer **11 arquivos**.
4. Caixinha pequena de cima: `Ajuste: administrador aprova o proprio pedido`
5. Caixa grande vazia → **Commit changes** → espere o **✓ verde**.

### Passo 4: testar

1. Abra o site e aperte **Ctrl+F5**.
2. Vá em **Solicitações**: o seu pedido aparece com o botão **Aprovar**.

## Para desligar

Rode `2026-10-13_ajuste_aprovar-proprio-pedido_DESFAZER.sql`. Volta a regra de antes (ninguém aprova o próprio). Os pedidos já aprovados continuam aprovados.
