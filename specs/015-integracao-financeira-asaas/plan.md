# Plan 015 — Integração financeira (Asaas)

> O COMO. Referencia os docs em vez de duplicá-los.

## App novo: `apps/financeiro/`

Concern isolado (credencial de API externa + adapter HTTP + webhook), mesmo
espírito do `apps/ia` (provedor externo com credencial cifrada) — não entra
em `apps/educacional` pra não misturar "identidade/matrícula" com
"integração de pagamento". `Matricula` (`apps/educacional/models.py`) e
`Aluno.token` só são referenciados, nunca alterados.

## Toques no sistema

| Camada | O que muda | Referência |
|---|---|---|
| App novo | `apps/financeiro/` — `INSTALLED_APPS` (`config/settings/base.py:21-39`), `AppConfig.ready()` importa `acoes.py` (mesmo padrão de `apps/educacional/apps.py:9-10`) | — |
| Modelos | `ConfiguracaoAsaas`, `Cobranca`, `EventoWebhookAsaas` (novos) | ver §Modelos abaixo; `docs/plataforma/02` a atualizar na PR |
| API | `GET/POST /api/acoes/executar/` ganha 2 ações (`gerar_cobranca`, `consultar_pagamento`); rota nova `POST /api/financeiro/webhook/asaas/` (`AllowAny`, sem JWT/sessão) | `docs/plataforma/03` — atualizar tabela de ações + nova seção "Webhook Asaas" |
| Front | Nenhum. O "link de pagamento" é a página hospedada do próprio Asaas — nada de checkout próprio nesta spec | — |
| Painel/Admin | `django-admin` (`/dj-admin/`) ganha `ConfiguracaoAsaas` (credencial mascarada, 1 linha por ambiente) e `Cobranca` (visualização + criação manual de fallback); caminho principal de criação é a ação do agente MAG (WhatsApp), não o Admin | memória `avaliacao-prototipo-mvp` — painel do gestor é o Django Admin por ora |
| Seed | Nenhum dado de seed — cobrança é sempre gerada em runtime | `docs/plataforma/08` (sem mudança) |

## Modelos

```python
# apps/financeiro/models.py

class ConfiguracaoAsaas(ComTimestamps):
    class Ambiente(TextChoices):
        SANDBOX = "sandbox", "Sandbox (testes)"
        PRODUCAO = "producao", "Produção (dinheiro real)"

    ambiente = CharField(max_length=10, choices=Ambiente.choices, unique=True)
    api_key = CharField(max_length=1000, blank=True)          # cifrado, ver crypto
    webhook_token = CharField(max_length=1000, blank=True)     # cifrado, ver crypto
    ativo = BooleanField(default=False)   # só 1 linha ativa entre as 2 (save() garante)

    # set_credencial/get_credencial + set_webhook_token/get_webhook_token,
    # espelhando ProvedorIA.set_credencial/get_credencial (apps/ia/models.py:53-61)


class Cobranca(ComTimestamps):
    class FormaPagamento(TextChoices):
        PIX = "PIX", "Pix"
        BOLETO = "BOLETO", "Boleto"
        CARTAO = "CREDIT_CARD", "Cartão"
        INDEFINIDO = "UNDEFINED", "Aluno escolhe"

    class Status(TextChoices):
        PENDENTE = "pendente", "Pendente"
        PAGA = "paga", "Paga"
        VENCIDA = "vencida", "Vencida"
        CANCELADA = "cancelada", "Cancelada"
        ESTORNADA = "estornada", "Estornada"

    matricula = ForeignKey("educacional.Matricula", related_name="cobrancas", on_delete=CASCADE)
    valor = DecimalField(max_digits=8, decimal_places=2)
    forma_pagamento = CharField(max_length=12, choices=FormaPagamento.choices)
    status = CharField(max_length=10, choices=Status.choices, default=Status.PENDENTE)
    vencimento = DateField()
    link_pagamento = URLField()
    asaas_id = CharField(max_length=40, unique=True)     # id da cobrança no Asaas ("pay_...")
    ambiente = CharField(max_length=10, choices=ConfiguracaoAsaas.Ambiente.choices)
    criado_por = ForeignKey("contas.Usuario", null=True, blank=True, on_delete=SET_NULL)
    # null = criada pelo agente MAG via chat (auditoria completa já fica no
    # LogAcao da execução — apps/nucleo/models.py:154-181)


class EventoWebhookAsaas(ComTimestamps):
    """Trilha de todo webhook recebido — primeiro endpoint desse tipo no
    projeto (ver §Riscos), auditoria evita "caixa preta" quando o status
    não bate com o esperado."""
    evento = CharField(max_length=60)          # ex.: "PAYMENT_RECEIVED"
    payload = JSONField()
    cobranca = ForeignKey(Cobranca, null=True, blank=True, on_delete=SET_NULL)
    status_processamento = CharField(choices=[("processado","Processado"),("ignorado","Ignorado — cobrança não encontrada"),("erro","Erro")])
    erro = TextField(blank=True)
```

