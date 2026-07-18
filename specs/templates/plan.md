# Plan NNN — <nome da feature>

> O COMO. Referencia os docs em vez de duplicá-los
> (ex.: "modelos conforme `docs/plataforma/02` §cursos").

## Toques no sistema

| Camada | O que muda | Referência |
|---|---|---|
| Modelos/migrations | | `docs/plataforma/02` |
| API | | `docs/plataforma/03` (atualizar na mesma PR se payload mudar) |
| Front | | `docs/plataforma/04` + `design-system/AGENTS.md` |
| Painel/Admin | | `docs/plataforma/06` |
| Seed | | `docs/plataforma/08` (manter idempotência) |

## Decisões desta feature

- <decisão> — <porquê> (se afetar o projeto todo, promover para `.context/decisoes.md`)

## Riscos / pontos de atenção

- <ex.: JSONField SQLite×MySQL → filtrar em Python; CSS com `hidden` → regra-guarda>
