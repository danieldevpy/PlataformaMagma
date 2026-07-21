# 2026-07-21 (tarde) — Spec 013: B1 Operadora (Fase 1, só leitura)

## Prompt do Daniel

"em relação aos agentes do n8n onde paramos?" → resumo do estado (fix de
prod do dia já commitado). "vamos começar as tarefas pendentes então" →
escolheu **B1 Operadora** entre as pendências abertas da Fase 1 (outras
opções: toques agendados da Nutridora T+1d/3d/7d; tool de perguntas
institucionais).

## O que foi feito

1. **Spec 013 criada** (`specs/013-agente-whatsapp-operadora-leitura/`) —
   escopo: gestor/instrutor consulta a operação pelo WhatsApp (status de
   turma, link de avaliação, leads recentes), sem escrita ainda.
2. **Ação nova `listar_leads`** (`apps/leads/acoes.py`): filtra por `dias`
   (janela de dias corridos, default 1 = hoje) e `status` (exato,
   opcional); retorna nome/whatsapp/curso/quando_pretende/status/
   utm_source/criado_em, sem PK. Registrada em `apps/leads/apps.py`
   (`ready()`). 5 testes novos em `apps/nucleo/tests.py`
   (`ListarLeadsTests`) — suíte completa 44/44.
3. **`TokenAgente agente-recepcionista-mag`** (dev) ganhou os escopos
   `cursos:status_turma`, `avaliacoes:gerar_link_avaliacao`,
   `leads:listar_leads` (as duas primeiras ações já existiam, só faltava
   liberar pro agente). Checklist de prod atualizado em
   `plataforma/n8n/workflows/README.md`.
4. **`docs/plataforma/03-api-contratos.md`** — nova linha da tabela de
   ações v1 pra `listar_leads`.
5. **Workflow n8n `MAG - Fase 0`** (id `ypeJKZLsGq1WxkQB`, via `n8n-mcp`):
   - Novo AI Agent **"Operadora - Secretária Digital"** no ramo
     "É gestor ou instrutor?" → `true` (antes ligado a um eco de teste
     estático, `Responder no WhatsApp` — removido, dead code).
   - 3 tools (`status_turma`, `gerar_link_avaliacao`, `listar_leads`),
     mesmo padrão `toolHttpRequest` 1.1 + credencial `httpHeaderAuth`
     validado nas specs 010/012 (nunca header manual, nunca `{{ }}` no
     campo `url`).
   - Memória de conversa própria (`Memória da conversa (Operadora)`),
     separada da SDR por precaução (mesmo que na prática os dois ramos
     nunca se cruzem pro mesmo número).
   - `Gemini Chat Model` **compartilhado** com a SDR (mesma credencial,
     conexão `ai_languageModel` com 2 alvos — n8n aceita esse fan-out).
   - Descoberta: não precisou de um nó de "preparar contexto" novo — o
     `Preparar contexto SDR` já roda ANTES do split gestor/instrutor
     (monta numero/papel/nome/texto/escalado pros dois ramos).
6. **Teste real em dev** via `n8n_test_workflow` (webhook direto, número
   do gestor Daniel `5521991920338`, payload sintético `messages.upsert`
   simulando a Evolution API):
   - "status da turma 08/2026" → `status_turma` chamada, resposta correta
     (curso, status, datas, 17 mídias/3 postagens/1 avaliação) —
     **mensagem chegou de verdade no WhatsApp do Daniel**.
   - "manda o link de avaliação da turma 08/2026" → `gerar_link_avaliacao`
     devolveu URL válida (reusou convite existente).
   - "quantos leads entraram nos últimos 7 dias?" → `listar_leads(dias=7)`
     devolveu os 5 leads reais do período.
   - "baixa as vagas da turma 08/2026 pra 5" (fora de escopo) → recusado
     com honestidade, sem fingir que executou.

## Achado de ambiente (não é bug do workflow)

