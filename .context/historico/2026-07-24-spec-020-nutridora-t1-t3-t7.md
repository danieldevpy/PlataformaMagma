# 2026-07-24 (continuação) — Spec 020: Nutridora T+1d/3d/7d

## Prompt do Daniel

Depois da spec 019 (Radar diário), pediu pra seguir com a Nutridora
T+1d/3d/7d — a candidata que tinha ficado de fora antes — pensando que a
campanha de tráfego pago (spec 018) pode começar amanhã, e com ela leads
reais chegando pelo WhatsApp.

## O que foi feito

- Spec-driven completo: `specs/020-agente-whatsapp-nutridora-t1-t3-t7/`.
- Backend: `Lead.nutridora_ultimo_toque` (campo novo, `t1`/`t3`/`t7`,
  migração `0002_lead_nutridora_ultimo_toque`) + ação `processar_nutridora`
  (`apps/leads/acoes.py`):
  - **T+1** (≥1 dia, toque em branco): puxa 3 habilidades reais do curso
    (`Curso.habilidades`) — fallback genérico se o lead não informou
    curso. Sempre tem conteúdo, sempre avança.
  - **T+3** (≥3 dias, já em t1): puxa uma `Avaliacao` aprovada real (do
    curso de interesse, senão qualquer uma aprovada). **Se não existir
    nenhuma ainda, não avança o toque** — tenta de novo no próximo dia
    em vez de inventar depoimento.
  - **T+7** (≥7 dias, já em t3): vagas restantes reais
    (`turma_destaque_de` + `Turma.vagas_restantes`) se `exibir_vagas`
    estiver ligado; texto genérico de urgência senão. Sempre avança.
  - Exclui `whatsapp` vazio, `utm_source=whatsapp` (lead nascido de
    conversa ao vivo com a SDR, já sendo nutrido) e números presentes em
    `ContatoEscalado` (reusa o mecanismo de silêncio do handoff — spec
    012 — em vez de criar opt-out novo).
  - Processa **no máximo 1 toque por lead por execução**, mesmo se o
    lead estiver atrasado em vários estágios ao mesmo tempo (ex.: cron
    ficou fora do ar por dias) — guard explícito
    (`ja_processados_nesta_rodada`) pra não mandar 2 mensagens seguidas
    na mesma rodada pro mesmo lead.
- 11 testes novos (`ProcessarNutridoraTests`) — suíte completa 245/245.
- `docs/plataforma/03-api-contratos.md` ganhou a entrada da ação.
- n8n: workflow novo `MAG - Nutridora (T+1/3/7)` — `Schedule Trigger`
  (diário, 9h) → `HTTP Request` (chama `processar_nutridora`) →
  **`Split Out`** (node novo no projeto — transforma o array
  `resultado.processados` em N itens do n8n) → `HTTP Request` (Evolution,
  roda automaticamente 1x por item, sem loop explícito). Mesma decisão
  de design do Radar: **sem AI Agent**, conteúdo já vem pronto do Django
  (dado real, não geração).

## Achados no caminho

1. **Mesmo achado de ambiente das specs 017/019**: porta 8000 do host
   ocupada por outro projeto. Testado com `runserver` em `:8001`,
   revertido pra `:8000` antes de exportar.
2. **Migração precisou ser aplicada no banco de dev** (`makemigrations`
   + `migrate leads`) antes de conseguir criar/editar leads de teste —
   diferente das specs anteriores, esta mexeu em modelo, não só em ação.
3. **Ordem das queries entre estágios**: achado de design (não bug —
   pego antes de rodar): se um lead está atrasado 5+ dias com o toque em
   branco, ele bate no filtro de T+1 (marca 't1') e, na mesma execução,
   passaria a bater também no filtro de T+3 (que exige `nutridora_ultimo_toque='t1'`
   — valor que acabou de ser gravado). Sem cuidado, um lead atrasado
   levaria 2 mensagens na mesma rodada. Resolvido com o guard
   `ja_processados_nesta_rodada` (cada lead processado no máximo 1x por
   chamada da ação).

## Teste real

Usei o mesmo número de teste (`5521979070319`, já usado em specs
anteriores) com um lead de dev, avançando `criado_em` manualmente em 3
rodadas e disparando o workflow via webhook temporário a cada uma:

- **T+1** (`criado_em` = 2 dias atrás): texto trouxe as 3 habilidades
  reais do Socorrista APH ("RCP e DEA", "Atendimento ao trauma",
  "Imobilização e transporte"). Toque marcado `t1`.
- **T+3** (4 dias atrás): puxou uma avaliação aprovada real já existente
  no banco de dev (5 estrelas). Toque marcado `t3`.
- **T+7** (8 dias atrás, turma com `capacidade=15`/`exibir_vagas=True`):
  texto calculou "restam 14 vaga(s)" (capacidade − 1 vaga já usada por
  matrícula existente no dev, valor real do `vagas_restantes`). Toque
  marcado `t7`.

Único erro em todas as execuções foi o de sempre (Evolution API não roda
nesta sessão).

## Estado ao sair

- Backend: pronto, testado, commitável (migração incluída).
- n8n dev: workflow novo criado e **ativado**
  (`ZkAxwOPuWVxWncax`, 4 nós) — cron real dispara 9h a partir de agora.
  `TokenAgente` dev com o escopo novo.
  `plataforma/n8n/workflows/mag-nutridora-t1-t3-t7.json` versionado.
- **Pendente, prioridade alta** (diferente das specs anteriores): a
  campanha de tráfego pago pode começar amanhã, então promover essa spec
  pra prod é urgente — workflow novo (primeira promoção, não está em
  `ids-prod.json`), escopo `leads:processar_nutridora` no `TokenAgente`
  de prod, migração `0002_lead_nutridora_ultimo_toque` em prod (simples,
  campo novo com default vazio — sem risco de dado).
- Backend runserver de teste (`:8001`) encerrado ao final.
