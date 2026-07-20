# Plan 010 — como fazer

> Referências: `docs/subsistemas/02b-agente-whatsapp-n8n.md` (§4 A1 SDR),
> `docs/plataforma/03-api-contratos.md` (`GET /api/cursos/`,
> `GET /api/cursos/{slug}/`, `POST /api/leads/` — já existentes, `AllowAny`).
> Decisão do LLM configurável: `.context/decisoes.md` (2026-07-20).

## Toques no sistema

| Camada | O que muda | Referência |
|---|---|---|
| Modelos/migrations | Nenhum | — |
| API | Nenhuma nova — reusa `GET /api/cursos/`, `GET /api/cursos/{slug}/`, `POST /api/leads/` | `docs/plataforma/03` |
| n8n | Credencial `googlePalmApi` ("MAG - Gemini") + workflow `MAG - Fase 0` ganha nó AI Agent + 3 tools + memória | `plataforma/evolution/README.md` |

## Credencial (já criada nesta sessão via `n8n-mcp`)

`MAG - Gemini` (tipo `googlePalmApi`, id `2hfz9nsgW5VRmX93`) — chave do
Daniel, mesma família de provedor do Studio (`apps.ia`), mas credencial
própria (n8n não compartilha cofre com o Django). Nó de modelo:
`@n8n/n8n-nodes-langchain.lmChatGoogleGemini`, conectado ao AI Agent via
`ai_languageModel`. Trocar de provedor depois = trocar só esse nó (decisão
"LLM configurável").

## Roteamento (workflow `MAG - Fase 0 (eco WhatsApp)`, id `ypeJKZLsGq1WxkQB`)

Depois do nó "Identificar Contato" (spec 009), novo IF: `papel == "lead"`
OU `papel == "desconhecido"` → **AI Agent (SDR)`; senão (gestor/instrutor)
→ mantém o nó "Responder no WhatsApp" atual (reconhecimento simples da spec
009). Os dois caminhos convergem num HTTP Request final que manda a
resposta pra Evolution (`POST /message/sendText/{instance}`).

## AI Agent — "Capitã de Matrículas"

- **System prompt**: persona MAG (guia de marca — nunca finge ser humano se
  perguntado diretamente; nunca inventa preço/data/vaga; se o lead disser
  algo que indique intenção clara de fechar matrícula ou reclamação, avisa
  que vai chamar alguém da equipe e não insiste em vender). Só responde com
  dado vindo das tools — se a tool não tiver a informação, diz que vai
  confirmar com a equipe.
- **Memória**: Window Buffer Memory, `sessionKey` = número do contato
  (`{{ $('Extrair dados').item.json.numero }}`), janela curta (últimas ~10
  trocas — suficiente pro MVP, mesma decisão do plano §8).
- **Tools (HTTP Request Tool, `sourceOutput: ai_tool`)**:
  1. `listar_cursos` — `GET /api/cursos/` (dev: `http://host.docker.internal:8000/...`;
     prod: `http://backend:8000/...`) — sem params.
  2. `detalhes_curso` — `GET /api/cursos/{slug}/`, `slug` via `fromAI()`
     (a IA escolhe o slug a partir do que `listar_cursos` devolveu).
  3. `registrar_lead` — `POST /api/leads/`. Campos controlados pela IA via
     `fromAI()`: `nome`, `curso_slug`, `quando_pretende`. Campos FIXOS (não
     vêm da IA, pra não arriscar o número vir errado):
     `whatsapp = {{ $('Extrair dados').item.json.numero }}`,
     `utm_source = "whatsapp"`, `pagina_origem = "whatsapp"`.

## Testes

Validação via `validate_workflow`/`n8n_validate_workflow` antes de ativar
(mesmo fluxo da spec 009). Teste real: número de teste manda pergunta de
preço/data pro curso de Socorrista APH, confere resposta batendo com o
`GET /api/cursos/socorrista-aph/` real; testar também com
`exibir_preco=false` (mudar no admin temporariamente) pra confirmar que não
inventa valor.

## Riscos / pontos de atenção

- HTTP Request Tool com `fromAI()` deixa a IA montar parte do payload —
  por isso `whatsapp`/`utm_source` ficam fixos fora do controle dela
  (mitigação de "número errado" ou "utm_source inventado").
- Sem `RegraAgente` ainda (Fase 1/2) — o system prompt fica hardcoded no
  workflow por ora; revisável só editando o node (aceitável pro MVP).
- Filtro de número de teste (`991920338`) continua ativo no nó IF de
  entrada — a SDR só responde esse número até a Fase de produção de fato.
