# Roteiro de execução — ordem acordada com o Daniel

> Criado em **2026-07-25**. Ordem definida por ele, nesta sequência.
> Regra: etapa fechada → marcar aqui **e** atualizar `.context/status.md`.
> Este arquivo diz **o que fazer em seguida**; o `status.md` diz **onde o
> projeto está**. Quando os dois divergirem, o `status.md` vence (ele é o
> registro do que aconteceu; este é o plano do que vai acontecer).

| Etapa | O que é | Estado |
|---|---|---|
| 1 | T20 — Nutridora passa a excluir por atividade, não por origem | **ENTREGUE em dev (25/07)** |
| 2 | Produção — commitar e promover 021→025 + blindagens da 027 | **ENTREGUE (25/07)** |
| 3 | Desenvolver o que falta — specs 026 e 028 | PENDENTE |
| 4 | Investigar o travamento do n8n — spec 027 (T1, T3/T4, T8–T11) | PENDENTE |
| 5 | Pixel e campanha — spec 018 T5 + Meta Ads | PENDENTE |

---

## Etapa 1 — T20: a Nutridora conta atividade, não origem

**Por que primeiro:** a Nutridora T+1/3/7 está ativa em produção desde
24/07 e hoje **não alcança nenhum lead nascido de conversa com a MAG** —
o `registrar_lead` do SDR carimba `utm_source="whatsapp"` como valor fixo
do workflow ([mag-fase-0-sdr.json:351](../plataforma/n8n/workflows/mag-fase-0-sdr.json))
e `processar_nutridora` exclui exatamente esse valor. Como a campanha do
Meta é Click-to-WhatsApp, **todo lead pago cairia nessa faixa morta**.
Corrigir antes de gastar dinheiro em anúncio.

**Decisão do Daniel (25/07):** trocar origem por atividade — não é exceção
estreita, é conserto de causa.

**Tarefas**

1. Em `apps/leads/acoes.py`, no `processar_nutridora`: remover
   `.exclude(utm_source="whatsapp")` e acrescentar exclusão por conversa
   recente, lendo `apps.conversas`:

   ```python
   numeros_em_conversa = Conversa.objects.filter(
       ultima_atividade_em__gte=agora - timedelta(days=silencio_dias)
   ).values_list("numero", flat=True)
   ```

   O índice `("numero", "-ultima_atividade_em")` já existe no model — a
   consulta não precisa de migração de índice.
2. Janela de silêncio em `ConfiguracaoSite.nutridora_silencio_dias`,
   **padrão 2**, seguindo o mesmo padrão de `conversas_retencao_dias` e
   `handoff_expira_horas` (ajustável no Admin, sem redeploy). Migração nova.
3. Testes: lead de WhatsApp **com** conversa recente fica fora; **sem**
   conversa recente entra; lead antigo que não tem nenhuma `Conversa`
   (anterior à spec 021) entra; handoff ativo continua excluindo.
4. Atualizar `docs/plataforma/03-api-contratos.md` se o payload mudar.

**Consequência esperada, de propósito:** para o lead de WhatsApp a régua
passa a contar a partir da **última conversa**, não da criação. Quem falou
com a MAG hoje e sumiu recebe o T+1 no 2º dia de silêncio, não no dia
seguinte ao cadastro. É mais correto do que o comportamento atual, mas é
mudança de cadência — se preferir T+1 no dia seguinte, é só pôr a config
em 1.

**Dependência:** a correção só funciona em produção **depois da etapa 2**,
porque `apps.conversas` (spec 021) ainda não está lá. Sem a tabela, o
filtro não exclui ninguém e todo lead de WhatsApp receberia toque —
inclusive quem está no meio de uma conversa. **Não promover a T20 sozinha:
ela viaja junto com a 021, na etapa 2.**

**Pronto quando:** suíte verde e a T20 marcada como resolvida em
`specs/028-lead-quente-ate-a-matricula/tasks.md`.

### ✅ Feita em 2026-07-25 (dev)

- `ConfiguracaoSite.nutridora_silencio_dias` (padrão **2**) + migração
  `nucleo/0008`, aplicada em dev.
- `Conversa.numeros_ativos_desde(dias)` — contrapartida de
  `ContatoEscalado.numeros_ativos()`; `dias=0` devolve conjunto vazio.
- `processar_nutridora` trocou `.exclude(utm_source="whatsapp")` por
  `.exclude(whatsapp__in=numeros_em_conversa)`.
- Suíte **300 → 304**, verde. O teste que afirmava o comportamento antigo
  (`test_exclui_lead_nascido_de_conversa_whatsapp`) foi substituído por 5
  que afirmam o novo.
- Contratos atualizados em `docs/plataforma/03-api-contratos.md`.

