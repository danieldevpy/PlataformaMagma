# Spec 017 — Agente WhatsApp: info institucional (SDR)

> Continuação da Fase 1 do plano `docs/subsistemas/02b-agente-whatsapp-n8n.md`
> (A1 SDR). Fase do roadmap: campanha digital até 08/08 (`.context/status.md`).

## Problema / oportunidade

Hoje a SDR (MAG) responde preço, data, carga horária e FAQ de curso lendo a
API pública, mas não sabe responder perguntas institucionais básicas —
endereço da escola, Instagram, nota no Google. É uma lacuna já registrada em
`.context/status.md` ("agente não responde perguntas institucionais gerais
... falta tool pra `GET /api/site/config/`"). Um lead que pergunta "onde fica
a escola?" ou "vocês têm Instagram?" no meio da conversa de venda esbarra
numa resposta vaga ou inventada — risco direto pro funil, às vésperas do
prazo de 08/08.

## O que muda para o usuário

- Lead pergunta "onde fica a escola?" e a MAG responde o endereço real
  (`ConfiguracaoSite.endereco`).
- Lead pergunta "tem Instagram?" / "qual o WhatsApp?" / "qual o e-mail?" e a
  MAG responde com o dado real, sem inventar.
- Se `exibir_nota_google` estiver ligado, a MAG pode citar a nota do Google
  como prova social ("nota 4.9 no Google"); se estiver desligado, ela nunca
  menciona nota nenhuma (mesma regra de toggle que o site público já segue).
- Mesmo comportamento pra `total_alunos_formados`/`exibir_total_formados`.

## Critérios de aceite

- [ ] Ação nova `info_institucional` (app `nucleo`, escopo
      `nucleo:info_institucional`): sem parâmetros, devolve
      `endereco`, `whatsapp_principal`, `instagram`, `email` sempre, e
      `nota_google`/`total_alunos_formados` **só** quando o respectivo
      toggle (`exibir_nota_google`/`exibir_total_formados`) estiver ligado
      (senão vêm `null` — mesma regra de "toggle antes de feature" da
      constituição §3, não é o serializer público que já expõe os dois
      campos crus pro front decidir).
- [ ] Workflow `MAG - Fase 0`: SDR ganha a tool `info_institucional`
      (`toolHttpRequest`, mesmo padrão validado de `detalhes_curso`),
      sem parâmetros, credencial `httpHeaderAuth` existente.
- [ ] `TokenAgente agente-recepcionista-mag` (dev) ganha o escopo
      `nucleo:info_institucional`.
- [ ] `docs/plataforma/03-api-contratos.md` ganha a entrada da ação.
- [ ] Testado com `n8n_test_workflow` (payload sintético estilo Evolution)
      perguntando endereço/Instagram — resposta cita o dado real.

## Critério de aceite do gestor

Não toca o painel (config já é editável em `/dj-admin/nucleo/configuracaosite/`
desde antes) — sem critério de gestor novo.

## Fora de escopo

- Editar `ConfiguracaoSite` pelo chat (é ação de leitura só).
- Perguntas fora dos campos existentes (ex. "quais os horários de
  funcionamento da secretaria" — não há campo pra isso hoje).
- Promoção para produção (escopo novo no `TokenAgente` de prod + import do
  workflow) — fica registrada como pendência, mesmo padrão das specs
  013/014/015/016.
