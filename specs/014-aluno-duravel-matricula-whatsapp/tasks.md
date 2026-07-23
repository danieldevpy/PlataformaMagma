# Tasks 014 — Aluno durável + matrícula pelo WhatsApp

> Estados: PENDENTE → EM ANDAMENTO → ENTREGUE (agente) → DONE (revisado).
> Fase A (T1–T8) entrega valor sozinha; Fase B (T9–T13) depende de A.

| ID | Tarefa | Estado | Agente |
|----|--------|--------|--------|
| T1 | `Aluno`: `token` (uuid), `cpf` unique/null normalizado, carteirinha (código/validade) migrada pra cá, `buscar_ou_criar_por_cpf`, `url` = `/carteirinha/{token}` | DONE | sonnet |
| T2 | `Matrícula` pura: `aluno` obrigatório, remove token/escopo/carteirinha/expira/preenchida, `unique_together (aluno, turma)` | DONE | sonnet |
| T3 | `Turma`: `token_cadastro` (uuid) + `vagas_restantes`/`lotada` como property; remove campo armazenado `vagas_restantes` | DONE | sonnet |
| T4 | Data migration: normaliza+funde CPF, migra carteirinha pro aluno, fantasmas→`token_cadastro`, apaga fantasmas, dropa colunas órfãs (ordem: dados antes do schema) | DONE | sonnet |
| T5 | Views/serializers públicos: cadastro por `Turma.token_cadastro` (busca-ou-cria aluno + cria matrícula, recusa turma encerrada); card por `Aluno.token` | DONE | sonnet |
| T6 | Frontend `/carteirinha/*`: cadastro usa `token_cadastro` da turma; card usa `token` do aluno | DONE | sonnet |
| T7 | `status_turma` (vaga via property) + `gerar_link_matricula` devolve link de cadastro da turma; `docs/plataforma/03` atualizado | DONE | sonnet |
| T-adm | Consertar `apps/educacional/admin.py` (`MatriculaAdmin`) e `apps/cursos/admin.py` (uso de `Matricula.Escopo`) — desbloqueia o system check; consertar os 13 testes quebrados | DONE | sonnet |
| T8 | Testes Fase A: dedup CPF, property de vaga, unicidade matrícula, cadastro público — suíte verde | DONE | sonnet |
| T9 | Ação `buscar_aluno` (nome/CPF/WhatsApp, candidatos mascarados, sem PK) + registro no `ready()` | DONE | sonnet |
| T10 | Ação `matricular_aluno` (aluno por token + turma, recusa duplicata/inexistente) + registro | DONE | sonnet |
| T11 | Testes Fase B: `buscar_aluno` (0/1/N) + `matricular_aluno` (sucesso/duplicata/inexistente) | DONE | sonnet |
| T12 | `TokenAgente` ganha os 2 escopos + Operadora ganha as 2 tools + system prompt com protocolo buscar→confirmar→matricular (3 casos de borda); `docs/plataforma/03` | DONE | sonnet |
| T13 | Teste real (dev, via `n8n_test_workflow` simulando webhook — não uma mensagem literal do celular do gestor): "busca o Zezinho" → busca/confirma/insere na 026 com sucesso; nome inexistente → oferece cadastro; vaga reflete no retorno de `matricular_aluno` | DONE | sonnet |
| T14 | `.context/` (educacional/cursos) + `status.md` + entrada em `historico/` | DONE | sonnet |

## Ondas

- Onda 1 (modelo, paralelizável com cuidado): T1, T2, T3
- Onda 2 (depende de T1–T3): T4 (migração), T5 (views)
- Onda 3 (depende de T5): T6 (frontend), T7 (ações de leitura ajustadas)
- Onda 4 (depende de T1–T7): T8 (testes Fase A) — **gate: A deployável aqui**
- Onda 5 (Fase B, depende de A): T9, T10 → T11
- Onda 6 (depende de T9–T11): T12 → T13
- Onda 7 (fecha): T14

