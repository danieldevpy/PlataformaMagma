# Tasks 027 — Resiliência do n8n

> Estados: PENDENTE → EM ANDAMENTO → ENTREGUE (agente) → DONE (revisado pelo orquestrador).

| ID | Tarefa | Estado | Agente |
|----|--------|--------|--------|
| T1 | **Investigação**: reproduzir o travamento em dev sob carga crescente (1 → 3 → 10 conversas simultâneas), sem observador; capturar perfil de CPU; isolar H1–H4; responder "acontece em prod, e com qual volume" | PENDENTE | — |
| T2 | ~~Timeout de 60s nos nós de agente~~ → **timeout de execução do workflow** (`settings.executionTimeout: 60`) — ver log | ENTREGUE | claude |
| T3 | Watchdog que reinicia o n8n travado (healthz sem resposta), em dev e prod | PENDENTE | — |
| T4 | Alarme no WhatsApp dos gestores quando o watchdog agir | PENDENTE | — |
| T5 | `EXECUTIONS_DATA_PRUNE` (~7 dias) nos dois ambientes — seguro desde a spec 021, que moveu o histórico pro Django | ENTREGUE | claude |
| T6 | Fixar a imagem do n8n em `2.31.5` (dev e prod), tirando o `latest` | ENTREGUE (só dev) | claude |
| T7 | Limite de memória no container do n8n (cerca, não solução) | ENTREGUE (só dev) | claude |
| T8 | Registrar o patamar de carga suportado em `plataforma/n8n/README.md` | PENDENTE | — |
| T9 | ADR em `.context/decisoes.md` + `historico/` com a conclusão da T1 | PENDENTE | — |
| T10 | Decidir com o Daniel se vai pra **queue mode** — só faz sentido se a T1 apontar concorrência | PENDENTE | — (decisão do Daniel) |
| T11 | Promover as blindagens pra prod | PENDENTE | — (decisão do Daniel) |

## Ondas

- Onda 1: **T1 sozinha** (é investigação; o resto não depende dela, mas o
  escopo do T10 sim)
- Onda 2 (paralelo com a 1): T2, T5, T6, T7 — blindagens que valem
  independente da causa
- Onda 3: T3 → T4
- Onda 4: T8, T9 → T10, T11

## Prioridade

**T2, T3, T5 e T6 antes de a campanha de tráfego pago (spec 018) escalar.**
Hoje o pior caso é: o atendimento cai numa madrugada, as mensagens que
chegarem somem (o WhatsApp não retenta), e ninguém descobre até um cliente
reclamar. As três primeiras tarefas custam pouco e cobrem esse cenário
inteiro, mesmo sem a causa raiz na mão.

## Log

- (2026-07-25) **Blindagens T2, T5, T6, T7 entregues em dev.**

  **O plano estava errado sobre o timeout.** Ele afirmava que "os nós
  `agent` do n8n aceitam timeout" — não aceitam: nem o
  `@n8n/n8n-nodes-langchain.agent` nem o nó do modelo
  (`lmChatGoogleGemini`) têm propriedade de timeout em nenhuma versão
  disponível. O que existe é o timeout **da execução inteira**
  (`settings.executionTimeout`), que foi posto em **60s** no
  `mag-fase-0-sdr.json`. Cobre mais do que o plano pedia (qualquer nó
  pendurado, não só o agente) e viaja pra prod junto com o workflow,
  porque `_limpar_export.py` preserva `settings`. Margem: as execuções
  medidas levam ~12s no pior caso (5s de debounce + 2,5–6,5s de agente),
  então 60s só dispara em anomalia de verdade.

  **T6 é no-op de imagem em dev**: o container já rodava exatamente
  2.31.5 sob a tag `latest`. Fixar só tira o risco de um `pull` futuro
  trocar o motor do atendimento sem ninguém pedir.

  **T6 e T7 NÃO foram aplicados em prod, de propósito.** Fixar prod em
  2.31.5 às cegas pode ser **downgrade**, e migração de banco do n8n não
  volta atrás; e o `mem_limit` precisa da RAM da VPS. O compose de prod
  ficou com um bloco de comentário dizendo exatamente o que rodar lá
  (`n8n --version` e `free -m`) antes de preencher. O `EXECUTIONS_DATA_PRUNE`
  (T5), esse sim, foi escrito nos dois — é aditivo e não muda versão.

  Verificado em dev depois do restart: `versao=2.31.5`, `prune=true`,
  `maxage=168`, `mem_limit=2 GiB`, `healthz 200`.

  **Sinal solto pra T1:** a bateria de 19 turnos da spec 024 rodou inteira
  **sem travar** — 0,19% de CPU e 513 MiB no fim. Não é reprodução (foi
  sequencial, não concorrente), mas reforça a hipótese de que o gatilho é
  **concorrência**, não volume acumulado. O banco está em 57 MB; o prune
  de 7 dias ainda não podou nada porque as execuções são todas de ontem
  e hoje.

- (2026-07-25) Spec criada a partir de um incidente real durante a
  bateria de 6 conversas simuladas: o n8n de dev travou por inteiro
  (1 núcleo a 100%, event loop bloqueado, webhook fora, memória plana em
  580 MiB) na 4ª conversa e só voltou com `restart`. Descartados por
  medição: falta de memória, backend fora, crash do processo, GC em
  espiral. Sobrou a assinatura de laço síncrono na thread principal —
  causa raiz **indeterminada**, daí a T1 ser investigação.
  Pedido do Daniel: *"quero até analisar sobre o que de fato ocorreu de
  verdade, para saber se teria acontecido em produção, vamos analisar
  para depois poder reforçar todo o sistema"*.
