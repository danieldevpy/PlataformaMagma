# 2026-07-24 (noite) — Deploy completo pra produção

## Prompt do Daniel

Depois de corrigir o `avisar_equipe` (spec 012-T7), pediu pra fechar a
sessão: "commitando, dando push, e atualizando na vps de produção, já
com tudo (git pull e workflow atualizado)".

## O que subiu

Todo o trabalho da sessão: specs 017 (info institucional), 019 (Radar
diário + adendo T9 listar_gestores), 020 (Nutridora T+1/3/7), 012-T7
(avisar_equipe pra todos os gestores) — mais, de brinde, tudo que já
estava commitado mas nunca promovido (specs 013-016, incluindo o buffer
de mensagens fragmentadas).

## Passo a passo

### 1. Git

`git push origin master` (6 commits, `f7939fe`→`0109c5b`). Na VPS
(`/home/daniel/PlataformaMagma`, mesmo repo GitHub): `git pull` —
fast-forward limpo, sem conflito (só 2 arquivos não-versionados
estranhos no working tree da VPS, `mvp-apps/.../instrutor.png~merged` e
`media`/`staticfiles`, nenhum deles interferiu no pull).

### 2. Backend Django

O backend roda de **imagem buildada** (`build: ./backend` no
`docker-compose.prod.yml`), não bind-mount — precisa `docker compose
build backend` pra pegar código novo, não só restart.

**Incidente**: rodei `docker compose -f docker-compose.prod.yml up -d
backend` sem `--env-file .env.prod`. O Compose faz substituição de
variável (`${MYSQL_USER}` etc.) usando o ambiente do shell + um `.env`
(nome padrão) — como só existe `.env.prod` (nome não-padrão, carregado
só via `env_file:` pros containers, não pra substituição do próprio
compose file), as variáveis viraram vazio. Isso mudou o hash de config
calculado do serviço `db` também (usa `${MYSQL_ROOT_PASSWORD}` etc. na
definição), então o Compose **recriou** `db` E `backend` com config em
branco. Resultado: Django tentando conectar no MySQL com senha vazia →
`Access denied for user 'root'@'...' (using password: NO)` → site
respondendo 502 por ~1-2 minutos.

Percebi pelo log do backend (`docker logs plataforma-backend-1`),
identifiquei a causa comparando com `init-prod.sh` (que sempre usa
`docker compose --env-file .env.prod -f docker-compose.prod.yml up -d
--build`) e rodei de novo com o `--env-file` certo. **Verificação de
segurança antes de seguir**: contei registros reais no banco (4 cursos,
2 turmas, 4 usuários, 1 lead) — nada foi perdido. A recriação do
container `db` não apaga o volume nomeado (`mysql_data`), só o
container em si; como o MySQL só usa as env vars de root/user pra
inicializar um datadir **vazio**, um datadir já existente ignora essas
variáveis — a autenticação real do banco nunca mudou, só a tentativa de
conexão do Django é que usava credencial errada.

Depois do fix: site voltou (200), migrations aplicadas automaticamente
pelo `entrypoint.sh` (`leads.0002_lead_nutridora_ultimo_toque` incluída),
gunicorn subiu limpo.

**Lição pro próximo deploy manual (sem `init-prod.sh`)**: SEMPRE
`docker compose --env-file .env.prod -f docker-compose.prod.yml ...`,
nunca só `-f docker-compose.prod.yml`.

### 3. TokenAgente de produção

`agente-n8n-mag` (nome diferente do dev, que é `agente-recepcionista-mag`
— não presumir nome igual entre ambientes) ganhou os 4 escopos novos:
`nucleo:info_institucional`, `nucleo:resumo_diario`,
`leads:processar_nutridora`, `nucleo:listar_gestores`.

### 4. n8n — workflows novos (1ª promoção)

`n8n-mcp` só está configurado pra instância de **dev** — pra prod, tudo
via SSH + `docker exec plataforma-n8n-1 n8n <comando>` (CLI do n8n
dentro do container).

Achados no caminho:
- `n8n import:workflow --input=X.json` **exige** um campo `id` no JSON,
  mesmo pra workflow que nunca existiu em prod — sem isso, erro
  `SQLITE_CONSTRAINT: NOT NULL constraint failed: workflow_entity.id`.
  Gerei IDs localmente (nanoid-like, 16 chars alfanuméricos) antes de
  importar.
