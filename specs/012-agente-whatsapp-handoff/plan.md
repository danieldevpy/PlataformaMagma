# Plan 012 — como fazer

> Referências: spec 009 (`identificar_contato`, registry), spec 010 (padrão
> de tool HTTP no AI Agent — usar `toolHttpRequest` typeVersion 1.1, NÃO o
> `httpRequest` comum nem `AI Agent typeVersion 3.x`, ver `.context/decisoes.md`
> e o Log da spec 010 pro bug já mapeado).

## Toques no sistema

| Camada | O que muda | Referência |
|---|---|---|
| Modelos/migrations | `ContatoEscalado` novo em `apps/nucleo/models.py` | `docs/plataforma/02` |
| API | `identificar_contato` ganha campo `escalado`; ação nova `escalar_contato` | `docs/plataforma/03` (atualizar as duas) |
| Painel/Admin | `ContatoEscaladoAdmin` — apagar = liberar | `docs/plataforma/06` |
| n8n | Workflow `MAG - Fase 0` ganha ramo "escalado = silêncio" + SDR ganha 2 tools novas | — |

## Modelo (`apps/nucleo/models.py`)

`ContatoEscalado(ComTimestamps)`: `numero` (`CharField`, único, mesmo
formato dos outros — só dígitos com DDI), `motivo` (`CharField`, texto
curto). Sem campo de status/booleano — **a presença do registro já é o
estado** (existe = pausado; apagado = liberado). `__str__` →
`f"{self.numero} — {self.motivo}"`. Admin: `list_display = ("numero",
"motivo", "criado_em")`, sem `has_add_permission` restrito (pode criar na
mão também, se um dia precisar pausar manualmente).

## Ações (`apps/nucleo/acoes_contato.py`)

- `identificar_contato`: no fim, antes do `return`, adiciona
  `"escalado": ContatoEscalado.objects.filter(numero=numero).exists()` em
  todos os retornos (gestor/instrutor/lead/desconhecido — vale pra
  qualquer papel, um gestor também pode ser silenciado se fizer sentido no
  futuro, mas por ora só a SDR consulta esse campo).
- `escalar_contato(params, request)`, escopo `nucleo:escalar_contato`:
  `numero` e `motivo` obrigatórios (`ErroAcao` se faltar); `get_or_create`
  por `numero`, atualiza `motivo` se já existir (reescalar com novo
  motivo não é erro). Devolve `{"ok": true}`.

`TokenAgente agente-recepcionista-mag`: acrescentar
`"nucleo:escalar_contato"` na lista de escopos (não recriar o token, só
editar `escopos` no admin ou via shell).

## Workflow n8n (`MAG - Fase 0`, id `ypeJKZLsGq1WxkQB`)

- `Preparar contexto SDR` (Set) ganha o campo `escalado` (de
  `$json.resultado.escalado`).
- Novo IF **"Está escalado?"** entre `Preparar contexto SDR` e o SDR
  (no ramo que hoje vai direto pra SDR): `true` → sem conexão (silêncio,
  fim do fluxo); `false` → segue pro SDR como hoje.
- SDR ganha 2 tools novas (mesmo tipo `@n8n/n8n-nodes-langchain.toolHttpRequest`,
  `typeVersion: 1.1`, dos 3 tools existentes):
  - `escalar_contato`: `POST /api/acoes/executar/` (`X-Agente-Token`),
    body `{"acao": "escalar_contato", "params": {"numero": <fixo, $json.numero>,
    "motivo": <controlado pela IA>}}`.
  - `avisar_equipe`: `POST /message/sendText/{instance}` na Evolution,
    `number` fixo = WhatsApp do Daniel (o mesmo já cadastrado como
    `Usuario.whatsapp` do gestor — **não hardcoded de novo no node**: como
    o roteador já roda `identificar_contato` pro PRÓPRIO Daniel quando ele
    fala com a MAG, o número dele já é conhecido; usar o valor fixo direto
    é aceitável aqui porque só existe 1 gestor hoje — documentar como
    simplificação de MVP), `text` = motivo + nome/número de quem precisa de
    atenção (controlado pela IA, mas sempre incluindo `$json.numero` fixo
    no texto pra garantir que o contato certo apareça mesmo que a IA
    esqueça).
- `system_message` do SDR ganha uma seção nova: gatilhos de handoff
  (intenção de fechar matrícula, reclamação, assunto de saúde sensível,
  pedido explícito de humano) → chamar **as duas tools** (`escalar_contato`
  e `avisar_equipe`) e responder ao lead avisando que a equipe já foi
  chamada, sem insistir em vender.

## Decisões desta feature

- Sem `RegraAgente` ainda — gatilhos ficam em texto no system prompt
  (mesma decisão já tomada nas specs anteriores; revisar quando
  `RegraAgente` nascer).
- "Grupo interno" vira DM pro Daniel — não existe grupo configurado; trocar
  depois é só mudar o número fixo do tool `avisar_equipe`.
- Liberação manual (apagar no admin) em vez de expiração automática —
  mais simples e mais seguro (não corre risco do bot voltar sozinho antes
  da hora).

## Riscos / pontos de atenção

- Repetir o padrão já validado (`toolHttpRequest` 1.1 + `AI Agent` 2.3) —
  **não tentar `httpRequest` comum nem subir a versão do Agent**, já
  confirmado quebrado nesta build do n8n (spec 010, Log).
- `escalar_contato` decide baseado no que a IA interpreta da conversa —
  igual a qualquer LLM, pode deixar passar um caso ambíguo; não é 100%
  determinístico. Aceitável pro MVP (mesma natureza de risco que já existe
  no resto da SDR).
