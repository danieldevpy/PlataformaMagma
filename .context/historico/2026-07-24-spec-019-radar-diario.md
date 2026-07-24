# 2026-07-24 (continuação) — Spec 019: B5 Radar (resumo diário)

## Prompt do Daniel

Depois da spec 017 (info institucional), perguntei se ele queria seguir
pra Nutridora T+1/3/7 (a candidata de maior impacto da análise original) —
ele preferiu adiar. Ofereci duas alternativas menores: B5 Radar diário ou
`atualizar_turma` pelo chat. Escolheu o Radar.

## O que foi feito

- Spec-driven completo: `specs/019-agente-whatsapp-radar-diario/`.
- Backend: ação nova `resumo_diario` (`apps/nucleo/acoes_resumo.py`,
  registrada em `apps/nucleo/apps.py::ready()`) — agrega `Lead` (janela
  rolante 24h, diferente do dia corrido de `listar_leads`), `Turma` com
  `status=inscricoes` (código+curso+vagas), `Avaliacao` pendentes
  (contagem), `Postagem` agendada pra hoje excluindo publicadas
  (contagem), e uso de IA do mês corrente (mesma agregação de
  `UsoMensalView`). Imports protegidos pros apps opcionais, mesmo padrão
  de `status_turma`.
- 5 testes novos (`ResumoDiarioTests`) — suíte completa 235/235.
- `docs/plataforma/03-api-contratos.md` ganhou a entrada da ação.
- n8n: workflow **novo** `MAG - Radar (resumo diário)` (não é um ramo do
  `MAG - Fase 0` — gatilho é `Schedule Trigger`, natureza diferente de
  mensagem recebida, mesmo padrão já usado pra separar a Nutridora):
  1. `Schedule Trigger` — diário, 8h, timezone do container
     (`America/Sao_Paulo`).
  2. `HTTP Request` — chama `resumo_diario` via `/api/acoes/executar/`.
  3. `Code` — formata o texto em PT-BR. **Decisão**: sem AI Agent. É um
     relatório factual com estrutura fixa; um LLM aqui só custaria
     tokens/latência e arriscaria "florear" um número que devia sair
     exato. Reversível — se um dia quiser tom mais caloroso, dá pra
     trocar o `Code` por um agente depois.
  4. `HTTP Request` — manda pro WhatsApp do gestor via Evolution API
     (número hardcoded, mesmo padrão do `avisar_equipe`; não existe grupo
     interno configurado ainda).
  `TokenAgente agente-recepcionista-mag` (dev) ganhou o escopo
  `nucleo:resumo_diario`.

## Achados no caminho

1. **Colisão de numeração de spec**: nasceu como "spec 018", mas no meio
   da sessão descobri (via `.context/status.md`, que outra sessão paralela
   tinha acabado de atualizar) que `specs/018-rastreamento-trafego-pago`
   já existia — trabalho de tráfego pago (Meta Ads) feito em paralelo,
   sem relação com esta spec. Renumerei tudo pra **019** antes de
   commitar (pasta, título dos 3 arquivos, `docs/03-api-contratos.md`,
   `plataforma/n8n/workflows/README.md`) — nada da spec 018 foi tocado.
2. **`Schedule Trigger` não é testável via `n8n_test_workflow`** (a
   ferramenta só dispara webhook/form/chat). Solução: adicionei um nó
   `Webhook` temporário ligado no mesmo ponto (`Radar: buscar resumo`),
   ativei o workflow, testei via webhook, e removi o nó temporário antes
   de reexportar — só o `Schedule Trigger` real fica no arquivo final.
3. **Mesmo achado de ambiente da spec 017**: porta 8000 do host ainda
   ocupada por outro projeto (não mexido). Testei com `runserver` em
   `:8001`, apontando só o nó `Radar: buscar resumo` pra lá
   temporariamente, revertido pra `:8000` antes de exportar.

## Teste real

Execução manual (via o webhook temporário) trouxe dado real do banco de
dev: 3 leads nas últimas 24h, turma "026" (Socorrista APH) com inscrições
abertas, 0 avaliações pendentes, 0 postagens agendadas pra hoje, 18
execuções de IA no mês (14060 tokens). Texto formatado corretamente pelo
`Code` node, incluindo o fallback pra vagas sem capacidade definida
(mostrou "?" em vez de quebrar). Único erro da execução foi o esperado
(Evolution API não roda nesta sessão de teste).

## Estado ao sair

- Backend: pronto, testado, commitável.
- n8n dev: workflow novo criado e **ativado** (`kq6ULUF5lYU9HRQf`, 4 nós)
  — o cron vai disparar de verdade às 8h a partir de agora, em dev.
  `TokenAgente` dev com o escopo novo.
  `plataforma/n8n/workflows/mag-radar-resumo-diario.json` versionado.
- **Pendente**: promover pra prod — é workflow **novo**, primeira
  promoção (ainda não está em `ids-prod.json`), escopo
  `nucleo:resumo_diario` no `TokenAgente` de prod, e ativar manualmente
  depois de importar (checklist atualizado em
  `plataforma/n8n/workflows/README.md`) — decisão do Daniel.
- Backend runserver de teste (`:8001`) encerrado ao final.
