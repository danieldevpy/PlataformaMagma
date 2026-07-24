# Plan 016 — como fazer

> Referências: `.context/decisoes.md` (2026-07-23, madrugada seguinte —
> Redis dedicado) e `plataforma/n8n/workflows/README.md` (convenção de
> reexportar o JSON depois de editar em dev).

## Toques no sistema

| Camada | O que muda | Referência |
|---|---|---|
| Infra (dev) | Container Redis novo e dedicado `magma-n8n-redis-dev` em `plataforma/n8n/docker-compose.dev.yml` | `.context/decisoes.md` |
| n8n | 9 nós novos no workflow `MAG - Fase 0 (eco WhatsApp)` (id `ypeJKZLsGq1WxkQB`), entre `Extrair dados` e `Identificar Contato` | `plataforma/n8n/workflows/mag-fase-0-sdr.json` |
| Modelos/migrations | Nenhum — não toca Django | — |
| API | Nenhuma — não toca `docs/plataforma/03` | — |
| Seed | Nenhum toque | — |

## Decisões desta feature

- **Redis novo e dedicado, não reaproveita o Redis da Evolution API** —
  já promovida a `.context/decisoes.md` por afetar o padrão de infra do
  projeto inteiro (containers dedicados).
- **Padrão "debounce por carimbo de execução"**, sem fila/lock explícito:
  cada mensagem empilha numa lista Redis (`wpp:buffer:{numero}`), carimba
  `wpp:lastseen:{numero} = $execution.id`, espera N segundos, e ao acordar
  só processa se ainda for o carimbo mais recente (senão aborta — a
  execução mais nova assume). Evita depender de um nó "líder" decidido
  antecipadamente.
- **Janela fixa em 5 segundos** (começou em 10s, o Daniel testou e pediu
  5s) — janela dinâmica por tamanho de mensagem fica pra depois, se fizer
  falta.
- **`Preparar contexto SDR` precisou trocar a referência** de
  `$('Extrair dados')` para `$('Consolidar mensagens')` — como essa
  referência é por nome de nó (não pela conexão), sem o ajuste o buffer
  juntaria as mensagens só pra `Identificar Contato` receber o número
  certo, e o SDR/Operadora continuariam recebendo o fragmento cru.

## Nós novos (nomes no n8n, para referência)

1. `Buffer: guardar mensagem` (Redis `push`/RPUSH em `wpp:buffer:{numero}`)
2. `Buffer: marcar visto` (Redis `set`, `wpp:lastseen:{numero} = $execution.id`, TTL 30s de segurança)
3. `Buffer: aguardar debounce` (Wait, 5s)
4. `Buffer: consultar visto` (Redis `get`)
5. `Buffer: sou a última mensagem?` (IF: compara `lastSeenAtual` com `$execution.id`)
6. `Buffer: ler mensagens` (Redis `get`, `keyType: list`) — ramo TRUE
7. `Buffer: limpar` (Redis `delete`) — ramo TRUE
8. `Consolidar mensagens` (Code: parseia, ordena por `recebidoEm`, junta os textos) — ramo TRUE, segue pro fluxo original
9. `Buffer: descartar (mensagem já absorvida)` (NoOp) — ramo FALSE, fim

## Riscos / pontos de atenção

- **Só existe no dev.** Promover pra prod exige replicar o container Redis
  dedicado no `docker-compose.prod.yml` + credencial lá (mesmo checklist
  de promoção de workflow já usado nas specs 013/014/015).
- **TTL do `lastseen` (30s) tem que ficar sempre maior que a janela de
  espera** — se ficasse menor, a chave podia expirar sozinha antes da
  execução acordar pra conferir, quebrando a comparação.
- **Testado só com payload sintético** (`n8n_test_workflow`), não com
  mensagem real via Evolution API — ver critério de aceite do gestor em
  aberto na spec.
- Achado incidental (não corrigido aqui): agente SDR pode terminar em
  handoff sem gerar texto final de resposta, quebrando `Responder no
  WhatsApp (SDR)` com "Text is required" — bug pré-existente, não
  causado por este buffer.
