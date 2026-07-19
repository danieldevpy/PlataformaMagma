# Tasks 003 — estados: PENDENTE → EM ANDAMENTO → ENTREGUE → DONE

| ID | Tarefa | Estado | Agente |
|---|---|---|---|
| 003-T1 | Endpoint avaliações da turma + `marca.js` (hashtags/contatos/resolverLegenda) | DONE | A4 (onda A) |

Notas T1 (para o T4): carregar `marca.js` no `studio.html`; estender `window.MAGMA_TURMA`
com `cursoSlug`/`dataInicio` no template; contrato do endpoint no retorno do agente
(consolidar em docs/03 na integração final).
| 003-T2 | Templates `depoimento.js` + `vagas.js` | DONE | B2 (onda B, retomada 2ª sessão) |

Notas T2 (para o T4): depoimento.js herdado validado sem mudanças (campos batem com o
endpoint real de avaliações). vagas.js: `campos` inclui `vagasRestantes` com
`tipo: 'numero'` NOVO (T4 deve tratar tipo desconhecido como texto, sem quebrar);
`fontes: ['campos', 'foto?']`; prefill ideal de `MAGMA_TURMA` p/ vagas: `curso`,
`cursoSlug`, `dataInicio` (inicio_aulas), `vagasRestantes` (vagas_restantes),
`diasAula` (dias_e_horario) — nomes já conferidos contra o model Turma.
`vagasRestantes === 0` é valor legítimo (mostra "0"); só null/'' vira "—".
| 003-T3 | Templates `formatura.js` + `educativo.js` + `capa_reel.js` | DONE | B3 (onda B, retomada 2ª sessão) |

Notas T3 (para o T4): (a) script tags dos 3 arquivos em studio.html; (b) ids
`formatura`/`educativo`/`capa_reel` no picker; (c) tipo de campo `texto-longo` NOVO
em educativo.js (corpo/errado/certo) — tratar desconhecido como texto; (d) fontes por
template: formatura=['fotos'], educativo=['campos'] (painel de fotos colapsado),
capa_reel=['foto','campos'] e SÓ formato capa_reel (checar def.formatos antes de
mostrar toggle feed/story). Educativo não usa vermelho (✕ neutro vs ✓ dourado — regra
AGENTS.md §3). Legendas só com variáveis já suportadas por marca.js.

Nota de retomada (2026-07-18, 2ª sessão): sessão anterior caiu no meio da onda B.
Estado herdado: `depoimento.js` existe no disco (B2 revisa contra a spec e cria o
`vagas.js` que falta); T3 não deixou nada no disco (B3 redisparada do zero).
| 003-T4 | Picker contextual + legenda variáveis + integração em `studio.js` (HOTSPOT) | DONE | B1 (reutilizado pós 002-T2) |

Notas T4 (para o 004-T2 — botão ✨): campos dinâmicos vivem em `renderCampos()`
(studio.js); cada campo vira `<label class="field">` com
`label.querySelector('input, textarea')` e o valor vivo em `state.campos[campo.id]`
— o botão ✨ pode ser injetado ao lado desse input dentro do mesmo `forEach`, e
escrever de volta com `state.campos[campo.id] = texto; buildSlides(); render();`
(mesmo padrão do listener `input` já existente). Contexto disponível pro payload de
`/api/ia/executar/`: `state.templateId` (nome do template), `TURMA.curso`/`TURMA.id`,
`state.campos` (demais campos já preenchidos) e `state.legenda` (textarea `#fLegenda`,
mesmo padrão). `pickerMode(tpl)`/`estrategiaSlides(id)` ficam no topo do arquivo se
o botão precisar se comportar diferente por modo (ex.: só oferecer "gerar legenda"
quando há avaliação/foto selecionada).

- T1 independe da 002 (backend/static novo). T2/T3 dependem de 002-T1 (contrato do
  motor). T4 depende de 002-T2 + T1..T3.
- T2 ∥ T3 (arquivos disjuntos). T4 sozinho no hotspot.
