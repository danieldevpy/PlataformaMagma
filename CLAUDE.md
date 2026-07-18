# Magma Cursos — Monorepo

Ecossistema digital da Magma Cursos (escola de cursos profissionalizantes de saúde
em Nova Iguaçu/RJ — carro-chefe: Socorrista APH 120h). Projeto de Daniel Fernandes.

## Leitura obrigatória de toda sessão (nesta ordem)

1. `.context/index.md` — mapa do projeto e onde vive cada fonte de verdade
2. `.context/status.md` — onde o projeto está AGORA (pronto / em andamento / pendente / metas)
3. `.specify/memory/constitution.md` — princípios que nenhuma mudança pode violar
4. `design-system/AGENTS.md` — antes de qualquer UI, arte ou texto de marca (a marca é lei)

## Regras de higiene (memória viva do projeto)

- Sessão que muda o comportamento de um módulo **atualiza o `.context/*.md` correspondente**.
- Toda sessão significativa termina com:
  1. `.context/status.md` atualizado (o que mudou, o que ficou pendente);
  2. uma entrada nova em `.context/historico/` (prompt do Daniel + o que foi feito + estado ao sair).
- Feature nova segue o fluxo spec-driven: pasta `specs/NNN-nome/` com spec → plan → tasks
  (ver `specs/README.md` e `docs/plataforma/09-fluxo-speckit-dotcontext.md`).
- Decisão de arquitetura tomada → registrar em `.context/decisoes.md` (ADR curto: data, decisão, porquê).
- Idioma do projeto: **PT-BR** (código, docs, commits, UI).
- Commits somente quando o Daniel pedir.
