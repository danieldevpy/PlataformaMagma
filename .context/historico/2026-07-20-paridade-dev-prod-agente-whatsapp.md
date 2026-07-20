# 2026-07-20 — Paridade dev/prod dos workflows do agente MAG (antes do merge)

## Prompt do Daniel (essência)
Depois de perguntar se haveria retrabalho ao subir o agente WhatsApp pra
produção (WhatsApp real na Evolution, ligações n8n↔Django↔Evolution), o
Daniel decidiu: **"antes do merge, vamos resolver todas as questões entre
dev e prod, para não ter tanto retrabalho quando subir pra produção"** —
pediu pra resolver a paridade ANTES de mergear a branch
`feature/evolution-api-compose` pra `master`, adiando o merge/commit em si.

## O que foi feito
- **URL do Django nos nós do n8n**: os ~5 nós que chamavam
  `http://host.docker.internal:8000/...` (hardcoded, só funcionava em dev)
  passaram a usar `http://magma-backend-interno:8000/...` — um hostname
  neutro que resolve pro lugar certo nos dois ambientes:
  - dev: `extra_hosts: magma-backend-interno:host-gateway` no
    `plataforma/n8n/docker-compose.dev.yml` (aponta pro host, onde roda o
    `runserver`);
  - prod: alias de rede (`networks.default.aliases`) no serviço `backend` do
    `plataforma/docker-compose.prod.yml`.
  - **Tentativa inicial descartada**: usar `$env.MAGMA_BACKEND_URL` numa
    expression `{{ }}` do n8n. Funcionou nos nós HTTP Request comuns
    (`Identificar Contato`, `Responder no WhatsApp`), mas quebrou a
    validação em TODOS os nós `toolHttpRequest` (as tools da IA —
    `listar_cursos`, `detalhes_curso`, `registrar_lead`, `escalar_contato`):
    esse tipo de nó tem um parser de `{placeholder}` PRÓPRIO (mecanismo de
    substituição de valor vindo da IA) que interpreta mal a chave dupla
    `{{ }}` do n8n, gerando erro `UNDEFINED_PLACEHOLDER` (achava que
    `{ $env.MAGMA_BACKEND_URL ` era um placeholder malformado). Solução:
    hostname literal idêntico nos dois ambientes, sem `$env` nenhum nesse
    campo específico.
- **Filtro de números de teste**: os 2 nós IF que restringem quem o bot
  responde (`É mensagem de texto recebida?` no workflow SDR, `Deve mandar
  boas-vindas?` na Nutridora) passaram a ler
  `{{ $env.MAGMA_NUMEROS_TESTE_REGEX }}` em vez de ter a regex hardcoded —
  essa SIM funciona via `$env` normalmente (não é campo de
  `toolHttpRequest`). Dev mantém a regex de teste; prod deixa a variável
  vazia (regex vazia casa com qualquer string = sem filtro, atende número
  real).
- **Segredos hardcoded restantes → credencial n8n**: `X-Agente-Token` (nó
  `Identificar Contato`) e apikey da Evolution (`Responder no WhatsApp`,
  `Responder no WhatsApp (SDR)`, `Enviar boas-vindas` da Nutridora) agora
  usam as credenciais `MAG - X-Agente-Token` / `MAG - Evolution apikey`
  (mesmo padrão que `escalar_contato`/`avisar_equipe` já usavam desde a
  spec 012).
- **Workflows exportados e versionados**: `plataforma/n8n/workflows/
  mag-fase-0-sdr.json` e `mag-nutridora-t0.json` — não existia versionamento
  nenhum antes, os workflows só viviam no banco SQLite do n8n. Escrito
  também `plataforma/n8n/workflows/README.md` com checklist de import em
  prod (credenciais precisam ser recriadas lá — não viajam no JSON por
  design de segurança do n8n).
- **`plataforma/n8n/README.md`** atualizado: seção "Como o n8n conversa com
  a plataforma" reescrita pra descrever o hostname neutro + credenciais +
  `$env` do filtro (a versão antiga descrevia auth JWT, que nunca foi o que
  de fato foi implementado — desatualizada desde a spec 009).

## Incidente durante o próprio trabalho
As duas primeiras rodadas de `n8n_update_partial_workflow` (edição em lote
via n8n-mcp) tiveram um efeito colateral: a sanitização automática da
ferramenta **zerou os `parameters` do nó "SDR - Capitã de Matrículas"**
(systemMessage inteiro, prompt, config de tools — tudo virou `{}`), mesmo
sem esse nó ter sido referenciado em nenhuma operação. Só foi detectado ao
rodar um teste real pós-mudança: o agente respondeu com erro `No prompt
specified` em vez de conversar. Recuperado batendo o **version history do
próprio n8n** (`n8n_workflow_versions` → `mode: get` na versão anterior à
sessão) e restaurando o `parameters` completo do nó. Depois de restaurar,
comparação byte-a-byte de TODOS os 18 nós contra o snapshot pré-edição
confirmou que só esse nó tinha sido afetado. Lição registrada em
`.context/decisoes.md`: sempre validar/comparar todos os nós depois de um
`n8n_update_partial_workflow` em lote, não só os que a operação visava.

## Validação
- `n8n_validate_workflow` nos dois workflows: 0 erros (só warnings
  pré-existentes e já conhecidos/benignos).
- Testes reais ponta a ponta via `curl` direto nos webhooks do n8n (número
  de teste `5521979070319`, já autorizado):
  - Identificação de contato (via hostname novo + credencial) — OK.
  - Fluxo "está escalado?" (silêncio correto quando já escalado) — OK.
  - SDR completo: Gemini chamou `listar_cursos` (via hostname novo), leu
    dado real da API, respondeu, e "Responder no WhatsApp (SDR)" mandou via
    credencial — mensagem chegou de verdade no WhatsApp do número de teste.
  - Nutridora completa: regex via `$env` deixou passar (utm_source
    `instagram`), mensagem montada com nome do curso real, envio via
    credencial — OK.
- Suíte de testes do backend não foi re-executada nesta etapa (nenhuma
  mudança tocou código Django, só compose/n8n) — segue verde da rodada
  anterior desta mesma sessão.

## Estado ao sair / handoff
- Paridade dev/prod **resolvida** — promover o agente pra produção agora é:
  subir os composes (`init-prod.sh`), recriar as 3 credenciais nomeadas
  igual em prod, importar os 2 JSONs de `plataforma/n8n/workflows/`, nomear
  a instância Evolution de prod como `Agente Whatsapp`, ativar, testar com
  número de teste antes de liberar geral.
- Ainda **NÃO commitado** — o Daniel pediu commit + merge pra master, mas
  primeiro pediu pra resolver a paridade (feito agora). Próximo passo natural
  é revisar `git status`/`git diff`, commitar, e então decidir com o Daniel
  se faz merge (e se dá push pro `origin/master`, pergunta que ainda não foi
  respondida).
- Processo `manage.py runserver` usado pra testar a conectividade
  `magma-backend-interno` foi encerrado ao final (não deixar rodando).
- `ContatoEscalado` do número de teste `5521979070319` foi removido durante
  o teste (pra poder validar o caminho normal do SDR, não só o de
  handoff) — dado de teste, não precisa restaurar.
