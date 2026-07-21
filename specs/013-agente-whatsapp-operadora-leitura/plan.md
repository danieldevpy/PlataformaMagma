# Plan 013 — como fazer

> Referências: spec 010 (padrão AI Agent + `toolHttpRequest` 1.1 + memória
> por número), spec 012 (padrão de acrescentar escopo num `TokenAgente`
> existente em vez de criar um novo), `docs/plataforma/03-api-contratos.md`
> (tabela de ações v1).

## Toques no sistema

| Camada | O que muda | Referência |
|---|---|---|
| API | Ação nova `listar_leads` em `apps/leads/acoes.py` (arquivo novo) | `docs/plataforma/03` (atualizar tabela) |
| Boot | `apps/leads/apps.py` — `ready()` ganha `from apps.leads import acoes` | padrão de `cursos`/`avaliacoes`/`midia` |
| Testes | `apps/nucleo/tests.py` — nova classe `ListarLeadsTests` (mesmo arquivo onde vivem os testes de `status_turma`/`gerar_link_avaliacao`, não em `apps/leads/tests.py`) | `apps/nucleo/tests.py:26+` |
| Admin | `TokenAgente agente-recepcionista-mag` ganha 3 escopos novos (dev via shell/admin; prod fica documentado no checklist) | `plataforma/n8n/workflows/README.md` |
| n8n | Ramo "É gestor ou instrutor?" troca o eco de teste por um AI Agent novo (**Operadora**), com 3 tools HTTP | `plataforma/n8n/workflows/mag-fase-0-sdr.json` |
| Docs | `docs/plataforma/03-api-contratos.md` — nova linha na tabela de ações v1 | — |

## Ação (`apps/leads/acoes.py`)

```python
from datetime import timedelta

from django.utils import timezone

from apps.leads.models import Lead
from apps.nucleo.acoes import ErroAcao, registrar_acao


@registrar_acao(
    nome="listar_leads",
    descricao=(
        "Lista leads criados nos últimos N dias corridos (padrão: hoje), "
        "do mais recente pro mais antigo. Filtro opcional por status exato."
    ),
    params={
        "dias": "int, opcional (padrão 1) — janela em dias corridos, contando hoje",
        "status": "string, opcional — filtra por status exato (ex.: 'novo', 'contatado')",
    },
    escopo="leads:listar_leads",
)
def listar_leads(params, request):
    bruto = params.get("dias")
    try:
        dias = int(bruto) if bruto not in (None, "") else 1
    except (TypeError, ValueError):
        raise ErroAcao("'dias' precisa ser um número inteiro.")
    if dias < 1:
        raise ErroAcao("'dias' precisa ser maior ou igual a 1.")

    inicio = timezone.localdate() - timedelta(days=dias - 1)
    leads = Lead.objects.filter(criado_em__date__gte=inicio).select_related("curso")

    status_filtro = (params.get("status") or "").strip()
    if status_filtro:
        leads = leads.filter(status=status_filtro)

    return [
        {
            "nome": lead.nome,
            "whatsapp": lead.whatsapp,
            "curso": lead.curso.nome if lead.curso_id else None,
            "quando_pretende": lead.quando_pretende,
            "status": lead.status,
            "utm_source": lead.utm_source,
            "criado_em": lead.criado_em,
        }
        for lead in leads.order_by("-criado_em")
    ]
```

Sem PK no retorno (constituição §6, mesma regra de `listar_postagens_agendadas`)
— nome + whatsapp + criado_em já identificam o lead o suficiente pro chat.
`dias` usa data corrida (`criado_em__date`), não janela rolante de 24h — "hoje"
deve significar "desde a meia-noite local de hoje", não "últimas 24h" (mais
intuitivo pra quem pergunta pelo chat).

## Testes (`apps/nucleo/tests.py`)

Nova classe `ListarLeadsTests`, mesmo padrão de `IdentificarContatoTests`/
`EscalarContatoTests`: `setUp` cria token via `criar_token_agente(nome=
"agente-recepcionista-mag", escopos=["leads:listar_leads"])`, helper privado
`_listar(**params)` faz o POST. Casos:

- lead criado hoje aparece com `dias` default (1); lead criado há 3 dias não
  aparece.
- `dias=3` traz os dois.
- filtro por `status` exato.
- retorno não inclui `id`/PK (`assertNotIn`).
- `dias` inválido (`"abc"`) → 400 (`ErroAcao`).
- sem auth / escopo errado → já coberto pelos testes genéricos existentes
  (`test_executar_sem_auth_nega`, `test_executar_token_com_escopo_errado_403`),
  não precisa duplicar por ação.

## `TokenAgente agente-recepcionista-mag`

Acrescentar (não recriar) os escopos: `cursos:status_turma`,
`avaliacoes:gerar_link_avaliacao`, `leads:listar_leads`. Em dev, via shell
(`Usuario`/`TokenAgente.objects.get(nome=...)`, editar `escopos`, `save()`).
Documentar o passo equivalente pra prod no
`plataforma/n8n/workflows/README.md` (checklist de import/config já existe
ali).

## Workflow n8n (`MAG - Fase 0`, id `ypeJKZLsGq1WxkQB`)

Hoje o IF **"É gestor ou instrutor?"** (`true` branch) liga direto no nó
`Responder no WhatsApp` (eco de teste fixo). Isso muda pra:

