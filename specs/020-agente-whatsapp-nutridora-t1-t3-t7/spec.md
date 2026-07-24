# Spec 020 — Agente WhatsApp: Nutridora T+1d/3d/7d

> Continuação do plano `docs/subsistemas/02b-agente-whatsapp-n8n.md` (§4,
> A2 Nutridora de Leads — T+0 já entregue na spec 011, T+1/3/7 pendentes).
> Motivação direta: campanha de tráfego pago (Meta Ads, `specs/018-...`)
> pode começar já amanhã e vai trazer leads reais pelo formulário do site
> — leads que hoje só recebem a boas-vindas automática (T+0) e depois
> silêncio, a menos que alguém da equipe puxe conversa manualmente.

## Problema / oportunidade

Lead preenche o formulário, recebe o "oi" automático (T+0) e, se ninguém
da equipe continuar a conversa manualmente, esfria. Com tráfego pago
chegando, o volume de leads pode crescer rápido — perder o timing dos
próximos toques é desperdiçar o investimento em anúncio. A Nutridora
precisa continuar a conversa sozinha nos dias seguintes, com conteúdo
real (nunca inventado), até o lead responder, ser escalado, ou a
sequência acabar.

## O que muda para o usuário

- 1 dia depois do lead entrar (T+1), sem ter respondido nada, ele recebe
  uma mensagem com conteúdo real do curso que despertou interesse (2-3
  habilidades reais que vai aprender) — ou uma mensagem mais genérica se
  o lead não informou curso.
- 3 dias depois (T+3), recebe uma mensagem com prova social — um
  depoimento real e aprovado (do curso de interesse, ou geral se não
  houver um específico ainda).
- 7 dias depois (T+7), recebe um lembrete de urgência — com o número real
  de vagas restantes se a turma tiver esse dado público (`exibir_vagas`),
  ou uma chamada genérica se não tiver.
- Lead que já foi escalado pro humano (`ContatoEscalado` — handoff, spec
  012) ou que nasceu de uma conversa de WhatsApp (`utm_source=whatsapp`,
  já vinha sendo nutrido ao vivo pela SDR) **não recebe** nenhum desses
  toques automáticos — não dobra a régua de contato.
- Cada lead recebe cada toque **uma vez só**, mesmo que o cron rode várias
  vezes por dia.

## Critérios de aceite

- [ ] Campo novo `Lead.nutridora_ultimo_toque` (`t1`/`t3`/`t7`, em branco
      = só T+0 recebido) — migração.
- [ ] Ação nova `processar_nutridora` (app `leads`, escopo
      `leads:processar_nutridora`): busca leads elegíveis pra cada janela
      (T+1: `criado_em` ≥ 1 dia atrás e toque ainda não avançou; T+3:
      ≥ 3 dias e já passou por T+1; T+7: ≥ 7 dias e já passou por T+3),
      exclui `whatsapp` vazio, `utm_source=whatsapp` e números em
      `ContatoEscalado`, monta o texto de cada toque com dado real
      (habilidades do curso / avaliação aprovada / vagas restantes),
      **marca `nutridora_ultimo_toque`** pros que geraram mensagem, e
      devolve a lista `{numero, texto}` pra mandar.
      - T+3 sem avaliação aprovada disponível (nem do curso nem geral):
        **não marca** o toque — tenta de novo no próximo dia (não
        inventa depoimento).
      - T+1 e T+7 sempre têm conteúdo válido (fallback genérico quando
        falta curso/toggle) — sempre marcam.
- [ ] Workflow novo `MAG - Nutridora (T+1/3/7)`: `Schedule Trigger`
      (diário) → chama `processar_nutridora` → `Split Out` (um item do
      n8n por lead) → `HTTP Request` manda cada mensagem via Evolution
      API (mesmo padrão do Radar — sem AI Agent, conteúdo já vem pronto
      do Django).
- [ ] `TokenAgente agente-recepcionista-mag` (dev) ganha o escopo
      `leads:processar_nutridora`.
- [ ] `docs/plataforma/03-api-contratos.md` ganha a entrada da ação.
- [ ] Testado manualmente (execução avulsa, sem esperar dias de verdade —
      criar leads de teste com `criado_em` retroativo).

## Critério de aceite do gestor

Nenhum — é 100% automático, não toca painel. (Se um dia quiser pausar a
sequência de um lead específico, o mecanismo já existe: escalar o
contato via handoff silencia todos os toques automáticos.)

## Fora de escopo

- Opt-out dedicado ("não quero mais receber") — por ora, o silêncio via
  `ContatoEscalado` (handoff) é o único jeito de parar os toques de um
  lead. Opt-out explícito fica pra quando aparecer necessidade real.
- Atualizar `Lead.status` a cada toque (o plano original menciona, mas
  não tem valor imediato sem um funil de status definido — fica pra
  quando `atualizar_status_lead` existir).
- Editar o conteúdo dos toques pelo painel (`RegraAgente` ainda não
  existe) — textos ficam no código da ação por ora, mesmo padrão dos
  outros prompts/textos do agente.
- Retry automático se o envio pela Evolution falhar depois de marcado —
  aceitável pro MVP (não é ação crítica tipo cobrança); ver `plan.md`.
- Promoção para produção — fica pendência, mesmo padrão das specs 013-019.
  **Importante**: como a campanha pode começar amanhã, promover essa spec
  logo depois de validada em dev é prioridade alta (ver `.context/status.md`).
