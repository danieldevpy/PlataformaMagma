# Tasks 015 — Integração financeira (Asaas)

> Estados: PENDENTE → EM ANDAMENTO → ENTREGUE (agente) → DONE (revisado pelo orquestrador).

| ID | Tarefa | Estado | Agente |
|----|--------|--------|--------|
| T1 | App `apps/financeiro/` novo: `ConfiguracaoAsaas`, `Cobranca`, `EventoWebhookAsaas` + migration + `INSTALLED_APPS` | ENTREGUE | |
| T2 | Credencial cifrada: `set_credencial`/`get_credencial` + `set_webhook_token`/`get_webhook_token` em `ConfiguracaoAsaas` (reusa `apps.ia.crypto`); `ModelForm` de Admin com campos write-only `api_key_nova`/`webhook_token_nova` | ENTREGUE | |
| T3 | Adapter `apps/financeiro/adapters/asaas.py`: `ErroAsaas`, `buscar_ou_criar_cliente`, `criar_cobranca` — `requests` puro, timeout, trata erro HTTP/rede | ENTREGUE | |
| T4 | `apps/financeiro/services.py::criar_cobranca_para_matricula` — orquestra adapter + persiste `Cobranca` (valida matrícula existente, config ativa) | ENTREGUE | |
| T5 | Ações do agente `apps/financeiro/acoes.py`: `gerar_cobranca` e `consultar_pagamento` (escopos `financeiro:*`), registradas em `AppConfig.ready()` | ENTREGUE | |
| T6 | Webhook `POST /api/financeiro/webhook/asaas/`: validação `asaas-access-token`, mapeamento de status, grava `EventoWebhookAsaas`, atualiza `Cobranca` | ENTREGUE | |
| T7 | `CobrancaAdmin` (Django Admin): visualização + criação manual de fallback (`save_model` chama o service, campos do Asaas ficam readonly) | ENTREGUE | |
| T8 | Suíte de testes: crypto/config (T2), adapter mockado (T3), service (T4), as 2 ações via `X-Agente-Token` em `apps/nucleo/tests.py` (T5), webhook token válido/inválido/payload desconhecido (T6), smoke do Admin | ENTREGUE | |
| T9 | Cadastrar credencial sandbox real (Daniel cola API key + webhook token) e testar end-to-end: gerar cobrança real no sandbox, simular webhook (simulador do painel Asaas), confirmar status muda sozinho | ENTREGUE | |
| T10 | Atualizar `docs/plataforma/03-api-contratos.md` (2 ações + seção webhook), `.context/backend.md`, `.context/decisoes.md` (webhook é 1º do tipo — registrar padrão), `.context/status.md` + `.context/historico/` | ENTREGUE | |
| T11 | Integrar as 2 ações no workflow n8n do agente MAG (Operadora): 2 tools novas + protocolo de confirmação no system prompt + escopos no `TokenAgente` de dev; testar de ponta a ponta via WhatsApp simulado | ENTREGUE | |

## Ondas

- Onda 1: T1 (modelos base — tudo depende dela)
- Onda 2 (paralelo, depende de T1): T2, T3
- Onda 3 (depende de T2 + T3): T4
- Onda 4 (paralelo, depende de T4): T5, T7
- Onda 5 (depende de T1, pode rodar junto da onda 4): T6
- Onda 6 (depende de T1–T7): T8
- Onda 7 (depende de T8, precisa do Daniel): T9
- Onda 8 (fecha a spec): T10

## Log

- (2026-07-23) `plan.md`/`tasks.md` escritos (sandbox já criado no Asaas
  pelo Daniel). Aguardando revisão do Daniel antes de iniciar T1. Credencial
  será colada no chat quando chegar em T9 — nunca gerada/digitada pelo
  agente, só armazenada cifrada.
- (2026-07-23) Daniel aprovou o plano. Iniciando implementação por T1.
- (2026-07-23) T1-T8 ENTREGUES numa sessão só: app `apps/financeiro/` novo
  (models, adapter, service, ações, webhook, admin) + 27 testes novos (16
  em `apps.financeiro`, 11 em `apps.nucleo` pras 2 ações) — suíte completa
  226/226 (era 199). Achado no caminho: `CobrancaAdminForm` customizado
  (bypassa o save padrão do ModelForm pra chamar o service) quebrava com
  `AttributeError: 'CobrancaForm' object has no attribute 'save_m2m'` — o
  `ModelAdmin.save_related` sempre chama isso; corrigido com um
  `save_m2m` no-op no form (Cobranca não tem m2m). Pego pelo teste
  `AdminSmokeTests`, não em produção. Falta T9 (credencial sandbox real +
  teste end-to-end, precisa do Daniel) e T10 (docs/memória).
