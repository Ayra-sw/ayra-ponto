# Ayra Ponto — Fase 7A: horas do jeito que o contador precisa

Pacote preparado em 11/10/2026 a partir do commit `fd3b281` ("Ajuste: digital abre sozinha").

Primeira das 3 etapas do **Fechamento do mês**. O espelho passa a calcular sozinho o que a folha de pagamento precisa.

**Decisões suas, respeitadas:**

- tudo já vem no **padrão da CLT**, numa tela simples que quase ninguém precisa mexer;
- hora extra em **domingo, feriado e folga = 100%** por padrão (dias normais, 50%), e dá para mudar;
- o **limite da semana é uma configuração** (44h hoje), por causa da PEC do fim da escala 6x1, que tem votação marcada no Senado para 14/10.

## O que muda para quem usa

- **Nova tela: Configurações → Regras de cálculo** (administrador altera; RH só vê). Ela tem:
  - **Hora extra:** % dos dias normais e % de domingo, feriado e folga;
  - **Trabalho noturno:** começo, fim e adicional (22h às 5h, 20%), hora reduzida de 52min30s e "continuar noturno depois das 5h";
  - **Intervalo e descanso:** opção "a equipe não marca o intervalo" e descanso mínimo entre dias (11h);
  - **DSR:** perde quem falta sem justificativa (e, se quiser, também por atraso);
  - **Limite da semana:** 44h, ou 42h/40h se a PEC passar;
  - os botões **Salvar regras** e **Voltar ao padrão da CLT**. A etiqueta mostra se está no "Padrão da CLT" ou "Personalizado".
- **Espelho de ponto** (de cada pessoa, para gestão e colaborador):
  - cartão novo **Para o contador**, com o total do mês: extras 50%, extras 100%, horas noturnas (com a hora reduzida), intervalo a pagar, descanso a pagar e DSR perdidos;
  - em cada dia: o selo **Noturno 2h17** (com uma lua), a marca **100%** na hora extra de domingo, feriado e folga, e avisos em português claro, como "Descansou só 9h40 desde a saída do dia anterior…", "Faltaram 0h30 de intervalo…", "DSR perdido…" e "A semana somou 46h10, acima do limite de 44h00";
  - quem tem **banco de horas** vê o aviso de que as extras vão para o banco.
- **Histórico de alterações:** toda mudança nas regras aparece lá.
- **Ajuda:** artigo novo, **Regras de cálculo e o resumo para o contador**.

Nada muda nas marcações, nos pedidos, no banco de horas nem nos relatórios. O espelho antigo continua igual por baixo: só ganha as informações novas.

## Importante saber

- As horas do espelho continuam **no relógio**. A hora reduzida entra no total de **horas noturnas** (é sobre ela que se paga o adicional). Vale confirmar com o contador que é assim que ele prefere receber.
- **DSR perdido** vale para quem tem jornada semanal com descanso no domingo. Escala 12x36 e por calendário não perdem DSR pelo Ayra.
- **Intervalo a pagar:** quem trabalha mais de 6h sem marcar intervalo tem 1h a pagar. Se a empresa usa **intervalo pré-assinalado** (a equipe não marca o intervalo), ligue essa opção nas regras.
- Recomendo levar esta tela ao **advogado e ao contador** na revisão antes das vendas.

## Arquivos do pacote

15 arquivos: 6 novos e 9 alterados. **Nenhum arquivo é apagado.**

| Pasta | Novos | Alterados |
|---|---|---|
| raiz | — | `README.md` |
| `docs/` | `fase-7a-LEIA-ME.md` (este guia) | — |
| `supabase/migrations/` | `2026-10-11_fase-7a_regras-calculo.sql` e `…_DESFAZER.sql` | — |
| `supabase/testes/` | `conferencia-fase-7a.sql` | — |
| `src/` | — | `App.jsx`, `telas.js`, `styles.css` |
| `src/pages/gestao/` | `RegrasCalculo.jsx` | — |
| `src/lib/` | `regrasCalculo.js` | `apuracao.js`, `historico.js`, `ajuda/artigosGestao.js` |
| `src/components/espelho/` | — | `EspelhoMensal.jsx` |
| `src/components/layout/` | — | `ShellGestao.jsx` |