- `--activeState=fromJson` (ativar direto no import) só funciona em modo
  queue/multi-main — nesse deployment (modo regular) dá erro. Alternativa:
  importar (fica inativo por padrão) → `n8n publish:workflow --id=X` →
  `n8n update:workflow --id=X --active=true` (comando **deprecated** mas
  ainda funcional — é o único jeito de ativar via CLI nessa versão).
  Nenhuma dessas mudanças tem efeito com o n8n rodando — só depois de
  reiniciar o container.

Ordem importava: `MAG - Avisar Equipe` precisava existir e estar ativo
**antes** de promover o `MAG - Fase 0` atualizado (cujo `avisar_equipe`
já aponta pro webhook desse sub-workflow) — importei os 3 novos primeiro
(sem restart ainda), só reiniciei o n8n uma vez, no final, junto com a
promoção do SDR (economiza o "derruba o processamento de webhook por
alguns segundos" documentado no `promover-prod.sh`).

### 5. Bloqueio: buffer de mensagens (spec 016) nunca tinha ido pra prod

`mag-fase-0-sdr.json` (a versão atual, cumulativa) já carrega os 9 nós
do buffer/debounce desde o commit `9432549` (23/07) — mas a spec 016
ficou marcada "T10 pendente" porque ninguém tinha promovido ainda. Ao
tentar promover o SDR agora, `_montar_json_prod.py` recusou: credencial
`MAG - Redis Buffer (dev)` sem mapeamento em `ids-prod.json` (porque
nunca existiu em prod).

Perguntei ao Daniel (`AskUserQuestion`): subir o buffer junto agora, ou
adiar a promoção do SDR/handoff/info_institucional até resolver isso
depois? Escolheu subir junto.

- Adicionei serviço `n8n-redis` (Redis dedicado, mesmo padrão do dev —
  container próprio, não reaproveita o Redis do Evolution) no
  `docker-compose.prod.yml` (commit `4595c03`), `git push` + `git pull`
  na VPS, `docker compose --env-file .env.prod -f docker-compose.prod.yml
  up -d n8n-redis` (só esse serviço, sem tocar no resto).
- Credencial: **não tentei automatizar**. n8n encripta o campo `data`
  das credenciais com `N8N_ENCRYPTION_KEY`; criar via CLI/SQL direto
  exigiria replicar esse esquema de criptografia às cegas — risco real
  de gravar algo corrompido no banco de credenciais de produção. Isso
  sempre foi um passo manual documentado no projeto (`workflows/README.md`
  § "Importar em prod pela primeira vez", passo 1). Perguntei ao Daniel
  (`AskUserQuestion` de novo) se ele criava manualmente ou se eu tentava
  automatizar mesmo assim — escolheu criar manualmente. Passei os campos
  exatos (Host `n8n-redis`, Port `6379`, sem senha, Database `0`, nome
  **`MAG - Redis Buffer (dev)`** — sim, com "(dev)" mesmo em prod, pra
  bater com o nome já usado no JSON e o remapeamento automático
  funcionar sem editar o arquivo).
- Com a credencial criada, só then `ids-prod.json` recebeu o ID dela
  (`dHFQvHd5Xo7cZE86`) + os 3 IDs dos workflows novos, e
  `./promover-prod.sh mag-fase-0-sdr.json` rodou normal (22 referências
  de credencial remapeadas, import + publish + restart do n8n).

## Estado final

- 5 workflows do agente MAG ativos em prod: `MAG - Fase 0 (eco
  WhatsApp)`, `MAG - Nutridora (T+0)`, `MAG - Avisar Equipe`, `MAG -
  Radar (resumo diário)`, `MAG - Nutridora (T+1/3/7)`.
- Todos os containers saudáveis (`db`, `backend`, `n8n`, `n8n-redis`,
  `evolution-api` + dependências, `frontend`).
- Nenhum dado perdido (confirmado via contagem de registros antes/depois
  do incidente do passo 2).
- Nenhuma mensagem sintética de teste disparada em prod — verificação
  final foi containers saudáveis + `execution_entity` sem erro recente.
  Teste real com mensagem de verdade fica a critério do Daniel.
- `plataforma/n8n/workflows/ids-prod.json` atualizado e commitado (IDs
  dos 3 workflows novos + credencial Redis).

## Pendências que sobraram

- Spec 016-T9: mandar uma mensagem fragmentada de verdade pelo WhatsApp
  em prod pra confirmar o buffer/debounce funcionando com tráfego real
  (só foi validado em dev até agora).
- `ConfiguracaoAsaas` de produção (cobrança real) — decisão do Daniel,
  não é deploy de código.
- Achado incidental do SDR em handoff (output vazio quebrando "Text is
  required") — ainda não investigado.
