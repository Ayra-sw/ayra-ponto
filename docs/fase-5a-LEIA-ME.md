# Ayra Ponto — Fase 5A: arquivos oficiais AFD e AEJ

Pacote preparado em 04/10/2026 a partir do commit `090aac5` ("Fase 4B: app instalável, desempenho e acessibilidade").

A Fase 5 (conformidade com a Portaria 671) ficou assim:

- **Fase 5A (este pacote):** os arquivos oficiais **AFD** e **AEJ**.
- **Fase 5B (a próxima):** a assinatura digital ICP-Brasil dos arquivos, do comprovante e do espelho de ponto.

**Decisões suas, respeitadas:**

- o AFD registra também os cadastros da empresa, das unidades e das pessoas, **na mesma numeração (NSR) das marcações**, de agora em diante;
- só o **administrador e o RH** baixam os arquivos;
- o número do **INPI** e os dados da empresa desenvolvedora ficam **preparados para preencher depois**.

## O que muda para quem usa

No menu **Gestão** aparece **Arquivos fiscais**, com dois cartões.

| Arquivo | O que tem | Período |
|---|---|---|
| **AFD** (Arquivo Fonte de Dados) | Todas as marcações **exatamente como foram feitas**, em ordem de NSR, cada uma com o seu código de integridade (SHA-256, que liga cada marcação à anterior). Traz também os cadastros da empresa e das pessoas no ponto. **Ajustes aprovados não mudam o AFD**, como combinamos na Decisão A. | até 1 ano por arquivo |
| **AEJ** (Arquivo Eletrônico de Jornada) | A jornada **já tratada**: horários contratuais, marcações (a original corrigida aparece como "desconsiderada" e a nova como "incluída", com o motivo do pedido), faltas e movimentos do banco de horas. | até 3 meses, até hoje |

Para baixar: escolha a unidade (se houver mais de uma) e o período, e clique em **Baixar AFD** ou **Baixar AEJ**. Os arquivos saem em texto, no formato oficial (ISO-8859-1, uma linha por registro).

Na tela aparecem dois avisos, que vão sumindo conforme as próximas etapas ficam prontas:

- **Dados do Ayra Ponto em conclusão.** O número do INPI e os dados da empresa desenvolvedora ainda não existem. Até lá, esses campos saem zerados ou em branco.
- **Assinatura digital.** O arquivo .p7s chega na Fase 5B.

Também há um artigo novo na ajuda, **Arquivos fiscais: AFD e AEJ**, e o botão **Como funciona** na tela.

### Uma correção que veio junto

Desde a Fase 3C, cada marcação de ponto deixava no **Histórico de alterações** uma linha técnica: "alterou a unidade", por causa do contador de NSR. Essas linhas **param de ser criadas** e as que já existem **somem da tela**. O histórico fica só com mudanças de verdade.

## Arquivos do pacote

15 arquivos: 6 novos e 9 alterados. **Nenhum arquivo é apagado.**

| Pasta | Novos | Alterados |
|---|---|---|
| raiz | — | `README.md` |
| `docs/` | `fase-5a-LEIA-ME.md` (este guia) | — |
| `supabase/migrations/` | `2026-10-05_fase-5a_afd-aej.sql` e `…_DESFAZER.sql` | — |
| `supabase/testes/` | `conferencia-fase-5a.sql` | — |
| `src/` | — | `App.jsx` (rota nova), `telas.js`, `styles.css` |
| `src/pages/gestao/` | `ArquivosFiscais.jsx` | — |
| `src/lib/` | `arquivosFiscais.js` | `historico.js`, `mensagensErro.js`, `ajuda/artigosGestao.js` |
| `src/components/` | — | `layout/ShellGestao.jsx` (menu), `historico/ListaHistorico.jsx` |

**Dependências novas:** nenhuma.

## Mudanças no banco (migração da Fase 5A)

**Nenhuma marcação é alterada.** O NSR e o horário de cada uma continuam os mesmos.

