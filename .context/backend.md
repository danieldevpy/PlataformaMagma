# Backend — Django/DRF (`plataforma/backend/`)

> Detalhe completo: `docs/plataforma/02-backend-django.md` (modelos) e `03-api-contratos.md` (API — contrato é lei).

## Apps (`apps/`)

| App | Responsabilidade |
|---|---|
| `nucleo` | Base/configurações compartilhadas + **Camada de Ações agent-first** (`/api/acoes/`: registry, `TokenAgente` hash sha256 + escopos `app:acao`/`app:*`/`*`, `LogAcao` inclusive em erro, auth por header `X-Agente-Token`) |
| `cursos` | Cursos, turmas (`cursos/models.py` — Turma), fotos, conteúdo da LP |
| `leads` | Captação de interessados |
| `avaliacoes` | Avaliações via magic-link (individual e por turma); `get_fotos` prioriza acervo (capa primeiro) com fallback `FotoCurso` |
| `midia` | **Acervo da MARCA em camadas** (`Midia`, ex-`MidiaTurma` — spec 008: `camada` turma/curso/instrutores/estrutura/externa/geral, `turma`/`curso` opcionais conforme invariantes, `credito` p/ imagem externa), postagens multi-contexto (`Postagem` c/ turma OU curso OU marca + `agendada_para`), thumbs Pillow c/ EXIF, dedup nome+tamanho **por escopo de camada** (409/`forcar`), API `/api/midia/`: rotas por turma (contrato antigo intocado) + gerais (`acervo/`, `acervo/camadas/`, `acervo/enviar/`, `postagens/`) + catálogo `acoes/`; Studio 2.0: motor declarativo (`static/midia/templates-engine.js` + `templates/*.js`, 6 templates, `requer:['turma']` nos 4 que dependem de turma) e `marca.js` |
| `ia` | Provedores de IA (`ProvedorIA` c/ credencial **cifrada Fernet** write-only, `ExecucaoIA` auditoria/custo), adaptadores Anthropic/OpenAI (texto), `/api/ia/` (capacidades, executar, provedores, uso), página staff "Integrações de IA", botão ✨ no Studio (proposta, nunca sobrescreve) |
| `contas` | Contas/usuários |
| `educacional` | Base para gestão escolar / área do aluno |

## Convenções

- PT-BR em código e dados. IDs públicos: slug/uuid, nunca PK sequencial. Erros: `{"detail": "..."}`.
- Toggles `exibir_*` no modelo; regra de exibição no **serializer** (API entrega `null` quando desligado).
- `conteudo_origem`: `"template"` (seed pode sobrescrever) vs `"editado"` (gestor tocou — intocável).
- Filtros em JSONField feitos **em Python** (compat SQLite dev × MySQL prod).
- URLs de mídia relativas (`config/drf.py::url_media_relativa`).
- Páginas staff sob `/dj-admin/` (templates em `templates/midia/`, estáticos em `static/midia/`): por turma via `TurmaAdmin.get_urls`; da MARCA via `MidiaAdmin.get_urls` (`/dj-admin/midia/midia/acervo|studio/`) — mesmos templates, modo decidido por `turma` presente/None no contexto (`window.MAGMA_CONTEXTO`).
- Auth API: Session+JWT, permissão `IsGestorOuInstrutor`, CSRF via `window.MAGMA_CSRF` + header `X-CSRFToken`. Agentes externos (n8n/bot): `X-Agente-Token` (nucleo/autenticacao.py).
- Templates de arte são declarativos e **sem DOM** (`static/midia/templates/*.js` — a "LEI" no topo do `templates-engine.js`); dados JSON-serializáveis (fotos via `imgKey` + `assets.imagens`), preparado p/ render server-side futuro (spec 007).
- ⚠️ Cifra das credenciais de IA deriva de `DJANGO_SECRET_KEY` — rotacionar a chave em prod invalida as credenciais salvas (recadastrar depois).
