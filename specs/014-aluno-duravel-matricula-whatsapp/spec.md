# Spec 014 — Aluno durável + matrícula pelo WhatsApp

> O QUÊ e PORQUÊ. Fase do roadmap: gestão escolar operável pelo celular
> (meta média de `.context/status.md`) + Fase 2 do agente MAG (B1 Operadora
> com escrita — `docs/subsistemas/02b-agente-whatsapp-n8n.md`).

## Problema / oportunidade

Hoje o `Aluno` (`apps/educacional`) nasce como subproduto de cada
preenchimento de carteirinha: sem CPF único, cada cadastro cria um `Aluno`
novo em branco. A mesma pessoa que fez um curso ano passado e agora faz
outro vira **dois alunos distintos** — recorrência é impossível de rastrear.

Junto disso, `Matricula` acumula três papéis ao mesmo tempo (convite/
magic-link + matrícula real + carteirinha), e o link compartilhado da turma
é uma `Matricula` "fantasma" (vazia, reutilizável). Foi dessa sobrecarga que
vieram os bugs de contagem e de `escopo` já corrigidos na spec 013.

O gestor precisa poder, pelo WhatsApp, **matricular um aluno que já existe**
numa turma nova ("coloque o Daniel Fernandes na turma 026") — e isso não tem
caminho no modelo atual: todo fluxo hoje é "cria convite → aluno preenche →
nasce aluno". Não dá pra reaproveitar quem já está na base.

## O que muda para o usuário

- **Aluno vira identidade durável.** Uma pessoa = um `Aluno` (chave: CPF).
  Fez 3 cursos = 1 aluno com 3 matrículas, não 3 alunos soltos.
- **Carteirinha = só a experiência de cadastro de aluno NOVO.** Ao preencher
  o link da turma, num passo nascem o `Aluno` + a 1ª `Matrícula` naquela
  turma. Aluno que já existe (mesmo CPF) é reconhecido — não duplica, só
  ganha a matrícula nova. O card digital persiste (identidade do aluno).
- **Gestor matricula aluno existente pelo WhatsApp.** "Coloque o Daniel
  Fernandes na turma 026" → o agente **busca** (por nome, CPF ou número),
  **confirma** mostrando os dados completos ("é o Daniel Fernandes, CPF
  123.***, WhatsApp (21)9****?") e só **depois de confirmado** cria a
  matrícula. Nunca insere sem confirmação.
- **Vagas restantes passam a bater sozinhas.** `vagas_restantes` deixa de ser
  um número digitado à mão e vira cálculo (`capacidade − matrículas`). A
  contagem segue certa a cada matrícula, sem manutenção manual.

## Critérios de aceite

- [ ] `Aluno.cpf` é único (normalizado, só dígitos); cadastro faz
      **busca-ou-cria por CPF** — reabrir o cadastro com um CPF já existente
      não cria aluno duplicado, só adiciona a matrícula nova àquele aluno.
- [ ] `Aluno` ganha `token` (uuid público) e passa a ser dono da carteirinha
      (código + validade). O card digital do aluno é acessível por
      `token`, um por pessoa.
- [ ] `Matrícula` vira pura: `aluno` obrigatório + `turma` + status +
      pagamento. Um mesmo aluno não pode ter duas matrículas ativas na mesma
      turma (unicidade `(aluno, turma)`).
- [ ] O link de cadastro de novos alunos vive na `Turma` (`token_cadastro`),
      estável e reutilizável — acabou a `Matrícula`-fantasma.
- [ ] `vagas_restantes` é **calculado** (`max(0, capacidade − matrículas)`;
      `null` quando `capacidade` em branco). Nenhum campo armazenado.
- [ ] Ação `buscar_aluno` (termo → nome/CPF/WhatsApp) devolve candidatos com
      dados suficientes pra confirmação (token, nome, CPF mascarado,
      WhatsApp), sem PK (constituição §6).
- [ ] Ação `matricular_aluno` (aluno por token + turma por código) cria a
      matrícula de um aluno existente; recusa duplicata e turma/aluno
      inexistentes com `ErroAcao`.
- [ ] Operadora (n8n) ganha as 2 tools e executa o fluxo
      **buscar → confirmar → matricular**, cobrindo: nenhum encontrado
      (oferece cadastrar como novo), 1 encontrado (confirma), vários
      encontrados (lista e pede desambiguação antes de confirmar).
- [ ] Migração de dados converte o legado sem perda: alunos duplicados por
      CPF são fundidos; carteirinha migra pro `Aluno`; matrículas-fantasma
      viram `token_cadastro` da turma; matrículas preenchidas viram
      `Aluno` + `Matrícula` pura.
- [ ] `docs/plataforma/03-api-contratos.md` atualizado (ações novas + payload
      alterado de `status_turma`/`gerar_link_matricula`).
- [ ] Suíte verde (`plataforma/rodar-testes.sh`), cobrindo dedup por CPF,
      property de vaga, unicidade da matrícula e as 2 ações novas.

## Critério de aceite do gestor

Pelo número de teste, logado como gestor: "coloque o Daniel Fernandes na
turma 026" → o agente busca, responde "é o Daniel Fernandes de CPF X e
WhatsApp Y? confirma?", e só depois do "sim" cria a matrícula e confirma.
"Quantas vagas faltam na 026?" reflete o número real depois da matrícula.
Um nome que não existe recebe "não achei — quer cadastrar como novo?" em vez
de um erro cru ou uma matrícula inventada.

## Fora de escopo

- Área do aluno logada / autenticação de aluno (o card continua acessível só
  pelo `token`, sem senha) — futuro.
- Unificar `Lead` e `Aluno` numa `Pessoa` única — mantém-se separados, com
  `Aluno.origem_lead` fazendo a ponte (decisão desta conversa).
- `identificar_contato` reconhecer aluno que volta a escrever no WhatsApp —
  vale a pena, mas fica pra spec futura (não bloqueia matrícula pelo gestor).
- Pagamentos/financeiro da matrícula além dos campos que já existem
  (`valor_fechado`, `forma_pagamento`).
- Override manual de vaga (vender fora do sistema sem registro) — não existe
  mais esse conceito: todo ocupante é uma `Matrícula` (via carteirinha ou via
  gestor), então `vagas_restantes` é puramente calculado.