- **Tabela nova `afd_registros`:** cada linha do AFD fica gravada **no momento em que o fato acontece** e nunca mais muda. Ninguém altera nem apaga, nem o administrador, nem o dono do banco.
  - **Marcação:** a linha nasce junto com a marcação, com o código SHA-256 ligado à marcação anterior.
  - **Empresa e unidade:** quando a razão social, o CNPJ, o nome ou o endereço mudam, é gravado um registro novo (tipo 2) em cada unidade.
  - **Pessoas:** são gravadas a entrada na unidade (inclusão), a mudança de nome ou CPF (alteração) e o desligamento ou a saída da unidade (exclusão), nos registros tipo 5.
  - Esses cadastros usam **a mesma sequência de NSR das marcações**, como o leiaute pede.
- **Na instalação:**
  - as marcações antigas ganham a sua linha, na ordem do NSR;
  - cada unidade e cada pessoa ativa recebem um registro da situação de hoje, com os próximos NSR.
- **Tabela nova `ayra_sistema`:** guarda o número do INPI e os dados da empresa desenvolvedora (Ayra Soluções). Só a equipe do Ayra preenche, pelo SQL Editor. Quando você tiver os dados, eu te passo o SQL pronto.
- **Funções novas `gerar_afd` e `gerar_aej`:** só administrador e RH, e só da própria empresa.
- **Conferência da corrente** (o botão **Conferir agora**, em Reconhecimento facial): passa a entender os NSR dos cadastros, sem acusar "sequência interrompida".

## Passo a passo

**Antes de tudo:** no Supabase, confira se no alto da tela está escrito **AYRA SOLUÇÕES / Ayra Ponto**.

### Passo 0: conferir o GitHub

Eu já conferi: o último envio é o `090aac5`. Se você fizer algum envio antes de aplicar este pacote, me avise primeiro.

### Passo 1: rodar a migração no Supabase

1. Extraia o ZIP: clique com o botão direito em `ayra-ponto-fase-5a.zip` e escolha **Extrair tudo** → **Extrair**.
2. Entre em **supabase** → **migrations** e abra `2026-10-05_fase-5a_afd-aej.sql` (o arquivo **sem** "DESFAZER" no nome) no **Bloco de Notas**.
3. Aperte **Ctrl+A** e depois **Ctrl+C**.
4. No Supabase, clique em **SQL Editor** e depois em **+ New query**.
5. Clique no editor e aperte **Ctrl+V**.
6. Clique em **Run**.
7. Deve aparecer **"Success. No rows returned"**.

### Passo 2: conferir

1. No SQL Editor, clique em **+ New query**.
2. Abra `supabase/testes/conferencia-fase-5a.sql` no Bloco de Notas, copie tudo, cole no editor e clique em **Run**.
3. As **6 linhas** devem mostrar **true**. Mande um print para o Claude.

### Passo 3: enviar para o GitHub

1. Abra `github.com/Ayra-sw/ayra-ponto` e clique em **Add file** → **Upload files**.
2. Na pasta extraída há **3 pastas** (`docs`, `src`, `supabase`) e **1 arquivo** (`README.md`).
3. Clique em qualquer item e aperte **Ctrl+A**. Arraste os 4 itens para o quadro grande do GitHub.
4. Devem aparecer **15 arquivos**.
5. Na **caixinha pequena de cima**, escreva: `Fase 5A: arquivos oficiais AFD e AEJ`
6. Deixe a caixa grande vazia e clique em **Commit changes**.
7. Espere o **✓ verde**.

### Passo 4: testar

Abra `ayra-ponto.vercel.app` e aperte **Ctrl+F5**.

1. No menu **Gestão**, clique em **Arquivos fiscais**.
2. No cartão **AFD**, clique em **Este mês** e depois em **Baixar AFD**. O arquivo vai para a pasta Downloads.
3. Abra o arquivo baixado no **Bloco de Notas**:
   - a primeira linha começa com `000000000` e tem o nome da sua empresa;
   - depois vêm as marcações, uma por linha;
   - no fim estão `999999999…` e `ASSINATURA_DIGITAL_EM_ARQUIVO_P7S`.
4. Faça o mesmo com o **AEJ**: as linhas começam com `01|`, `02|`, `03|`… e terminam com `99|`.
5. Clique em **Como funciona** e confira o artigo de ajuda.
6. Abra o **Histórico de alterações**: as linhas "alterou a unidade" de cada marcação não aparecem mais.

