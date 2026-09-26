# Ayra Ponto — Fase 1.5: ponto com reconhecimento facial

Pacote preparado em 25/09/2026 a partir do commit `bbbe581` ("Ajuste: painel lateral com barra de rolagem").

Esta etapa entra antes da Fase 2, a pedido da Pati: bater o ponto com o rosto é a ideia central de um app de ponto no celular. Ela também traz a **corrente de integridade** das marcações (o item M2 da auditoria).

## Decisões aprovadas pela Pati (25/09/2026)

- **Nível escolhido:** reconhecimento feito no próprio celular, com a estrutura pronta para ligar um serviço profissional com prova de vida antes da venda.
- **Se o rosto não for reconhecido:** o ponto é registrado mesmo assim e vai para o RH conferir. O reconhecimento **nunca impede** ninguém de bater o ponto (Portaria 671).
- **Corrente de integridade:** sim, encadear as marcações a partir de agora.

## O que muda para quem usa

**Administrador**
- Em **Configurações → Empresa**, um cartão novo, **"Ponto com reconhecimento facial"**, com o botão para ligar e desligar. Ele começa **desligado**.
- ⚠️ Se o CNPJ gravado da empresa for inválido, o botão fica bloqueado até o CNPJ ser corrigido e salvo. O banco não deixa salvar nenhuma alteração na empresa enquanto o CNPJ antigo estiver inválido.

**Colaborador (e também o administrador e o RH, que batem ponto)**
- **Primeiro uso:** aparece um **aviso de privacidade** explicando o que é guardado, para quê, quem vê e por quanto tempo. A pessoa toca em **"Li e concordo"**. Se não quiser, pode **"Registrar sem foto"**: o ponto é registrado e o RH confere.
- **Cadastro do rosto** em **Minha conta → Reconhecimento facial → Cadastrar meu rosto**. A câmera abre, guia a pessoa ("aproxime", "olhe de frente", "pisque os olhos") e tira a foto sozinha. A pessoa confere a foto e toca em **"Usar esta foto"**. A foto fica **aguardando aprovação**.
- **Ao registrar o ponto**, o botão principal abre a câmera. A foto é tirada sozinha, comparada com a foto de cadastro e o ponto é registrado. Leva poucos segundos (na primeira vez um pouco mais, porque o aparelho baixa o reconhecimento).
- No **comprovante** aparece a linha **"Reconhecimento facial"**: *Rosto reconhecido* ou *A conferir pelo RH*.
- Nas **Marcações de hoje**, cada marcação mostra a mesma etiqueta.
- **Sem câmera, câmera bloqueada ou rosto não encontrado:** aparece o botão **"Registrar sem foto"**, e a marcação fica para o RH conferir.

**Administrador e RH (gestão)**
- Item novo no menu: **Reconhecimento facial**, com um contador de pendências. Tem duas abas:
  - **Fotos para aprovar:** a foto nova (e a atual, quando é uma troca), com **Aprovar** e **Recusar**. Para recusar é preciso escrever o motivo, com sugestões prontas ("Foto escura", "Não é a pessoa"…). A pessoa vê o motivo em Minha conta.
  - **Marcações a conferir:** a selfie da marcação ao lado da foto de cadastro, o resultado, a semelhança (%), se parece um rosto real e se a pessoa piscou. Botões **"Era a pessoa"** e **"Não era"**. Contestar exige uma explicação, e a marcação **nunca é apagada** (a lei não permite): ela fica registrada como contestada.
- **Integridade das marcações** (no fim da mesma tela): o botão **"Conferir agora"** verifica se alguma marcação foi alterada ou apagada direto no banco.
- Na tela **Hoje** aparecem avisos quando há fotos para aprovar ou marcações para conferir.
- **Quem analisa o quê:** ninguém aprova a própria foto nem confere a própria marcação, exceto o administrador. O RH não analisa fotos nem marcações de um administrador.

## Como funciona por dentro

- **Biblioteca:** `@vladmandic/human` 3.3.6 (gratuita, licença MIT). Roda dentro do navegador do celular e é baixada **só quando a câmera abre**, para não deixar o resto do site mais lento. Os modelos (cerca de 10 MB, uma vez por aparelho) vêm do jsDelivr.
- **O que é comparado:** a foto vira um "código numérico" do rosto (1024 números). A semelhança entre o código da selfie e o da foto de cadastro vai de 0% a 100%. **A partir de 50%**, o rosto é considerado reconhecido (padrão da biblioteca). O banco confere esse limite de novo, e a comparação só vale contra a foto **aprovada**.
- **Selfies:** ficam no armazenamento privado **"rostos"** do Supabase, numa pasta por empresa e por pessoa. Só a própria pessoa, o RH e os administradores da empresa conseguem ver. Ninguém consegue alterar ou apagar uma selfie pelo app, porque ela é a prova da marcação.
- **Limitação conhecida:** como a comparação acontece no celular, alguém com conhecimento técnico conseguiria enganá-la (com uma foto impressa, por exemplo, ou mexendo no navegador). Por isso toda selfie fica guardada e o RH sempre pode conferir. **Antes de começar a vender**, a troca por um serviço profissional com prova de vida acontece em dois lugares só: `src/lib/rosto.js` e a função `registrar_ponto_facial` do banco.

