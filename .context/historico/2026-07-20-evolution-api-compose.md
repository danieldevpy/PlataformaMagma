# 2026-07-20 — Container Evolution API no compose (dev + prod)

## Prompt do Daniel (resumo)

Em uma branch, configurar o container do Evolution API junto ao compose,
tanto pra desenvolvimento quanto pra produção, pra já poder começar a
desenvolver o agente WhatsApp (sequência natural do plano escrito em
`docs/subsistemas/02b-agente-whatsapp-n8n.md`, Fase 0 do roadmap §9).

## O que foi feito

- Branch `feature/evolution-api-compose`.
- Pesquisa na doc oficial do Evolution API (github.com/EvolutionAPI/evolution-api)
  pra levantar as env vars corretas de v2: `DATABASE_PROVIDER=postgresql`
  (não suporta SQLite/MySQL), `DATABASE_CONNECTION_URI` com `?schema=`,
  `CACHE_REDIS_*`, `AUTHENTICATION_API_KEY`. Confirmado que a própria imagem
  `evolution-api` já serve o Manager embutido em `/manager` — dispensa o
  container separado `evolution-manager` do compose de referência (evita
  conflito com a porta 3000 do frontend Next.js).
- **Dev** — `plataforma/evolution/docker-compose.dev.yml` (+ `README.md` da
  pasta): 3 containers (evolution-api, postgres, redis dedicados), Manager em
  `http://localhost:8080/manager`, API key fixa de dev. Hook em
  `init-dev.sh` via nova flag `--evolution` (mesmo padrão do `--n8n` já
  existente).
- **Prod** — 3 serviços novos em `docker-compose.prod.yml`
  (`evolution-postgres`, `evolution-redis`, `evolution-api`), variáveis novas
  em `.env.prod.example` (`EVOLUTION_API_KEY`, `EVOLUTION_POSTGRES_*`),
  checagem de placeholder em `init-prod.sh` atualizada. **Sem porta pública
  nem subdomínio** — n8n e Evolution ficam na mesma rede interna do compose
  (`http://evolution-api:8080` / `http://n8n:5678/webhook/...`), só o
  loopback publicado pra administração via túnel SSH.
- `plataforma/n8n/README.md` ganhou link cruzado pro novo `evolution/README.md`.
- **Validado de ponta a ponta em dev**: `docker compose up -d`, os 3
  containers subiram saudáveis, `GET http://localhost:8080` respondeu
  `"Welcome to the Evolution API, it is working!"` (confirma conexão com
  Postgres via schema `evolution_api` e Redis), `/manager` respondeu 200,
  sem erros/warnings nos logs. Stack derrubada (`down -v`) depois do teste —
  nada fica rodando.

## Bug reportado pelo Daniel: Manager travando ("taking longer than expected") + logo quebrada

Ao abrir `localhost:8080/manager` na prática, apareceu um toast preso de erro
e o logo do topo não carregava. Investigado com Playwright headless (Chromium
via `npx playwright install chromium`, sem precisar de sudo) capturando
console/network da página real — não dava pra saber só lendo o bundle.

- **Causa raiz**: no primeiro boot (volume vazio) a Evolution aplica ~60
  migrations no Postgres antes de responder na porta — leva uns 20-30s. O
  `init-dev.sh --evolution` de antes soltava `docker compose up -d` e já
  imprimia o link, sem esperar o container ficar pronto. Se o Daniel abria o
  Manager nessa janela, a SPA (React Query, `retry: 3` default global) tentava
  chamadas que falhavam, disparava um toast persistente de erro que não some
  sozinho (só ao fechar manualmente) — dava a impressão de estar travado
  mesmo depois do backend subir.
- **Logo quebrada**: `https://evolution-api.com/files/evo/evolution-logo-white.svg`
  responde 404 — bug no CDN da própria Evolution (confirmado no teste
  headless), nada a ver com a nossa config. Cosmético, documentado no
  `evolution/README.md` como comportamento esperado (não é bug nosso).
- **Fix (simples, sem adicionar complexidade)**: `init-dev.sh` agora espera o
  container ficar `healthy` (poll a cada 2s, até ~2min) antes de anunciar o
  link pronto; healthcheck do dev compose com `start_period: 60s` (margem
  maior pro boot inicial mais lento) e `interval: 5s` (detecta saudável mais
  rápido). Reproduzido o bug (subir e bater na página cedo demais) e
  confirmado a correção (subir, esperar `healthy`, Manager abre limpo direto
  na tela de login) com o mesmo script headless antes de fechar.

