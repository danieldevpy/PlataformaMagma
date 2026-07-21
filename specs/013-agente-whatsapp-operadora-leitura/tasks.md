# Tasks 013 — B1 Operadora (Fase 1, só leitura)

| ID | Tarefa | Estado | Agente |
|----|--------|--------|--------|
| T1 | Ação `listar_leads` (`apps/leads/acoes.py`) + registro no `ready()` + testes (`apps/nucleo/tests.py`) | DONE | claude |
| T2 | `TokenAgente agente-recepcionista-mag` ganha os 3 escopos (dev) | DONE | claude |
| T3 | `docs/plataforma/03-api-contratos.md` — nova linha `listar_leads` | DONE | claude |
| T4 | Workflow: AI Agent "Operadora" (sem nó de contexto próprio — reusa "Preparar contexto SDR") + memória própria + 3 tools + resposta WhatsApp | DONE | claude |
| T5 | Teste real (dev): "status da turma 08/2026" / "link de avaliação" / "leads dos últimos 7 dias" / recusa de escrita, pelo número de gestor (Daniel) | DONE | claude |
| T6 | Atualizar `.context/status.md` + entrada em `.context/historico/` | DONE | claude |
| T7 | Adendo: `status_turma` ganha `matriculas` (contagem `Matricula` ativa/concluída) | DONE | claude |
| T8 | Adendo: ação `gerar_link_matricula` (`apps/educacional/acoes.py`) + registro + testes | DONE | claude |
| T9 | Adendo: Operadora ganha 4ª tool `gerar_link_matricula`, escopo novo no `TokenAgente`, docs atualizados, teste real | DONE | claude |
| T10 | Adendo 2: ação `listar_turmas` (`apps/cursos/acoes.py`) + teste | DONE | claude |
| T11 | Adendo 2: Operadora ganha 5ª tool `listar_turmas`, escopo novo no `TokenAgente`, docs atualizados, teste real | DONE | claude |
| T12 | Bugfix: `MatriculaConvitePublicoView` não marcava `escopo=INDIVIDUAL` na matrícula do aluno + `gerar_link_matricula` sem defesa contra isso | DONE | claude |

## Ondas

- Onda 1: T1
- Onda 2 (depende de T1): T2, T3
- Onda 3 (depende de T2): T4
- Onda 4 (depende de T4): T5
- Onda 5 (depende de T5): T6
- Onda 6 (achado pós-entrega, mesmo dia): T7, T8 → T9
- Onda 7 (2º achado, mesmo dia): T10 → T11
- Onda 8 (bug real do Daniel, mesmo dia): T12

## Log

- (2026-07-21) Spec criada a pedido do Daniel, continuando a Fase 1 do
  agente MAG depois de fechar o fix de produção (SDR/Gemini). B1 Operadora
  escolhida entre as pendências abertas (alternativas: toques agendados da
  Nutridora T+1d/3d/7d; tool de perguntas institucionais). Escopo desta
  spec = só leitura (`status_turma`, `gerar_link_avaliacao` já existiam;
  `listar_leads` é a única ação nova) — escrita fica pra spec futura
  (Fase 2, `atualizar_turma`/`atualizar_status_lead` com confirmação/PIN).
- (2026-07-21) **Spec ENTREGUE e validada com teste real (dev, n8n-mcp).**
  Descoberta no caminho: não foi preciso um nó de contexto novo pra
  Operadora — "Preparar contexto SDR" já roda ANTES do split
  gestor/instrutor (monta numero/papel/nome/texto/escalado pros dois
  ramos), então o AI Agent da Operadora lê o mesmo `$json` direto.
  `Gemini Chat Model` é compartilhado entre SDR e Operadora (mesma
  credencial/modelo, conexão `ai_languageModel` com 2 alvos no mesmo nó —
  n8n aceita esse fan-out sem problema). Memória (`ai_memory`) ficou em
  instância própria por precaução (não testado se compartilhar quebraria,
  mas não valia o risco). Testes reais via `n8n_test_workflow` (webhook
  direto, número do gestor Daniel `5521991920338`, payload sintético
  `messages.upsert`): "status da turma 08/2026" → `status_turma` chamada,
  resposta correta com contagens reais (mensagem **enviada de verdade** no
  WhatsApp); "link de avaliação" → `gerar_link_avaliacao` devolveu URL
  válida; "leads dos últimos 7 dias" → `listar_leads(dias=7)` devolveu os
  5 leads reais do período; pedido de escrita ("baixa as vagas pra 5") →
  recusado honestamente, sem fingir que executou. **Achado de ambiente**
  (não é bug do workflow): a primeira rodada de testes falhou com
  `[GoogleGenerativeAI Error]: fetch failed` no Gemini — mas o mesmo erro
  também acontecia no SDR (pré-existente, não causado por esta mudança).
  Causa: DNS do container `magma-n8n-dev` retornando `SERVFAIL` pra
  qualquer host externo (`docker exec magma-n8n-dev nslookup google.com`
  confirmou); resolvido com `docker restart magma-n8n-dev` (glitch
  transitório do resolver embutido do Docker, não precisa de mudança de
  config). Se acontecer de novo: reiniciar o container antes de suspeitar
  do workflow. Workflow reexportado pra
  `plataforma/n8n/workflows/mag-fase-0-sdr.json` (18→23 nós: removido
  `Responder no WhatsApp` — eco de teste morto — e adicionados os 6 nós
  da Operadora).
