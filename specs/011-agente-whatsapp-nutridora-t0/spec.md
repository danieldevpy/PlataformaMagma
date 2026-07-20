# Spec 011 — Nutridora de Leads: boas-vindas imediata (T+0)

> Continuação da Fase 1 do plano `docs/subsistemas/02b-agente-whatsapp-n8n.md`
> (§4, A2), na ordem projetada (depois de A0/A1). Fatia T+0 do toque de
> nutrição — T+1d/T+3d/T+7d ficam para a próxima spec (precisam de
> agendamento/cron e não têm o gancho pronto).

## Problema / oportunidade

Todo lead novo (site ou WhatsApp/SDR) já dispara `POST N8N_LEAD_WEBHOOK`
(`apps/leads/signals.py`), mas hoje esse gancho não está ligado a nada — o
lead não recebe resposta nenhuma até alguém da equipe ver o painel. A
Nutridora (A2) age no tempo, sem conversar: o primeiro toque (T+0, boas-vindas
imediata) é o que dá o "recebemos seu interesse" em segundos, antes mesmo do
lead sair da tela onde pediu contato.

## O que muda para o usuário

- Lead se cadastra no site (ou é criado pela SDR no WhatsApp) → em segundos
  recebe uma mensagem de boas-vindas da MAG confirmando o interesse no curso
  certo, sem precisar de ninguém da equipe agir.
- Mensagem é template fixo (não é IA gerando texto) — previsível, sem custo
  de LLM, consistente com o guia de marca.

## Critérios de aceite

- [x] `N8N_LEAD_WEBHOOK` (dev) configurado apontando pro workflow novo.
- [x] Workflow n8n `MAG - Nutridora (T+0)`: recebe o payload do lead
      (`nome`, `whatsapp`, `curso`, `quando_pretende`), monta mensagem de
      boas-vindas citando o curso quando houver, manda via Evolution
      (`POST /message/sendText/{instance}`).
- [x] Lead sem `whatsapp` preenchido → workflow não tenta mandar nada (não
      quebra, só não executa o envio).
- [x] Teste real: lead criado via `POST /api/leads/` com o número de teste →
      mensagem chega no WhatsApp em segundos.

## Critério de aceite do gestor

Um lead de teste é criado (formulário do site ou pela SDR) e o número dele
recebe a boas-vindas da MAG sem o Daniel precisar fazer nada.

## Fora de escopo

- Toques T+1d/T+3d/T+7d (conteúdo do pilar, prova social, "vagas
  acabando") — precisam de agendamento (cron) + campo(s) novo(s) no `Lead`
  pra rastrear qual toque já foi mandado; spec própria.
- Opt-out / silêncio respeitado — entra junto com a spec dos toques
  agendados (T+0 é comemorativo, não teria por que alguém pedir pra parar
  ainda).
- Atualizar `status` do lead a cada resposta — só faz sentido quando houver
  mais de um toque pra rastrear.
