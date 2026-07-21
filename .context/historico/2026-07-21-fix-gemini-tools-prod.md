# 2026-07-21 — Fix: Gemini rejeitando tools do agente MAG em produção

## Prompt do Daniel

Erro no n8n ao chamar as tools do agente SDR: `[GoogleGenerativeAI Error]: ... [400
Bad Request] * GenerateContentRequest.tools[0].function_declarations[1..4].parameters.properties[]:
key cannot be empty`. Depois esclareceu: o problema era em **produção** (VPS
`45.231.133.116`), não em dev.

## Diagnóstico

- Dev (`docker compose -f plataforma/n8n/docker-compose.dev.yml`, estava parado,
  subi de novo) já funcionava ponta a ponta — testado via webhook real
  (`listar_cursos`, `detalhes_curso`, `registrar_lead` chamados com sucesso pelo
  Gemini).
- Prod (`ypeJKZLsGq1WxkQB`→ id real em prod `hpv8MhUXW8rdG5bo`, container
  `plataforma-n8n-1`) tinha 4 dos 5 nós de tool (`listar_cursos`,
  `detalhes_curso`, `registrar_lead`, `escalar_contato`) com
  `sendHeaders: true` e um campo de header mal formado. **Causa raiz real**: o
  node `toolHttpRequest` só entende `parametersHeaders` (fixedCollection
  própria dele) quando `sendHeaders: true`; se esse campo não existe (ex.: só
  existe `headerParameters`, que é o campo do node `httpRequest` comum, não
  deste), ele cai no *default* do node: `{values: [{name: ""}]}` — um
  parâmetro de header **sem nome**, que vira uma property com chave vazia no
  schema mandado pro Gemini → `key cannot be empty`.
- Confirmado comparando a config REAL do dev (que funciona, sem nenhum header
  nesses 4 nós) com a de prod, via export direto (`n8n export:workflow` dentro
  dos containers, e leitura read-only do SQLite com `sqlite3` do próprio
  pnpm store do n8n quando não havia CLI `sqlite3` disponível na imagem).
- **Achado extra**: `n8n import:workflow` / `n8n update:workflow` (CLI) escrevem
  direto no SQLite mas **não** avisam o processo principal do n8n rodando — é
  preciso `docker restart` do container pra ele reler o workflow ativo do
  banco. O próprio CLI avisa isso ("Note: Changes will not take effect if n8n
  is running"), mas é fácil não perceber.

## O que foi feito

1. Subi o n8n dev local (estava parado) e reproduzi o bug end-to-end via
   webhook real (`MAGMA_NUMEROS_TESTE_REGEX` local) — confirmei que o dev já
   estava correto.
2. Via SSH na VPS: export do workflow real de prod (`n8n export:workflow --all`),
   backup do `database.sqlite` do n8n antes de mexer.
3. Duas rodadas de fix (a primeira, trocar pro campo errado
   `headerParameters`, não resolveu — mesmo erro depois do restart; a real foi
   **remover `sendHeaders`/`headerParameters`/`parametersHeaders` dos 4 nós**,
   igual ao dev que já funciona) via `n8n import:workflow --input=...`
   (upsert pelo mesmo `id`, credenciais de prod preservadas) +
   `n8n update:workflow --id=... --active=true` + `docker restart plataforma-n8n-1`.
4. Testado com webhook real em prod pós-fix: SDR Agent chamou `listar_cursos`
   com sucesso via Gemini (erro anterior sumiu); a única falha remanescente
   foi o envio pro WhatsApp (400 da Evolution, esperado — número de teste
   fake `5521900000003` não existe). Nenhum lead de teste foi criado
   (`Lead.objects.filter(whatsapp__in=[...])` → 0).
5. Reexportei o workflow de **dev** (fonte de verdade, comprovadamente
   funcional) e sobrescrevi `plataforma/n8n/workflows/mag-fase-0-sdr.json`
   pra remover os headers órfãos que causariam o mesmo bug numa reimportação
   futura. **Ainda não commitado** (regra do projeto: só commit quando o
   Daniel pedir).

## Segundo bug encontrado (efeito colateral do primeiro fix)

Depois do primeiro fix (remover os headers por completo), o Daniel testou e o
Gemini parou de reclamar — mas `listar_cursos`/`detalhes_curso` passaram a
devolver `write EPROTO ... wrong version number` (erro de TLS). Causa: prod
tem `SECURE_SSL_REDIRECT = HTTPS_ENABLED` e `SECURE_PROXY_SSL_HEADER =
("HTTP_X_FORWARDED_PROTO", "https")` em `backend/config/settings/prod.py`
(dev não tem isso). Sem o header `X-Forwarded-Proto`, o Django considera a
chamada insegura e devolve 301 pra `https://magma-backend-interno:8000/...`
— porta que só fala HTTP puro internamente (TLS só existe no nginx do host).
O `httpRequest`/`toolHttpRequest` segue o redirect (`followRedirect: true`
default) e tenta handshake TLS contra um socket HTTP puro → erro de SSL.

**Fix definitivo**: manter o header, mas como valor fixo não exposto ao
modelo — `parametersHeaders.values: [{name: "X-Forwarded-Proto",
valueProvider: "fieldValue", value: "https"}]` (mesmo padrão que já
funcionava nos campos fixos do `registrar_lead`, ex. `whatsapp`/`utm_source`).
Aplicado primeiro no dev via `n8n_update_partial_workflow` (API — não precisa
restart, ao contrário do `import:workflow` da CLI), testado com sucesso
(`listar_cursos`+`detalhes_curso`+`registrar_lead` completos), depois
replicado em prod (import + restart) e testado com mensagem real — sem SSL
error, sem erro de Gemini. Commit em prod: `8c2efb5`.

## Estado ao sair

- **Prod: corrigido e ativo**, testado com tráfego real de webhook.
- **Dev: já estava correto**, sem mudança de comportamento.
- `plataforma/n8n/workflows/mag-fase-0-sdr.json`: reescrito a partir do export
  atual do dev (fonte de verdade) — mudança grande no diff porque o arquivo
  anterior já estava desatualizado em relação ao dev real (nunca tinha sido
  reexportado depois de edições anteriores). **Falta**: Daniel revisar o diff
  e commitar quando achar bom.
- Backup do SQLite de prod pré-fix ficou em
  `/home/node/.n8n/database.sqlite.bak-pre-toolfix-20260721161816` dentro do
  container `plataforma-n8n-1` (não removido — limpar depois se não for mais
  necessário).
- **Lição pro README do n8n**: depois de `import:workflow`/`update:workflow`
  via CLI em prod, **sempre `docker restart` do container do n8n** — a
  mudança não pega sozinha com o processo rodando.
