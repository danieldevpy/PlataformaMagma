# 2026-07-20 (continuação) — Fase 1 do agente WhatsApp: A1 SDR + A2 Nutridora (T+0)

> Continuação da sessão de `2026-07-20-evolution-api-compose.md` (mesma
> branch `feature/evolution-api-compose`) — Fase 0 e spec 009 já estavam
> prontas. Daniel pediu pra seguir desenvolvendo pela ordem projetada no
> plano-mãe.

## Prompt do Daniel (resumo)

Bater o martelo nas 7 decisões do §10 do plano (feito via `AskUserQuestion`:
persona "MAG" única, número de teste fica só teste, LLM configurável/
trocável, agenda de visitas no Data Table do n8n) e seguir desenvolvendo na
ordem projetada: A1 SDR, depois A2 Nutridora.

## Spec 010 — A1 SDR ("Capitã de Matrículas")

Nó AI Agent no workflow `MAG - Fase 0`, com 3 tools HTTP lendo as APIs
públicas já existentes (`GET /api/cursos/`, `GET /api/cursos/{slug}/`,
`POST /api/leads/` — todas `AllowAny`, zero mudança no Django) — reroteado
por papel: `lead`/`desconhecido` cai na SDR, `gestor`/`instrutor` mantém o
reconhecimento simples da spec 009.

**Bug real do n8n encontrado e resolvido** (Daniel reconheceu o padrão de um
problema que já tinha visto em outro projeto — valeu a pena não descartar
como "aviso bobo"):

- Sintoma: toda chamada de tool falhava com `"The node
  '@n8n/n8n-nodes-langchain.toolHttpRequest' has a 'supplyData' method but
  no 'execute' method"`.
- Investigado direto no código-fonte instalado no container (`docker exec` +
  grep/sed nos arquivos `.js` do `n8n-nodes-langchain` e `n8n-core`) — não
  dava pra confiar só em busca na internet, os resultados batiam com um bug
  parecido mas em outro código (`job-processor.ts`, modo queue/MCP Trigger,
  já corrigido — não é o nosso caminho de execução).
- Causa real: `AI Agent typeVersion 3.1` (a versão "nova", `ToolsAgent/V3`)
  tem uma inconsistência interna nessa build do n8n (`n8nio/n8n:latest`,
  2.30.7) — o setup das tools (`executeBatch.ts`) exige que todo node
  conectado como `ai_tool` tenha `supplyData`; mas a invocação de fato, em
  outro ponto do código (`workflow-execute.js::runNode`), tenta `execute()`.
  Testei as DUAS alternativas de tipo de node pra tool (o
  `toolHttpRequest` legado, só `supplyData`; e o `httpRequest` comum
  "usableAsTool", só `execute`) — nenhuma das duas funciona com a V3, cada
  uma bate numa ponta diferente da mesma inconsistência.
- Fix: baixar o AI Agent pra `typeVersion 2.3` (`ToolsAgent/V2`, mecanismo
  mais antigo/estável) + voltar as tools pro `toolHttpRequest` original.
  Funcionou de primeira depois disso.