## Corrente de integridade (M2)

- Cada marcação nova guarda o **código da marcação anterior da mesma unidade** e o **código da selfie**. O código de integridade de cada marcação é calculado com esses dados.
- Se alguém alterar ou apagar uma marcação direto no banco, a corrente quebra dali para frente, e o botão **"Conferir agora"** mostra onde.
- As marcações antigas (feitas antes desta fase) continuam como estão: são o começo da corrente.
- A regra do cálculo está na função `texto_hash_marcacao`, e qualquer pessoa consegue recalcular.

## Arquivos do pacote

26 arquivos: 15 novos e 11 alterados. **Nenhum arquivo é apagado.**

| Pasta | Novos | Alterados |
|---|---|---|
| raiz | — | `package.json` (biblioteca de reconhecimento facial) |
| `src/` | — | `App.jsx` (rota nova), `styles.css` (câmera, fotos, abas) |
| `src/components/rosto/` | `AvisoBiometria`, `CadastroRosto`, `CameraRosto`, `EtiquetaVerificacao`, `FotoRosto`, `MeuRosto`, `PontoFacial` | — |
| `src/components/ponto/` | — | `RegistrarPonto` (abre a câmera), `Comprovante` (linha do reconhecimento) |
| `src/components/layout/` | — | `ShellGestao` (item de menu e contador) |
| `src/hooks/` | `useRosto` | — |
| `src/lib/` | `rosto`, `localizacao` | `mensagensErro`, `rotulos` |
| `src/pages/` | — | `MinhaConta` (seção do rosto), `GestaoDashboard` (avisos) |
| `src/pages/gestao/` | `Reconhecimento` | `Empresa` (botão de ligar) |
| `supabase/migrations/` | `2026-09-25_fase-1-5_reconhecimento-facial.sql` e `…_DESFAZER.sql` | — |
| `supabase/testes/` | `conferencia-fase-1-5.sql` | — |
| `docs/` | `fase-1-5-LEIA-ME.md` (este arquivo) | — |

**Dependência nova** (a Vercel instala sozinha): `@vladmandic/human` 3.3.6.

## Mudanças no banco (migração da Fase 1.5)

Tudo é acrescentado. Nenhuma tabela é recriada e nenhum dado é apagado.

- **`empresas`:** campo novo `reconhecimento_facial` (começa desligado).
- **`registros_ponto`:** campos novos `hash_anterior`, `hash_evidencia` e `versao_hash`. As marcações antigas não são alteradas.
- **Tabelas novas:**
  - `consentimentos_biometria`: quem aceitou o aviso, qual versão e quando;
  - `rostos_referencia`: fotos de cadastro e aprovações;
  - `verificacoes_faciais`: o resultado de cada marcação e a conferência do RH.
- **Armazenamento:** o bucket privado `rostos` (só JPG, até 1 MB por foto), com 4 regras de acesso.
- **Funções novas:** `registrar_ponto_facial`, `aceitar_aviso_biometria`, `enviar_rosto_referencia`, `analisar_rosto_referencia`, `conferir_verificacao_facial` e `verificar_cadeia_integridade`. Funções internas: `registrar_marcacao_interna`, `foto_rosto_valida` e `texto_hash_marcacao`.
- **`registrar_ponto`** continua com a mesma assinatura. Agora ela encadeia a marcação e, se a empresa usa reconhecimento facial, deixa a marcação "a conferir" (sem foto).

## Passo a passo

### Passo 0: conferir o GitHub

Eu já conferi: o último envio é o `bbbe581` (ajuste do painel lateral). Se você fizer algum envio antes de aplicar este pacote, me avise primeiro.

### Passo 1: rodar a migração no Supabase

1. No seu computador, clique com o botão direito em `ayra-ponto-fase-1-5.zip` e escolha **Extrair tudo** → **Extrair**.
2. Na pasta que abriu (a **pasta amarela comum**, não o ZIP), entre em **supabase** e depois em **migrations**.
3. Clique com o botão direito em `2026-09-25_fase-1-5_reconhecimento-facial.sql` (o que **não** tem "DESFAZER" no nome). Escolha **Abrir com** → **Bloco de Notas**.
4. Aperte **Ctrl+A** e depois **Ctrl+C**.
5. No Supabase, abra o projeto, clique em **SQL Editor** e depois em **+ New query**.
6. Clique no editor em branco e aperte **Ctrl+V**.
7. Clique em **Run**. Se aparecer um aviso de operação "destrutiva", pode confirmar: a migração só acrescenta.
8. Deve aparecer **"Success. No rows returned"**.

### Passo 2: conferir

1. No SQL Editor, clique em **+ New query**.
2. Abra `supabase/testes/conferencia-fase-1-5.sql` no Bloco de Notas, copie tudo e cole.
3. Clique em **Run**.
4. As **10 linhas** devem mostrar **true** na coluna **ok** (role a tabelinha para ver todas). Mande um print para o Claude.

