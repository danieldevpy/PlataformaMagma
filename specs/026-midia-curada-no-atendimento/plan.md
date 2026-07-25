# Plan 026 — Mídia curada no atendimento

## Toques no sistema

| Camada | O que muda | Referência |
|---|---|---|
| Backend | Ação nova `midia_para_atendimento` (`apps/midia/acoes.py`) — devolve só mídia curada, filtrada por curso | `docs/plataforma/03-api-contratos.md` |
| Backend | Escopo novo `midia:para_atendimento` no `TokenAgente` (dev e prod) | spec 005 |
| Frontend | Mesa de Luz: atalho de curadoria novo, do mesmo jeito dos atuais (D/C/A) | `docs/plataforma/06-painel.md` |
| n8n | `mag-fase-0-sdr.json`: tool nova + nó de envio de mídia pela Evolution | `plataforma/n8n/workflows/README.md` |
| n8n | `systemMessage`: quando oferecer mídia (**depende das specs 024/025 — mesmo texto**) | specs 024, 025 |
| Docs | `03-api-contratos.md`, `.context/frontend.md`, `docs/subsistemas/09-*`, status/historico/ADR | higiene do CLAUDE.md |

**Sem migração**: a curadoria entra no `tags` (`JSONField`) que já existe
em `Midia` — o mesmo mecanismo de `destaque`/`capa`/`avaliacao`.

## Decisões desta feature

### A curadoria é uma tag, não um modelo novo

`Midia.tags` já é um subconjunto de `{"destaque","capa","avaliacao"}`
curado na Mesa de Luz. Acrescentar `"atendimento"` custa: uma constante no
front, um atalho de teclado, um filtro no backend. Zero migração, zero
tela nova, e o gestor não aprende fluxo novo — é o mesmo gesto que ele já
faz.

Descartado: modelo `MidiaAtendimento` próprio, ou campo booleano. Ambos
criariam um segundo lugar pra curadoria viver, e a spec 008 já pagou o
preço de consolidar isso num lugar só.

### O filtro por contexto é do backend, e a tool recebe o curso

A ação recebe `curso_slug` (com a mesma tolerância de `resolver_curso()`
da spec 023 — o modelo **vai** errar o slug, isso já está provado três
vezes) e devolve mídia de:

- camada `curso` daquele curso, **e**
- camadas `estrutura` e `geral` (a escola, a marca).

Camada `turma` fica **fora por padrão**, sempre: é a camada com pessoas
identificáveis, e o consentimento que existe é pra álbum da turma e
divulgação curada, não pra disparo em atendimento individual. Se o Daniel
quiser liberar turma no futuro, é decisão consciente com ADR próprio —
não default.

Camada `externa` (banco de imagens) também fica fora: crédito obrigatório
não cabe numa mensagem de WhatsApp.

### Envio: a Evolution busca a mídia por URL

`POST /message/sendMedia/{instance}` com a URL do arquivo + `caption`. A
legenda sai do próprio `Midia.legenda` quando existir.

Detalhe de ambiente que **vai** morder (mesma família do achado de
2026-07-20 sobre hostname único):

- Em **prod**, a mídia é servida pelo nginx do host em URL relativa; a
  Evolution precisa de URL absoluta e alcançável **de dentro do
  container**. O caminho seguro é a URL pública `https://` do site — que
  em prod existe e resolve.
- Em **dev**, `http://magma-backend-interno:8000/media/...` funciona
  (mesma rede `magma-dev-net`), mas **não** é a mesma string de prod.

Ou seja: diferente das outras tools, aqui **não dá** pra usar uma URL
idêntica nos dois ambientes. Como `toolHttpRequest` não aceita `{{ }}` no
campo `url` (achado de 2026-07-20), o envio de mídia **não pode ser uma
tool** — tem que ser um nó `httpRequest` comum no fluxo, depois do agente,
onde a expression funciona. Consequência de desenho:

> A tool `midia_para_atendimento` **só consulta** (devolve a lista de
> URLs). Quem envia é um nó do fluxo, lendo o que o agente decidiu. Mesmo
> padrão que a spec 012 usou pro `avisar_equipe` (tool → sub-workflow) e
> pelo mesmo motivo raiz.

### Teto de 2 envios por conversa, contado fora do modelo

"No máximo 2" no prompt é orientação, não garantia — a spec 023 já provou
isso com "uma vez só por conversa" (o modelo chamou duas). Como aqui o
custo de furar é a pessoa recebendo spam de foto, o teto é **contado no
Redis** (`mag:midia:{numero}`, TTL igual ao da memória), checado pelo nó
de envio antes de disparar. O prompt continua pedindo — quem garante é o
fluxo.

### Sem mídia curada, a MAG não oferece

A tool devolve lista vazia → o nó de envio não dispara e o agente segue
sem mencionar mídia. Isso depende da regra 7 da spec 024 ("nunca ofereça o
que não veio de tool") estar valendo — **por isso a 026 depende da 024**,
não o contrário.

## Ordem de implementação

1. **024** (pesos de tom) — cria o espaço de conversa onde o convite cabe.
2. **025** (handoff) — fecha o `systemMessage` de handoff.
3. **026** (esta) — encaixa a mídia no convite já existente.

As três mexem no mesmo `systemMessage`. Fora de ordem, uma sobrescreve a
outra.

## Riscos

- **Peso de arquivo.** Foto de celular de 4MB numa conexão fraca é uma
  experiência ruim. A mídia do acervo já tem `thumb` gerado — avaliar
  mandar uma versão redimensionada em vez do original (decisão de
  implementação, medir antes).
- **Mídia desatualizada.** Foto de turma de 2024 vendendo turma de 2026.
  Mitigação: a curadoria é do gestor e revisável a qualquer momento — mas
  vale um aviso na Mesa de Luz de quando a marcação foi feita.
- **LGPD.** Tratado acima (camada `turma` fora por padrão). Qualquer
  mudança nisso exige ADR.
