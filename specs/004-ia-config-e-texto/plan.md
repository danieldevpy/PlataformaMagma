# Plan 004 — como fazer

Referências: doc 10 §5.1 (capacidades×provedores), §5.2 (modelos), §5.5 (provedores).
Padrões do projeto: `.context/backend.md` (auth, erros `{"detail"}`, JSONField em
Python, PT-BR).

## App `apps.ia`

- `models.py`: `ProvedorIA` e `ExecucaoIA` conforme doc 10 §5.2 (`ComTimestamps`
  de `apps.nucleo.models`). Um provedor ATIVO por tipo (validar no `save`/admin).
- `crypto.py`: Fernet com chave derivada de `SECRET_KEY`
  (`base64.urlsafe_b64encode(sha256(SECRET_KEY))`) — dependência `cryptography`
  em `requirements.txt`. Campo `credencial` guarda o token cifrado.
- `adapters/base.py`: `AdaptadorBase` — `capacidades: set[str]`,
  `executar(capacidade, contexto) → dict`, `testar() → bool/erro`.
  `adapters/anthropic.py` (Messages API via `requests`, modelo default
  `claude-sonnet-5`) e `adapters/openai.py` (chat completions). Registro
  provedor→classe num dict.
- `prompts.py`: prompt de sistema por capacidade de texto com a marca (tom de voz,
  nunca prometer emprego/aprovação, hashtags fixas, CTA WhatsApp/@magma_curso —
  fonte: `design-system/AGENTS.md` §1/§8, doc 07b §4).
- `views.py` (DRF APIView, mesma auth/CSRF do `midia`):
  - `GET /api/ia/capacidades/`;
  - `POST /api/ia/executar/` — resolve provedor ativo do tipo da capacidade,
    chama adaptador, grava `ExecucaoIA` (sucesso E erro), retorna `{resultado}`;
  - `POST /api/ia/provedores/<pk>/testar/` — chamada mínima real, seta `testado_em`.
- `admin.py`: `ProvedorIA` com campo de chave write-only (form custom),
  `ExecucaoIA` readonly. Contexto de `texto.gerar`/`melhorar`/`variacoes`:
  `{tipo_conteudo, template, turma, curso, texto_atual?, instrucao?}`.
- Instalar em `config/settings` + incluir rotas em `config/urls.py` (edits
  ADITIVOS — outros agentes podem estar no mesmo arquivo: re-ler antes de editar).

## Testes (smoke, test client)

Capacidades sem provedor → tudo false; executar sem provedor → 400 `{detail}`;
CRUD provedor cifra credencial; executar com adaptador fake → grava `ExecucaoIA`.
(Mock de rede — nunca chamar API real em teste.)

## Fora desta spec

Página staff "Integrações de IA" bonita (§5.3) e botões ✨ no Studio (§5.4) —
ficam na 006/wave posterior; o Django Admin cobre a configuração no início.