- Efeito colateral: trocar `typeVersion` via API zera os `parameters` do
  node (tive que reconfigurar o prompt/system message do zero) — e o
  editor do n8n não mostra mais esse node como editável na tela ("Install
  this node to use it"), mesmo executando perfeitamente — parece que
  versões mais antigas somem da lista de nodes "instaláveis" da UI, mas
  continuam funcionando via execução/API. Confirmado nos dois navegadores
  do Daniel, não é cache. A partir de agora esse node específico só é
  editado via `n8n-mcp`.
- Outro efeito colateral menor: memória de conversa (Window Buffer,
  in-memory) acumulou histórico misto V3→V2 durante os testes e quebrou uma
  chamada à API do Gemini ("function response turn deve vir logo após
  function call turn") — resolvido reiniciando o container do n8n (memória
  é só RAM, não persiste, sem perda real).

Validado com teste real via WhatsApp (preço R$650, turma 08/2026, vagas não
inventadas quando a API devolve `null`) e via `n8n_test_workflow`
(automação, sem precisar do Daniel reenviar toda hora).

**Lacuna registrada, não fechada**: agente não responde perguntas
institucionais gerais (endereço formatado, Instagram, nota Google) — não
tem tool pra `GET /api/site/config/`. Combinado com o Daniel: fica pra
depois, seguindo a ordem do plano em vez de tapar buraco fora de ordem.

## Spec 011 — A2 Nutridora, boas-vindas imediata (T+0)

Fatia pequena e determinística (sem IA — "não conversa, age no tempo"): o
gancho `N8N_LEAD_WEBHOOK` já existia (`apps/leads/signals.py`, disparava em
todo `Lead` novo) mas nunca tinha sido ligado a nada. Configurado
`backend/.env` (dev, gitignored) + workflow novo `MAG - Nutridora (T+0)`
(Webhook → checa se tem whatsapp → monta mensagem com o nome do curso real
→ manda via Evolution). T+1d/T+3d/T+7d (conteúdo, prova social, "vagas
acabando") ficam pra próxima spec — precisam de cron e de campo novo no
`Lead` pra rastrear qual toque já foi mandado.

Testado ponta a ponta: lead criado via `POST /api/leads/` → mensagem de
boas-vindas chegou de verdade no WhatsApp de teste, citando o curso certo.
Lead de teste removido do banco depois.

## Spec 012 — Handoff: escalar pro humano e silenciar o bot

Daniel perguntou onde no plano estava documentada a parte de avisar o
gestor / intervenção humana no chat. Resposta: três mecanismos diferentes
no plano-mãe (§4), nenhum implementado ainda — handoff do A0 (avisa a
equipe + silencia o contato), B1 Operadora (gestor pergunta), B5 Radar
(resumo diário proativo). Escolhido o handoff primeiro, por ser o que mais
falta pro SDR não ficar "sozinha" numa conversa que precisa de humano.

Implementado: modelo `ContatoEscalado` (nucleo) — a presença do registro já
é o estado (existe = silenciado; apagar no admin = libera, sem campo de
status/booleano). Ação `identificar_contato` ganhou o campo `escalado`
(reaproveita a mesma chamada que o roteador já faz sempre, zero HTTP
extra). Ação nova `escalar_contato(numero, motivo)`. Workflow ganhou um IF
"Está escalado?" logo depois da identificação — contato escalado não passa
disso, nem eco nem SDR. A SDR ganhou 2 tools: `escalar_contato` (grava o
motivo) e `avisar_equipe` (manda WhatsApp de verdade pro número do Daniel —
"grupo interno" ainda não existe, é DM por enquanto, documentado como
simplificação de MVP).

**Segundo bug real do n8n encontrado nesta sessão** (depois do da spec
010): `toolHttpRequest` com `sendHeaders: true` + header definido na mão
(`headerParameters`) quebra o schema de function-calling que o node monta
pro Gemini — erro `GenerateContentRequest.tools[].function_declarations[].
parameters.properties[]: key cannot be empty`. Testado exaustivamente:
não era sobre `$fromAI()` (o node não entende, só `{placeholder}` literal
mesmo — outro achado secundário), não era sobre múltiplos placeholders no
mesmo campo, não era sobre nome de placeholder colidindo entre tools —
isolado por eliminação (`sendHeaders: false` fez o erro sumir na hora) que
o problema é genuinely no código de extração de parâmetro dos HEADERS
manuais, mesmo com `valueProvider: "fieldValue"` explícito. As 3 tools da
spec 010 nunca tinham testado `sendHeaders`, por isso o bug não tinha
aparecido antes. Fix: trocar header manual por credencial `httpHeaderAuth`
(`authentication: "genericCredentialType"`) — bypassa esse código
quebrado. Duas credenciais criadas via `n8n-mcp`: "MAG - X-Agente-Token" e
"MAG - Evolution apikey".

Ciclo completo testado via `n8n_test_workflow` (webhook direto — não
precisou incomodar o Daniel a cada tentativa, só no final pra confirmar a
notificação real): mensagem de handoff → `escalar_contato` e
`avisar_equipe` chamados → registro criado no banco → WhatsApp real
chegou pro Daniel → mensagem seguinte do mesmo número não gerou resposta
nenhuma (silêncio confirmado via execução, 7 nós, parou no IF) → liberado
(apagar o registro, simulando o admin) → voltou a responder normal.

## Incidente: testes do Django mandando WhatsApp de verdade

Depois de ajustar a cidade errada no prompt (Nova Iguaçu → Nilópolis) e
liberar um terceiro número de teste, o Daniel reportou ter visto no
WhatsApp da instância mensagens enviadas pra números que nunca escreveram
nada e não estavam na lista de permitidos.

Investigação: eram os números fictícios usados como fixture em
`apps/nucleo/tests.py` (`5521999990003` "Maria Interessada",
`5521999990004` "Mesmo Número"). Causa raiz de duas camadas:

1. `backend/.env` (criado na spec 011) tem a URL **real** do
   `N8N_LEAD_WEBHOOK`.
2. Rodei `manage.py test` sem `--settings=config.settings.test` durante a
   sessão inteira (usei o padrão, que cai em `config.settings.dev` — o
   `manage.py` só troca de settings se alguém passar a flag). `dev.py`
   também lê `backend/.env`, então todo teste que cria um `Lead` disparou
   o webhook de verdade, e a Nutridora (ativa) respondeu mandando WhatsApp
   real pros números da fixture.

Ação imediata: desativei a Nutridora até corrigir. Fix em duas camadas:
`config/settings/test.py` agora força `N8N_LEAD_WEBHOOK = ""` (não
importa o `.env`); `MAG - Nutridora` ganhou o mesmo filtro de números de
teste do workflow principal (defesa em profundidade, mesmo se eu esquecer
a flag de novo). Confirmado rodando a suíte do jeito certo — nenhuma
execução nova no n8n; banco confirmado limpo (só os 2 leads reais de
teste já conhecidos). Reativei a Nutridora com os dois fixes no lugar.

**Lição registrada**: sempre `--settings=config.settings.test` (ou
`plataforma/rodar-testes.sh`) pra rodar a suíte — nunca `manage.py test`
cru num projeto com integrações externas (webhook) configuradas em `.env`.
Guardado como memória (`testes-settings-isolado`) pra não repetir em
projeto nenhum.

## Ajustes finais de UX (testando com o Daniel)

Duas coisas pequenas encontradas testando a conversa de verdade:

- **Cidade errada**: o system prompt da SDR tinha "Nova Iguaçu/RJ"
  hardcoded (herdado da descrição solta do projeto) — o dado real
  (`ConfiguracaoSite.endereco`) é Nilópolis/RJ, bairro Olinda. Corrigido e
  **tirada a cidade fixa do prompt** (a SDR já pega isso certo pela API,
  evita destincronizar nomes de novo).
- **Boas-vindas redundante**: quando a SDR já registra o lead
  (`registrar_lead`) DENTRO da própria conversa de WhatsApp, a Nutridora
  disparava a mesma mensagem de "recebi seu interesse" logo em seguida —
  interrompendo uma conversa que já estava rolando naturalmente. Fix: nó
  "Tem WhatsApp?" da Nutridora virou "Deve mandar boas-vindas?", ganhou a
  condição `utm_source != "whatsapp"` (a SDR sempre marca esse
  `utm_source` no lead que registra) — testado os dois caminhos reais via
  `POST /api/leads/`.

## Estado ao sair (fim de sessão)

- **Suíte 100% verde** rodando do jeito certo (`plataforma/rodar-testes.sh`):
  161 testes backend + estáticos do admin + 56 testes frontend. Zero
  execução nova disparada no n8n durante a checagem final.
- Workflows ativos no n8n: `MAG - Fase 0 (eco WhatsApp)` (id
  `ypeJKZLsGq1WxkQB` — identificação + SDR + handoff, cidade corrigida pra
  Nilópolis, 3 números de teste liberados: `991920338`, `5521979070319`,
  `5521964946079`) e `MAG - Nutridora (T+0)` (id `3qI5VzAWMZbU2vly` — mesmo
  filtro de números + não manda mais boas-vindas redundante quando o lead
  nasce no próprio WhatsApp).
- Credenciais no n8n: `MAG - Gemini` (googlePalmApi), `MAG - X-Agente-Token`
  e `MAG - Evolution apikey` (httpHeaderAuth).
- Specs 009, 010, 011 e 012 — todas ENTREGUES e validadas com teste real
  nesta sessão (mesma branch `feature/evolution-api-compose`). Fase 0 do
  plano-mãe 100% completa; Fase 1 com A0/A1/A2(T+0)/Handoff prontos, falta
  B1 Operadora + regras editáveis + toques T+1d/3d/7d da Nutridora.
- Docs atualizados: `docs/subsistemas/02b-agente-whatsapp-n8n.md` (status
  de cada agente/ação marcado ✅/pendente, §9 e §10 refletem o real),
  `docs/plataforma/03-api-contratos.md` (ações `identificar_contato` e
  `escalar_contato`), `.context/status.md` (bloco consolidado do agente
  WhatsApp, uma entrada em vez de várias soltas), `.context/decisoes.md`.
- `backend/.env` (dev) criado com `N8N_LEAD_WEBHOOK` — gitignored, não
  versionado; lembrar de recriar se clonar o repo em outra máquina (ver
  `plan.md` da spec 011).
- Memória nova salva: `testes-settings-isolado` (lição do incidente).
- **Nada commitado** — diff grande (specs 009-012 completas + fixes de
  hoje), fica pro Daniel revisar/pedir o commit.
- Próximo passo: decidir entre B1 Operadora (consultas do gestor pelo
  chat) ou fechar os toques agendados da Nutridora (T+1d/3d/7d) — ver
  `.context/status.md` § EM ANDAMENTO.
- Próximo passo: Daniel decide entre B1 Operadora ou os toques agendados
  da Nutridora (T+1d/3d/7d) pra continuar a Fase 1.
- Próximo passo: continuar a Fase 1 na ordem — falta decidir com o Daniel
  se vai primeiro B1 Operadora (consultas do gestor pelo chat) ou fechar os
  toques agendados da Nutridora (T+1d/3d/7d).