**Sem model `ClienteAsaas`**: o cliente Asaas de um aluno é resolvido em
runtime via `GET /v3/customers?externalReference=<aluno.token>` antes de
criar a cobrança (reusa se achar, cria se não achar) — evita guardar mais
um ID por ambiente e mantém `Aluno` intocado.

## Credencial cifrada

Reusa `apps.ia.crypto.cifrar`/`decifrar` (Fernet derivado do `SECRET_KEY`,
`apps/ia/crypto.py:13-41`) — é genérico (não tem nada específico de IA),
zero segredo novo pra gerenciar em produção. `ConfiguracaoAsaas` chama
essas funções nos seus próprios `set_credencial`/`get_credencial` (e
equivalentes pro `webhook_token`), mesmo padrão do `ProvedorIA`
(`apps/ia/models.py:53-61`).

Diferente do `ProvedorIA` (que tem página própria "Integrações de IA" no
frontend), aqui a credencial é cadastrada só pelo Django Admin — não existe
hoje um padrão de "campo mascarado write-only" em `ModelAdmin` (só existe
via DRF serializer, `apps/ia/serializers.py:38-73`); vou criar um
`ModelForm` com campos extra `api_key_nova`/`webhook_token_nova`
(`PasswordInput`, opcionais) que chamam `set_credencial`/`set_webhook_token`
no `save()` só se preenchidos — nunca mostram o valor salvo de volta.

## Adapter Asaas

`apps/financeiro/adapters/asaas.py` — `requests` puro, mesma linha de
`apps/ia/adapters/gemini.py` (função `_chamar` que trata `RequestException`
e status ≥400 como `ErroAsaas`, nunca deixa vazar stack trace/payload cru).

- `URL_BASE = {"sandbox": "https://api-sandbox.asaas.com/v3", "producao": "https://api.asaas.com/v3"}`
- Header de auth: `access_token: <api_key decifrada>`
- `buscar_ou_criar_cliente(config, aluno) -> asaas_customer_id`
- `criar_cobranca(config, customer_id, valor, vencimento, billing_type, external_reference) -> dict` (id, invoiceUrl, status)

`apps/financeiro/services.py` orquestra (usado tanto pela ação do agente
quanto pelo `ModelAdmin.save_model`): `criar_cobranca_para_matricula(matricula, valor, forma_pagamento, vencimento, usuario=None)`.

## Ações do agente (Camada de Ações, `apps/nucleo/acoes.py`)

Identificação de matrícula segue exatamente o padrão de
`matricular_aluno`/`listar_matriculas_turma` (`apps/educacional/acoes.py:59-83,131-179`):
`aluno_token` (uuid, de `buscar_aluno`) + `turma_codigo` — nunca PK, nunca
token próprio de Matrícula (ela não tem).

- `gerar_cobranca` — escopo `financeiro:gerar_cobranca`.
  Params: `aluno_token`, `turma_codigo`, `valor`, `forma_pagamento` (opcional,
  padrão "aluno escolhe"), `vencimento` (opcional, padrão hoje+3 dias).
  Resolve `Matricula` por `(aluno, turma)`, chama `services.criar_cobranca_para_matricula`,
  devolve `{aluno_nome, turma_codigo, valor, forma_pagamento, link_pagamento, vencimento}`.
  Protocolo de confirmação idêntico ao `matricular_aluno` (o system prompt do
  MAG já exige confirmar valor e destinatário antes de chamar — critério de
  aceite da spec).

