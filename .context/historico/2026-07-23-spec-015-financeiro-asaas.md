# 2026-07-23 (madrugada) — Spec 015 (integração financeira Asaas) entregue

## Prompt do Daniel

"quero começar a implementação da spec de pagamento, já criei a conta
sandbox do asaas" — a spec (`specs/015-integracao-financeira-asaas/spec.md`)
já existia (critérios de aceite definidos), faltava `plan.md`/`tasks.md` e
a implementação inteira.

## Estado ao entrar

Só `spec.md`. Nenhum código do app financeiro existia ainda.

## O que foi feito

**plan.md/tasks.md.** Levantamento dos padrões já existentes (credencial
cifrada do `apps/ia`, Camada de Ações, models `Aluno`/`Matrícula`/`Turma`)
antes de desenhar o plano — confirmado que **não existia nenhum webhook
HTTP externo no projeto** (nem `revalidate-hook`, que é rota Next.js, não
Django). Decisões registradas em `.context/decisoes.md` (2026-07-23):
app novo `apps/financeiro/`, reuso de `apps.ia.crypto`, sem model
`ClienteAsaas` (resolvido por `externalReference` em runtime).

**T1-T8 — implementação + testes (numa sessão só).** `apps/financeiro/`:
`models.py` (`ConfiguracaoAsaas`, `Cobranca`, `EventoWebhookAsaas`),
`adapters/asaas.py` (`requests` puro, mesma linha do adapter Gemini),
`services.py::criar_cobranca_para_matricula` (ponto único de orquestração,
usado pela ação do agente E pelo Admin), `acoes.py` (`gerar_cobranca`,
`consultar_pagamento` — identificação por `aluno_token`+`turma_codigo`,
mesmo padrão de `matricular_aluno`), `views.py` (webhook), `admin.py`
(credencial mascarada + criação manual de fallback). 27 testes novos (16
em `apps.financeiro`, 11 em `apps.nucleo` pras 2 ações) — suíte completa
226/226.

Achado no caminho: `CobrancaAdminForm` customizado (bypassa o `save()`
padrão do `ModelForm` pra chamar o service em vez de só gravar campos
crus) quebrava com `AttributeError: 'CobrancaForm' object has no attribute
'save_m2m'` — o `ModelAdmin.save_related` sempre chama isso depois de
salvar, e como o form não passava pelo fluxo padrão (`commit=False` +
`save_m2m` dinâmico), o atributo nunca existia. Corrigido com um
`save_m2m` no-op no form (`Cobranca` não tem campo m2m). Pego pelo teste
`AdminSmokeTests`, nunca chegou perto de produção.

**T9 — teste real de ponta a ponta no sandbox.** Faltava uma URL pública
pra o Asaas conseguir chamar o webhook — dev roda em `localhost`. Com
autorização explícita do Daniel, instalei o `ngrok` (binário oficial,
`~/.local/bin/`, sem `sudo`) e configurei o authtoken que ele gerou numa
conta nova. Subi o `backend-dev` (porta 8123, via `preview_start` do
`.claude/launch.json`) e o túnel ngrok (`https://jackal-uninvited-keep.ngrok-free.dev`).

Guiei o Daniel pela tela de Webhooks do painel Asaas (URL do túnel + Ngrok,
versão v3, tipo de envio **Sequencial** — dado financeiro, sem motivo pra
não sequencial num volume baixo — e os eventos de status de cobrança).
Ele colou a API key sandbox e o token de webhook no chat; gravei os dois
cifrados em `ConfiguracaoAsaas` (ambiente sandbox, ativo) via
`manage.py shell` alimentado por um script no scratchpad, apagado depois
de rodar — nunca ficaram em arquivo do repo nem em log.

**2 achados de ambiente, não bugs do código:**
1. **Pix indisponível** nessa conta sandbox ("precisa estar aprovada") —
   o adapter devolveu o erro do Asaas limpo (`ErroAsaas` → `ErroFinanceiro`
   → 400), exatamente como projetado; testei com boleto em vez disso.
2. **1ª tentativa não funcionou** porque o Daniel tinha deixado o webhook
   **desligado** no painel (o toggle "Este Webhook ficará ativo?") — a
   1ª cobrança de teste ficou "pendente" pra sempre (webhooks não são
   reenviados retroativamente). Ativado o toggle, gerei uma 2ª cobrança —
   simulei o pagamento via `POST /payments/{id}/receiveInCash` (API real
   do Asaas, não é feature de teste) e o webhook chegou de verdade
   (`User-Agent: Asaas_Hmlg/3.0`, 200, evento `PAYMENT_RECEIVED`) —
   `Cobranca` virou `paga` **sem nenhuma ação manual**. Testei também
   `consultar_pagamento` via `X-Agente-Token` real (token de teste criado
   e removido na mesma sessão) — devolveu as 2 cobranças com status
   corretos.

**T10 — docs/memória.** `docs/plataforma/03-api-contratos.md` (2 ações na
tabela + seção nova "Webhook Asaas"), `.context/backend.md` (linha do app
`financeiro`), `.context/decisoes.md`, `.context/status.md` e esta entrada.

