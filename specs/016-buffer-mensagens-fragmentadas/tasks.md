# Tasks 016 — Buffer de mensagens fragmentadas do WhatsApp

| ID | Tarefa | Estado | Agente |
|----|--------|--------|--------|
| T1 | Redis dedicado (`magma-n8n-redis-dev`) no `docker-compose.dev.yml` + credencial n8n | DONE | claude |
| T2 | 9 nós de buffer no workflow `MAG - Fase 0`, entre `Extrair dados` e `Identificar Contato` | DONE | claude |
| T3 | Corrigir `Preparar contexto SDR` pra ler de `Consolidar mensagens` em vez de `Extrair dados` | DONE | claude |
| T4 | Teste real com payload sintético (`n8n_test_workflow`, 2 mensagens fragmentadas) | DONE | claude |
| T5 | Ajustar janela de 10s para 5s (pedido do Daniel após teste) | DONE | claude |
| T6 | Reexportar `plataforma/n8n/workflows/mag-fase-0-sdr.json` (30 → 39 nós) | DONE | claude |
| T7 | `.context/decisoes.md` + `.context/status.md` + `.context/historico/` | DONE | claude |
| T8 | Documentar como spec formal (esta pasta) | DONE | claude |
| T9 | Critério de aceite do gestor: teste com mensagem real via Evolution API (celular) | PENDENTE | — |
| T10 | Promover pra produção (Redis + workflow) | DONE | claude |

## Ondas

- Onda 1: T1
- Onda 2 (depende de T1): T2, T3
- Onda 3 (depende de T2, T3): T4
- Onda 4 (depende de T4): T5, T6
- Onda 5: T7, T8 (documentação, em paralelo)
- Onda 6 (fora desta spec por ora): T9, T10 — dependem do Daniel decidir levar pra produção

## Log

- (2026-07-23) Daniel perguntou sobre um padrão de "aguardar e juntar
  mensagens" que viu na internet, depois de descrever exatamente o caso de
  CPF + valor em mensagens separadas. Expliquei o padrão (debounce/message
  buffer) e mapeei onde encaixaria no workflow real do agente MAG. Daniel
  pediu pra prototipar direto no n8n dev (`AskUserQuestion`: Redis
  dedicado + protótipo antes de spec formal).
- (2026-07-23, madrugada seguinte) Implementado e testado de ponta a
  ponta com o exemplo real do Daniel — ver
  `.context/historico/2026-07-23-buffer-mensagens-whatsapp-prototipo.md`
  pro relato completo (inclusive o achado incidental do SDR em handoff).
  Daniel testou pelo WhatsApp e confirmou que funcionou, pediu pra trocar
  a janela pra 5s, e commitou (`9432549`).
- (2026-07-24) Daniel pediu pra formalizar como spec — pasta criada
  retroativamente documentando o que já foi implementado, testado e
  commitado. T9/T10 ficam como próximos passos, não bloqueiam o "DONE"
  do que já está pronto no dev.
- (2026-07-24, à noite) **T10 concluída** como parte da promoção de
  outras specs (017/019/020/012-T7) pra prod: ao promover
  `mag-fase-0-sdr.json` (que já carrega os nós do buffer desde o commit
  `9432549`), a ausência do Redis dedicado e da credencial em prod
  bloqueou o deploy — confirmado com o Daniel (`AskUserQuestion`) que
  preferia subir o buffer junto em vez de adiar o resto. Redis dedicado
  adicionado ao `docker-compose.prod.yml` (serviço `n8n-redis`, mesmo
  padrão do dev — container próprio, não reaproveita o Redis do
  Evolution) + credencial `MAG - Redis Buffer (dev)` criada em prod n8n
  (nome idêntico ao de dev de propósito, pro remapeamento automático do
  `promover-prod.sh` funcionar sem editar o JSON). T9 (teste com mensagem
  real via Evolution, celular) continua pendente — ninguém mandou
  mensagem fragmentada de verdade ainda.