- `consultar_pagamento` — escopo `financeiro:consultar_pagamento`.
  Params: `aluno_token`, `turma_codigo` (opcional se o aluno tiver 1 só
  matrícula; `ErroAcao` pedindo o código se for ambíguo). Devolve lista de
  `Cobranca` da matrícula (valor, forma, status, vencimento, criado_em).

## Webhook Asaas

`POST /api/financeiro/webhook/asaas/` — **primeiro webhook HTTP externo do
projeto** (o levantamento confirmou que não existe precedente — nem
`revalidate-hook` é Django, é rota Next.js). Decisões:

- View DRF simples, `authentication_classes = []`, `permission_classes = [AllowAny]`
  (sem `SessionAuthentication` → CSRF não entra em jogo, mas testar).
- Autenticação do webhook: header `asaas-access-token` comparado contra
  `ConfiguracaoAsaas.get_webhook_token()` das duas linhas (sandbox e
  produção correspondem a contas Asaas diferentes, cada uma com seu próprio
  token de webhook configurado no painel Asaas) — nenhuma bate → 401.
- Mapeamento de status Asaas → `Cobranca.Status`: `RECEIVED`/`CONFIRMED`/`RECEIVED_IN_CASH` → `paga`; `OVERDUE` → `vencida`; `REFUNDED`/`REFUND_REQUESTED` → `estornada`; `CANCELLED`/`DELETED` → `cancelada`; `PENDING` → `pendente`.
- Sempre grava `EventoWebhookAsaas`; se `payment.id` não bate com nenhuma
  `Cobranca.asaas_id`, grava como `ignorado` e devolve 200 (nunca 500/404 —
  Asaas reenvia agressivamente em erro, e uma cobrança de teste "solta" no
  sandbox não é motivo pra retry infinito).

## Decisões desta feature

- **App novo `apps/financeiro`**, não dentro de `educacional` — integração
  de pagamento é um concern isolado, mesmo raciocínio do `apps/ia`.
- **Reuso de `apps.ia.crypto`** em vez de duplicar/mover — é genérico, mover
  pra `apps.nucleo` seria só churn sem ganho nesta spec.
- **Sem model `ClienteAsaas`** — resolve por `externalReference` em runtime
  (1 chamada HTTP extra, evita mais uma tabela/ambiguidade sandbox×prod).
- **Criação pelo Admin é fallback, não o caminho principal** — o critério de
  aceite do gestor ("digo o valor, em segundos tenho o link, pelo celular")
  é atendido pela ação do agente MAG; o Admin serve pra Daniel testar e pra
  emergência sem WhatsApp à mão.
- **Nenhuma env var nova** — chave/token ficam cifrados no banco
  (`ConfiguracaoAsaas`), igual `ProvedorIA`; URLs sandbox/produção são
  constantes no adapter, não configuráveis por env (como `URL_BASE` do
  Gemini).

## Riscos / pontos de atenção

- **Nunca testar com dinheiro real sem querer** (aceite explícito): só 1
  `ConfiguracaoAsaas.ativo=True` por vez decide onde cobranças NOVAS são
  criadas — `save()` desativa a outra linha, mesmo mecanismo de `ProvedorIA.save()`
  (`apps/ia/models.py:44-51). Sandbox deve ficar ativo até o Daniel decidir
  explicitamente promover pra produção.
- **Primeiro webhook HTTP do projeto** — sem convenção prévia de assinatura;
  testar exaustivamente token válido/inválido/ausente antes de considerar
  pronto. Usar o simulador de webhook do próprio painel sandbox do Asaas.
- **Retry do Asaas**: webhook fora do ar ou lento gera reenvio automático —
  a view precisa responder rápido e nunca depender de terceiros dentro da
  própria request de webhook (a atualização de `Cobranca` é local, então ok).
- **Erro de rede/Asaas fora do ar ao gerar cobrança**: `ErroAsaas` vira
  `ErroAcao` (chat) e mensagem amigável no Admin — nunca 500 cru pro
  gestor/agente.
- **PII**: nunca logar CPF/telefone/api_key/webhook_token; `EventoWebhookAsaas.payload`
  do Asaas não inclui CPF (só id/status/valor), mas revisar no teste real.
