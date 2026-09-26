# Ayra Ponto — Ajuste 1.5a: a selfie sempre é guardada

Pacote preparado em 25/09/2026 a partir do commit `50771a2` ("Fase 1.5: ponto com reconhecimento facial e corrente de integridade").

## O problema

No primeiro teste real, a marcação do intervalo ficou **sem foto**. A conferência no banco mostrou que nenhuma foto chegou a ser enviada. O motivo é que a foto só era tirada quando o reconhecimento automático conseguia enquadrar o rosto. Se isso não acontecia (câmera do computador longe, pouca luz, reconhecimento ainda carregando ou sem carregar), a única saída era "Registrar sem foto", e a selfie se perdia.

## O que muda

- **Botão "Tirar foto agora":** aparece poucos segundos depois de a câmera abrir. A pessoa pode tirar a foto na hora, sem esperar o enquadramento automático. A foto automática continua funcionando como antes.
- **A câmera abre mesmo se o reconhecimento não carregar.** Nesse caso, a foto é tirada pelo botão **"Tirar foto"** e guardada como prova. O RH confere depois.
- **Se o reconhecimento demorar mais de 45 segundos** para carregar (internet muito lenta), a câmera passa para o modo de foto manual, em vez de ficar parada em "Preparando…".
- **Motivos mais claros** quando a marcação fica sem foto:
  - "A pessoa escolheu registrar sem foto";
  - "O reconhecimento não carregou no aparelho".
- **Cadastro do rosto:** a foto manual só é aceita se tiver um rosto legível. Senão aparece o aviso "Não encontramos um rosto nessa foto".
- **Tela Reconhecimento facial:** quando a foto de cadastro da pessoa ainda está aguardando aprovação, ela já aparece ao lado da marcação, com a legenda "Cadastro (aguardando)".

## Arquivos do pacote

9 arquivos: 2 novos e 7 alterados.

| Arquivo | O que é |
|---|---|
| `supabase/migrations/2026-09-25_fase-1-5a_ajuste-foto.sql` | **novo**: aceita os 2 motivos novos (só troca a função `registrar_ponto_facial`) |
| `docs/fase-1-5a-LEIA-ME.md` | **novo**: este guia |
| `supabase/migrations/2026-09-25_fase-1-5_reconhecimento-facial.sql` | alterado para já conter o ajuste, para quem rodar a Fase 1.5 do zero. **Não rode de novo.** |
| `src/components/rosto/CameraRosto.jsx` | câmera independente do reconhecimento e botão de foto manual |
| `src/components/rosto/CadastroRosto.jsx` | exige rosto legível na foto de cadastro |
| `src/components/rosto/PontoFacial.jsx` | compara só quando existe leitura do rosto |
| `src/lib/rosto.js` | limite de 45 s e teste real dos modelos ao carregar |
| `src/lib/rotulos.js` | textos dos motivos novos |
| `src/pages/gestao/Reconhecimento.jsx` | foto de cadastro aguardando ao lado da marcação |

Nenhuma dependência nova.

## Passo a passo

1. **Supabase:** rode `supabase/migrations/2026-09-25_fase-1-5a_ajuste-foto.sql` no SQL Editor (+ New query → colar → Run). Deve aparecer **"Success. No rows returned"**.
2. **GitHub:** Add file → Upload files. Arraste as **3 pastas** (`docs`, `src`, `supabase`). Devem aparecer **9 arquivos**. Título: `Ajuste 1.5a: a selfie sempre é guardada`. Depois clique em Commit changes.
3. **Testar:** espere o ✓ verde e registre o ponto. Se a foto automática não acontecer em alguns segundos, toque em **"Tirar foto agora"**.

## Como foi testado

- **Banco:** os 69 cenários da Fase 1.5 passaram de novo com o ajuste aplicado, e os 2 motivos novos ficam gravados. O ajuste rodou 2 vezes sem erro.
- **Telas**, na versão montada igual à da Vercel, com câmera simulada:
  - foto automática normal;
  - reconhecimento bloqueado, com foto manual guardada;
  - rosto pequeno/longe, com foto manual guardada;
  - cadastro sem reconhecimento, que recusa a foto sem rosto legível;
  - fluxo completo de novo: cadastro, aprovação, mesma pessoa com 72% (reconhecido), outra pessoa com 28% (a conferir), contestação.
