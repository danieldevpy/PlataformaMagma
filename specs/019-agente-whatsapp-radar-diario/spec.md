# Spec 019 — Agente WhatsApp: B5 Radar (resumo diário)

> Continuação do plano `docs/subsistemas/02b-agente-whatsapp-n8n.md` (§4,
> B5 Radar — "Bom dia, Magma"; §9, Fase 2). Fase do roadmap: campanha
> digital até 08/08 (`.context/status.md`).

## Problema / oportunidade

Pra saber como está o funil (leads novos, vagas restantes, avaliações
esperando aprovação, postagens agendadas do dia), o Daniel precisa abrir
o admin e olhar 3-4 telas. Faltam 2 semanas pro 08/08 e cada dia que passa
sem esse relance rápido é atenção que não vai pro que importa: reagir a
lead frio, aprovar avaliação, cobrir o dia de conteúdo.

## O que muda para o usuário

- Toda manhã (8h), o Daniel recebe uma mensagem da MAG no WhatsApp com:
  quantos leads novos entraram nas últimas 24h, vagas restantes de cada
  turma com inscrições abertas, quantas avaliações estão esperando
  aprovação, quantas postagens estão agendadas pra hoje, e um resumo do
  uso de IA no mês (execuções + tokens, pra não levar susto na fatura).
- Não depende de nenhuma pergunta — é proativo, uma mensagem só, sem
  precisar abrir o WhatsApp antes.

## Critérios de aceite

- [ ] Ação nova `resumo_diario` (app `nucleo`, escopo
      `nucleo:resumo_diario`): sem parâmetros, devolve `leads_24h`,
      `turmas_abertas` (código, curso, vagas restantes — só status
      `inscricoes`), `avaliacoes_pendentes` (contagem), `postagens_hoje`
      (contagem com `agendada_para` = hoje, sem status `publicada`) e
      `uso_ia_mes` (execuções ok/erro + tokens entrada/saída do mês
      corrente, mesma agregação de `UsoMensalView`).
- [ ] Workflow novo `MAG - Radar (resumo diário)`: `Schedule Trigger`
      (diário, 8h America/Sao_Paulo) → chama `resumo_diario` → formata o
      texto em PT-BR (Code node, sem LLM — dado factual, não precisa de
      geração) → manda pro WhatsApp do gestor via Evolution API (mesmo
      padrão do `avisar_equipe`).
- [ ] `TokenAgente agente-recepcionista-mag` (dev) ganha o escopo
      `nucleo:resumo_diario`.
- [ ] `docs/plataforma/03-api-contratos.md` ganha a entrada da ação.
- [ ] Workflow testado manualmente (execução avulsa via n8n, não precisa
      esperar 8h) — mensagem chega formatada e com dado real.

## Critério de aceite do gestor

O Daniel recebe a mensagem no WhatsApp sem ter feito nada — só configura
o horário uma vez (já vem em 8h) e pode reexecutar manualmente pelo editor
n8n se quiser ver de novo no meio do dia.

## Fora de escopo

- Personalização do horário/conteúdo pelo próprio WhatsApp (fica pra
  quando existir `RegraAgente`, regras editáveis).
- Enviar pro grupo interno da equipe (só o gestor, mesmo padrão do
  handoff/`avisar_equipe`).
- Resposta a follow-up depois do resumo (ex.: "me manda os leads de
  hoje") — isso já existe via Operadora (`listar_leads`), o Radar só
  dispara, não conversa.
- Promoção para produção (novo workflow + escopo no `TokenAgente` de
  prod + `Schedule Trigger` ativo em prod) — fica registrada como
  pendência, mesmo padrão das specs 013-017.
