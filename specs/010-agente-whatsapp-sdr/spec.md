# Spec 010 — Recepcionista + SDR (Fase 1 MVP)

> Início da Fase 1 do plano `docs/subsistemas/02b-agente-whatsapp-n8n.md` (§9).
> n8n puro — reaproveita APIs públicas já existentes, zero mudança no Django.

## Problema / oportunidade

A spec 009 fechou a Fase 0: a MAG já identifica quem fala (gestor/instrutor/
lead/desconhecido), mas ainda só ecoa um texto fixo. Pra ajudar a lotar a
turma de Socorrista APH até 08/08 (meta nº 1, `.context/status.md`), o bot
precisa responder de verdade dúvida de curso — preço, data, vaga, requisito
— e captar o lead automaticamente. Critério da Fase 1: "lead real atendido
em segundos."

## O que muda para o usuário

- Lead ou desconhecido pergunta algo sobre curso (preço, data, carga
  horária, vaga) → MAG responde lendo o dado real da API pública (a mesma
  fonte da LP — nunca inventa preço/data/vaga).
- Depois de qualificar (curso de interesse + urgência), a MAG registra o
  lead automaticamente (`POST /api/leads/`, `utm_source=whatsapp`) — sem o
  Daniel precisar fazer nada.
- Gestor continua recebendo o reconhecimento simples da spec 009 (B1
  Operadora de verdade é spec futura).

## Critérios de aceite

- [ ] Nó AI Agent ("Capitã de Matrículas") no workflow, com tools que leem
      `GET /api/cursos/` e `GET /api/cursos/{slug}/` — nunca responde
      preço/vaga/data sem ter lido a API antes.
- [ ] Tool que chama `POST /api/leads/` com `utm_source=whatsapp` quando o
      lead está qualificado (nome + interesse claros na conversa).
- [ ] Roteamento por papel (via `identificar_contato`, spec 009): `lead`/
      `desconhecido` → SDR; `gestor`/`instrutor` → mantém o reconhecimento
      simples já existente.
- [ ] Memória de conversa por número (janela curta, nativa do n8n) — o
      agente lembra o que já foi dito na mesma conversa.
- [ ] Preço desligado (`exibir_preco=false` na API) → a MAG responde
      "consulte condições", nunca inventa valor.

## Critério de aceite do gestor

Um número de teste manda "oi, quanto custa o curso de socorrista" e recebe
de volta o preço real da turma em aberto (ou "consulte condições" se
estiver desligado) — sem o Daniel precisar configurar nada além da
credencial de LLM.

## Fora de escopo

- B1 Operadora (consultas do gestor pelo chat), A2 Nutridora (follow-up
  automático de lead), A3 Depoimentos, regras editáveis (`RegraAgente`) e
  handoff formal pra humano — ficam pra próximas specs da Fase 1/2.
- Agenda de visitas (Data Table do n8n) — Fase 1 mas spec própria, depois
  desta.
- Qualquer mudança no Django/`apps/leads`, `apps/cursos` — os endpoints
  públicos já existentes (`GET /api/cursos/`, `GET /api/cursos/{slug}/`,
  `POST /api/leads/`, todos `AllowAny`) já cobrem o que a SDR precisa.