**Medido no banco de dev:** os **12 leads existentes têm `utm_source="whatsapp"`**
— ou seja, com a regra antiga a Nutridora nutriria **zero** deles. Rodada
real da ação com o lead #32 retro-datado em 3 dias: **sem conversa
recente, entra na régua** (texto T+1 com as habilidades reais do curso);
**com conversa de agora, não entra**. Estado do lead restaurado depois.

**Falta desta etapa:** nada em dev. Em produção ela só passa a valer na
etapa 2, junto com a 021.

---

## Etapa 2 — Produção: tirar 2.200 linhas do working tree

**Por que:** cinco specs terminadas e testadas existem **só** no working
tree — 26 arquivos modificados + 26 caminhos não rastreados, nada
commitado desde `b90fc95` (24/07). E a produção roda o SDR de antes da
023/024/025: hoje, em prod, quem é escalado **não vira lead**, é
**silenciado até ser liberado na mão** e some do Radar e da Nutridora.

**O que vai junto:** 021 (conversas), 022 (memória Redis), 023 (correções
SDR), 024 (tom e pesos), 025 (handoff de ponta a ponta), 027 parcial
(T2/T5/T6/T7), T20 da etapa 1, e o pixel da 018 (T1–T4, frontend).

**Tarefas**

1. Revisar o diff inteiro e commitar agrupado por spec (não um commit só).
2. `git push` + `git pull` na VPS.
3. **Backend:** `docker compose --env-file .env.prod build backend` e
   `up -d`. ⚠️ **Nunca rodar `docker compose up -d` sem `--env-file
   .env.prod`** — foi o que derrubou o site por ~2 min em 24/07 (o Compose
   substitui as credenciais do MySQL por vazio e recria o container).
   Migrações sobem sozinhas pelo `entrypoint.sh`.
4. **Escopos novos no `TokenAgente` de prod** (`agente-n8n-mag`): os
   `conversas:*` da spec 021. Sem isso a ação volta 403 — foi o achado da
   spec 017.
5. **Workflows:** os 5 mudaram (a 021 pôs um nó de registro em cada).
   `promover-prod.sh` em `mag-fase-0-sdr.json`, `mag-nutridora-t0.json`,
   `mag-nutridora-t1-t3-t7.json`, `mag-radar-resumo-diario.json`,
   `mag-avisar-equipe.json` — todos já mapeados em `ids-prod.json`, então
   é atualização normal, sem import nem credencial nova (a credencial
   Redis que a 022 usa já existe em prod desde o buffer da 016).
6. **027-T6/T7 em prod:** rodar `n8n --version` e `free -m` na VPS e
   preencher os dois campos deixados em branco de propósito no
   `docker-compose.prod.yml`. Fixar a versão às cegas pode ser
   **downgrade**, e migração de banco do n8n não volta atrás.
7. Conferir: containers saudáveis, `healthz` 200, execuções recentes sem
   erro. **Não** disparar mensagem sintética em prod (evita Lead e custo de
   IA falsos no banco real).

**Pronto quando:** `git status` limpo, os 5 workflows ativos em prod e a
`ConfiguracaoSite` de produção com `handoff_expira_horas`,
`conversas_retencao_dias` e `nutridora_silencio_dias` conferidos.

### ✅ Feita em 2026-07-25

**5 commits** (`d82c09d` pixel · `08a7da8` blindagens 027 · `2d7d7bd`
specs 021-025 + T20 · `18067b9` docs · `438e1b5` T6/T7 de prod), push e
`git pull` na VPS. Não deu pra fazer um commit por spec: 021→025 e a T20
escrevem nos mesmos arquivos (`nucleo/models.py` recebe campo de três
delas, `mag-fase-0-sdr.json` de cinco), e separar exigiria inventar
estados intermediários que nunca existiram.

- **Backend**: `build backend` + `up -d backend`, os dois com
  `--env-file .env.prod`. `db` ficou `Running` (não recriado) — o
  incidente de 24/07 não se repetiu. As 4 migrações subiram pelo
  `entrypoint.sh`; dado intacto (4 cursos, 2 turmas, 4 usuários, 1 lead).
- **`TokenAgente` de prod** (`agente-n8n-mag`): 16 → 19 escopos, com os
  3 `conversas:*`.
- **5 workflows** atualizados e ativos. Desviei do `promover-prod.sh`, que
  reinicia o n8n por arquivo: montei os 5 com `_montar_json_prod.py`,
  importei e publiquei os 5, e reiniciei **uma vez** — uma janela de
  segundos em vez de cinco.
- **027-T6/T7**: prod fixado em `2.31.4` (o que já rodava) e `mem_limit`
  de `1g`. Ver o §Etapa 4 e o log da spec 027 pros números.

**Verificado**: site e API em 200, 8 containers de pé, n8n `healthy`,
`EXECUTIONS_DATA_PRUNE=true`/`168`.

