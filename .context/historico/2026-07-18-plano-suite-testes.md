# 2026-07-18 — Plano da rede de segurança (spec 001)

## Prompt do Daniel (essência)

> "Todo o código agora tem testes automatizados para me garantir que tudo vai continuar
> funcionando nas próximas features?" → constatado que NÃO → "Crie um plano detalhado
> dessa rede de segurança, que eu possa ir executando por passos. Bem documentado e
> detalhado para que outros agentes implementem."

## O que foi feito

- Auditoria: **zero** testes no repo (nem `tests.py` nos apps, nada no front, sem pytest/jest/CI). O "smoke test" do subsistema 09 foi execução única em sessão — não persiste.
- Criada `specs/001-suite-de-testes/` (primeira spec do fluxo novo):
  - `spec.md` — porquê e critérios de aceite (contratos + regras da constituição como testes);
  - `plan.md` — stack (pytest+pytest-django, SQLite :memory:, MEDIA_ROOT tmp), estrutura de arquivos, contrato de fixtures, mapa rota→prova por módulo, armadilhas conhecidas (JSONField em Python, CSRF, EXIF, STATIC_ROOT);
  - `tasks.md` — T1 fundação (Onda 0) → T2–T5 em paralelo (Onda 1: público, convites, mídia, painel/constituição) → T6 runner `rodar-testes.sh` + T7 CI opcional (Onda 2), com regras de revisão do orquestrador.
- `.context/status.md` atualizado (spec 001 em andamento + correção de registro: v0.1 sem testes persistidos).

## Estado ao sair / handoff

- Nada implementado ainda — plano pronto para execução por passos. Daniel dispara: "execute a T1 da spec 001" (Onda 0), depois "Onda 1" (4 agentes em paralelo), depois T6.
- Arquivos desta sessão ainda NÃO commitados (Daniel não pediu commit).
