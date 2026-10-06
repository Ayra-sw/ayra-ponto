# Ayra Ponto — Fase 6A: geolocalização

Pacote preparado em 06/10/2026 a partir do commit `ce9292b` ("Ajuste: faixa da marca no app dos funcionários").

Cada unidade ganha um **local no mapa** e uma **cerca virtual**. Quando alguém registra o ponto longe da unidade, o RH vê um selo na marcação, com a distância. **O ponto nunca é bloqueado**, como manda a Portaria 671.

**Decisões suas, respeitadas:**

- o local da unidade é marcado **pelo endereço, com ajuste do ponto no mapa**;
- o RH vê o selo **"Fora do local" com a distância** na própria marcação (sem alerta na Visão geral e sem sininho);
- o colaborador recebe **só um aviso gentil**, sem bloqueio;
- o raio padrão é **200 metros**, ajustável por unidade (de 50 m a 5 km).

## O que muda para quem usa

- **Administrador, em Unidades → Editar:** nova seção **Localização e cerca virtual**, com:
  - **Buscar pelo endereço:** usa o endereço preenchido acima e põe o ponto no mapa;
  - **Estou na unidade agora:** marca o ponto pela localização do seu aparelho;
  - **clicar no mapa** para ajustar o ponto exato (com o teclado: setas movem o mapa e Enter marca o centro);
  - **raio da cerca** em metros, com o círculo desenhado no mapa na hora;
  - **Desligar a cerca**, para unidades onde não faz sentido.
  O cartão de cada unidade mostra **Cerca virtual: Ligada · raio de 200 m** ou **Desligada**.
- **Administrador e RH, na ficha da pessoa → aba Marcações:**
  - marcação longe da unidade: selo **Fora do local · 1,1 km**;
  - marcação sem localização (pessoa não permitiu): selo **Sem localização**;
  - ícone de mapa em cada marcação com localização: abre o mapa com o ponto da marcação, o ponto da unidade e o círculo da cerca **como estava na hora**.
  Marcações dentro da cerca não ganham selo.
- **Colaborador:** se marcar longe, o comprovante mostra um aviso azul e gentil ("O ponto foi registrado normalmente… o RH poderá ver essa informação"). Se a unidade tem cerca e a pessoa não deu localização, uma dica para permitir da próxima vez. O colaborador **não** vê selos no próprio histórico.
- **Ajuda:** dois artigos novos: **Cerca virtual e "ver no mapa"** (gestão) e **Localização no ponto** (colaborador).
- **Histórico de alterações:** mudar o local ou o raio de uma unidade aparece lá, como qualquer outra mudança.

## Importante saber

- **A localização é um indício, não uma prova.** Computadores costumam errar a posição por dezenas ou centenas de metros; celulares com GPS erram menos. Por isso o raio padrão é de 200 m, e o aviso do mapa diz isso.
- **Quem trabalha fora** (visita, entrega) vai aparecer como "fora do local". É esperado.
- **A cerca é uma foto do momento:** cada marcação guarda o local e o raio da época. Se você mudar a unidade de lugar, as marcações antigas continuam contando como eram.
- **Só vale para unidades com cerca ligada.** Unidades sem cerca funcionam exatamente como antes.
- **LGPD:** a localização é um dado pessoal. Vale o advogado revisar a política de privacidade para citar a geolocalização do ponto (junto com o comprovante por e-mail).

## Serviços de mapa usados (gratuitos)

- **Mapa de fundo: OpenStreetMap.** Uso leve, como uma tela de gestão, é permitido. **Quando houver muitos clientes**, troque por um serviço pago (MapTiler, Stadia, Mapbox…): é uma linha só, `MAPA_TILES` em `src/lib/geo.js`. Eu faço isso quando chegar a hora.
- **Busca de endereço: Nominatim (OpenStreetMap).** Só é chamado quando o administrador clica em **Buscar pelo endereço**. No Brasil, nem todo número de rua existe no mapa: se não achar, a pessoa clica no mapa.
- **Nenhuma biblioteca nova** foi adicionada ao projeto.

## Correção no código de integridade

Ao testar marcações com localização, encontrei um detalhe antigo: uma coordenada como `-23.550120` era calculada como `-23.55012` na hora de marcar e conferida como `-23.550120` depois, e o botão **Conferir agora** (Integridade das marcações) poderia acusar uma diferença que não existe (cerca de 1 marcação em 5 com localização). A migração corrige isso, escrevendo a coordenada sempre no mesmo formato. **Nenhuma marcação já registrada é alterada**, e as que já conferem continuam conferindo.

## Arquivos do pacote

18 arquivos: 8 novos e 10 alterados. **Nenhum arquivo é apagado.**

| Pasta | Novos | Alterados |
|---|---|---|
| raiz | — | `README.md` |
| `docs/` | `fase-6a-LEIA-ME.md` (este guia) | — |
| `supabase/migrations/` | `2026-10-08_fase-6a_geolocalizacao.sql` e `…_DESFAZER.sql` | — |
| `supabase/testes/` | `conferencia-fase-6a.sql` | — |
| `src/components/geo/` (pasta nova) | `Mapa.jsx`, `CercaVirtual.jsx`, `MapaDaMarcacao.jsx` | — |
| `src/components/marcacoes/` | — | `HistoricoMarcacoes.jsx` |
| `src/components/ponto/` | — | `Comprovante.jsx`, `RegistrarPonto.jsx` |
| `src/lib/` | `geo.js` | `historico.js`, `ajuda/artigosGestao.js`, `ajuda/artigosPessoais.js` |
| `src/pages/gestao/` | — | `PerfilPessoa.jsx`, `Unidades.jsx` |
| `src/` | — | `styles.css` |