**O que NÃO foi verificado:** nenhuma mensagem real passou pela MAG depois
do deploy. Não disparei mensagem sintética em prod de propósito (criaria
Lead e custo de IA falsos no banco real) — a confirmação de ponta a ponta
é o Daniel mandar uma mensagem do WhatsApp dele pro número da MAG e ver a
resposta, e depois conferir se apareceu `Conversa` no Admin (é o que prova
que os escopos `conversas:*` estão valendo).

---

## Etapa 3 — Desenvolver o que falta

Ordem obrigatória: **026 antes da 028**. As duas editam o mesmo
`systemMessage` do SDR, e fora de ordem uma sobrescreve a outra (a 024 já
entrou; a 025 também).

### 3a. Spec 026 — mídia curada no atendimento

**Bloqueada em 2 decisões suas**, a bater no começo da etapa:

- tag nova em `Midia.tags` × reusar a `destaque` que já existe;
- vídeo entra ou é só foto.

### 3b. Spec 028 — lead quente vai até a matrícula

As 3 decisões de produto já estão fechadas (prazo de 2h, sempre a
`turma_destaque`, nunca aprovar pagamento antes da matrícula) e a T20 sai
resolvida na etapa 1. Ondas conforme `specs/028-.../tasks.md`:

- **Onda 1** — T1..T7: backend inteiro (`AprovacaoPendente`, resumo da
  conversa, `pedir_aprovacao`, `listar_aprovacoes_pendentes`,
  `resolver_aprovacao`, expiração, testes). Validável por `curl`, **sem
  tocar em n8n**. É por aqui que se começa.
- **Onda 2** — T8/T9: sub-workflow `mag-enviar-ao-contato.json` + disparo.
- **Onda 3** — T10/T11: `systemMessage` do SDR (uma edição só, não fatiar).
- **Onda 4** — T12: Operadora.
- **Onda 5** — T14/T15/T16 testes reais → T17/T18. Aceite da T16: dos 6
  perfis da bateria, **1 abre o caminho novo e 5 seguem no handoff**.

**Princípio que não pode ser violado:** o modelo nunca escolhe o
destinatário — o número sai da `AprovacaoPendente`, nunca de parâmetro
produzido pela IA.

---

## Etapa 4 — Investigar o travamento do n8n (spec 027)

- **T1** — reproduzir sob carga **concorrente** (1 → 3 → 10 conversas
  simultâneas), com o harness em `plataforma/n8n/simulacao/`. A hipótese
  atual é concorrência: a bateria de 19 turnos da 024 rodou inteira sem
  travar, mas foi sequencial. Responder "acontece em prod, e com qual
  volume".
- **T3/T4** — watchdog que reinicia o n8n travado + alarme no WhatsApp dos
  gestores.
- **T8/T9** — registrar o patamar de carga suportado e o ADR da conclusão.
- **T10/T11** — decidir queue mode (só faz sentido se a T1 apontar
  concorrência) e promover as blindagens.

> **Observação, não mudança de ordem:** T3/T4 é curto e independe da causa
> raiz — é a diferença entre você descobrir uma queda por aviso ou por
> cliente reclamando. Se quiser, ele cabe na cauda da etapa 2, junto com o
> deploy. Mantido aqui por ser a sua ordem.

---

## Etapa 5 — Pixel e campanha

1. **018-T5** — confirmar o disparo com a extensão Meta Pixel Helper.
   **Só você consegue fazer**: precisa de um Pixel ID real e do seu Chrome.
   Passo a passo em `historico/2026-07-24-spec-018-pixel-implementado.md`.
2. Criar o Pixel de verdade no Business Manager.
3. Montar a campanha — `docs/subsistemas/01b-trafego-pago-meta-ads.md` §6.
   Campanha única, objetivo Mensagens (Click-to-WhatsApp), 1 conjunto,
   R$40–50/dia, teto de R$1.000, só Socorrista APH.

**Fora do alcance de um agente:** o Ads Manager exige o seu login.

---

## Decisões já tomadas (não rediscutir sem fato novo)

- **T20** — atividade, não origem (25/07, ver `.context/decisoes.md`).
- **028** — prazo de aprovação 2h; link sempre da `turma_destaque`; nunca
  aprovar pagamento antes de existir `Aluno` + `Matrícula`.
- **Asaas** — a cobrança real **já está configurada em produção**
  (informado pelo Daniel em 25/07). Não é mais pendência.

## Decisões que ainda vão aparecer

- Etapa 3a — tag nova × `destaque`, e se vídeo entra (spec 026).
- Etapa 4 — queue mode (depende do resultado da T1).
- Etapa 1 — janela de silêncio da Nutridora: 2 dias (proposto) ou 1.
