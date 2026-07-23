# Plan 014 — como fazer

> Referências: `apps/educacional/` (models/views/serializers atuais),
> `apps/avaliacoes/models.py` (padrão convite×artefato que inspira a
> separação), spec 013 (padrão AI Agent + `toolHttpRequest` 1.1 + memória +
> confirmar-antes-de-executar), `docs/plataforma/03-api-contratos.md`,
> constituição §6 (IDs públicos = uuid, nunca PK) e §1 (seed idempotente).

## Arquitetura-alvo (resumo)

```
Aluno       identidade durável. token (uuid público) + cpf UNIQUE (só dígitos,
            null quando desconhecido). Dono da carteirinha (codigo + validade,
            um por pessoa). Card em /carteirinha/{aluno.token}.

Matrícula   Aluno (obrigatório) ↔ Turma + status + valor/forma_pagamento +
            enviado_por. unique_together (aluno, turma). É o que conta vaga.

Turma       token_cadastro (uuid) = link estável de cadastro de novos alunos.
            vagas_restantes vira @property; capacidade continua manual.
```

Duas portas de matrícula, sem `Matrícula`-fantasma e sem `escopo`:
1. **Aluno novo** → carteirinha (`/carteirinha/nova/{turma.token_cadastro}`) →
   busca-ou-cria `Aluno` por CPF + cria `Matrícula`.
2. **Aluno existente** → gestor pelo WhatsApp → `buscar_aluno` +
   `matricular_aluno` → cria só a `Matrícula`.

## Fase A — Fundação de modelo (backend)

### Model (`apps/educacional/models.py`)

**`Aluno`** ganha:
- `token = UUIDField(default=uuid.uuid4, unique=True, editable=False)`.
- `cpf` passa a `unique=True, null=True` (guardar **só dígitos**; blank vira
  `NULL` — unique tolera múltiplos NULL em SQLite e MySQL). Normalizar no
  `save()`/serializer.
- `codigo_carteirinha` (unique), `validade_carteirinha`,
  `validade_carteirinha_meses` **migram de `Matricula` pra cá**; gerados no
  `save()` na criação do aluno (mesma lógica de prefixo/competência que hoje
  vive em `Matricula.save()`, agora baseada no 1º curso/turma do aluno ou num
  prefixo genérico `MAG` se ainda não houver matrícula).
- `@property url` → `/carteirinha/{self.token}` (card do aluno).
- helper `Aluno.buscar_ou_criar_por_cpf(cpf, defaults)` centraliza o dedup.

**`Matricula`** enxuga — **remove** `token`, `escopo`, `codigo_carteirinha`,
`validade_carteirinha*`, `expira_em`, `preenchida_em` e a lógica de
carteirinha do `save()`. Fica:
- `aluno` → `on_delete=CASCADE`, **not null** (obrigatório).
- `turma`, `status`, `valor_fechado`, `forma_pagamento`, `enviado_por`,
  timestamps.
- `Meta.constraints`: `UniqueConstraint(fields=["aluno", "turma"],
  name="matricula_aluno_turma_unica")`.

**`Turma`** (`apps/cursos/models.py`):
- `token_cadastro = UUIDField(default=uuid.uuid4, unique=True,
  editable=False)`.
- **remove** o campo `vagas_restantes`; vira:
  ```python
  @property
  def vagas_restantes(self):
      if self.capacidade is None:
          return None
      ativas = self.matriculas.filter(
          status__in=[Matricula.Status.ATIVA, Matricula.Status.CONCLUIDA]
      ).count()
      return max(0, self.capacidade - ativas)

  @property
  def lotada(self):
      return self.vagas_restantes == 0
  ```
  `status` continua manual pro ciclo de vida (rascunho/inscrições/andamento/
  encerrada); a LP/serializer passam a considerar `lotada` (property) OU
  `status == LOTADA`. Import de `Matricula` dentro da property (evita ciclo
  educacional↔cursos no boot).

