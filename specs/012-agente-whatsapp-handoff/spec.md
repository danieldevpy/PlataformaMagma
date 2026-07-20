# Spec 012 — Handoff: escalar pro humano e silenciar o bot

> Continuação da Fase 1 do plano `docs/subsistemas/02b-agente-whatsapp-n8n.md`
> (§4, gatilhos de handoff do A0 Recepcionista; §5, regra "Handoff").

## Problema / oportunidade

A SDR (spec 010) já é instruída a "chamar alguém da equipe" quando o lead
quer fechar matrícula, reclama, ou pede um humano — mas hoje isso é só uma
frase que ela fala. Ninguém é avisado de verdade, e se o lead mandar outra
mensagem 1 minuto depois, a MAG volta a responder sozinha como se nada
tivesse acontecido. Isso é risco real: bot insistindo em vender pra quem já
quer fechar com uma pessoa, ou continuando a conversar num caso sensível.

## O que muda para o usuário

- Quando a conversa pede um humano (intenção de matrícula, reclamação,
  assunto sensível, pedido explícito), o Daniel recebe um aviso no WhatsApp
  na hora, com o motivo e o contato de quem precisa de atenção.
- Esse número para de receber resposta automática da SDR — fica em silêncio
  até o Daniel liberar.
- Liberar é manual, pelo admin (celular) — apagar o registro de
  "escalado" daquele número.

## Critérios de aceite

- [x] Modelo `ContatoEscalado` (nucleo): `numero` único + `motivo` +
      timestamp. Presença do registro = contato pausado; apagar (admin) =
      liberado.
- [x] Ação `nucleo:escalar_contato(numero, motivo)` — cria/atualiza o
      registro.
- [x] `nucleo:identificar_contato` passa a devolver também `escalado`
      (bool) — reaproveita a mesma chamada que o roteador já faz sempre,
      sem HTTP extra.
- [x] Workflow: contato escalado não recebe resposta automática nenhuma
      (nem eco, nem SDR) até o registro ser apagado.
- [x] SDR ganha 2 tools novas: `escalar_contato` (grava o motivo) e
      `avisar_equipe` (manda WhatsApp pro Daniel na hora, com motivo +
      contato) — usadas juntas quando um gatilho de handoff aparece.
- [x] `TokenAgente agente-recepcionista-mag` ganha o escopo
      `nucleo:escalar_contato`.

## Critério de aceite do gestor

Um número de teste escreve algo como "quero fechar matrícula agora, pode
ser?" — o Daniel recebe um WhatsApp avisando na hora, e esse número não
recebe mais resposta automática até o Daniel apagar o `ContatoEscalado`
dele pelo admin.

## Fora de escopo

- "Grupo interno" de verdade (o aviso vai direto pro WhatsApp do Daniel,
  não pra um grupo — não há grupo configurado ainda).
- Regras editáveis de quais palavras/intenções disparam o handoff
  (`RegraAgente`) — os gatilhos ficam no system prompt da SDR por ora,
  mesmo padrão já usado nas specs 009/010.
- Liberação automática por tempo — só manual (apagar no admin).
