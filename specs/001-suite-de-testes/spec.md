# Spec 001 — Rede de segurança: suíte de testes automatizados

> O QUÊ e PORQUÊ. Fase do roadmap: transversal (protege todas as fases).
> Status de execução: ver `tasks.md` neste diretório.
> **Revisada em 2026-07-18 (noite)** após Studio 2.0 (specs 002–005), Acervo em
> Camadas (spec 008) e app `ia` entrarem no repo. Ver histórico da revisão no `tasks.md` §Log.

## Problema / oportunidade

Quando esta spec nasceu (manhã de 18/07) o repo tinha **zero testes**. No mesmo dia,
Studio 2.0 e o Acervo em Camadas trouxeram **~45 testes** (`apps/nucleo`, `apps/ia`,
`apps/midia`) — mas eles cobrem **ilhas**: camada de ações, provedores de IA, o endpoint
de avaliações da turma e parte do acervo em camadas. Ficam **sem nenhuma rede**:

- a **LP dinâmica** (`site/config`, cursos lista/detalhe) — infraestrutura da campanha;
- os **leads** (a captação em si — se quebrar, perde-se aluno em silêncio);
- as **avaliações por magic-link** e a **carteirinha** (o convite público, prova social);
- o **smoke completo do acervo** (upload EXIF→thumb, dedup 409/`forcar`, postagem→ZIP,
  fallback de fotos) — só uma fração virou teste persistido.

Com a meta nº 1 sendo a campanha 08/08 (`.context/status.md`), esses quatro são
infraestrutura de campanha: quebrar qualquer um no meio da campanha custa alunos. Além
disso, a superfície nova que **já tem teste** (ia, ações, acervo em camadas) precisa ser
**consolidada** sob um único runner e um settings de teste isolado — hoje não há nem
`config/settings/test.py`, nem comando único, então ninguém sabe rodar "a suíte".

## O que muda para o usuário (Daniel)

- Um comando único (`plataforma/rodar-testes.sh`) responde em ~1 min: "posso deployar?".
- Toda feature futura roda a suíte no seu Definition of Done (`specs/README.md` já exige).
- Regressão nos contratos de API (`docs/plataforma/03`) é detectada na hora, não em produção.
- Os testes rodam num settings isolado (`test.py`): SQLite de teste + `MEDIA_ROOT`
  temporário — nunca sujam `db.sqlite3` nem `backend/media/` reais.

## Decisão de stack (ver ADR no plan §Stack)

Mantém-se o padrão **já estabelecido no código**: `django.test.TestCase` nativo, um
`tests.py` **por app**, rodado com `python manage.py test`. **Não** se adota pytest nem
pasta central — os ~45 testes existentes já seguem esse formato, e migrar seria retrabalho
sem ganho para o alvo desta spec (contrato + regra de negócio, não fixtures sofisticadas).

## Critérios de aceite

- [ ] Existe `config/settings/test.py` (herda de `base`): DB de teste, `MEDIA_ROOT` em
      diretório temporário, `PASSWORD_HASHERS=[MD5]` p/ velocidade; **não** depende de
      `collectstatic`/`STATIC_ROOT`.
- [ ] `plataforma/rodar-testes.sh` roda `manage.py test` (settings de teste) + checagens de
      estáticos/front e sai com código ≠ 0 em qualquer falha.
- [ ] Rodar a suíte **não toca** `db.sqlite3` nem `backend/media/` reais (conferir timestamps)
      e é determinística (2 execuções seguidas = mesmo resultado).
- [ ] Todos os endpoints públicos e de painel listados no `plan.md §Cobertura` têm teste de
      contrato (status + shape do JSON).
- [ ] As regras da constituição viram testes executáveis: `conteudo_origem="editado"`
      intocável, toggles `exibir_*` → `null` no serializer, IDs públicos slug/uuid, erros
      `{"detail": ...}`, 403 sem login no painel/mídia/ia.
- [ ] O roteiro do smoke test do acervo (upload EXIF, dedup 409/`forcar`, postagem→ZIP,
      avaliação c/ acervo + fallback) está persistido como testes — incluindo o acervo **em
      camadas** (spec 008): dedup **por escopo de camada**, postagem multi-contexto (marca/curso/turma).
- [ ] A superfície nova já testada (ia, camada de ações) é **consolidada** e roda no runner;
      lacunas conhecidas dela viram teste (ex.: adapter Gemini recém-adicionado, se presente).
- [ ] Rodar a suíte não exige serviço externo (rede, MySQL, Node opcional só p/ front).

## Critério de aceite do gestor

Não toca o painel — n/a. (O beneficiário é o dev/orquestrador.)

## Fora de escopo

- Testes de browser real (Playwright/Selenium) — fica para uma spec futura; bugs de CSS
  renderizado (caso `[hidden]`) continuam cobertos por teste manual + regra-guarda.
- Render pixel-a-pixel dos templates do Studio 2.0 — a checagem aqui é **`node --check`**
  (sintaxe dos JS declarativos) e, no máximo, um smoke headless opcional; o olho do dono
  segue no teste manual.
- Testes unitários de componentes React — por ora `next build` + `tsc` são a checagem.
- CI em nuvem (GitHub Actions) — tarefa opcional T8, só se/quando houver remoto ativo.
- Cobertura percentual como meta — o alvo é **contrato e regra de negócio**, não número.