A primeira rodada de testes falhou com
`[GoogleGenerativeAI Error]: fetch failed` no nó Gemini. Antes de suspeitar
da lógica nova, testei o SDR (pré-existente) com o mesmo erro — confirmando
que não era causado pela mudança. Causa raiz:
`docker exec magma-n8n-dev nslookup google.com` devolveu `SERVFAIL` — DNS
do container quebrado (glitch transitório do resolver embutido do Docker).
Fix: `docker restart magma-n8n-dev`. Depois do restart, os 4 testes reais
passaram. **Registrar pra não repetir a investigação**: se o Gemini falhar
com "fetch failed" no n8n dev, checar DNS do container antes de mexer no
workflow.

## Reorganização visual do workflow (a pedido do Daniel)

Pediu pra arrumar as posições dos nós e ver visualmente via
`http://localhost:5678/workflow/ypeJKZLsGq1WxkQB`. Usei o botão nativo
**"Tidy Up"** do n8n (auto-layout) — organizou em duas pistas horizontais
claras (Operadora em cima, SDR embaixo, tronco principal no topo). Só
precisei reposicionar manualmente o `Gemini Chat Model` (compartilhado
pelos dois agentes), que o auto-layout tinha deixado no fundo da pista da
SDR, criando uma conexão diagonal longa até a Operadora — movido pro meio,
equidistante das duas pistas. **Limitação encontrada**: a ferramenta de
screenshot do navegador automatizado travou consistentemente nessa página
(canvas pesado do editor n8n) — validei a reorganização via API
(`n8n_get_workflow` structure) e accessibility tree (DOM), não visualmente;
avisei o Daniel da limitação.

## Adendo: matrículas + link de matrícula (achado do Daniel)

Testando de verdade, o Daniel notou que o gestor não via quantas matrículas
a turma já tinha, nem tinha como gerar link de matrícula pelo chat.
Investigação: o model `Matricula` (`apps/educacional/models.py`) **já
existe** — mesmo padrão do `ConviteAvaliacao` (token UUID, escopo
turma/individual, `.url` = `/carteirinha/{token}`), reusado do sistema de
carteirinha digital — só não estava exposto na Camada de Ações.

- `status_turma` ganhou `matriculas` (conta só `Matricula` com status
  `ativa`/`concluida` — convite de escopo turma ainda sem preencher não
  conta).
- Ação nova `gerar_link_matricula` (`apps/educacional/acoes.py`, `ready()`
  do app ganhou o import): mesmo padrão de `gerar_link_avaliacao`, reusa
  convite de escopo turma válido ou cria um novo.
- Operadora ganhou a 4ª tool; prompt atualizado; `TokenAgente
  agente-recepcionista-mag` ganhou `educacional:gerar_link_matricula`.

**Bug cometido e corrigido no caminho**: ao atualizar o `systemMessage` da
Operadora via `n8n_update_partial_workflow` (`updateNode` em
`parameters.options.systemMessage`), o diff engine reconstruiu o objeto
`options` inteiro em vez de fazer merge raso — apagou `promptType`, `text`
e `maxIterations`/`returnIntermediateSteps` do nó (erro `No prompt
specified` na 1ª tentativa de teste real). Corrigido com dois `updateNode`
extras restaurando os campos. **Lição registrada em `plan.md`**: depois de
um `updateNode` em campo aninhado, sempre conferir com `n8n_get_workflow
mode: filtered` se os campos-irmãos sobreviveram.

Teste real (WhatsApp, número do gestor): "status da turma 026" →
"Matrículas confirmadas: 2"; "link de matrícula da turma 026" → devolveu
`/carteirinha/{token}` válido, expira em 3 meses. Nota curiosa: o código da
turma de teste mudou de "08/2026" pra "026" no meio da sessão (o próprio
Daniel editando/testando em paralelo pelo admin ou WhatsApp) — a Operadora
reagiu certo ao erro "turma não encontrada", pedindo confirmação do código
em vez de inventar dado (comportamento validando a regra "nunca inventa").

## Adendo 2: listar_turmas (antes de commitar)

Daniel pediu uma forma de listar as turmas (código, nome, curso etc.) pra
quando não lembrar o código de cabeça. Ação nova `listar_turmas`
(`apps/cursos/acoes.py`) — sem parâmetro obrigatório, filtro opcional por
`status`, ordenada por mais recente (`-criado_em`). Operadora ganhou a 5ª
tool; prompt instruído a chamar `listar_turmas` proativamente antes de
perguntar o código, quando a pergunta for ambígua.

