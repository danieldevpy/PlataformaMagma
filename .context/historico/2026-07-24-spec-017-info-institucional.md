# 2026-07-24 — Spec 017: info institucional da SDR

## Prompt do Daniel

Pediu uma análise das ferramentas do n8n usadas no projeto e se fazia
sentido ter alguma nova, baseada no estado atual (meta: turma cheia até
08/08). Depois de ver a análise (15 tools existentes, 3 candidatas a
lacuna), escolheu começar pela primeira: `info_institucional` — a SDR não
sabia responder "onde fica a escola?" ou "tem Instagram?", lacuna já
registrada nas "lacunas conhecidas" do `.context/status.md`.

## O que foi feito

- Spec-driven completo: `specs/017-agente-whatsapp-info-institucional/`
  (spec.md, plan.md, tasks.md).
- Backend: ação nova `info_institucional` (`apps/nucleo/acoes_institucional.py`,
  registrada em `apps/nucleo/apps.py::ready()`) — devolve `endereco`,
  `whatsapp_principal`, `instagram`, `email` sempre; `nota_google` e
  `total_alunos_formados` só quando o toggle correspondente
  (`exibir_nota_google`/`exibir_total_formados`) está ligado, senão `null`.
  Decisão registrada no `plan.md`: diferente do serializer público de
  `GET /api/site/config/` (que expõe os campos crus e deixa o front
  decidir exibir), a ação filtra na origem — um agente de IA não tem CSS
  escondido, se o dado chega no prompt ele pode falar.
- 4 testes novos (`InfoInstitucionalTests`) — suíte completa 230/230.
- `docs/plataforma/03-api-contratos.md` ganhou a entrada da ação.
- n8n: workflow `MAG - Fase 0 (eco WhatsApp)` ganhou o 40º nó
  (`toolHttpRequest info_institucional`, mesmo padrão de `listar_turmas`),
  ligado só na SDR (não na Operadora — pergunta institucional é coisa de
  lead/público, não de gestor). `TokenAgente agente-recepcionista-mag`
  (dev) ganhou o escopo `nucleo:info_institucional`.

## Achados no caminho

1. **Porta 8000 do host ocupada por outro projeto**: ao tentar rodar um
   `runserver` de dev pra testar, descobri que a porta 8000 já respondia
   — mas com um Django de **outro sistema** (rotas `apac_request`,
   `apac_batch`, `establishment`... claramente não é a Magma), rodando
   como `root`, não iniciado por mim nesta sessão. Sem mexer nesse
   processo alheio, subi um `runserver` de teste em `0.0.0.0:8001` e
   apontei temporariamente só os 2 nós que precisavam responder
   (`Identificar Contato` + o novo `info_institucional`) pra lá via
   `n8n-mcp` (`patchNodeField`), revertendo os dois pra `:8000` (padrão
   real, igual aos outros 38 nós) antes de reexportar o JSON. Nenhum nó
   além desses dois foi tocado.
2. **403 na tool nova**: faltava o escopo `nucleo:info_institucional` no
   `TokenAgente agente-recepcionista-mag` de dev — corrigido via shell.
3. **JSON exportado pela API REST do n8n, não pelo MCP**: o `n8n_get_workflow`
   (MCP) devolve o workflow com metadados extras (`shared`, `versionId`
   etc.) que o formato de arquivo do repo não usa; usei a REST API do n8n
   direto (`GET /api/v1/workflows/{id}`, mesma API key do MCP) pra pegar o
   JSON completo e depois recortei só `name`/`nodes`/`connections`/`settings`,
   igual ao formato já versionado.

## Teste real

Via `n8n_test_workflow` (payload sintético estilo Evolution, número de
teste `5521979070319`, não cadastrado como gestor/instrutor → vai pro
ramo SDR): "Oi, onde fica a escola de vocês e qual o Instagram?" → a MAG
respondeu com o endereço real (`Rua Nossa Senhora de Fátima, 495 —
Olinda, Nilópolis/RJ`) e o Instagram real (`@magma_curso`), **sem**
mencionar nota do Google nem total de formados (toggles desligados em
dev — comportamento certo, confirmado no `intermediateSteps` da execução:
a tool devolveu os dois campos como `null` e a IA simplesmente não falou
deles). Único erro da execução foi o já esperado (Evolution API não roda
nesta sessão de teste) — mesmo padrão de todas as specs anteriores.

## Estado ao sair

- Backend: pronto, testado, commitável.
- n8n dev: workflow atualizado e ativo (`ypeJKZLsGq1WxkQB`, 40 nós),
  `TokenAgente` dev com o escopo novo. Container `magma-n8n-dev` +
  `magma-n8n-redis-dev` deixados rodando (mesmo padrão do
  `init-dev.sh --n8n` — sobem e ficam).
  `plataforma/n8n/workflows/mag-fase-0-sdr.json` reexportado.
- **Pendente**: promover pra prod (escopo `nucleo:info_institucional` no
  `TokenAgente` de prod + `promover-prod.sh mag-fase-0-sdr.json`) —
  decisão do Daniel, mesmo checklist das specs 013-016.
- Backend runserver de teste (`:8001`) foi encerrado ao final; o processo
  desconhecido na porta 8000 não foi tocado (não é deste projeto).