- (2026-07-21, mesmo dia) **Adendo pós-entrega**: Daniel, testando de
  verdade (pediu "como eu testo?" e depois usou o WhatsApp real), notou que
  o gestor não sabia quantas matrículas a turma já tinha, nem tinha como
  gerar link de matrícula pelo chat. Investigação: o model `Matricula`
  (app `educacional`) **já existe** — mesmo padrão de convite por turma do
  `ConviteAvaliacao` (token UUID, escopo turma/individual, `.url` ==
  `/carteirinha/{token}`) — só faltava expor pela Camada de Ações. Fix:
  `status_turma` ganhou `matriculas` (conta só `ativa`/`concluida` — convite
  de escopo turma sem preencher não conta) e ação nova
  `gerar_link_matricula` (mesmo padrão de `gerar_link_avaliacao`, sem
  precisar de campo `curso` porque `Matricula` só tem FK direta pra
  `Turma`). Operadora ganhou a 4ª tool e o prompt foi atualizado. **Bug
  cometido e corrigido no caminho**: o `updateNode` que trocou o
  `systemMessage` via `parameters.options.systemMessage` resetou
  `promptType`/`text`/`maxIterations`/`returnIntermediateSteps` do nó pro
  default (`No prompt specified` na 1ª tentativa de teste) — o diff engine
  do n8n-mcp reconstrói o objeto `parameters.options` inteiro em vez de
  fazer merge raso quando o path é aninhado; corrigido com dois
  `updateNode` extras restaurando os campos perdidos. **Lição**: ao usar
  `updateNode` num campo aninhado (`parameters.options.X`), sempre conferir
  via `n8n_get_workflow` (`mode: filtered`) se os campos-irmãos
  sobreviveram, e reaplicar os que sumirem — não assumir merge automático.
  Reorganização visual: usei o botão nativo "Tidy Up" do n8n (auto-layout,
  duas pistas — Operadora em cima, SDR embaixo) e só reposicionei manualmente
  o `Gemini Chat Model` compartilhado pro meio das duas pistas (encurta a
  conexão diagonal). Screenshot do navegador automatizado travou nessa
  página (canvas pesado do editor) — validação foi via API/DOM, não visual.
  Testado de ponta a ponta com número real do gestor: "status da turma 026"
  → devolveu "Matrículas confirmadas: 2"; "link de matrícula da turma 026"
  → devolveu `/carteirinha/{token}` válido. Nota: o código da turma de teste
  mudou de "08/2026" pra "026" no meio da sessão (o próprio Daniel editou/
  testou em paralelo) — a Operadora reagiu corretamente ao erro "não
  encontrada" pedindo confirmação do código, sem inventar dado. Suíte
  completa 169/169.
- (2026-07-21, mesmo dia) **Adendo 2, antes de commitar**: Daniel pediu uma
  forma de listar as turmas (código, nome, curso etc.) pra quando não
  lembrar o código de cabeça. Ação nova `listar_turmas` (`apps/cursos/
  acoes.py`) — sem parâmetro obrigatório, filtro opcional por `status`,
  ordenada por mais recente. Operadora ganhou a 5ª tool e o prompt foi
  instruído a chamar `listar_turmas` proativamente quando não souber o
  código, em vez de só perguntar. Testado de ponta a ponta: "quais turmas
  estão abertas?" → a IA sozinha decidiu filtrar por `status=inscricoes`
  e respondeu só a turma 026; "lista todas as turmas cadastradas" →
  devolveu as 3 turmas (026 inscrições, 027/028 rascunho) formatadas em
  tabela markdown. Dessa vez o `updateNode` no `systemMessage` NÃO resetou
  os campos-irmãos (ao contrário do adendo 1) — mesmo assim confirmei via
  `n8n_get_workflow mode: filtered` antes de seguir. Suíte completa
  170/170. Workflow reexportado (25 nós).
- (2026-07-21, mesmo dia) **Bug real encontrado pelo Daniel**: pediu o link
  de matrícula da turma 026 e recebeu um link **já preenchido** (de um
  aluno específico, "Fernando Teste"), não um convite em aberto. Investiguei
  o banco dev: a turma tinha 3 `Matricula` — pk 19 (convite aberto, `aluno`
  None), pk 20 e 21 (alunos que já preencheram a carteirinha) — e as 3
  estavam com `escopo=turma` (deveriam ser 20/21 `individual`). Causa raiz:
  `MatriculaConvitePublicoView.post` (`apps/educacional/views.py:66-73`)
  cria a matrícula nova do aluno sem passar `escopo=INDIVIDUAL` — herda o
  default do model (`TURMA`) — apesar do comentário no código já dizer
  "Matrícula individual nova". Bug pré-existente da plataforma (não
  introduzido por mim), só ficou visível agora porque `gerar_link_matricula`
  foi a primeira coisa a **consultar** esse campo pra decidir qual link
  reaproveitar (o teste `test_escopo_turma_gera_matricula_nova_e_mantem_
  link_reutilizavel` já existia mas nunca checava o `escopo` dos alunos
  gerados, só do convite original). Fix em duas camadas: (1) causa raiz —
  a view agora passa `escopo=Matricula.Escopo.INDIVIDUAL` explicitamente;
  (2) defesa em profundidade — `gerar_link_matricula` também filtra
  `preenchida_em__isnull=True`, nunca confiando só no `escopo` pra decidir
  se é convite em aberto. Teste novo `test_nao_devolve_matricula_ja_
  preenchida` reproduz o cenário exato. Dados já afetados no dev corrigidos
  via shell (`Matricula.objects.filter(escopo=TURMA,
  preenchida_em__isnull=False).update(escopo=INDIVIDUAL)`). Testado de
  ponta a ponta de novo: "manda o link de matrícula da turma 026 de novo"
  → devolveu o token da matrícula pk 19 (convite real, sem aluno),
  confirmado por comparação direta no shell. Suíte completa 171/171.
