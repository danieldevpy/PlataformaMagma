# Spec 018 — Rastreamento mínimo para tráfego pago (Meta Pixel)

> O QUÊ e PORQUÊ. Fase do roadmap: primeira campanha paga de captação
> (`docs/subsistemas/01b-trafego-pago-meta-ads.md`).

## Problema / oportunidade

Vamos rodar a primeira campanha de Meta Ads sem nenhum Pixel instalado no
site. O objetivo principal da campanha (Mensagens/Click-to-WhatsApp) não
depende de pixel pra funcionar, mas sem ele a plataforma não acumula nenhum
sinal de quem visitou a LP vindo do anúncio — o que trava qualquer
retargeting ou otimização por conversão no futuro. Ligação com a meta atual:
turma cheia até 08/08 (`.context/status.md`); esta spec é a base mínima pra
não perder dado enquanto a campanha roda.

## O que muda para o usuário

- Nenhuma mudança visível para quem visita o site.
- Internamente: toda página pública carrega o Pixel base (`PageView`); clique
  nos botões de WhatsApp já existentes dispara evento padrão do Meta
  (`Contact`); envio do formulário de lead dispara `Lead`.

## Critérios de aceite

- [ ] Pixel base carrega em todas as páginas públicas, condicional a
      `NEXT_PUBLIC_META_PIXEL_ID` estar configurado.
- [ ] Clique em qualquer link `[data-wa]` (`WaLinks`) dispara evento `Contact`.
- [ ] Envio bem-sucedido do `LeadForm` dispara evento `Lead`.
- [ ] Sem `NEXT_PUBLIC_META_PIXEL_ID` configurado (dev/local), o site funciona
      normalmente — nada quebra, pixel simplesmente não carrega.

## Critério de aceite do gestor

- N/A — não toca painel/admin.

## Fora de escopo

- Conversions API (server-side).
- Hashing/envio de dados pessoais (PII) ao Meta.
- Custom Audiences / Lookalike.
- Qualquer alteração no fluxo de qualificação do MAG (WhatsApp).
- Amarrar `utm_source=meta_ads` em leads que chegam direto por WhatsApp sem
  passar pela LP (depende de ajuste no prompt do MAG — spec futura separada).
