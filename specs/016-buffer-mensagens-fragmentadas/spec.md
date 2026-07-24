# Spec 016 — Buffer de mensagens fragmentadas do WhatsApp

> Continuação da Fase 1 do agente MAG (`docs/subsistemas/02b-agente-whatsapp-n8n.md`).
> Meta atual em `.context/status.md`: campanha digital até 08/08/2026 — todo
> atrito na conversa do WhatsApp (SDR vendendo curso, Operadora atendendo a
> equipe) atrapalha a conversão.

## Problema / oportunidade

Muita gente digita em vários toques em vez de uma mensagem só — ex.: manda o
CPF numa mensagem e o valor na seguinte, ou "quero o Socorrista" e só depois
"pra qual turma tem vaga". Sem um buffer, o agente MAG responde a cada
fragmento isolado, sem esperar a pessoa terminar de digitar: pede de novo uma
informação que já estava a caminho, ou responde uma pergunta pela metade.
Isso vale tanto pra SDR (lead se cadastrando) quanto pra Operadora (gestor
consultando/matriculando/cobrando).

## O que muda para o usuário

- Quem manda 2+ mensagens seguidas em poucos segundos recebe **uma resposta
  só**, considerando tudo que escreveu — não uma resposta por fragmento.
- Se demorar mais que a janela de espera entre uma mensagem e outra, cada uma
  é tratada normalmente (sem atraso perceptível de mais que a janela).

## Critérios de aceite

- [x] Mensagens do mesmo número, chegando dentro da janela de espera (5s),
      são combinadas num texto só antes de chegar no agente (SDR ou
      Operadora) — ordem preservada por horário de chegada.
- [x] Quando chega uma mensagem mais nova antes da janela da anterior
      terminar, só a mais nova processa e responde — a anterior é
      descartada silenciosamente (nunca gera 2 respostas pra 1 turno de
      conversa).
- [x] O comportamento vale igualmente pro ramo do SDR e da Operadora
      (o ponto de buffer fica antes da bifurcação dos dois).
- [x] Testado de ponta a ponta com o exemplo real que motivou a spec
      (`"18714933748"` + `"650"` em mensagens separadas) via
      `n8n_test_workflow` — consolidação confirmada.

## Critério de aceite do gestor

- [ ] Daniel manda 2 mensagens fragmentadas de verdade pelo WhatsApp (número
      de teste) e recebe 1 resposta só, considerando as duas — **ainda não
      testado com mensagem real via Evolution API**, só com payload
      sintético (`n8n_test_workflow`).

## Fora de escopo

- Janela de espera dinâmica (mais curta pra mensagem que já parece completa,
  mais longa pra fragmento curto) — fica fixa em 5s por ora.
- Promoção para produção (Redis dedicado + workflow atualizado só existem no
  dev).
- Investigar o achado incidental do teste: agente SDR pode terminar em
  handoff sem gerar texto final de resposta — bug pré-existente, não
  causado por esta spec, tratado à parte.