### Passo 3: enviar para o GitHub

1. Abra `github.com/Ayra-sw/ayra-ponto`, clique em **Add file** → **Upload files**.
2. Na pasta extraída você vai ver **3 pastas** (`docs`, `src`, `supabase`) e **1 arquivo** (`package.json`).
3. Clique num espaço vazio da pasta, aperte **Ctrl+A** e arraste os 4 itens para o quadro do GitHub.
4. Espere a lista carregar. Devem aparecer **26 arquivos**.
5. No título, escreva: `Fase 1.5: ponto com reconhecimento facial e corrente de integridade`
6. Deixe marcado **"Commit directly to the main branch"** e clique em **Commit changes**.
7. Espere uns 3 minutos, até a bolinha virar ✓ verde.

### Passo 4: testar

1. Abra `ayra-ponto.vercel.app` **no celular** e entre com a sua conta.
2. Vá em **Empresa** (menu ☰) e confira se o CNPJ está válido e salvo. Depois toque em **"Ligar reconhecimento facial"** → **Ligar**.
3. Vá em **Minha conta** → **Cadastrar meu rosto**. Leia o aviso, toque em **Li e concordo** e permita a câmera quando o celular perguntar.
4. Siga as instruções da tela até a foto ser tirada, e toque em **Usar esta foto**.
5. Vá em **Reconhecimento facial** → **Fotos para aprovar** e aprove a sua foto (o administrador pode aprovar a própria).
6. Toque em **Registrar ponto**. A câmera abre, a foto é tirada sozinha e o comprovante deve mostrar **"Rosto reconhecido"**.
7. Para testar o outro caminho, peça para outra pessoa bater o ponto na sua conta (ou cubra metade do rosto). O ponto é registrado e aparece em **Reconhecimento facial → Marcações a conferir**.
8. No fim da tela **Reconhecimento facial**, toque em **Conferir agora**: deve aparecer **"Tudo certo"**.

## Se algo der errado

- **A câmera não abre:** o navegador precisa de permissão. No celular, toque no cadeado ao lado do endereço do site e permita a **Câmera**. Mesmo sem câmera, o botão **"Registrar sem foto"** sempre funciona.
- **O site não abre depois do envio:** na Vercel, vá em **Deployments**, três pontinhos no deploy anterior → **Instant Rollback**. Depois me avise com um print.
- **Precisa voltar o banco:** rode `2026-09-25_fase-1-5_reconhecimento-facial_DESFAZER.sql` do mesmo jeito do passo 1. **Atenção:** ele apaga as fotos de cadastro aprovadas, os aceites do aviso e as verificações (as marcações de ponto continuam). Só use se o Claude pedir.

## Como foi testado

- **Banco:** numa cópia local da estrutura real (Fases 0 e 1 aplicadas, com 1 empresa de CNPJ antigo inválido, 1 unidade e 1 marcação, como no Supabase):
  - **69 cenários** passaram, entre eles: interruptor só do administrador; CNPJ inválido bloqueando alterações; marcação sem câmera ficando a conferir; aviso de privacidade obrigatório para cadastrar o rosto; fotos só na pasta da própria pessoa e da própria empresa; ninguém apaga selfie; aprovação e conferência com as regras de quem pode o quê; rosto reconhecido, não reconhecido, foto inexistente, foto de outra pessoa e comparação com foto não aprovada; outra empresa sem ver nada; funções internas fechadas; visitante sem login bloqueado;
  - **corrente de integridade:** cálculo recalculável, adulteração de uma marcação detectada e marcação apagada detectada;
  - a migração rodou duas vezes sem erro, o DESFAZER funcionou, e a migração rodou de novo depois do DESFAZER;
  - as conferências das Fases 0 e 1 continuaram todas `true`.
- **Reconhecimento facial:** com fotos reais de duas pessoas diferentes num navegador:
  - mesma pessoa, fotos diferentes: 79% de semelhança;
  - pessoas diferentes: 38% e 39%.
- **Fluxo completo nas telas**, com câmera simulada e Supabase simulado, em celular e computador, tema claro e escuro:
  - ligar o reconhecimento; aviso; cadastro do rosto com foto automática; aprovação;
  - ponto com o mesmo rosto (72%, reconhecido);
  - ponto com outro rosto (28%, a conferir);
  - contestação com motivo; conferência da corrente;
  - aparelho sem câmera registrando sem foto;
  - nenhum erro de JavaScript.
- **Build limpo** simulando a Vercel (instalação do zero).

## Pendências antes da venda

- **Advogado:** validar o texto do aviso de privacidade e definir por quanto tempo guardar as selfies (hoje ficam guardadas sem prazo de exclusão automática).
- **Serviço profissional com prova de vida:** trocar a comparação no celular por um serviço que detecta foto ou vídeo falso.
- **Leiaute oficial do AFD:** confirmar como a corrente e a evidência facial entram nos arquivos legais (Fase 5).
