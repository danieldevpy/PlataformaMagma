# Spec 013 — B1 Operadora (Fase 1, só leitura)

> Continuação da Fase 1 do plano `docs/subsistemas/02b-agente-whatsapp-n8n.md`
> (§4, B1 Operadora da Plataforma; §9, Fase 1 marca B1 leitura como pendência
> final antes do critério "Daniel opera consultas pelo chat").

## Problema / oportunidade

Hoje, quando o Daniel (gestor) ou um instrutor escreve pro número da MAG, o
workflow reconhece quem é (`Identificar Contato`) mas só devolve um eco de
teste ("Te reconheci como gestor... recebi: ..."). Nenhuma consulta real
funciona pelo chat — pra saber o status de uma turma, pegar o link de
avaliação ou ver os leads do dia, o Daniel ainda precisa abrir o admin.

## O que muda para o usuário

- Gestor ou instrutor manda "status da T027" e recebe curso, status, datas
  e contagens (mídias/postagens/avaliações) — igual ao que o admin mostra.
- Manda "link de avaliação da T027" e recebe a URL pública (reusa convite
  válido existente, mesma regra do painel).
- Manda "leads de hoje" (ou "dos últimos 3 dias") e recebe a lista: nome,
  curso de interesse, quando pretende começar, status, de onde veio.
- Pergunta fora desse escopo (ex. "muda o preço", "aprova essa avaliação") —
  a Operadora explica que ainda não sabe fazer isso (sem inventar que fez).

## Critérios de aceite

- [x] Ação nova `listar_leads` (app `leads`): filtra por janela de dias
      (`dias`, opcional, default 1 = hoje) e por `status` (opcional, exato).
      Devolve nome, curso, whatsapp, quando_pretende, status, utm_source,
      criado_em — sem PK (mesma regra das demais ações).
- [x] `TokenAgente agente-recepcionista-mag` ganha os escopos
      `cursos:status_turma`, `avaliacoes:gerar_link_avaliacao` e
      `leads:listar_leads` (token único reaproveitado, mesmo padrão das
      specs 009/012 — não cria token novo por subagente ainda).
- [x] Workflow `MAG - Fase 0`: o ramo "É gestor ou instrutor?" (hoje ligado
      ao eco de teste `Responder no WhatsApp`) passa a entrar num AI Agent
      novo — **Operadora** — com as 3 ações acima como tools
      (`toolHttpRequest` typeVersion 1.1, credencial `httpHeaderAuth`,
      mesmo padrão validado da SDR/handoff), memória por número, e
      responde pelo WhatsApp.
- [x] Ramo "escalado" já cobre gestor/instrutor também (o IF "Está
      escalado?" já é anterior ao "É gestor ou instrutor?" — nenhuma
      mudança extra necessária ali, só confirmar no teste real).
- [x] `docs/plataforma/03-api-contratos.md` ganha a entrada de
      `listar_leads`.
- [x] **Adendo (achado do Daniel no teste real, mesmo dia)**: `status_turma`
      passa a incluir `matriculas` (contagem de `Matricula` com status
      `ativa`/`concluida` — convite de escopo turma ainda não preenchido não
      conta); ação nova `gerar_link_matricula` (app `educacional`, mesmo
      padrão de `gerar_link_avaliacao`, mas sobre o model `Matricula`) devolve
      o link público de matrícula/carteirinha da turma. Operadora ganha essa
      4ª tool; `TokenAgente` ganha `educacional:gerar_link_matricula`.
- [x] **Adendo 2 (achado do Daniel, mesmo dia)**: ação nova `listar_turmas`
      (app `cursos`) — lista todas as turmas (código, curso, status, início
      das aulas, vagas) com filtro opcional por status, pra achar o código
      de uma turma sem lembrar de cabeça. Operadora ganha essa 5ª tool e
      passa a chamar `listar_turmas` antes de pedir o código ao usuário
      quando a pergunta for ambígua (ex. "quais turmas estão abertas?").
      `TokenAgente` ganha `cursos:listar_turmas`.
- [x] **Bugfix (achado do Daniel, mesmo dia)**: `gerar_link_matricula` às
      vezes devolvia o link de uma matrícula **já preenchida** (de um aluno
      específico) em vez de um convite em aberto. Causa raiz:
      `MatriculaConvitePublicoView.post` (`apps/educacional/views.py`) não
      marcava `escopo=INDIVIDUAL` na matrícula gerada pro aluno que preenche
      um link de turma — ficava com o default `TURMA`, colando no filtro de
      "convite reaproveitável". Corrigido em dois pontos: a view agora seta
      `escopo=INDIVIDUAL` explicitamente (fix da causa raiz) e
      `gerar_link_matricula` passou a filtrar também por
      `preenchida_em__isnull=True` (defesa em profundidade — nunca confiar
      só no `escopo`). Dados já afetados no banco dev corrigidos via shell.

## Critério de aceite do gestor

No número de teste, logado como gestor: "status da T027" volta os dados
reais da turma; "link de avaliação da T027" volta a URL; "leads de hoje"
volta a lista dos leads criados hoje. Uma pergunta fora do escopo (ex.
"muda a vaga da T027 pra 5") recebe uma resposta honesta de que ainda não
faz isso, sem inventar confirmação.

## Fora de escopo

- Escrita (`atualizar_turma`, `atualizar_status_lead`, PIN pra ações
  críticas, criar matrícula individual pelo chat) — fica pra Fase 2 /
  próxima spec (B1 com escrita, §9 do plano). `gerar_link_matricula` só
  devolve o link de auto-preenchimento — quem cria a `Matricula` de fato é
  quem preenche o link, não o agente.
- `RegraAgente` (regras editáveis) — ainda não existe, mesma decisão das
  specs anteriores.
- Token dedicado por subagente — mantém `agente-recepcionista-mag`
  compartilhado (mesmo padrão pragmático já em uso).
- Agenda de instrutor por curso (ex. "quais turmas eu dou aula") — não
  fazia parte do pedido original do Daniel pra B1; fica pra quando surgir
  necessidade real.