**Dependências novas:** nenhuma. **Segredos novos:** nenhum.

## Mudanças no banco (migração da Fase 6A)

**Nenhuma marcação é alterada.**

- **`filiais`** ganha 3 colunas: `latitude`, `longitude` e `raio_cerca_m` (padrão 200, entre 50 e 5000). Latitude e longitude vêm sempre juntas ou ficam vazias.
- **Função `distancia_metros`:** a conta da distância entre dois pontos.
- **Tabela nova `marcacao_local`:** para cada marcação feita numa unidade **com cerca**, guarda "dentro", "fora" (com a distância) ou "sem localização". Quem vê: a própria pessoa, o administrador e o RH da empresa. **Ninguém grava pelo app**: só o gatilho do banco.
- **Gatilho:** logo depois de cada marcação, preenche a `marcacao_local`. **Se der qualquer erro ali, a marcação é registrada do mesmo jeito.**
- **Código de integridade:** a correção descrita acima.

## Passo a passo

**Antes de tudo:** no Supabase, confira se no alto da tela está escrito **AYRA SOLUÇÕES / Ayra Ponto**.

### Passo 0: conferir o GitHub

Eu já conferi: o último envio é o `ce9292b`. Se você fizer algum envio antes de aplicar este pacote, me avise primeiro.

### Passo 1: rodar a migração no Supabase

1. Extraia o ZIP: clique com o botão direito em `ayra-ponto-fase-6a-geolocalizacao.zip` e escolha **Extrair tudo** → **Extrair**.
2. Entre em **supabase** → **migrations** e abra `2026-10-08_fase-6a_geolocalizacao.sql` (o arquivo **sem** "DESFAZER" no nome) no **Bloco de Notas**.
3. Aperte **Ctrl+A** e depois **Ctrl+C**.
4. No Supabase, clique em **SQL Editor** e depois em **+ New query**.
5. Clique no editor e aperte **Ctrl+V**.
6. Clique em **Run**.
   - Se aparecer um aviso sobre operação destrutiva ("destructive operation"), pode clicar em **Run this query**. São só linhas que recriam regras de acesso; nenhum dado é apagado.
7. Deve aparecer **"Success. No rows returned"**.

### Passo 2: conferir

1. No SQL Editor, clique em **+ New query**.
2. Abra `supabase/testes/conferencia-fase-6a.sql` no Bloco de Notas, copie tudo, cole no editor e clique em **Run**.
3. As **5 linhas** devem mostrar **true**. Mande um print para o Claude.

### Passo 3: enviar para o GitHub

1. Abra `github.com/Ayra-sw/ayra-ponto` e clique em **Add file** → **Upload files**.
2. Na pasta extraída há **3 pastas** (`docs`, `src`, `supabase`) e **1 arquivo** (`README.md`). Selecione os 4 com **Ctrl+A** e arraste para o quadro grande.
3. Devem aparecer **18 arquivos**.
4. Na **caixinha pequena de cima**, escreva: `Fase 6A: geolocalizacao e cerca virtual`
5. Deixe a caixa grande vazia e clique em **Commit changes**.
6. Espere o **✓ verde** (a Vercel publica sozinha, em cerca de 1 minuto).

**Confira que é o pacote certo:** dentro da pasta `src` deve existir a pasta **`components` → `geo`**, com 3 arquivos. Se não existir, você está com o ZIP errado.

### Passo 4: testar

1. Abra `ayra-ponto.vercel.app` e aperte **Ctrl+F5**.
2. Entre como administradora e vá em **Configurações → Unidades**. Clique em **Editar** na sua unidade.
3. Role até **Localização e cerca virtual** e clique em **Buscar pelo endereço**. O ponto aparece no mapa. Se estiver no lugar errado, **clique no mapa** onde fica a entrada.
4. Deixe o raio em 200 e clique em **Salvar alterações**. O cartão da unidade mostra **Ligada · raio de 200 m**.
5. Registre uma marcação **de dentro do raio** e outra de **longe** (por exemplo, de casa). Na longe, o comprovante mostra o aviso gentil.
6. Abra **Colaboradores** → a pessoa → aba **Marcações**: a marcação longe tem o selo **Fora do local**. Clique no ícone de mapa dela.

## Se algo der errado

- **O mapa aparece cinza, sem ruas:** pode ser a internet ou o bloqueio do serviço de mapas por alguma rede da empresa. Me avise com um print.
- **"Buscar pelo endereço" não acha:** clique no mapa para marcar o local.
- **O ponto do mapa caiu em outro lugar:** é só clicar de novo no lugar certo e salvar.
- **A seção da cerca não aparece em Unidades:** a migração ainda não foi rodada (Passo 1).
- **Algum problema:** me mande o print. **Para desligar a cerca nas marcações novas:** rode `2026-10-08_fase-6a_geolocalizacao_DESFAZER.sql` no SQL Editor. Nada é apagado.

## Fica para depois

- **Origem "celular com localização":** hoje toda marcação sai como "Computador" nos relatórios, mesmo feita no celular. Quando você decidir, eu separo.
- **Precisão do GPS:** hoje não guardamos a margem de erro que o aparelho informa. Se o RH reclamar de falsos "fora do local", essa é a próxima melhoria.