## Estado ao saír

Backend completo e testado (226/226, sandbox real validado de ponta a
ponta). Ficam no banco **dev** 2 `Cobranca` de teste (pk 1 pendente, pk 2
paga) ligadas ao aluno real "Fernando" — dados de sandbox, sem dinheiro
real; o Daniel pode limpar pelo Admin se quiser. Túnel ngrok e servidor
dev deixados rodando ao final da sessão.

**Pendente**: promover pra produção (ver `.context/status.md` §Próximo
passo) — cadastrar `ConfiguracaoAsaas` de produção só quando o Daniel
decidir ativar cobrança real, e dar escopo `financeiro:*` ao `TokenAgente`
de prod.

## Continuação (mesmo dia): integração no agente MAG via WhatsApp

Pedido do Daniel: "quero agora integrar no agente, para criar os link de
pagamento". A camada de ações já existia (T5); faltava plugar no workflow
n8n de fato.

**Infra que precisou subir**: `n8n` dev não estava rodando (container
nem existia) — subido via `docker compose -f docker-compose.dev.yml up -d`
depois de recriar a rede externa `magma-dev-net` (não existia). O
`backend-dev` desta sessão rodava em `:8123` (`.claude/launch.json`), mas
todos os nós do workflow (25+) já usam `http://magma-backend-interno:8000`
hardcoded (decisão de paridade dev/prod de 2026-07-20) — em vez de editar
26 nós existentes, subi uma 2ª instância do `runserver` em `0.0.0.0:8000`
(mesmo banco SQLite) só pra esse hostname resolver certo por
`extra_hosts: host-gateway`. Confirmado com `docker exec magma-n8n-dev
wget http://magma-backend-interno:8000/...` antes de tocar no workflow.

**Mudanças no workflow** (`MAG - Fase 0 (eco WhatsApp)`, via `n8n-mcp`):
- 2 nós `toolHttpRequest` novos (`gerar_cobranca`, `consultar_pagamento`),
  clonados exatamente do padrão de `matricular_aluno`/`buscar_aluno`
  (mesma credencial `MAG - X-Agente-Token`, `X-Forwarded-Proto: https`
  fixo — nunca esquecer esse header, é o que evita o bug de redirect SSL
  já documentado em `.context/status.md`), conectados como `ai_tool` da
  Operadora.
- System prompt da Operadora ganhou "PROTOCOLO DE COBRANÇA" (buscar →
  confirmar → gerar, mesmo espírito do protocolo de matrícula) via
  `patchNodeField` (find/replace cirúrgico — nunca `updateNode` bruto no
  campo aninhado, lição da spec 013 que apagou o prompt sem querer).
- `TokenAgente` "agente-recepcionista-mag" (o que o n8n de fato usa em dev)
  ganhou `financeiro:gerar_cobranca` + `financeiro:consultar_pagamento`.

**Teste real de ponta a ponta** (via `n8n_test_workflow`, simulando payload
do Evolution, número do gestor Daniel):
1. "o Fernando ja pagou a 026?" → Operadora chamou `buscar_aluno` →
   `consultar_pagamento` e respondeu com as 2 cobranças reais criadas no
   T9 (uma paga, uma pendente) — sem inventar nada.
2. "gera uma cobranca de 20 reais em boleto pro fernando na 026" (tudo
   numa mensagem só) → a IA **não** gerou de cara: buscou o aluno e **parou
   pra pedir confirmação explícita** ("...confirma?") — protocolo
   respeitado mesmo com todos os dados já na mensagem.
3. "sim, confirma" (mensagem separada, memória do n8n manteve o contexto
   pelo `numero` como session key entre as 2 chamadas de webhook) → chamou
   `buscar_aluno` DE NOVO (token fresco, exatamente a regra anti-alucinação
   da spec 014) e então `gerar_cobranca` — devolveu uma cobrança real nova
   no sandbox (`https://sandbox.asaas.com/i/wqrlmnlmkotg0ilp`) formatada
   numa resposta natural.
4. Único erro nas 3 execuções: `Responder no WhatsApp (Operadora)` falhou
   (`ENOTFOUND evolution-api`) — esperado, Evolution API não está rodando
   nesta sessão (fora de escopo, WhatsApp real já validado em specs
   anteriores).

**Achado de setup, não bug**: no primeiro teste, esqueci o envelope duplo
— o corpo que o Evolution manda pro webhook já é `{event, data}`
diretamente (o n8n envelopa de novo em `.body` sozinho); mandar
`{"body": {...}}` como payload de teste duplicava o aninhamento e a
condição "é mensagem de texto?" caía silenciosamente no ramo falso.

`plataforma/n8n/workflows/mag-fase-0-sdr.json` reexportado (30 nós, era
28) e `README.md` (checklist de credencial de prod) atualizado com os 2
escopos novos.

### Estado ao sair (sessão completa)

n8n dev, o `runserver :8000` extra e o túnel ngrok ficaram rodando.
Critério de aceite "Agente MAG ganha 2 ações novas" da spec 015 está
demonstrado de ponta a ponta em dev — falta só promover pra produção
(pendência já registrada acima, sem mudança).