## MCP `n8n-mcp` configurado + primeiro workflow real

Daniel pediu pra configurar um MCP existente que desse pro Claude Code criar
os workflows do plano direto no n8n. Usado `czlonkowski/n8n-mcp` (verificado
no npm — mantenedor único, versão publicada há poucos dias).

- `claude mcp add n8n-mcp --scope local -e N8N_API_URL=... -e N8N_API_KEY=...
  -- npx n8n-mcp` (chave gerada pelo Daniel no próprio n8n, Settings → n8n
  API — não dava pra gerar por fora, precisa da conta de dono dele).
- **Dois bugs de conectividade encontrados e corrigidos, ambos investigados
  lendo o código-fonte instalado em `~/.npm/_npx/.../n8n-mcp` em vez de
  chutar configuração:**
  1. SSRF: o pacote bloqueia `localhost` por padrão (`strict` mode) →
     `WEBHOOK_SECURITY_MODE=moderate` (mesma env var cobre o cliente de API
     e o de webhook, apesar do nome sugerir só webhook).
  2. Mesmo em `moderate`, `N8N_API_URL=http://localhost:5678` ainda falhava
     ("No response from n8n server"): o SSRF guard resolve o hostname via
     `dns.lookup()` e "pina" a conexão nesse IP — `localhost` pode resolver
     pra `::1` (IPv6), que o Docker não publica (só `127.0.0.1`). Trocado
     pra `N8N_API_URL=http://127.0.0.1:5678` (IP literal, sem ambiguidade) e
     resolveu.
- Cada `-e` novo no `claude mcp add` exige reiniciar a sessão do Claude Code
  pra valer (o subprocesso do MCP já estava rodando com o env antigo).

Com o MCP validado (criei/ativei/disparei um workflow de smoke test via
webhook, 200 OK), montei o par WhatsApp ⇄ n8n de verdade:

- Instância "Agente Whatsapp" da Evolution já estava conectada por fora
  (Daniel pareou antes) com **número dedicado de teste** (confirmado com
  ele antes de prosseguir — não é número pessoal nem da escola).
- **Terceiro bug de rede, mesma família dos dois de cima**: Evolution dev e
  n8n dev são dois `docker compose` separados; `host.docker.internal`
  resolve pro gateway da bridge (`172.17.0.1`), que NÃO alcança portas
  publicadas só em `127.0.0.1` (ambos os composes publicam assim, de
  propósito). Fix: rede externa compartilhada `magma-dev-net` (criada pelo
  `init-dev.sh`, os dois composes entram nela via `networks.default.external`),
  containers recriados com `docker compose up -d` (dados preservados —
  volumes intactos, sessão do WhatsApp não caiu). Depois disso, `n8n` e
  `evolution-api` se enxergam pelo nome do serviço.
- Configurado o webhook da instância (`POST /webhook/set/{instance}` na
  Evolution, `events: ["MESSAGES_UPSERT", "CONNECTION_UPDATE"]`,
  `webhookByEvents: false`) apontando pro `http://n8n:5678/webhook/whatsapp-in`.
- Criado (via `n8n-mcp`) o workflow **`MAG - Fase 0 (eco WhatsApp)`**
  (id `ypeJKZLsGq1WxkQB`): Webhook → Set (log) → If (só `messages.upsert`,
  `fromMe=false`, texto não vazio, **e** remetente contém `991920338` — o
  número de teste, filtro temporário) → Set (extrai número/texto/nome) →
  HTTP Request (`POST /message/sendText/{instance}` na Evolution) com a
  resposta. **Testado com mensagem real do celular do Daniel — respondeu de
  volta no WhatsApp de verdade.** Payload real do webhook da Evolution
  capturado na execução (`body.data.key.remoteJid`, `.fromMe`,
  `.message.conversation`, `.pushName`) — documentado no plan da spec 009
  pra quem for construir o próximo agente não precisar redescobrir.

## Spec 009 aberta e IMPLEMENTADA na mesma sessão

Formalizado o fluxo spec-driven do projeto: `specs/009-agente-whatsapp-fundacao/`
(spec.md + plan.md + tasks.md, a partir dos templates de `specs/templates/`).
Desenho original: modelo `OperadorWhatsApp` novo + ação `identificar_contato`
+ `TokenAgente` do roteador.

