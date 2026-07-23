# 2026-07-23 (cont.) — Novo WhatsApp primário em toda a plataforma

## Prompt do Daniel

"quero deixar o numero 5521979767821 como o primeiro e o outro como
secundario em todo o contexto da plataforma".

## Contexto

O número `5521979767821` = (21) 97976-7821 já vinha aparecendo num
banner de divulgação do workshop Stop the Bleed + BLS, e o
`docs/subsistemas/07c-social-maker-calendario-piloto.md` tinha um aviso
pendente: esse número era diferente dos dois "oficiais" do guia de marca
((21) 97100-5197 / (21) 96494-6079), com uma nota "confirmar com o
Daniel qual usar". Perguntei e o Daniel confirmou: **97976-7821 vira o
primário**, **96494-6079 fica secundário**, **97100-5197 sai de
circulação**. Confirmei também que isso é só o número de
contato/exibição do site (wa.me, JSON-LD/SEO) — não mexe na sessão do
agente MAG na Evolution API (essa é vinculada por QR code, fora do
alcance de uma edição de código).

## O que foi feito

`whatsapp_principal` (`ConfiguracaoSite`, singleton) é a fonte única que
alimenta todos os botões `[data-wa]` do site (via `WaLinks`), o rodapé,
e o `telephone` do JSON-LD — trocado o `default` do model
(`5521964946079` → `5521979767821`), migração
`0005_alter_configuracaosite_whatsapp_principal` gerada e aplicada, e a
**linha viva do dev** (pk=1) atualizada via shell (o `default` só vale
pra registro novo).

Locais com o número **hardcoded como texto** (não vêm do banco) também
atualizados, ordem 97976-7821 primeiro / 96494-6079 segundo /
97100-5197 removido:

- `apps/ia/prompts.py` (CTA padrão dos textos gerados pela IA)
- `static/midia/marca.js` (contatos oficiais consumidos pelo Studio) e
  `static/midia/studio.js` (default do campo "whatsapp" nos templates)
- `plataforma/frontend/lib/fallback.ts` (config de fallback quando a API
  cai) e o texto ao lado do telefone em `HomeLP.tsx` (seção Localização)
- `design-system/tokens/tokens.json` e `design-system/AGENTS.md` (fonte
  de verdade da marca) e `design-system/index.html` (showcase, inclui o
  rodapé do **template de certificado** — próximos certificados emitidos
  a partir dele já saem com o número novo)
- Docs: `docs/plataforma/02-backend-django.md`,
  `docs/plataforma/03-api-contratos.md`,
  `docs/subsistemas/agente-social-maker-contexto.md`
- `docs/subsistemas/07c-social-maker-calendario-piloto.md`: fechado o
  aviso pendente sobre o número do banner

Testes ajustados (`jsonld.test.ts`, `format.test.ts`) para os novos
valores. Suíte completa: backend 171/171, frontend 56/56.

## Fora do escopo (deliberado)

- **Não mexi** em `mvp-apps/` (protótipos históricos, congelados por
  design — ver `.context/index.md`) nem nos PDFs de `certificados/`
  (documentos já emitidos, imutáveis) nem em
  `design-system/assets/certificado-conclusao-aph.pdf` (asset binário —
  se precisar de um certificado novo com o número atualizado, é preciso
  regerar/editar o PDF manualmente a partir do template em
  `design-system/index.html`, que já está com o número certo).
- **Não mexi** na sessão de WhatsApp do agente MAG (Evolution API) — ver
  contexto acima.

## Pendente

- Nenhum. Mudança é só de conteúdo/config — sem migração de dado além do
  `whatsapp_principal` do singleton.
