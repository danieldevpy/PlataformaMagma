# Plan 003 — como fazer

Referências: doc 10 §4 (tabela de templates com detalhes), §8 (UX). Motor: spec 002.
Marca: `design-system/AGENTS.md` (§3 cores, §5 receitas de componentes, §6 formatos,
§8 tom de voz) e `design-system/tokens/tokens.json`.

## Backend (independente do motor — pode andar em paralelo à 002)

- `apps/midia/views.py`: `AvaliacoesTurmaView` — GET lista `Avaliacao` da turma com
  `status` aprovado, ordem: estrelas desc, peso desc. Campos:
  `{id, nome, cargo_atual, estrelas, comentario, criado_em}`. Mesma auth do app
  (`IsGestorOuInstrutor`). Registrar no `CATALOGO_ACOES` + `urls.py`.
- `static/midia/marca.js`: `window.MagmaMarca` = contatos oficiais (AGENTS.md §1),
  hashtags fixas (`#MagmaCursos #NovaIguacu`) + por slug de curso (doc 07b §5),
  frases-modelo, função `resolverLegenda(template, contexto)`.

## Templates (1 arquivo cada em `static/midia/templates/`)

| Arquivo | Fontes | Notas de desenho (doc 10 §4 + AGENTS.md) |
|---|---|---|
| `depoimento.js` | avaliacao + foto? | card navy-deep, aspas Georgia douradas gigantes, estrelas douradas, nome+turma; foto opcional de fundo escurecida |
| `vagas.js` | campos turma | badge vermelho "ÚLTIMAS VAGAS", número gigante Archivo 900, data início, pílula "sábados", CTA WhatsApp dourado |
| `formatura.js` | fotos | foto grande + faixa "Parabéns, turma {{codigo}}!" + CTA próxima turma |
| `educativo.js` | campos texto | navy + hexágonos, eyebrow dourado ("VOCÊ SABIA?"/"ERRO × CERTO"), título 900, corpo Inter |
| `capa_reel.js` | foto + título | 1080×1920, máx 4 palavras em destaque, selo Magma canto, alto contraste |

Cada template define `legendaPadrao` com variáveis; campos declarados geram o
formulário (motor 002). Variantes: mínimo 2 por template (sorteio já existe).

## Integração UI (HOTSPOT `studio.js` — 1 agente, depois dos templates)

Picker contextual: `fontes` do template decide painel esquerdo (fotos | lista de
avaliações com estrelas | vazio/colapsado). Dados da turma pré-preenchem campos
(`window.MAGMA_TURMA`). Legenda usa `MagmaMarca.resolverLegenda`.

## Constituição

§3 exibição no serializer, §4 zero redesign, §6 contrato (novo endpoint → docs 03
na consolidação final).