- (2026-07-23) **T9 ENTREGUE — teste real de ponta a ponta no sandbox**.
  Daniel criou o webhook no painel Asaas; expus o `backend-dev` (porta
  8123) via ngrok (`https://jackal-uninvited-keep.ngrok-free.dev`) pra dar
  uma URL pública alcançável em dev. Cadastrei a API key + token de webhook
  reais (colados no chat) em `ConfiguracaoAsaas` (sandbox, ativo) — round
  trip cifra/decifra confirmado. **Pix indisponível nessa conta sandbox**
  ("precisa estar aprovada") — erro veio limpo do Asaas, sem 500, exatamente
  como projetado; testado com boleto em vez disso. Gerei 2 cobranças reais
  pro aluno "Fernando" (turma 026): a 1ª antes do Daniel notar que o
  webhook estava **desligado** no painel (ficou "pendente" pra sempre — não
  há reenvio retroativo); a 2ª depois de ele ativar — simulei o pagamento
  via `POST /payments/{id}/receiveInCash` (API real) e o webhook chegou
  solo (`Asaas_Hmlg/3.0`, 200 OK, evento `PAYMENT_RECEIVED`), `Cobranca`
  virou `paga` **sem nenhuma intervenção manual** — critério de aceite
  confirmado. Testei também `consultar_pagamento` via HTTP real com
  `X-Agente-Token` (token de teste criado e removido na sessão) — devolveu
  as 2 cobranças com status corretos. Aviso do ngrok sobre "browser
  warning": só afeta visita manual em navegador, confirmado que não
  interferiu na entrega servidor-a-servidor do Asaas. Ficam no banco dev
  2 `Cobranca` de teste (pk 1 pendente, pk 2 paga) ligadas ao aluno real
  "Fernando" — dados de sandbox, sem dinheiro real, Daniel pode limpar
  pelo Admin se quiser. Túnel ngrok e servidor dev deixados rodando nesta
  sessão. Falta só T10 (docs/memória).
- (2026-07-23) **T10 ENTREGUE — spec 015 completa (T1-T10)**. Docs e
  memória viva atualizados: `docs/plataforma/03-api-contratos.md` (2 ações
  + seção "Webhook Asaas"), `.context/backend.md`, `.context/decisoes.md`,
  `.context/status.md`, `.context/historico/2026-07-23-spec-015-financeiro-asaas.md`.
  Fora de escopo desta sessão (registrado como pendência em
  `.context/status.md`): promover pra produção (`ConfiguracaoAsaas`
  produção, escopo `financeiro:*` no `TokenAgente` de prod, nós novos na
  Operadora do n8n).
- (2026-07-23) **T11 ENTREGUE — integração real no agente MAG**, a pedido
  do Daniel ("quero agora integrar no agente, para criar os link de
  pagamento"). n8n dev subido do zero (container/rede não existiam); 2ª
  instância do backend em `:8000` só pra bater com o hostname que os nós
  já usam. `gerar_cobranca`/`consultar_pagamento` adicionados como tools
  da Operadora (clonados do padrão `matricular_aluno`, via `n8n-mcp`
  `addNode`/`addConnection`), system prompt ganhou "PROTOCOLO DE COBRANÇA"
  via `patchNodeField`, `TokenAgente` de dev ganhou os 2 escopos. Testado
  de ponta a ponta com `n8n_test_workflow` simulando 3 mensagens reais do
  Evolution: consulta respondeu com dados reais; geração de cobrança
  **parou pra confirmar** mesmo com todo dado na mesma mensagem, e só após
  o "sim" buscou o aluno de novo (token fresco) e gerou uma 3ª cobrança
  real no sandbox. `plataforma/n8n/workflows/mag-fase-0-sdr.json`
  reexportado + `README.md` atualizado. Ver
  `historico/2026-07-23-spec-015-financeiro-asaas.md` §Continuação pro
  relato completo, incluindo o achado de setup (payload de teste com
  envelope `body` duplicado). Spec 015 fechada de ponta a ponta em dev;
  só falta promover pra produção quando o Daniel decidir.
