# Specs — fluxo spec-driven interno

Base interna inspirada no GitHub spec-kit (sem depender do CLI): **1 feature = 1 pasta
`NNN-nome/` = 1 branch = 1 PR**, com specs pequenas (≤ ~1 semana de trabalho).

```
specs/
├── templates/          # copiar para iniciar uma feature
│   ├── spec.md         # o QUÊ e PORQUÊ — sem stack
│   ├── plan.md         # o COMO — aponta p/ docs/plataforma/* em vez de duplicar
│   └── tasks.md        # passos pequenos e verificáveis (estados: PENDENTE → EM ANDAMENTO → ENTREGUE → DONE)
└── NNN-nome/           # uma pasta por feature
```

## Ciclo

1. **spec.md** — Daniel descreve/aprova o quê e porquê. Se toca o painel, incluir a
   seção "Critério de aceite do gestor" (ex.: "o dono ativa o countdown sozinho pelo celular").
2. **plan.md** — como fazer, referenciando os docs técnicos (`docs/plataforma/*`) e a
   constituição (`.specify/memory/constitution.md`).
3. **tasks.md** — tarefas pequenas; agentes implementam, orquestrador revisa (modelo de
   ondas usado no subsistema 09 — ver `docs/subsistemas/09-execucao-status.md`).
4. Daniel revisa a PR.

## Definition of Done (toda spec)

- [ ] Critérios de aceite passam (incluindo o do gestor, se houver)
- [ ] `seed` continua idempotente (rodar 2× não muda nada)
- [ ] Diff visual do site público = zero, exceto quando a spec é de UI
- [ ] `docs/plataforma/03` atualizado se o payload mudou
- [ ] `.context/` do módulo tocado atualizado (+ status/historico — constituição §7)
- [ ] Verificado no celular
