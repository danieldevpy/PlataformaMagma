# Tasks 026 — Mídia curada no atendimento

> Estados: PENDENTE → EM ANDAMENTO → ENTREGUE (agente) → DONE (revisado pelo orquestrador).
> **Depende da spec 024 estar ENTREGUE** (regra "nunca ofereça o que não veio de tool").

| ID | Tarefa | Estado | Agente |
|----|--------|--------|--------|
| T1 | Tag de curadoria nova (`atendimento`) no `Midia.tags` — constante + validação onde as outras já vivem | PENDENTE | — |
| T2 | Mesa de Luz: atalho de curadoria novo, no mesmo padrão de `destaque`/`capa`/`avaliacao` | PENDENTE | — |
| T3 | Ação `midia_para_atendimento` (`apps/midia/acoes.py`): filtra por tag + camadas `curso`/`estrutura`/`geral`, **nunca** `turma` nem `externa`; `curso_slug` tolerante via `resolver_curso()` | PENDENTE | — |
| T4 | Escopo `midia:para_atendimento` no `TokenAgente` de dev | PENDENTE | — |
| T5 | Testes: só devolve mídia marcada · nunca vaza camada `turma`/`externa` · slug errado ainda resolve · curso sem mídia devolve lista vazia | PENDENTE | — |
| T6 | n8n: tool `midia_para_atendimento` no SDR (só consulta) | PENDENTE | — |
| T7 | n8n: nó `httpRequest` de envio (`sendMedia` da Evolution), com URL absoluta por ambiente — **não pode ser tool**, ver plan | PENDENTE | — |
| T8 | n8n: teto de 2 envios por conversa contado no Redis (`mag:midia:{numero}`), checado antes de disparar | PENDENTE | — |
| T9 | `systemMessage`: quando oferecer mídia (**só depois de 024 e 025 fecharem o texto**) | PENDENTE | — |
| T10 | **Teste real**: marcar 4 fotos na Mesa de Luz pelo celular → conversa nova → MAG oferece e manda exatamente aquelas | PENDENTE | — |
| T11 | **Teste real**: curso sem mídia marcada → MAG não oferece nada e segue a conversa | PENDENTE | — |
| T12 | Reexportar `mag-fase-0-sdr.json` (`exportar-dev.sh`) | PENDENTE | — |
| T13 | `03-api-contratos.md` + `.context/frontend.md` + `docs/subsistemas/09-*` + status/historico/ADR | PENDENTE | — |
| T14 | Promover pra prod (escopo novo no `TokenAgente` de prod + `promover-prod.sh`) | PENDENTE | — (decisão do Daniel) |

## Ondas

- Onda 0 (**bloqueia T1**): Daniel decide as 2 perguntas abertas da spec
  (tag nova × reusar `destaque`; vídeo entra ou só foto)
- Onda 1: T1, T3, T4 → T5 (backend) · T2 (front, paralelo)
- Onda 2: T6, T7, T8 (n8n)
- Onda 3: T9 (depois de 024/025) → T10, T11
- Onda 4: T12, T13
- T14 com a promoção conjunta

## Log

- (2026-07-25) Spec criada a partir de uma ideia do Daniel na revisão da
  bateria de conversas: em vez de a MAG despejar ficha técnica pra
  cativar, oferecer foto/vídeo **escolhido a dedo pelos gestores**. É a
  contrapartida positiva do achado "ficha técnica no lugar de convite"
  da spec 024 — lá se tira o excesso de texto, aqui se dá o que colocar
  no lugar.
