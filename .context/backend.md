# Backend — Django/DRF (`plataforma/backend/`)

> Detalhe completo: `docs/plataforma/02-backend-django.md` (modelos) e `03-api-contratos.md` (API — contrato é lei).

## Apps (`apps/`)

| App | Responsabilidade |
|---|---|
| `nucleo` | Base/configurações compartilhadas do site |
| `cursos` | Cursos, turmas (`cursos/models.py` — Turma), fotos, conteúdo da LP |
| `leads` | Captação de interessados |
| `avaliacoes` | Avaliações via magic-link (individual e por turma); `get_fotos` prioriza acervo (capa primeiro) com fallback `FotoCurso` |
| `midia` | Acervo por turma (`MidiaTurma`), postagens (`Postagem`), thumbs Pillow c/ EXIF, dedup nome+tamanho (409/`forcar`), API `/api/midia/` + catálogo `acoes/` |
| `contas` | Contas/usuários |
| `educacional` | Base para gestão escolar / área do aluno |

## Convenções

- PT-BR em código e dados. IDs públicos: slug/uuid, nunca PK sequencial. Erros: `{"detail": "..."}`.
- Toggles `exibir_*` no modelo; regra de exibição no **serializer** (API entrega `null` quando desligado).
- `conteudo_origem`: `"template"` (seed pode sobrescrever) vs `"editado"` (gestor tocou — intocável).
- Filtros em JSONField feitos **em Python** (compat SQLite dev × MySQL prod).
- URLs de mídia relativas (`config/drf.py::url_media_relativa`).
- Páginas staff via `TurmaAdmin.get_urls` sob `/dj-admin/` (templates em `templates/midia/`, estáticos em `static/midia/`).
- Auth API: Session+JWT, permissão `IsGestorOuInstrutor`, CSRF via `window.MAGMA_CSRF` + header `X-CSRFToken`.
