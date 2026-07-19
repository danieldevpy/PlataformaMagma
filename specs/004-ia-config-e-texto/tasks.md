# Tasks 004 — estados: PENDENTE → EM ANDAMENTO → ENTREGUE → DONE

| ID | Tarefa | Estado | Agente |
|---|---|---|---|
| 004-T1 | App `apps.ia` completo (models+crypto+adapters+prompts+views+admin+testes) | DONE | A2 (onda A) |

Notas T1: capacidade acende só com provedor ativo E testado; erros 400 (input) vs 502
(provedor, com ExecucaoIA); `requests` + `cryptography` no requirements (instalados no
venv dev). Contrato dos 3 endpoints no retorno do agente → consolidar em docs/03.
| 004-T2 | Página staff "Integrações de IA" (doc 10 §5.3) + ✨ no Studio (§5.4) | DONE | C1 (onda C, 2ª sessão) |

Notas T2: endpoints novos ADITIVOS em `apps/ia` — `GET/POST /api/ia/provedores/`
(lista sem credencial + cria, credencial obrigatória na criação), `PATCH
/api/ia/provedores/<pk>/` (edita; credencial em branco mantém a chave salva, mesmo
padrão write-only do `ProvedorIAForm`), `GET /api/ia/uso/` (card de uso do mês via
`ExecucaoIA`). Página em `templates/ia/integracoes.html` +
`static/ia/integracoes.{css,js}`, servida em `/dj-admin/ia/provedoria/integracoes/`
via `ProvedorIAAdmin.get_urls` (mesmo padrão staff do `TurmaAdmin` — `admin_view`,
exige `is_staff`; dados da página via `/api/ia/` com `IsGestorOuInstrutor` normal).
Link ⚙ novo na sidebar do Studio (`studio.html`) abre a página em nova aba.
Botão ✨ injetado em `renderCampos()`/legenda do `studio.js` (exatamente onde as
notas T4 da 003 indicavam): menu contextual (Gerar se campo vazio; Melhorar/
Encurtar/3 variações se já tem texto), resultado sempre como proposta (Aplicar/
Tentar de novo/Descartar — nunca sobrescreve direto), variações em cards
clicáveis. `CAMPOS_COM_IA` restringe o ✨ a campos de prosa (frase/titulo/corpo/
errado/certo + todo `texto-longo`) — campos factuais (turma/contato/datas/vagas)
ficam de fora de propósito. `GET /api/ia/capacidades/` consultado 1x no load;
falha nunca propaga (Studio idêntico a hoje sem provedor); botão esmaecido com
clique abrindo a página de Integrações quando a capacidade de texto está
desligada. Testes novos em `apps/ia/tests.py` (provedores CRUD, uso mensal,
acesso à página staff) — suíte completa 39/39 OK.

- T1 independente (backend novo). T2 depende de T1 + 003-T4 (hotspot studio.js).
