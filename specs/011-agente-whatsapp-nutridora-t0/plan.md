# Plan 011 — como fazer

> Referências: `docs/subsistemas/02b-agente-whatsapp-n8n.md` (§4 A2),
> `apps/leads/signals.py` (gancho já existe), spec 010 (padrão de workflow
> n8n + Evolution já validado).

## Toques no sistema

| Camada | O que muda | Referência |
|---|---|---|
| Modelos/migrations | Nenhum | — |
| API | Nenhuma nova — o payload do `N8N_LEAD_WEBHOOK` já tem tudo que a mensagem precisa | `apps/leads/signals.py::montar_payload` |
| Config | `backend/.env` (dev): `N8N_LEAD_WEBHOOK=http://localhost:5678/webhook/lead-novo` (Django roda no host, n8n dev publica em 127.0.0.1:5678 — chamada direta, sem host.docker.internal) | — |
| n8n | Workflow novo `MAG - Nutridora (T+0)` | `plataforma/evolution/README.md` |

## Workflow (`MAG - Nutridora (T+0)`, novo)

Webhook (`POST /webhook/lead-novo`, responseMode `onReceived`) → IF
(`whatsapp` não vazio — sem número não tem pra quem mandar) → Set (monta a
mensagem: saudação + menção ao curso se `curso` não for null + faixa "em
breve alguém da nossa equipe também vai falar com você") → HTTP Request
(`POST /message/sendText/{instance}` na Evolution, mesmo padrão dos workflows
anteriores).

Texto fixo (sem IA — "não conversa, age no tempo", plano §4). Exemplo:

```
Oi, {nome}! Aqui é a MAG, da Magma Cursos 🚑
Recebi seu interesse no curso de {curso} — em breve alguém da nossa equipe
te chama por aqui pra tirar qualquer dúvida e te ajudar a garantir sua vaga.
```

Sem `curso` (lead genérico, sem `curso_slug`): variação sem citar o nome do
curso.

## Decisões desta feature

- Mensagem é **template determinístico**, não AI Agent — T+0 é sempre a
  mesma estrutura, não precisa de LLM (custo zero, previsível, mais rápido
  que Fase 1 anterior que depende de tool-calling).
- URL da Evolution no HTTP Request do workflow de nutrição usa
  `http://evolution-api:8080/...` (rede interna do compose, `magma-dev-net`
  em dev) — mesmo padrão já validado nos workflows anteriores.
- **Não manda boas-vindas quando o lead nasce dentro do próprio WhatsApp**
  (`utm_source == "whatsapp"`, marcado pelo `registrar_lead` da SDR, spec
  010) — nesse caso a conversa já está rolando e a mensagem fica
  redundante/fora de contexto (achado testando com o Daniel, 2026-07-20).
  Nó "Tem WhatsApp?" virou "Deve mandar boas-vindas?" com essa 3ª condição.

## Riscos / pontos de atenção

- `N8N_LEAD_WEBHOOK` só é lido no boot do Django (`env.read_env` roda uma
  vez) — precisa reiniciar o `runserver` depois de criar/editar
  `backend/.env` pra valer.
- Testar com um lead cujo `whatsapp` seja o número de teste
  (`5521979070319`) pra não mandar mensagem de verdade pra ninguém.
