# Ayra Ponto — Ajuste da digital: mais rápida e sem aviso estranho

Pacote preparado em 10/10/2026 a partir do commit `97b33c9` ("Fase 6B: entrar com a digital").

**Pedido da Pati:** não mostrar o aviso do celular "Nenhuma chave de acesso disponível" e deixar a entrada rápida, sem burocracia.

## O que muda

- O botão **Entrar com a digital** só aparece **no celular onde a digital já foi ativada**. Em qualquer outro aparelho, a tela de entrada fica como antes (e-mail e senha), e ninguém vê mais o aviso "Nenhuma chave de acesso disponível".
- Nesse celular, **o pedido da digital abre sozinho** ao chegar na tela de entrada. É só colocar o dedo.
  - Se a pessoa cancelar, nada de mensagem de erro: ficam o botão **Entrar com a digital** e o e-mail e senha.
  - **Logo depois de "Sair da conta"**, a digital **não** abre sozinha (a pessoa pode querer entrar com outra conta). O botão continua lá.
  - No iPhone, o Safari às vezes exige um toque: aí a pessoa toca em **Entrar com a digital**.
- Se a digital daquele celular foi removida (em Minha conta), aparece uma explicação e o botão some daquele celular.
- O caminho para ativar não muda: entrar com a senha uma vez → **Ativar** no convite (ou em Minha conta).
- Artigo de ajuda **Entrar com a digital** atualizado.

## Arquivos

7 arquivos, todos **alterados**, menos este guia. **Nenhum SQL.** Nada muda no Supabase.

| Pasta | Arquivos |
|---|---|
| `docs/` | `ajuste-digital-LEIA-ME.md` (novo, este guia) |
| `src/contexts/` | `AuthContext.jsx` |
| `src/components/conta/` | `EntrarComDigital.jsx`, `OfertaDigital.jsx` |
| `src/lib/` | `digital.js`, `ajuda/artigosPessoais.js` |
| `src/pages/` | `Login.jsx` |

## Passo a passo

1. Extraia o ZIP `ayra-ponto-ajuste-digital-automatica.zip` (botão direito → **Extrair tudo** → **Extrair**).
2. **Confira que é o pacote certo:** dentro de `src` tem que existir a pasta **`contexts`**.
3. No GitHub (`github.com/Ayra-sw/ayra-ponto`), clique em **Add file** → **Upload files**.
4. Na pasta extraída há **2 pastas** (`docs` e `src`). Selecione as 2 com **Ctrl+A** e arraste para o quadro grande.
5. Devem aparecer **7 arquivos**.
6. Na **caixinha pequena de cima**, escreva: `Ajuste: digital abre sozinha`
7. Deixe a caixa grande vazia, clique em **Commit changes** e espere o **✓ verde**.

## Testar no celular

1. Abra o Ayra no celular. Se já estiver dentro, vá em **Minha conta** → **Sair da conta**.
2. A tela de entrada aparece **sem** abrir a digital sozinha (porque você acabou de sair), com o botão **Entrar com a digital** em primeiro.
3. Agora **feche o Ayra por completo** (no app instalado, feche pela lista de apps abertos; no navegador, feche a aba).
4. Abra de novo: **o celular já pede a digital sozinho**. Coloque o dedo e pronto.
5. Num celular onde a digital ainda não foi ativada, a tela de entrada mostra só e-mail e senha, sem nenhum aviso.