- Nó **"Preparar contexto Operadora"** (Set, espelha "Preparar contexto SDR"):
  monta `numero`, `nome`, `texto` a partir do que já saiu de
  `Identificar Contato`/`Extrair dados`.
- Nó **AI Agent "Operadora - Secretária Digital"** (mesmo tipo/versão do SDR:
  `@n8n/n8n-nodes-langchain.agent`, `typeVersion 2.3`, NÃO 3.x — bug já
  mapeado na spec 010), usando o mesmo `Gemini Chat Model` e uma
  **memória própria** (chave por número, igual à SDR, mas não a mesma
  instância — conversa de gestor não deve se misturar com a de um lead que
  por acaso tenha o mesmo fluxo).
- 3 tools novas (`@n8n/n8n-nodes-langchain.toolHttpRequest`,
  `typeVersion 1.1`, credencial `httpHeaderAuth` → "MAG - X-Agente-Token",
  mesmo padrão de `escalar_contato`/`listar_cursos` — **nunca** header
  manual, **nunca** `{{ }}` no campo `url`):
  - `status_turma`: `POST /api/acoes/executar/`, body
    `{"acao": "status_turma", "params": {"turma_codigo": <controlado pela IA>}}`.
  - `gerar_link_avaliacao`: idem, `acao: "gerar_link_avaliacao"`.
  - `listar_leads`: idem, `acao: "listar_leads"`, `params: {"dias": <opcional>,
    "status": <opcional>}`.
- Nó **"Responder no WhatsApp (Operadora)"** (`httpRequest` com credencial
  `httpHeaderAuth` → "MAG - Evolution apikey", espelha "Responder no WhatsApp
  (SDR)").
- `system_message` da Operadora: apresenta-se como MAG (mesma persona
  pública, mas o gestor/instrutor já sabe que fala com o "operacional"),
  explica que só consulta por enquanto (sem inventar que mudou algo),
  nunca inventa `turma_codigo`/status/leads — sempre chama a tool certa
  antes de responder dado concreto.

## Decisões desta feature

- Token único reaproveitado (`agente-recepcionista-mag`) em vez de um
  token dedicado pra Operadora — mesmo pragmatismo já adotado nas specs
  009/012; revisar quando o squad crescer o bastante pra justificar
  granularidade por subagente.
- `dias` como janela de dias corridos (calendário), não rolante de 24h —
  mais alinhado com a forma como o Daniel fala ("hoje", "essa semana").
- Sem escrita nesta spec — qualquer pedido de ação (mudar vaga, aprovar
  avaliação) a Operadora recusa explicando que ainda não sabe fazer isso.

## Riscos / pontos de atenção

- Repetir os 4 bugs de n8n já mapeados (specs 010/012, ver Log e
  `.context/status.md` "EM ANDANGO" — typeVersion do AI Agent, node
  "não instalado" no editor visual ao editar via API, header manual
  quebrando o schema do Gemini, `{{ }}` no campo `url`).
- Memória separada da SDR: se a Operadora usar a mesma "Memória da conversa"
  node instance da SDR, uma pergunta de gestor pode contaminar o contexto
  de um lead (ou vice-versa) — usar instância de memória própria, mesma
  chave (`numero`) mas node diferente.

## Adendo — matrículas + link de matrícula (achado do Daniel pós-entrega)

O gestor não conseguia ver quantas matrículas a turma já tinha, nem gerar
o link de matrícula pelo chat. O model `Matricula` (`apps/educacional/
models.py`) já existe (spec/subsistema de carteirinha digital — token
UUID, escopo turma/individual, `.url` = `/carteirinha/{token}`), só não
estava exposto na Camada de Ações.

- `status_turma` (`apps/cursos/acoes.py`) ganha `matriculas` (mesma
  cautela de import protegido dos outros campos): conta
  `Matricula.objects.filter(turma=turma, status__in=[ATIVA, CONCLUIDA])`
  — não conta o convite de escopo turma ainda sem preencher.
- Ação nova `gerar_link_matricula` (`apps/educacional/acoes.py`, `ready()`
  do app ganha o import) — mesmo padrão exato de `gerar_link_avaliacao`:
  reusa `Matricula` de escopo turma ainda válida (`expira_em__gt=now()`)
  ou cria uma nova; devolve `{turma_codigo, url, expira_em}`. Mais simples
  que `ConviteAvaliacao` porque `Matricula` não tem campo `curso` direto
  (só via `turma.curso`).
- Operadora ganha essa 4ª tool (mesmo padrão `toolHttpRequest`); prompt
  atualizado pra listar as 4 tools e explicar o que é `matriculas`.
- `TokenAgente agente-recepcionista-mag` ganha
  `educacional:gerar_link_matricula`.

**Cuidado ao editar `systemMessage` via `n8n_update_partial_workflow`
(`updateNode`)**: um `updateNode` que só seta
`parameters.options.systemMessage` reconstrói o objeto `options` inteiro
em vez de fazer merge raso — apagou `promptType`/`text`/`maxIterations`/
`returnIntermediateSteps` do nó na primeira tentativa (`No prompt
specified` ao testar). Sempre conferir com `n8n_get_workflow` (`mode:
filtered`) depois de um `updateNode` em campo aninhado, e restaurar
qualquer campo-irmão que tenha sumido.
