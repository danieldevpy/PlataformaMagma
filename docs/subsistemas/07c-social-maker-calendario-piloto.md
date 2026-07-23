# Social Maker — Calendário piloto (23/07 a 08/08/2026)

> Não é spec — é o plano de conteúdo operacional pra alimentar o Manus (complementa
> `07-social-maker.md` e `07b-social-maker-manus.md`). Este arquivo traz só o
> **planejamento** (dia, curso, pilar, ângulo, CTA, dado a usar). Legenda final,
> escolha de imagem/arte e texto de story ficam a cargo do agente (Manus), seguindo
> o guia de marca (`design-system/AGENTS.md`) e o contexto já anexado a ele
> (`docs/subsistemas/agente-social-maker-contexto.md`).
>
> Período escolhido porque cobre os **dois eventos reais** dessa janela:
> **02/08/2026 — workshop Stop the Bleed + BLS** e **08/08/2026 — início da
> turma 026 de Socorrista APH** (meta da campanha, ver `.context/status.md`).

## Fonte de dados

Fichas de curso confirmadas no banco de dev (`plataforma/backend/db.sqlite3`) em 23/07/2026,
mais o banner oficial (`banner_magma_stop_the_bleed_v2.png`) que o Daniel forneceu com o dado
real do workshop combinado. Antes de cada post, o agente deve confirmar se o dado ainda é
válido (preço, vaga, data podem mudar).

| Curso / evento | Status na plataforma | Data confirmada | Dado confirmado |
|---|---|---|---|
| **Socorrista APH** | publicado | ✅ Turma 026 | 120h · início 08 e 09/08/2026, sáb/dom 09h–16h · R$650 à vista · sem limite de capacidade cadastrado · instrutor João Paulo Bello dos Santos (COREN-RJ) |
| **Workshop Stop the Bleed + BLS** | **não é a formação completa de BLS (20h) cadastrada no site** — é um workshop combinado avulso, ainda não publicado na plataforma | ✅ **02/08/2026, domingo, 10h às 18h** (8h) | R$300 investimento · local: Rua Nossa Senhora de Fátima, 495, Olinda, Nilópolis/RJ · instrutor Enf. João Bello (mesma pessoa/foto oficial) · Instagram @magma_curso |
| **Primeiros Socorros — Lei Lucas** | rascunho, sem página no site | ❌ sem turma | 4h · conteúdo institucional/educativo, sem CTA de matrícula |
| **Punção Venosa e Coleta de Exames** | rascunho, sem página no site | ❌ sem turma | 10h · conteúdo educativo, sem CTA de matrícula |

✅ **Resolvido em 23/07/2026**: o número do banner (`21 97976-7821`) é o WhatsApp oficial
**primário** da Magma — Daniel confirmou. `21 96494-6079` fica como secundário; `21 97100-5197`
saiu de circulação. Guia de marca (`design-system/AGENTS.md`) e `ConfiguracaoSite.whatsapp_principal`
já atualizados. CTA dos posts do workshop pode usar o número do banner sem ressalva.

**Regra de CTA por curso:**
- APH → pode linkar pro site (página publicada) ou WhatsApp.
- Workshop Stop the Bleed + BLS → CTA forte pro WhatsApp (`21 97976-7821`); não linkar pra página do site (ainda não publicada).
- Lei Lucas / Punção Venosa → sem CTA de matrícula; no máximo CTA soft ("manda mensagem se quiser saber mais").

## Calendário dia a dia

| Data | Dia | Formato | Foco | Pilar | Ângulo (o que abordar) | CTA |
|---|---|---|---|---|---|---|
| 23/07 | Qui | Feed + Stories | Socorrista APH | Captação direta | Abertura oficial: turma 026 com inscrições abertas, início 08–09/08 | Forte — site ou WhatsApp |
| 24/07 | Sex | Feed + Stories | Workshop Stop the Bleed + BLS | Captação direta | Anúncio do workshop — 02/08, domingo, 10h–18h, R$300 | Forte — WhatsApp (confirmar número) |
| 25/07 | Sáb | Feed + Stories | Socorrista APH (acervo) | Bastidores / autoridade | Fotos/vídeos reais de turmas anteriores em prática (não há aula ao vivo neste dia — turma 026 só começa 08/08) | Suave |
| 26/07 | Dom | Feed + Stories | — | Leve / recap | Resumo da semana ou frase do instrutor | Nenhum |
| 27/07 | Seg | Feed + Stories | Punção Venosa | Curiosidade | "Jelco x Scalp: você sabe a diferença?" | Soft |
| 28/07 | Ter | Feed + Stories | Socorrista APH | Prova social | Depoimento de aluno formado (turma anterior) | Forte |
| 29/07 | Qua | Feed + Stories | Lei Lucas | Institucional / autoridade | "Sua escola já cumpre a Lei Lucas 13.722/2018?" | Soft |
| 30/07 | Qui | Feed + Stories | Socorrista APH | Urgência | Faltam 9 dias pra turma 026 começar | Forte |
| 31/07 | Sex | Feed + Stories | Workshop Stop the Bleed + BLS | Urgência | Faltam 2 dias pro workshop — últimas inscrições | Forte — WhatsApp |
| 01/08 | Sáb | Feed + Stories | Workshop Stop the Bleed + BLS | Véspera / hype | "Amanhã tem workshop" — instrutor convocando | Forte |
| 02/08 | Dom | Feed + Stories | Workshop Stop the Bleed + BLS | Cobertura ao vivo | Workshop acontecendo — bastidores do dia inteiro (10h–18h) | Forte |
| 03/08 | Seg | Feed + Stories | Workshop (recap) + Socorrista APH | Prova social / mercado | Recap do workshop que acabou de rolar + saídas profissionais do APH | Forte |
| 04/08 | Ter | Feed + Stories | Socorrista APH | Urgência | Faltam 5 dias pra turma 026 começar | Forte |
| 05/08 | Qua | Feed + Stories | Socorrista APH | Objeção / FAQ | "Não tenho experiência, posso fazer?" (requisito real: nenhum, formação do zero) | Forte |
| 06/08 | Qui | Feed + Stories | Socorrista APH | Prova social | Depoimento ou bastidores de preparação da turma que começa | Forte |
| 07/08 | Sex | Feed + Stories | Socorrista APH | Véspera / hype | "Amanhã começa" — instrutor convocando a turma | Forte |
| 08/08 | Sáb | Feed + Stories | Socorrista APH | Captação direta / cobertura ao vivo | Primeira aula da turma 026 ao vivo | Forte |

## Pendências antes de rodar no Manus

1. ~~Confirmar o WhatsApp certo do workshop~~ — **resolvido 23/07/2026, confirmado pelo Daniel**: `21 97976-7821` é o principal, `21 96494-6079` secundário, `21 97100-5197` saiu de circulação.
2. ~~Confirmar se haverá aula real em 25/07 e 01/08~~ — **resolvido**: não há aula ao vivo em nenhum dos dois dias (turma 026 só começa 08/08); 25/07 usa acervo de turmas anteriores, 01/08 já é véspera/hype do workshop.
3. Publicar a página do workshop/BLS na plataforma quando o Daniel decidir — hoje o CTA depende só de WhatsApp.