Teste real: "quais turmas estão abertas?" → a IA decidiu sozinha filtrar
por `status=inscricoes` (sem eu precisar hardcodar o que "aberta"
significa) e respondeu só a turma 026; "lista todas as turmas cadastradas"
→ devolveu as 3 turmas (026 inscrições, 027/028 rascunho) numa tabela
markdown. Dessa vez o `updateNode` no `systemMessage` **não** repetiu o
bug do adendo 1 (campos-irmãos preservados), mas conferi via
`n8n_get_workflow mode: filtered` mesmo assim, por precaução. Suíte
completa 170/170.

## Bugfix real: link de matrícula devolvia carteirinha já preenchida

Daniel testou de novo (pediu o link de matrícula da turma 026) e recebeu o
link de um aluno específico ("Fernando Teste") que já tinha preenchido a
carteirinha — não um convite em aberto. Investigando o banco dev: a turma
tinha 3 `Matricula` (pk 19 = convite aberto, `aluno` None; pk 20/21 = alunos
que já preencheram) e **as 3 estavam com `escopo=turma`** — deveriam ser
20/21 `individual`.

Causa raiz: `MatriculaConvitePublicoView.post`
(`apps/educacional/views.py:66-73`) cria a matrícula nova do aluno sem
passar `escopo=Matricula.Escopo.INDIVIDUAL` — herda o default do model
(`TURMA`) — apesar do comentário no próprio código dizer "Matrícula
individual nova". **Esse é um bug pré-existente da plataforma**, não
introduzido pela spec 013 — só ficou visível agora porque
`gerar_link_matricula` foi a primeira coisa a *consultar* esse campo pra
decidir qual link reaproveitar. O teste que já existia
(`test_escopo_turma_gera_matricula_nova_e_mantem_link_reutilizavel`,
`apps/educacional/tests.py`) checava que o convite original ficava intacto,
mas nunca checava o `escopo` das matrículas dos alunos gerados — por isso
o bug passou despercebido.

Fix em duas camadas (raiz + defesa em profundidade):
1. `apps/educacional/views.py` — a view agora passa
   `escopo=Matricula.Escopo.INDIVIDUAL` explicitamente na criação.
2. `apps/educacional/acoes.py` — `gerar_link_matricula` passou a filtrar
   também por `preenchida_em__isnull=True`, nunca confiando só no `escopo`
   pra decidir se uma matrícula é um "convite em aberto" reaproveitável.

Teste novo `test_nao_devolve_matricula_ja_preenchida` reproduz o cenário
exato. Dados já afetados no banco dev corrigidos via shell
(`Matricula.objects.filter(escopo=TURMA, preenchida_em__isnull=False)
.update(escopo=INDIVIDUAL)`). Testado de ponta a ponta de novo: "manda o
link de matrícula da turma 026 de novo" → devolveu o token da matrícula
pk 19 (convite real, sem aluno) — confirmado por comparação direta no
shell. Suíte completa 171/171.

## Estado ao sair

- Spec 013 ENTREGUE (tasks.md T1-T12 DONE) e validada com teste real —
  incluindo os dois adendos (matrículas/link de matrícula, listar_turmas)
  e o bugfix do escopo da matrícula.
- Suíte backend completa 171/171.
- Workflow atualizado em dev (25 nós, ativo) e reexportado pra
  `plataforma/n8n/workflows/mag-fase-0-sdr.json` (ainda não commitado —
  revisar diff antes, junto com o resto das mudanças desta sessão:
  `apps/leads/acoes.py`, `apps/leads/apps.py`, `apps/cursos/acoes.py`,
  `apps/educacional/acoes.py` (novo), `apps/educacional/apps.py`,
  `apps/educacional/views.py` (bugfix), testes em `apps/nucleo/tests.py`,
  `docs/plataforma/03-api-contratos.md`,
  `plataforma/n8n/workflows/README.md`).
- **Pendente**: promover pra prod (importar workflow + 5 escopos novos no
  `TokenAgente` de prod — o bugfix do `escopo` também precisa ir junto,
  já que prod tem o mesmo bug latente em qualquer matrícula-turma já
  preenchida). Próxima decisão de escopo: toques agendados da Nutridora
  (T+1d/3d/7d) ou B1 Operadora com escrita (Fase 2).
