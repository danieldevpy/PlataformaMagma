# Tasks 002 — estados: PENDENTE → EM ANDAMENTO → ENTREGUE → DONE

| ID | Tarefa | Estado | Agente |
|---|---|---|---|
| 002-T1 | Core declarativo (`FORMATOS`, `registrar`, helpers, adaptador browser) + `templates/formacao.js` (feed idêntico + story) | DONE | A1 (onda A) |
| 002-T2 | `studio.js`/`studio.html`: seletor de modo, toggle formato, campos dinâmicos de `template.campos`, export kit multi-formato | DONE | B1 (onda B, retomada 2ª sessão) |

Nota de retomada (2026-07-18, 2ª sessão): a 1ª tentativa da T2 foi perdida quando a
sessão caiu — nada chegou ao disco (diff do studio.js era só a adaptação da T1).
Redisparada do zero com agente novo (B1), hotspot limpo.

Notas T1: `dados` é JSON-serializável (fotos via `imgKey` + `assets.imagens` Map);
LEI sem-DOM vale para `templates/*.js` (adaptador no core pode usar DOM); DPR=2 interno
ao `renderizar`. `PHOTO_VARIANTS` mantido por compat.

- T2 depende de T1.
- T2 é HOTSPOT (`studio.js`): nunca 2 agentes ao mesmo tempo nesse arquivo.
- Validação final (orquestrador): dev server + browser, gerar formação feed+story real.
