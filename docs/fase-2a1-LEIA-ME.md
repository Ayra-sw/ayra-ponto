# Ayra Ponto — Ajuste 2A.1: a lista de colaboradores com uma pessoa só

Pacote preparado em 28/09/2026 a partir do commit `d238d6d` (Fase 2A).

## O problema

Quando a empresa tem só uma pessoa (o administrador), a tela **Colaboradores** mostrava apenas o aviso "Você ainda é a única pessoa por aqui" e escondia a lista. Assim não havia como abrir a própria ficha.

## O que muda

- Com uma pessoa só, a lista aparece normalmente, com um aviso explicando que dá para clicar no nome para abrir a ficha.
- O texto "1 pessoas na empresa" passa a ser "1 pessoa na empresa".
- A tela vazia só aparece se realmente não houver ninguém.

## Arquivos do pacote

2 arquivos: 1 novo e 1 alterado. Nenhuma migração no banco e nenhuma dependência nova.

| Arquivo | O que é |
|---|---|
| `src/pages/gestao/Pessoas.jsx` | alterado |
| `docs/fase-2a1-LEIA-ME.md` | novo (este guia) |

## Passo a passo

1. Extraia o ZIP (botão direito → **Extrair tudo…** → **Extrair**). Você verá as pastas `docs` e `src`.
2. No GitHub (`github.com/Ayra-sw/ayra-ponto`), clique em **Add file** → **Upload files**.
3. Selecione as **2 pastas** (`docs` e `src`) com **Ctrl + A** e arraste para o quadro. Devem aparecer **2 arquivos**.
4. Na caixinha pequena de cima, escreva: `Ajuste 2A.1: lista de colaboradores com uma pessoa só`
5. Deixe a caixa grande vazia, deixe marcado "Commit directly to the main branch" e clique em **Commit changes**.
6. Espere o ✓ verde (cerca de 2 minutos) e aperte **Ctrl + F5** no site.
