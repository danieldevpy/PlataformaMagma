# Tasks 010 — Recepcionista + SDR (Fase 1 MVP)

| ID | Tarefa | Estado | Agente |
|----|--------|--------|--------|
| T1 | Credencial `googlePalmApi` ("MAG - Gemini") no n8n | DONE | claude |
| T2 | Nó AI Agent + Gemini Chat Model + memória, conectados | PENDENTE | |
| T3 | Tools `listar_cursos` / `detalhes_curso` / `registrar_lead` | PENDENTE | |
| T4 | Reroteamento do workflow por papel (gestor/instrutor × lead/desconhecido) | PENDENTE | |
| T5 | Teste real: pergunta de preço/data respondida certa; `exibir_preco=false` não inventa valor | PENDENTE | |

## Ondas

- Onda 1: T2 (depende de T1, já feito)
- Onda 2 (depende de T2): T3
- Onda 3 (depende de T3): T4
- Onda 4 (depende de T4): T5

## Log

- (2026-07-20) Spec criada logo após a 009 (mesma sessão/branch). Decisão do
  provedor LLM (Gemini) tomada com o Daniel; credencial `MAG - Gemini`
  criada via `n8n-mcp` (T1 já DONE ao abrir a spec).