## Se algo der errado

- **Aparece "Os arquivos fiscais ainda não foram instalados no banco":** a migração do Passo 1 ainda não rodou. Faça o Passo 1.
- **Aparece "Falta o CNPJ da empresa":** cadastre o CNPJ em **Configurações → Empresa**. O AFD identifica o empregador pelo CNPJ.
- **O site não abre depois do envio:** na Vercel, use **Instant Rollback** no deploy anterior e me avise.
- **Precisa desligar a Fase 5A no banco:** rode o arquivo `…_DESFAZER.sql` do mesmo jeito do Passo 1.
  - A gravação de novas linhas do AFD para, e os botões de baixar deixam de funcionar.
  - **Nada é apagado:** as linhas já gravadas são registros legais.
  - Ao rodar a 5A de novo, as marcações feitas nesse meio-tempo ganham a linha que faltou.

## Como foi testado

- **Banco:** numa cópia local com todas as fases aplicadas.
  - **70 cenários novos passaram.** Foram testados:
    - o código de verificação (CRC-16) com o exemplo oficial do leiaute;
    - o formato de data e hora em vários fusos;
    - acentos e caracteres fora do padrão;
    - a carga inicial: cada marcação com a sua linha, sem mudar nenhum NSR, e sem duplicar se a migração rodar de novo;
    - a marcação nova com o NSR seguinte e o SHA-256 ligado à anterior;
    - inclusão, alteração, desligamento, reativação e troca de unidade da pessoa;
    - a empresa nova, o endereço, a unidade com CNO e a unidade nova;
    - ninguém altera nem apaga as linhas;
    - quem vê e quem gera os arquivos, e os limites de período;
    - o INPI e os dados do desenvolvedor, quando preenchidos, aparecendo nos arquivos;
    - a correção aprovada aparecendo no AEJ como desconsiderada + incluída.
  - **Todos os 550 cenários das fases anteriores** rodaram de novo **com a 5A ligada** e passaram. A migração rodou duas vezes sem erro; o DESFAZER e a nova instalação funcionaram.
  - **Velocidade:** empresa de 50 pessoas com 3 meses de marcações (12 mil registros). O AEJ de 3 meses ficou pronto em 0,4 s e o AFD de 1 ano em menos de 0,1 s.
- **Validador independente:** escrevi um conferidor separado, em outra linguagem, que lê os arquivos gerados e confere tamanho de cada linha, CRC-16, a corrente de SHA-256, contadores, formatos e referências. **Os arquivos gerados passaram sem nenhum erro.**
- **Telas:**
  - **24 verificações novas passaram**: a tela, os downloads (arquivo idêntico ao do banco, byte a byte, em ISO-8859-1, passando no validador), os avisos de período, o erro sem a migração, a colaboradora sem acesso, o celular, a acessibilidade e o histórico sem as linhas técnicas.
  - As verificações das fases 2B a 4B continuam passando: 43, 72, 85, 75, 49, 40, 59 e 40.

## Pontos para o advogado ou contador conferir antes de vender

Os arquivos seguem os leiautes oficiais publicados pelo Ministério do Trabalho (Anexos V e VI da Portaria 671). Alguns detalhes não estão escritos nos leiautes e foram decididos assim:

- **Hexadecimal:** CRC-16 em letras maiúsculas e SHA-256 em minúsculas.
- **Marcação feita pelo celular** é identificada como "aplicativo mobile" (01); pelo navegador, como "browser" (02).
- **No AEJ:**
  - entram as faltas não justificadas e os saldos e lançamentos do banco de horas;
  - **não** entram o DSR, a folga compensatória de feriado e o pagamento de banco de horas em folha, porque o sistema não separa esses casos com segurança.
- **Arquivo por unidade:** cada unidade tem o seu próprio AFD e AEJ, porque cada uma tem a sua sequência de NSR.

## O que fica para depois

- **Fase 5B:** assinatura digital ICP-Brasil. Vamos precisar de um certificado digital da Ayra Soluções (e-CNPJ A1).
- **INPI:** depois do registro, você me passa o número e eu te mando o SQL para preencher.
- **Contato do suporte:** WhatsApp e e-mail.
