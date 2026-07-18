# Spec 001 — Rede de segurança: suíte de testes automatizados

> O QUÊ e PORQUÊ. Fase do roadmap: transversal (protege todas as fases).
> Status de execução: ver `tasks.md` neste diretório.

## Problema / oportunidade

A v0.1.0 foi validada por smoke tests **pontuais** (executados uma vez em sessão de
agente, via Django test client) e teste manual — nada disso persiste no repo. Hoje
**zero testes automatizados** protegem o código: uma feature nova pode quebrar a LP,
o magic-link de avaliação ou o upload do acervo sem que nada acuse.

Com a meta nº 1 sendo a campanha 08/08 (`.context/status.md`), a LP, os leads e o
Acervo/Studio viram infraestrutura de campanha — quebrar qualquer um deles no meio
da campanha custa alunos. A rede de segurança vem ANTES das próximas features.

## O que muda para o usuário (Daniel)

- Um comando único (`plataforma/rodar-testes.sh`) responde em ~1 min: "posso deployar?".
- Toda feature futura roda a suíte no seu Definition of Done (`specs/README.md` já exige).
- Regressão nos contratos de API (`docs/plataforma/03`) é detectada na hora, não em produção.

## Critérios de aceite

- [ ] `plataforma/rodar-testes.sh` roda backend (pytest) + checagens de front/estáticos e sai com código ≠ 0 em qualquer falha.
- [ ] Todos os endpoints públicos e de painel listados no `plan.md` §Cobertura têm teste de contrato (status + shape do JSON).
- [ ] As regras da constituição viram testes executáveis: `conteudo_origem="editado"` intocável, toggles `exibir_*` → `null` no serializer, IDs públicos slug/uuid, erros `{"detail": ...}`, 403 sem login no painel/mídia.
- [ ] O roteiro do smoke test do subsistema 09 (upload EXIF, dedup 409/`forcar`, postagem→ZIP, avaliação c/ acervo + fallback) está persistido como testes.
- [ ] Suíte roda em SQLite em memória, sem tocar `db.sqlite3` nem `media/` reais, e é determinística (2 execuções seguidas = mesmo resultado).
- [ ] Rodar a suíte não exige serviço externo (rede, MySQL, Node opcional só para as checagens de front).

## Critério de aceite do gestor

Não toca o painel — n/a. (O beneficiário é o dev/orquestrador.)

## Fora de escopo

- Testes de browser real (Playwright/Selenium) — fica para uma spec futura; bugs de CSS renderizado (caso `[hidden]`) continuam cobertos por teste manual + regra-guarda.
- Testes unitários de componentes React — por ora `next build` + `tsc` são a checagem.
- CI em nuvem (GitHub Actions) — tarefa opcional T7, só se/quando houver remoto ativo.
- Cobertura percentual como meta — o alvo é **contrato e regra de negócio**, não número.
