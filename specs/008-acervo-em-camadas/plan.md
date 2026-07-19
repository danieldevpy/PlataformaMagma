# Plan 008 — Acervo em camadas

## Arquitetura da mudança

```
CAMADA (Midia.camada)   turma        curso         instrutores/estrutura/externa/geral
FK obrigatória          turma        curso         (nenhuma)
arquivo em              turmas/<id>/ acervo/cursos/<id>/   acervo/<camada>/
consentimento           da turma     n/a           n/a
```

### Backend (`apps/midia`)

- **models.py**: `RenameModel MidiaTurma → Midia` (tabela renomeada pelo Django,
  FKs seguem). `turma` null/blank (CASCADE mantido — ADR), `curso` FK null/blank
  (`related_name="midias_acervo"`; `curso.fotos` já é do FotoCurso), `camada`
  choices com default `geral`, `credito` Char(200) blank. `clean()` valida os
  invariantes. `caminho_midia` ramifica por camada. `Postagem.turma` null/blank
  + `curso` FK null/blank + property `contexto_rotulo` (turma → "Turma X";
  curso → nome; senão "Marca").
- **migração 0003**: rename + alter/add fields + `RunPython` marcando
  `camada="turma"` nas linhas existentes (todas têm turma). Nenhum arquivo móvel.
- **views.py**:
  - `encontrar_duplicata(queryset, nome, tamanho)` — recebe o escopo pronto.
  - Novas: `AcervoGeralView` (GET `/acervo/` com filtros), `CamadasView`
    (GET `/acervo/camadas/`), `EnviarAcervoView` (POST `/acervo/enviar/` —
    resolve camada/turma/curso, valida invariantes, dedup no escopo),
    `PostagensView` (GET/POST `/postagens/` — filtros `turma`, `curso`,
    `contexto=marca`; POST com `turma_id`/`curso_id` opcionais).
  - As views por turma continuam; upload por turma passa a delegar na mesma
    lógica de criação (camada=turma).
  - `CATALOGO_ACOES` ganha as rotas novas.
- **serializers.py**: Item ganha `camada`, `credito`; edit ganha `credito`;
  Postagem ganha `contexto` (rótulo) e aceita nulls.
- **acoes.py**: `listar_postagens_agendadas` devolve `contexto` e
  `turma_codigo`/`curso_slug` opcionais (sem PK).
- **admin.py**: colunas/filtros de camada e curso.

### Páginas staff (admin do app midia)

`MidiaAdmin.get_urls()` ganha `acervo/` (Mesa de Luz da marca) e `studio/`
(Studio da marca), renderizando os MESMOS templates das páginas por turma com
`window.MAGMA_CONTEXTO = {tipo: 'marca'}` (nas páginas por turma:
`{tipo:'turma', turma:{…}}`). Autenticação de graça via `admin_view` — mesmo
racional do 09 (nginx só roteia /api|/dj-admin).

### Front (static/midia)

- **acervo.js**: lê `MAGMA_CONTEXTO`; no modo marca, mostra um seletor de
  camada (geral/instrutores/estrutura/externa + cursos, populado por
  `/acervo/camadas/`), lista via `/acervo/?camada=…`, sobe via
  `/acervo/enviar/`, esconde o toggle de consentimento. Modo turma: zero
  mudança de comportamento.
- **studio.js**: picker de fotos ganha `<select>` de camada (turma atual →
  marca → cursos → outras turmas), carregando `/acervo/?tipo=foto&…` da camada
  escolhida; a seleção (state.photos) sobrevive à troca de camada → arte pode
  misturar camadas. Sem turma (Studio da marca): templates com
  `requer:['turma']` desabilitados, postagem criada via `/postagens/` geral,
  nomes de arquivo/título usam o rótulo do contexto.
- **templates/*.js**: `formacao`, `formatura`, `vagas`, `depoimento` declaram
  `requer: ['turma']` (capa_reel e educativo funcionam em qualquer contexto).

## Riscos e mitigação

- **Rename quebrar import esquecido** → grep MidiaTurma tem que zerar fora de
  migrations; suíte inteira roda no final.
- **Rotas por turma mudarem de contrato** → testes existentes + novos cobrindo
  o caminho antigo intocado.
- **Prod (MySQL)**: RENAME TABLE é operação suportada/atômica; migração não
  toca arquivos físicos.
- **Regressão visual do Studio** → mudanças de UI são aditivas (um select a
  mais no picker); smoke no browser antes de entregar.