### Views/serializers públicos (`apps/educacional/`)

- **Cadastro (aluno novo)**: view resolve por `Turma.token_cadastro` (não mais
  por `Matricula.token`). Aceita cadastro só quando a turma permite
  (`status` em inscrições/andamento — recusar em rascunho/encerrada). No POST:
  `Aluno.buscar_ou_criar_por_cpf(...)` → cria `Matricula(aluno, turma)` se
  ainda não existir (senão devolve a existente, idempotente) → responde o card
  do aluno.
- **Card do aluno**: view resolve por `Aluno.token` → `/carteirinha/{token}`.
- `PreencherCarteirinhaSerializer` continua exigindo CPF de 11 dígitos;
  passa a normalizar pra dígitos antes de gravar.
- Frontend: rota do cadastro passa a usar `token_cadastro` da turma; rota do
  card usa `token` do aluno. Ajustar `plataforma/frontend/` (páginas
  `/carteirinha/...`) — detalhar na task.

### Ações que mudam (`apps/cursos/acoes.py`)

- `status_turma`: `vagas_restantes` agora vem da property; `matriculas`
  continua contando `ATIVA`/`CONCLUIDA` (agora matrícula pura, sem fantasma).
- `gerar_link_matricula` (`apps/educacional/acoes.py`): deixa de criar/reusar
  `Matricula` e passa a devolver o **link de cadastro da turma**
  (`/carteirinha/nova/{turma.token_cadastro}`) — mesmo nome de ação, payload
  `{turma_codigo, url}` (sem `expira_em`; validade agora é o `status` da
  turma). Atualizar `docs/plataforma/03`.

### Migração de dados (`apps/educacional/migrations/` + `apps/cursos/`)

Data migration cuidadosa (dev tem volume pequeno; prod exige atenção):
1. Adiciona campos novos (schema).
2. **Normaliza** `Aluno.cpf` pra dígitos; onde ficou vazio → `NULL`.
3. **Funde** alunos com o mesmo CPF: mantém o mais antigo, repontua as
   `Matricula` dos duplicados pro sobrevivente, apaga os duplicados.
4. **Migra carteirinha**: para cada `Matricula` preenchida, copia
   `codigo_carteirinha`/`validade` pro `Aluno` (se o aluno ainda não tiver).
5. **Fantasmas** (matrícula de escopo turma, sem aluno, não preenchida) →
   gera/atribui `Turma.token_cadastro` (reusa o `token` da fantasma quando dá,
   pra não invalidar links já distribuídos) e depois **apaga** as fantasmas.
6. **Preenchidas** viram `Matricula` pura (os campos removidos são dropados no
   schema depois que os dados foram copiados).
7. Popula `token_cadastro` de toda `Turma` que ficou sem.
8. Remove os campos órfãos de `Matricula` e o campo `vagas_restantes` de
   `Turma` num passo final.

> Ordem importa: copiar dados **antes** de remover colunas. Rodar em dev,
> conferir contagens (`Aluno`/`Matricula`/`Turma`) antes e depois, e só então
> replicar em prod com backup.

## Fase B — Escrita pelo WhatsApp (Operadora)

### Ações novas (`apps/educacional/acoes.py`)

**`buscar_aluno`** — `params: {termo}`. Detecta o tipo do termo: só dígitos
com 11 → CPF; só dígitos (outro tamanho) → WhatsApp; senão → nome
(`icontains`). Devolve lista (limitada, ex. 10) de candidatos:
```python
{"token": str(aluno.token), "nome": ..., "cpf_mascarado": "123.***",
 "whatsapp": ..., "matriculas": <qtd>}
```
Sem CPF cru nem PK (constituição §6; CPF é PII — mascarar). Escopo
`educacional:buscar_aluno`.

