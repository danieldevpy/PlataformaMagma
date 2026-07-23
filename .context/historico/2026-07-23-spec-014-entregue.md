# 2026-07-23 (noite) — Spec 014 (Aluno durável + matrícula pelo WhatsApp) entregue

## Prompt do Daniel

"certo então antes de ir para a vps, camos terminar essa spec 014" — depois
de identificar, no processo de organizar os commits desta sessão, que havia
trabalho de uma sessão anterior (T1-T5, T7, T-adm) parado no working tree,
com T6 "em andamento" e T8-T14 "pendente".

## Estado ao entrar

T1-T5, T7 e T-adm já estavam prontos e corretos (modelo `Aluno`/`Matrícula`
pura, migração de dados cuidadosa em 2 passos, views/serializers públicos,
`gerar_link_matricula` e `status_turma` ajustados). Faltava: frontend (T6),
testes de cobertura (T8), as 2 ações de escrita da Operadora (T9-T11), o
workflow do n8n (T12), um teste real (T13) e a documentação (T14).

## O que foi feito

**T6 — Frontend.** O componente antigo `CarteirinhaExperience.tsx` servia
dois papéis com um token só (cadastro E card). Virou dois:
`CarteirinhaCadastro.tsx` (form de preenchimento, sempre em branco, POST em
`/carteirinha/nova/{turma.token_cadastro}/`, redireciona pro card no
sucesso) e `CarteirinhaCard.tsx` (só exibição, GET em
`/carteirinha/{aluno.token}/`, sempre "preenchido"). Rotas:
`app/(site)/carteirinha/nova/[token]/page.tsx` (nova) e
`app/(site)/carteirinha/[token]/page.tsx` (reescrita). `lib/types.ts`
ganhou `CarteirinhaAluno`/`ConviteCadastroTurma` no lugar do
`AlunoCarteirinha` aninhado antigo. `docs/plataforma/03-api-contratos.md`
ganhou a seção "Carteirinha digital". Validado via curl (SSR, POST real
contra o backend, GET do card, os 2 casos de erro) — **sem acesso a
browser nesta sessão**, então a animação/sheet não foi clicada manualmente;
recomendado o Daniel testar quando puder.

**T8 — Testes que faltavam.** `VagasRestantesPropertyTests` (capacidade
nula, desconto só ativa/concluída, nunca negativo, `lotada`) em
`apps/cursos/tests.py`; `BuscarOuCriarPorCpfTests` e
`MatriculaUnicidadeTests` em `apps/educacional/tests.py`. Decisão
consciente: não escrevi um teste que re-executa a migration de dados em si
— ela já rodou em dev e testá-la exigiria o historical model state do
Django, que essa migration não suporta mais depois que `0005`/`0006`
dropraram os campos que ela lê. A lógica de dedup que continua viva
(`Aluno.buscar_ou_criar_por_cpf`) tem cobertura direta.

**T9-T11 — Ações de escrita.** `buscar_aluno` e `matricular_aluno` em
`apps/educacional/acoes.py`, testadas em `apps/nucleo/tests.py`
(`BuscarAlunoTests`, `MatricularAlunoTests`). Achado ao escrever o teste de
busca por WhatsApp sem DDI: 11 dígitos colide com CPF (ambos têm 11
dígitos) — resolvido buscando nos dois campos (`Q(cpf=...) |
Q(whatsapp__icontains=...)`) quando o termo tem exatamente 11 dígitos, em
vez de arriscar não achar por causa da ambiguidade.

**T12 — Workflow n8n.** `n8n dev` precisou ser subido nesta sessão
(`docker compose -f plataforma/n8n/docker-compose.dev.yml up -d`, não
estava rodando). Operadora ganhou os 2 nós `toolHttpRequest` novos
(`buscar_aluno`, `matricular_aluno`, mesmo padrão dos existentes:
`typeVersion 1.1`, credencial `httpHeaderAuth`, sem `{{ }}` no `url`) e o
system prompt ganhou o protocolo buscar→confirmar→matricular. Edição via
`patchNodeField` (não `updateNode` bruto no campo aninhado) — lição da
spec 013 sobre apagar `promptType`/`text` sem querer. `TokenAgente` de dev
ganhou os 2 escopos novos via shell.

