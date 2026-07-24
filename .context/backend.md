# Backend — Django/DRF (`plataforma/backend/`)

> Detalhe completo: `docs/plataforma/02-backend-django.md` (modelos) e `03-api-contratos.md` (API — contrato é lei).

## Apps (`apps/`)

| App | Responsabilidade |
|---|---|
| `nucleo` | Base/configurações compartilhadas + **Camada de Ações agent-first** (`/api/acoes/`: registry, `TokenAgente` hash sha256 + escopos `app:acao`/`app:*`/`*`, `LogAcao` inclusive em erro, auth por header `X-Agente-Token`) |
| `cursos` | Cursos, turmas (`cursos/models.py` — Turma; `vagas_restantes`/`lotada` são `@property` calculadas a partir das matrículas ativas/concluídas, nunca campo digitado — spec 014; `token_cadastro` é o link estável de cadastro de aluno novo), fotos, conteúdo da LP |
| `leads` | Captação de interessados |
| `avaliacoes` | Avaliações via magic-link (individual e por turma); `get_fotos` prioriza acervo (capa primeiro) com fallback `FotoCurso` |
| `midia` | **Acervo da MARCA em camadas** (`Midia`, ex-`MidiaTurma` — spec 008: `camada` turma/curso/instrutores/estrutura/externa/geral, `turma`/`curso` opcionais conforme invariantes, `credito` p/ imagem externa), postagens multi-contexto (`Postagem` c/ turma OU curso OU marca + `agendada_para`), thumbs Pillow c/ EXIF, dedup nome+tamanho **por escopo de camada** (409/`forcar`), API `/api/midia/`: rotas por turma (contrato antigo intocado) + gerais (`acervo/`, `acervo/camadas/`, `acervo/enviar/`, `postagens/`) + catálogo `acoes/`; Studio 2.0: motor declarativo (`static/midia/templates-engine.js` + `templates/*.js`, 6 templates, `requer:['turma']` nos 4 que dependem de turma) e `marca.js` |
| `ia` | Provedores de IA (`ProvedorIA` c/ credencial **cifrada Fernet** write-only, `ExecucaoIA` auditoria/custo), adaptadores Anthropic/OpenAI (texto), `/api/ia/` (capacidades, executar, provedores, uso), página staff "Integrações de IA", botão ✨ no Studio (proposta, nunca sobrescreve) |
| `contas` | Contas/usuários |
| `educacional` | Gestão escolar: `Aluno` é identidade durável (`token` uuid, `cpf` unique/null, dono da carteirinha código+validade — spec 014); `Matrícula` pura (`aluno`+`turma`+status, `unique(aluno,turma)`, conta vaga); cadastro público por `Turma.token_cadastro` (link estável, busca-ou-cria por CPF) e card por `Aluno.token`; ações `buscar_aluno`/`matricular_aluno` (gestor matricula existente pelo WhatsApp, protocolo buscar→confirmar→matricular) |
| `financeiro` | Integração de pagamento Asaas (spec 015): `ConfiguracaoAsaas` (credencial + token de webhook **cifrados**, reusa `apps.ia.crypto`; 1 ambiente `ativo` entre sandbox/produção por vez) e `Cobranca` (ligada à `Matrícula`, campos vindos do Asaas nunca digitados). `adapters/asaas.py` é o único ponto que fala HTTP com o Asaas; `services.py::criar_cobranca_para_matricula` orquestra e é usado tanto pela ação do agente quanto pelo Admin (fallback). Ações `gerar_cobranca`/`consultar_pagamento`. `POST /api/financeiro/webhook/asaas/` é o **1º webhook HTTP externo do projeto** (auth por header `asaas-access-token`, nunca Session/JWT), auditado em `EventoWebhookAsaas`. Testado de ponta a ponta com sandbox real (2026-07-23) |

## Convenções

- PT-BR em código e dados. IDs públicos: slug/uuid, nunca PK sequencial. Erros: `{"detail": "..."}`.
- Toggles `exibir_*` no modelo; regra de exibição no **serializer** (API entrega `null` quando desligado).
- `conteudo_origem`: `"template"` (seed pode sobrescrever) vs `"editado"` (gestor tocou — intocável).
- Filtros em JSONField feitos **em Python** (compat SQLite dev × MySQL prod).
- URLs de mídia relativas (`config/drf.py::url_media_relativa`).
- Páginas staff sob `/dj-admin/` (templates em `templates/midia/`, estáticos em `static/midia/`): por turma via `TurmaAdmin.get_urls`; da MARCA via `MidiaAdmin.get_urls` (`/dj-admin/midia/midia/acervo|studio/`) — mesmos templates, modo decidido por `turma` presente/None no contexto (`window.MAGMA_CONTEXTO`).
- **Toda página staff nova via `get_urls()` PRECISA de link visível** — `get_urls()` só cria a rota, ninguém acha sem digitar a URL. Padrão: override `templates/admin/<app>/<model>/change_form.html` (link por objeto, bloco `object-tools-items`, `<a class="btn ...">` sem `<li>` — Jazzmin) ou `.../change_list.html` (link geral, mesmo bloco + `{{ block.super }}` pra manter o botão "Adicionar"). Exemplos: `cursos/turma/change_form.html` (Acervo/Studio por turma) e `midia/midia/change_list.html` (Acervo/Studio da marca).
- Auth API: default global é **só JWT** (`DEFAULT_AUTHENTICATION_CLASSES`, `config/settings/base.py`); `midia` e `ia` **declaram explicitamente** `[SessionAuthentication, JWTAuthentication]` e aceitam os dois — as demais views de painel (`cursos`, `leads`, `avaliacoes`, `nucleo/ConfigPainelView`) não têm auth própria, então só autenticam via JWT (sessão sozinha não basta ali; achado registrado em `specs/001-suite-de-testes/tasks.md` §Log 2026-07-19). Permissão típica `IsGestorOuInstrutor` (ou `IsGestor` nos endpoints restritos). CSRF via `window.MAGMA_CSRF` + header `X-CSRFToken` (fluxo de sessão, páginas staff). Agentes externos (n8n/bot): `X-Agente-Token` (nucleo/autenticacao.py).
- Templates de arte são declarativos e **sem DOM** (`static/midia/templates/*.js` — a "LEI" no topo do `templates-engine.js`); dados JSON-serializáveis (fotos via `imgKey` + `assets.imagens`), preparado p/ render server-side futuro (spec 007).
- ⚠️ Cifra das credenciais de IA deriva de `DJANGO_SECRET_KEY` — rotacionar a chave em prod invalida as credenciais salvas (recadastrar depois).
- **Testes**: `apps/<app>/tests.py` (`django.test.TestCase`, um por app) + helpers em `apps/nucleo/testing.py`; rodam sob `config/settings/test.py` (DB em memória, `MEDIA_ROOT` tmp). Rodar: `plataforma/rodar-testes.sh` (`--full` inclui frontend). Ver `specs/001-suite-de-testes/`.
