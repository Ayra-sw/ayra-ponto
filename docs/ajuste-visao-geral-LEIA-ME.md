# Ayra Ponto — Ajuste: apresentação da marca na Visão geral

Pacote preparado em 05/10/2026 a partir do commit `06c0206` ("Fase 5C: comprovante por e-mail").

## O que muda

- **Onde:** no alto da tela **Visão geral**, para o **administrador** e o **RH**, aparece uma faixa com a marca:
  - o emblema do relógio (azul-escuro e dourado);
  - **AYRA SOLUÇÕES**, em letras grandes e espaçadas;
  - o slogan "Pessoas, tempo e gestão em perfeita sintonia.";
  - um desenho discreto à direita (anéis de relógio e pontos ligados), que some no celular para não atrapalhar a leitura.
- **Fica tudo como estava:**
  - o título "Visão geral" no alto;
  - o item "Visão geral" no menu lateral;
  - "Hoje", os avisos, os 4 indicadores e "Equipe agora".
- **A faixa é baixa** (cerca de 120 px). No computador, os indicadores continuam aparecendo sem rolar a tela.
- **Funciona nos temas claro e escuro**, no computador, no tablet e no celular.
- **O colaborador não vê nada de diferente.**
- **Não muda:** banco, login, permissões, menu e cores.

Para trocar o nome ou o slogan no futuro: são as duas primeiras linhas de `src/components/gestao/ApresentacaoMarca.jsx`.

## Arquivos do pacote

4 arquivos: 2 novos e 2 alterados. **Não tem SQL.**

| Pasta | Novos | Alterados |
|---|---|---|
| `docs/` | `ajuste-visao-geral-LEIA-ME.md` (este guia) | — |
| `src/components/gestao/` (pasta nova) | `ApresentacaoMarca.jsx` | — |
| `src/pages/` | — | `GestaoDashboard.jsx` |
| `src/` | — | `styles.css` |

## Passo a passo

1. Extraia o ZIP: clique com o botão direito em `ayra-ponto-ajuste-visao-geral.zip` e escolha **Extrair tudo** → **Extrair**.
2. Abra `github.com/Ayra-sw/ayra-ponto` e clique em **Add file** → **Upload files**.
3. Na pasta extraída há **2 pastas** (`docs` e `src`). Selecione as 2 com **Ctrl+A** e arraste para o quadro grande.
4. Devem aparecer **4 arquivos**.
5. Na caixinha pequena de cima, escreva: `Ajuste: apresentação da marca na Visão geral`
6. Deixe a caixa grande vazia e clique em **Commit changes**. Espere o **✓ verde**.
7. Espere 1 ou 2 minutos, abra `ayra-ponto.vercel.app`, aperte **Ctrl+F5** e entre como administradora.

## Como foi testado

- **21 verificações novas passaram**, entre elas:
  - a faixa aparece para o administrador e o RH;
  - o título, o menu, os indicadores e "Equipe agora" continuam lá;
  - os indicadores aparecem sem rolar a tela;
  - temas claro e escuro, tablet e celular, sem rolagem lateral;
  - acessibilidade;
  - a colaboradora e as outras telas não mudam.
- **As verificações das fases 2C a 5C continuam passando.**
- **Na 2B**, as mesmas 4 verificações que dependem da data falham também na versão que está no ar hoje. Ou seja, não são efeito deste ajuste.