**T13 — Teste real.** Via `n8n_test_workflow` simulando o webhook da
Evolution (não uma mensagem literal do celular do gestor). 3 cenários:

- 0 candidatos → ofereceu o link de cadastro, não inventou nada.
- 1 candidato → confirmou nome/CPF mascarado/WhatsApp, pediu confirmação.
- **Achado real #1**: na confirmação (mensagem separada da busca), a IA
  **inventou** um `aluno_token` fake (`"aluno_token_001"`) em vez de reusar
  o token real devolvido pela busca — o token nunca é falado em voz alta
  pro humano, então não sobrevive na "memória" da conversa que o LLM relê.
  O backend recusou com 400 (a defesa em `matricular_aluno` — `try/except
  ValidationError` no parse do token — funcionou), mas a matrícula não
  aconteceu e a IA relatou o erro com honestidade, sem fingir sucesso.
  **Fix**: regra nova no system prompt — sempre re-chamar `buscar_aluno`
  imediatamente antes de `matricular_aluno` quando a confirmação vem numa
  mensagem separada, nunca reaproveitar token "de cabeça". Re-testado do
  zero (busca → confirmação em 2 mensagens): 2ª rodada re-buscou e
  matriculou certo, com o token real, e respondeu "Matrícula ... realizada
  com sucesso" só depois do tool call confirmar.
- **Achado real #2 (pré-existente, não desta sessão)**: ao reexportar o
  workflow pro JSON versionado (`plataforma/n8n/workflows/mag-fase-0-sdr.json`,
  que estava desatualizado desde a reorganização visual de 21/07 e nunca
  tinha sido reexportado), percebi que o node "SDR - Capitã de Matrículas"
  estava com `parameters` **vazio** no n8n de dev — o system prompt inteiro
  sumido. Não fui eu quem causou (nenhuma das minhas operações tocou nesse
  node) — é provável recorrência do incidente já documentado na spec 013
  ("sanitização automática apagou `systemMessage` sem querer" numa sessão
  anterior). Recuperado a partir do `mag-fase-0-sdr.json` já commitado
  (única fonte com o prompt original íntegro) via `updateNode`. Retestado
  com uma pergunta de venda real ("quanto custa o Socorrista APH?") — SDR
  respondeu preço certo (R$ 650) e registrou o lead, confirmando a
  recuperação.

Todo teste terminou com erro de DNS só no nó final de *envio* da resposta
(`getaddrinfo EAI_AGAIN evolution-api` — Evolution API não estava rodando
neste sandbox), depois de confirmar que IA + backend fizeram a coisa
certa. Nunca chegou a mandar mensagem de verdade pra ninguém.

**T14 — Docs.** `.context/backend.md` (linhas de `cursos`/`educacional`
atualizadas), `.context/frontend.md` (rotas de carteirinha), esta entrada,
`.context/status.md`.

## Estado ao sair

Spec 014 (Fases A e B) completa em dev: backend 192/192 testes, frontend
typecheck+lint limpos, workflow n8n validado (0 erros) e testado de ponta
a ponta com 2 bugs achados e corrigidos no processo. `mag-fase-0-sdr.json`
reexportado com os 2 nós novos, o fix do SDR e as posições atualizadas.
`ids-prod.json`/`promover-prod.sh` não tocados.

## Pendente

- Promover pra prod: importar o workflow atualizado + criar os 2 escopos
  novos (`educacional:buscar_aluno`, `educacional:matricular_aluno`) no
  `TokenAgente` de prod — checklist em `plataforma/n8n/workflows/README.md`.
- Rodar as migrations da 014 em prod, **com backup antes** (migração de
  dados destrutiva — funde CPF duplicado, apaga matrículas-fantasma).
- Daniel clicar no fluxo de `/carteirinha/nova/*` e `/carteirinha/*` num
  browser de verdade (não testado interativamente nesta sessão).
- Nada disso foi commitado ainda — fica pra próxima etapa (ir pra VPS),
  quando o Daniel decidir.
