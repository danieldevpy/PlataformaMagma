# 2026-07-24 — Spec 018 (pixel de rastreamento): T1-T4 implementadas

## Prompt do Daniel

"Quero ir passo a passo para implementar o plano de tráfego pago." Perguntado
por onde começar (pixel/código vs. campanha no Ads Manager), respondeu que
tinha outro agente trabalhando em paralelo nas specs 021/022 e pediu pra
conferir se dava pra avançar sem conflito antes de decidir a ordem.

## Estado ao entrar

`specs/018-rastreamento-trafego-pago/` já existia (spec/plan/tasks), criada
numa sessão anterior no mesmo dia, mas nenhuma das 5 tasks tinha sido
implementada. `docs/subsistemas/01b-trafego-pago-meta-ads.md` já documentava
o plano completo da campanha.

## Checagem de conflito com specs 021/022

Lidos `specs/021-registro-conversas-agente/tasks.md` e
`specs/022-memoria-conversa-redis/tasks.md`: ambas são backend/n8n puro
(`apps/conversas/`, campo novo em `apps/nucleo/models.py`, nós do workflow).
`git status` confirmou os arquivos já tocados por aquele agente
(`apps/nucleo/admin.py`, `apps/nucleo/models.py`,
`config/settings/base.py`, `apps/nucleo/migrations/0006_...py`,
`apps/conversas/`). A spec 018 só mexe em frontend
(`app/layout.tsx`, `components/client/WaLinks.tsx`,
`components/client/LeadForm.tsx`, `.env.local.example`) — zero
sobreposição de arquivo. Seguro trabalhar em paralelo.

## O que foi feito

- **T1** — `app/layout.tsx`: script base do Meta Pixel via `next/script`
  (`strategy="afterInteractive"`, inline com `id`), só renderiza quando
  `NEXT_PUBLIC_META_PIXEL_ID` está definida (`fbq('init', ...)` +
  `fbq('track', 'PageView')`) + `<noscript><img>` de fallback. Sem a env
  var, nada é injetado — comportamento confirmado no código (checklist do
  plan.md).
- **T2** — `.env.local.example` ganhou `NEXT_PUBLIC_META_PIXEL_ID=`
  documentada (comentário aponta pro Gerenciador de eventos do Ads Manager
  e pro `01b`).
- **T3** — `WaLinks.tsx`: `fbq('track', 'Contact')` no clique de qualquer
  `[data-wa]`. Listener por link (não um único listener global) com cleanup
  no `useEffect` — evita disparo duplicado se o componente re-renderizar.
- **T4** — `LeadForm.tsx`: `fbq('track', 'Lead')` só depois do
  `fetch(/api/leads/)` responder OK, antes de abrir o `whatsapp_url` — não
  dispara no `catch` (fallback que abre WhatsApp direto sem lead
  confirmado no backend).
- Guarda `typeof window.fbq === "function"` nos dois componentes — sem
  Pixel ID configurada (dev normal), `window.fbq` nunca existe, e nada
  quebra.
- Verificado `next/script` (API v16.2.10, projeto usa Turbopack) via
  `node_modules/next/dist/docs/01-app/03-api-reference/02-components/script.md`
  — inline script com `id` é a forma suportada, confirma que a implementação
  bate com a versão real do Next instalada (o `AGENTS.md` do frontend avisa
  pra sempre checar a doc local em vez de confiar em memória de treino).
- `npx tsc --noEmit` limpo; `npm run lint` só acusou 2 warnings
  pré-existentes em outros arquivos (não tocados nesta sessão).

## T5 não implementada (não dá pra automatizar)

T5 é "confirmar com a extensão Meta Pixel Helper que PageView/Contact/Lead
disparam de verdade" — depende de (a) um Pixel ID de teste real (só existe
depois de criar um Pixel no Business Manager) e (b) o Chrome do próprio
Daniel com a extensão instalada. Tentei rodar um dev server à parte numa
porta livre pra pelo menos confirmar a renderização do script (sem a parte
visual), mas o Next.js 16 recusa 2ª instância no mesmo diretório de projeto
mesmo em porta diferente ("Another next dev server is already running") —
havia um dev server já rodando (PID 35401, não iniciado por mim, possivelmente
do próprio Daniel ou de outra sessão). Não matei esse processo. Fica como
verificação manual mesmo.

**Passo a passo pro Daniel rodar o T5:**
1. No Ads Manager (Gerenciador de eventos) criar um Pixel, mesmo que
   provisório — copiar o ID.
2. Em `plataforma/frontend/.env.local`, setar
   `NEXT_PUBLIC_META_PIXEL_ID=<o ID copiado>`.
3. Reiniciar o `npm run dev` (precisa reiniciar pra pegar a env nova).
4. Instalar a extensão "Meta Pixel Helper" no Chrome.
5. Abrir o site local, checar que o ícone da extensão acende com
   `PageView` disparado.
6. Clicar num botão de WhatsApp (`[data-wa]`) — checar `Contact`.
7. Preencher e enviar o formulário de lead — checar `Lead`.
8. Se tudo aparecer, T5 vira DONE e dá pra tirar o Pixel ID de teste do
   `.env.local` (ou trocar pelo definitivo, quando a campanha for ao ar).

## Estado ao sair

T1-T4 implementadas e verificadas estaticamente (typecheck/lint); T5
pendente de teste manual do Daniel. `specs/018-rastreamento-trafego-pago/tasks.md`
e `.context/status.md` atualizados. Nenhum arquivo de backend tocado — zero
risco de conflito com o agente rodando em paralelo nas specs 021/022.
Próximo passo natural do plano de tráfego pago: criar o Pixel de verdade
(ou pular direto pra campanha, já que o objetivo Mensagens não depende
dele) e montar a campanha no Ads Manager seguindo
`docs/subsistemas/01b-trafego-pago-meta-ads.md` §6 — passo que só o Daniel
consegue clicar, mas que dá pra fazer guiado, tela por tela.