## Log

- (2026-07-21) Spec criada a partir de conversa de arquitetura com o Daniel.
  Origem: pergunta "o sistema conta certo os inscritos?" → achado de que
  `vagas_restantes` é campo manual e `Aluno` não tem identidade durável.
  Decisões travadas na conversa: (1) carteirinha = só o front-end de cadastro
  de aluno novo (não vira `ConviteMatricula`); (2) o card persiste no `Aluno`;
  (3) gestor matricula aluno existente pelo WhatsApp com busca por nome/CPF/
  WhatsApp + confirmação obrigatória antes de inserir (casos: 0/1/N
  resultados); (4) `vagas_restantes` 100% calculado, sem override; (5) Lead e
  Aluno seguem separados (sem `Pessoa` unificada); (6) Fases A e B na mesma
  spec. Maior risco = migração de dados destrutiva (copiar antes de dropar,
  backup em prod).
- (2026-07-23) T6, T8-T14 fechados numa sessão só, a pedido do Daniel ("vamos
  terminar essa spec 014"). T1-T5/T7/T-adm já estavam prontos de sessão
  anterior — só validados.
  - **T6**: `/carteirinha/[token]` virou só o card (`CarteirinhaCard.tsx`,
    sempre "preenchido"); `/carteirinha/nova/[token]` novo, com o formulário
    (`CarteirinhaCadastro.tsx`, porta do componente antigo, sem o caso
    "já preenchida" que não existe mais nesse fluxo — cadastro é sempre em
    branco). `CarteirinhaExperience.tsx` (antigo, servia os dois papéis)
    removido. `lib/types.ts` ganhou `CarteirinhaAluno`/`ConviteCadastroTurma`
    no lugar do `AlunoCarteirinha` aninhado antigo. Validado via curl
    (SSR + POST real + GET do card) — sem acesso a browser nesta sessão pra
    testar a animação/sheet manualmente; recomendado o Daniel clicar no
    fluxo quando puder.
  - **T8**: faltavam testes de `vagas_restantes`/`lotada` (property) e de
    unicidade `(aluno, turma)` — adicionados em `apps/cursos/tests.py` e
    `apps/educacional/tests.py`. **Decisão consciente**: não escrevi teste
    que re-executa a migration `0004_migrar_dados_aluno_matricula_turma` em
    si (ela já rodou em dev, e re-testá-la exigiria o histórico model state
    do Django, que essa migration não suporta mais depois que `0005`/`0006`
    dropraram os campos que ela lê) — cobri a lógica de dedup que continua
    viva (`Aluno.buscar_ou_criar_por_cpf`) com testes diretos em
    `BuscarOuCriarPorCpfTests`.
  - **T9-T11**: `buscar_aluno`/`matricular_aluno` em `apps/educacional/acoes.py`.
    Achado ao escrever o teste de busca por WhatsApp: 11 dígitos sem DDI
    colide com CPF (ambos 11 dígitos) — resolvido buscando nos dois campos
    quando o termo tem exatamente 11 dígitos, em vez de arriscar não achar.
  - **T12**: Operadora ganhou as 2 tools + protocolo buscar→confirmar→
    matricular no system prompt (via `n8n-mcp`, `patchNodeField` — não
    `updateNode` bruto, pra não repetir o incidente da spec 013 de apagar
    `promptType`/`text` sem querer). `TokenAgente` de dev ganhou os 2
    escopos novos via shell. `docs/plataforma/03-api-contratos.md` e
    `plataforma/n8n/workflows/README.md` atualizados.
  - **T13** (teste real, via `n8n_test_workflow` — n8n dev precisou ser
    subido nesta sessão, `docker compose -f plataforma/n8n/docker-compose.dev.yml up -d`,
    não estava rodando): **achado real #1** — no 1º teste completo
    (buscar → confirmar em mensagens separadas), a IA **inventou** um
    `aluno_token` fake em vez de reusar o token real da busca anterior
    (porque o token nunca é falado em voz alta pro humano, então não fica
    na "memória" da conversa que o LLM relê) — o backend recusou com 400
    (proteção que já existia funcionou), mas a matrícula não aconteceu.
    Fix: regra nova no system prompt — sempre re-chamar `buscar_aluno`
    imediatamente antes de `matricular_aluno` quando a confirmação vem numa
    mensagem separada, nunca reaproveitar token de memória. Re-testado e
    confirmado: 2ª rodada matriculou certo, com o token real. **Achado real
    #2** (não relacionado à spec 014, pré-existente): o node "SDR - Capitã
    de Matrículas" estava com `parameters` **vazio** no n8n de dev (system
    prompt inteiro perdido — provável recorrência do incidente já
    documentado na spec 013, "sanitização automática apaga campo aninhado
    sem querer"), descoberto ao reexportar o workflow pro JSON versionado.
    Restaurado a partir do `mag-fase-0-sdr.json` já commitado (única fonte
    com o prompt original íntegro) via `updateNode`; testado de novo com
    mensagem real de venda (SDR respondeu preço certo, registrou lead) —
    confirmado recuperado. `mag-fase-0-sdr.json` reexportado com os 2 nós
    novos + fix do SDR + posições atualizadas (o arquivo estava desatualizado
    desde a reorganização visual de 21/07, nunca reexportado). Testes cobrem
    0 candidatos (oferece link de cadastro, não inventa) e 1 candidato
    (busca → confirma com CPF mascarado → matricula com sucesso); não testei
    o caso de vários candidatos via WhatsApp real (coberto só no nível
    Django, `BuscarAlunoTests.test_por_nome_parcial_varios_resultados`).
    Evolution API não estava rodando neste sandbox — todo teste terminou
    com erro de DNS só no nó final de *envio* da resposta (`getaddrinfo
    EAI_AGAIN evolution-api`), depois de confirmar que a IA/backend fizeram
    a coisa certa — nunca chegou a mandar mensagem de verdade pra ninguém.
  - **T14**: esta entrada + `.context/status.md` + `.context/historico/`.
- (2026-07-23, mais tarde) Achado do Daniel testando: faltava uma forma de
  ver quem está matriculado numa turma específica (só dava pra ver a
  *contagem* via `status_turma`). Adicionado nos dois lugares pedidos:
  - **Admin**: `MatriculaInline` em `TurmaAdmin` (`apps/cursos/admin.py`) —
    abre a Turma e já vê a lista de alunos matriculados, sem filtrar
    Matrícula à parte.
  - **Agente**: ação nova `listar_matriculas_turma` (`apps/educacional/
    acoes.py`, testada em `apps/nucleo/tests.py`) — `{turma_codigo,
    alunos: [{aluno_token, nome, status, matriculado_em}]}`, ordem
    alfabética, sem CPF nem `id`. Tool nova na Operadora + linha no system
    prompt. Suíte 195/195.
  - **Achado de infraestrutura, não desta spec**: enquanto eu editava o
    workflow no n8n via `n8n-mcp`, o Daniel tinha o editor aberto no
    navegador (`localhost:5678`) — cada save/interação da aba dele
    sobrescrevia minhas mudanças com o estado antigo que a aba tinha
    carregado (Operadora/SDR voltaram a ficar com `parameters` vazio, nós
    se reposicionaram sozinhos, `versionCounter` saltou de 41 pra 65 sem
    eu ter feito isso). Confirmado com o Daniel e resolvido restaurando de
    novo depois. **Lição pra próxima vez**: perguntar/checar se o editor do
    n8n está aberto ANTES de fazer uma sequência de edições via API — dois
    escritores (UI + API) no mesmo workflow brigam e quem salvar por
    último vence, mesmo que a versão salva seja mais velha.