**`matricular_aluno`** — `params: {aluno_token, turma_codigo, status?}`.
Valida aluno (por token), turma (por código), e recusa duplicata
(`unique (aluno, turma)`) com `ErroAcao` clara ("Daniel já está matriculado na
026"). Cria `Matricula(aluno, turma, status=ATIVA, enviado_por=request.user)`.
Devolve `{aluno_nome, turma_codigo, status, vagas_restantes}`. Escopo
`educacional:matricular_aluno`.

### `TokenAgente agente-recepcionista-mag`

Acrescenta (não recria) `educacional:buscar_aluno` e
`educacional:matricular_aluno` (dev via shell; passo de prod no
`plataforma/n8n/workflows/README.md`).

### Workflow n8n (`MAG - Fase 0`, id `ypeJKZLsGq1WxkQB`)

Operadora ganha 2 tools novas (`toolHttpRequest` 1.1, credencial
`httpHeaderAuth`, **nunca** header manual, **nunca** `{{ }}` no `url` — os 4
bugs já mapeados nas specs 010/012). System prompt ganha o protocolo de
escrita:
- Ao pedir matrícula, **primeiro** `buscar_aluno`, **nunca** `matricular_aluno`
  direto.
- 0 resultados → oferecer cadastrar como novo (link da carteirinha via
  `gerar_link_matricula`), não inventar.
- 1 resultado → repetir nome + CPF mascarado + WhatsApp e **pedir confirmação
  explícita** antes de chamar `matricular_aluno`.
- vários → listar candidatos numerados, pedir qual, e só então confirmar.
- Nunca afirmar que matriculou sem ter recebido `matricular_aluno` OK.

> Cuidado ao editar `systemMessage` via `n8n_update_partial_workflow`
> (`updateNode` em campo aninhado reconstrói `options` e apaga
> `promptType`/`text`/`maxIterations` — conferir com `mode: filtered` depois,
> lição da spec 013).

## Testes

- `apps/educacional/tests.py`: dedup por CPF (cadastro repetido não duplica,
  adiciona matrícula); normalização de CPF; carteirinha no `Aluno`; unicidade
  `(aluno, turma)`; cadastro recusado em turma encerrada.
- `apps/cursos/tests.py`: `vagas_restantes` property (capacidade nula → None;
  desconta ativas/concluídas; nunca negativo); `lotada`.
- `apps/nucleo/tests.py` (onde vivem os testes de ação): `buscar_aluno`
  (nome/CPF/WhatsApp; 0/1/N; sem PK/CPF cru); `matricular_aluno` (sucesso;
  duplicata → 400; token/curso inexistente → 400; sem escopo → 403 já
  coberto).
- Migração: teste de sanidade que roda a fusão de CPF num fixture com
  duplicados e confere que matrículas foram repontuadas.

## Decisões desta feature

- Sem `ConviteMatricula`: a carteirinha é só a experiência de cadastro; o link
  vive na `Turma`. (Decisão do Daniel — mais simples que espelhar
  `ConviteAvaliacao`.)
- `vagas_restantes` 100% calculado, sem override manual — todo ocupante é uma
  `Matrícula`.
- `Aluno.token` (uuid) é o identificador público nas ações; CPF nunca trafega
  cru pro agente (mascarado na busca).
- Fases A e B na mesma spec (decisão do Daniel), mas A entrega valor sozinha
  (contagem/vaga corretas) mesmo antes de B.

## Riscos / pontos de atenção

- **Migração destrutiva**: copiar dados antes de dropar colunas; conferir
  contagens em dev; backup antes de prod. É o maior risco da spec.
- Colisão de CPF na fusão só é segura se a normalização rodar antes do unique
  — ordem dos passos da migration importa.
- Links de carteirinha já distribuídos: a rota muda (`/carteirinha/{token}`
  passa a ser o card do aluno; cadastro vira `/carteirinha/nova/{token}`).
  Reusar o token da fantasma como `token_cadastro` reduz quebra, mas o path
  muda — avisar o Daniel se houver link já circulando.
- Repetir os 4 bugs de n8n (specs 010/012).