**Dependências novas:** nenhuma. **Segredos novos:** nenhum.

## Mudanças no banco (migração da Fase 7A)

**Nenhuma marcação, pedido ou cálculo antigo é alterado.**

- **Tabela nova `regras_calculo`:** uma linha por empresa, com as regras. Sem linha, valem os padrões da CLT. Todos da empresa leem; só o administrador grava.
- **Função nova `apurar_clt`:** o espelho de sempre (`apurar_periodo`), mais as contas da folha. Quem pode ver é o mesmo de antes: a própria pessoa, o administrador e o RH da empresa, e o gestor da equipe.
- **Função `regras_da_empresa`:** devolve as regras (ou o padrão).

## Passo a passo

**Antes de tudo:** no Supabase, confira se no alto da tela está escrito **AYRA SOLUÇÕES / Ayra Ponto**.

### Passo 0: conferir o GitHub

Eu já conferi: o último envio é o `fd3b281`. Se você fizer algum envio antes de aplicar este pacote, me avise primeiro.

### Passo 1: rodar a migração no Supabase

1. Extraia o ZIP: clique com o botão direito em `ayra-ponto-fase-7a-regras-calculo.zip` e escolha **Extrair tudo** → **Extrair**.
2. Entre em **supabase** → **migrations** e abra `2026-10-11_fase-7a_regras-calculo.sql` (o arquivo **sem** "DESFAZER" no nome) no **Bloco de Notas**.
3. Aperte **Ctrl+A** e depois **Ctrl+C**.
4. No Supabase, clique em **SQL Editor** e depois em **+ New query**.
5. Clique no editor e aperte **Ctrl+V**.
6. Clique em **Run**.
   - Se aparecer um aviso sobre operação destrutiva ("destructive operation"), pode clicar em **Run this query**. São só linhas que recriam regras de acesso; nenhum dado é apagado.
7. Deve aparecer **"Success. No rows returned"**.

### Passo 2: conferir

1. No SQL Editor, clique em **+ New query**.
2. Abra `supabase/testes/conferencia-fase-7a.sql` no Bloco de Notas, copie tudo, cole no editor e clique em **Run**.
3. As **5 linhas** devem mostrar **true**. Mande um print para o Claude.

### Passo 3: enviar para o GitHub

1. **Confira que é o pacote certo:** dentro de `src` → `pages` → `gestao` tem que existir o arquivo **`RegrasCalculo.jsx`**.
2. Abra `github.com/Ayra-sw/ayra-ponto` e clique em **Add file** → **Upload files**.
3. Na pasta extraída há **3 pastas** (`docs`, `src`, `supabase`) e **1 arquivo** (`README.md`). Selecione os 4 com **Ctrl+A** e arraste para o quadro grande.
4. Devem aparecer **15 arquivos**.
5. Na **caixinha pequena de cima**, escreva: `Fase 7A: regras de calculo`
6. Deixe a caixa grande vazia e clique em **Commit changes**.
7. Espere o **✓ verde**.

### Passo 4: testar

1. Abra `ayra-ponto.vercel.app` e aperte **Ctrl+F5**.
2. No menu, em **Configurações**, clique em **Regras de cálculo**. Tudo tem que estar no **Padrão da CLT**.
3. Abra **Colaboradores** → uma pessoa → aba **Espelho**. Logo abaixo dos números do mês aparece o cartão **Para o contador**.

## Se algo der errado

- **A tela Regras de cálculo diz "Ainda não instalado":** o Passo 1 não foi rodado.
- **O cartão "Para o contador" não aparece:** aperte **Ctrl+F5**. Se continuar, confira o Passo 1.
- **Algum número parece errado:** me mande o print do dia e eu confiro a conta.
- **Para desligar:** rode `2026-10-11_fase-7a_regras-calculo_DESFAZER.sql`. O espelho volta a ser o de antes. Nada é apagado.

## Próximas etapas

- **7B: Fechar o mês:** lista do que falta, botão Fechar (trava o mês; só o administrador reabre) e planilha Excel para o contador.
- **7C: O colaborador confere e assina:** "Está certo" com a digital ou a senha, ou "Encontrei um problema".