**Ao começar a implementar, achado que simplificou a spec**: `contas.Usuario`
já tinha `whatsapp` (`CharField`) e `papel` (`Papel.GESTOR`/`Papel.INSTRUTOR`)
— exatamente o que a ação precisava. `OperadorWhatsApp` teria duplicado esse
dado. `spec.md`/`plan.md`/`tasks.md` corrigidos na hora (T1 riscada, ver Log
da spec) pra usar `Usuario` direto — zero migration nova, e a identificação
de "instrutor" (que estava fora de escopo por achar que precisava de campo
novo) saiu de graça.

Implementado:

- `apps/nucleo/acoes_contato.py` — ação `identificar_contato(numero)`:
  `Usuario.whatsapp` (papel = `usuario.papel`) → `Lead.whatsapp` (papel
  `"lead"`) → `"desconhecido"` (nome `None`, nunca inventa dado). Registrada
  em `NucleoConfig.ready()`, mesmo padrão de `cursos`/`avaliacoes`/`midia`.
- 7 testes novos em `apps/nucleo/tests.py::IdentificarContatoTests`
  (gestor, instrutor, lead, prioridade Usuario > Lead no mesmo número,
  desconhecido, número vazio → 400, LogAcao gravado). Suíte `apps.nucleo`
  27/27.
- `TokenAgente agente-recepcionista-mag` criado no banco dev, escopo só
  `nucleo:identificar_contato`.
- Workflow n8n `MAG - Fase 0`: nó HTTP Request novo ("Identificar Contato",
  `POST http://host.docker.internal:8000/api/acoes/executar/` com
  `X-Agente-Token`) inserido entre a extração de dados e a resposta; a
  resposta agora usa `papel`/`nome` devolvidos em vez do texto fixo de eco.
- `docs/plataforma/03-api-contratos.md` — ação nova documentada na tabela
  de ações v1 + exemplo de payload no catálogo.

**Critério do gestor confirmado por Daniel de verdade** (não só teste
automatizado): preencheu o `whatsapp` do próprio `Usuario` pelo admin,
mandou "oi" pro número da MAG, recebeu de volta o reconhecimento como
gestor. Fase 0 do plano-mãe (`docs/subsistemas/02b-agente-whatsapp-n8n.md`
§9) está completa.

## §10 do plano-mãe — decisões batidas

Levei as 7 questões em aberto pro Daniel (via `AskUserQuestion`, uma leva de
4 + 2 já resolvidas por implementação). Respostas registradas em
`.context/decisoes.md` (2026-07-20) e refletidas no próprio
`docs/subsistemas/02b-agente-whatsapp-n8n.md` §10:

1. Gateway → Evolution API (já implementado).
2. Número → dedicado; o de teste da Fase 0 fica só de teste, número oficial
   de produção é escolha futura.
3. Persona → **"MAG"**, única, squad invisível por trás.
4. LLM → **configurável/trocável** (Daniel quer poder comparar
   custo-benefício) — implica escolher modelo via credencial/parâmetro no
   node do n8n, não hardcoded feito o `apps.ia` do Studio.
5. Agenda de visitas (SDR/A1) → Data Table do n8n (MVP).
6. Auth do upload de acervo → segue em aberto, só recomendação técnica
   registrada (reaproveitar `X-Agente-Token`); decide quando chegar a B2
   Zeladora do Acervo (Fase 2).
7. Postgres extra da Evolution → aceito (já implementado).

## Estado ao sair

- Containers rodando: `magma-n8n-dev`, `magma-evolution-api-dev` (+
  postgres/redis), todos na rede `magma-dev-net`. Workflow `MAG - Fase 0`
  ativo no n8n, respondendo com identificação real — mas ainda com filtro
  de número de teste (`991920338`) no nó IF, não serve pra produção como
  está (vira `RegraAgente`/allowlist editável na Fase 1).
- MCP `n8n-mcp` operacional (escopo local, chave do Daniel).
- Spec 009 ENTREGUE — todas as tasks DONE, critério do gestor validado.
- 6 das 7 decisões do §10 do plano-mãe fechadas (só a #6 fica pra Fase 2).
- `.context/status.md` e `.context/decisoes.md` atualizados.
- Próximo passo: Fase 1 do plano — squad de atendimento (A0 Recepcionista +
  A1 SDR primeiro, mira o 08/08).
