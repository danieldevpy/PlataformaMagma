# Plan 024 — A MAG conversa melhor: pesos de tom, escassez e curiosidade

## Toques no sistema

| Camada | O que muda | Referência |
|---|---|---|
| n8n | `mag-fase-0-sdr.json` → `systemMessage` do nó `SDR - Capitã de Matrículas`: **reescrita do bloco "SEU OBJETIVO"**, não acréscimo de regras | `plataforma/n8n/workflows/README.md` |
| n8n | `mag-fase-0-sdr.json` → nó `Preparar contexto SDR`: `nome` passa a ter fallback pro `pushName` | idem |
| n8n | `mag-fase-0-sdr.json` → nó `Memória da conversa`: `contextWindowLength` 10 → 20 | spec 022 |
| Docs | `.context/status.md` + `historico/` + ADR em `.context/decisoes.md` | higiene do CLAUDE.md |

**Zero mudança de backend, zero migração, zero mudança de contrato de API.**
Esta spec é de comportamento; a integridade de dado é tratada na 025.

## Decisões desta feature

### O orçamento de regras é fixo — entra uma, sai uma

O prompt do SDR hoje tem 8 regras numeradas em "SEU OBJETIVO" + 4
inegociáveis + o bloco de handoff. O Daniel foi explícito: *"quanto mais
regra colocamos, mais engessados deixamos"*. Então a reescrita **funde**
regras em vez de empilhar:

| Hoje | Vira |
|---|---|
| 3. "criar senso de urgência LEGÍTIMO com dado real" | 3. urgência **só** com vaga escassa de verdade (limiar explícito) |
| 6. lista de frases proibidas ("registrei", "cadastrei", "vou registrar"...) | 6. regra **positiva**: peça o nome sem dar motivo nenhum |
| 7. "nunca ofereça opção não confirmada" | 7. absorve a promessa de apuração: **nunca ofereça nem prometa** o que não veio de tool |
| 8. "não chame a mesma tool de novo" | some do prompt — vira ajuste de `contextWindowLength` |

Saldo: mesmo número de regras, nenhuma nova categoria pro modelo
processar.

### Limiar de escassez: 3, no prompt (não no backend)

`vagas_restantes` e `exibir_vagas` já vêm de `turma_destaque`. A regra
vira *"só cite o número de vagas se for **3 ou menos**; acima disso, não
mencione vagas em nenhuma forma (nem 'ainda temos vagas')"*.

Cogitei calcular no backend (um campo `escassez_relevante` no payload),
seguindo a lição da spec 023 de "não confiar julgamento ao modelo". Ficou
de fora por dois motivos: (a) `GET /api/cursos/{slug}/` é o **mesmo**
payload que a LP consome — pôr conselho de venda no contrato público é
poluição; (b) comparar um inteiro com 3 não é a classe de erro que a 023
diagnosticou (lá era **montar string de identificador**, coisa que LLM
erra sistematicamente). Se o teste mostrar o modelo furando o limiar, o
plano B está registrado aqui.

### Convite antes de ficha: ordem, não proibição

Nada é proibido de dizer — o que muda é **quando**. A regra passa a
separar dois momentos:

- **Interesse genérico** ("vi a propaganda", "quero saber do curso"):
  responder o que foi perguntado + **um** gancho de valor + convite pra
  saber mais. Não entregar data/horário/preço/vagas de bandeja.
- **Interesse específico** (perguntou preço, data, horário, requisito):
  responder direto e completo, sem enrolação.

O exemplo do Daniel entra no prompt como referência de tom (*"gostaria de
conhecer melhor esse curso? acredito que seu filho iria gostar"*), não
como frase pronta — frase pronta vira papagaio.

> Este é o pedaço que a **spec 026 (mídia curada)** vai completar: hoje o
> convite termina em texto; lá ele passa a poder oferecer foto/vídeo
> escolhido pelos gestores. A 024 prepara o terreno deixando a conversa
> com espaço pra isso, e as duas são independentes — a 024 funciona
> sozinha.

### Curso inexistente: negar e abrir o leque, na mesma mensagem

A regra 1 (nunca inventar) fica intacta — ela funcionou. O que entra é o
**segundo movimento**: depois de negar, listar os cursos que existem
(`listar_cursos` já é chamada nesse caminho hoje) posicionando o APH como
carro-chefe. Sem inventar adequação ("o BLS serve pra você") — só
apresentar o que há.

### Regra do nome: positiva, e sem sobrenome

Duas trocas:

1. **Proibição vira instrução.** Em vez de listar frases proibidas (que o
   modelo contorna com sinônimo — provado duas vezes agora), a regra passa
   a ser *"pergunte o nome e mais nada: 'Como você se chama?'. Não explique
   por que está perguntando"*. Fecha a porta na origem: sem justificativa,
   não há justificativa errada.
2. **Nunca pedir sobrenome.** Foi o que produziu o *"Entendido, Nunes!"*.
   Primeiro nome basta pro lead e pra conversa.

### `pushName` como fallback, não como substituto

`Preparar contexto SDR` hoje faz `nome = $json.resultado.nome`
(`identificar_contato`). Passa a ser
`$json.resultado.nome || $('Consolidar mensagens').item.json.nome` — o
nome do cadastro **sempre ganha** do apelido do WhatsApp, e o `pushName`
só entra quando não existe cadastro.

Ressalva registrada: `pushName` é apelido, não nome ("Rafa", "Ju",
"Thiago N."). Por isso ele serve pra **chamar a pessoa** e evitar o turno
perdido, mas o prompt continua confirmando o nome antes de registrar o
lead ("posso te chamar de Rafa?" resolve os dois).

### `contextWindowLength` 10 → 20 resolve a tool repetida

A regra 8 do prompt não impediu 4 chamadas de `listar_cursos` na mesma
conversa, e a explicação mais provável não é desobediência: com janela de
10 mensagens, numa conversa de 5 turnos com tool calls no meio, o
resultado da tool **sai do contexto**. O modelo não está ignorando o que
sabe — ele não sabe mais.

Custo: o dobro de histórico por chamada. Aceitável — `gemini-3.1-flash-lite`
é barato e as conversas são curtas. Se virar problema de custo, o caminho
é resumir a conversa, não encurtar a janela.

### Teto de tamanho: ~600 caracteres e uma pergunta por mensagem

Vai no prompt como orientação de formato, não como corte automático
(cortar no meio é pior que uma mensagem longa). A âncora é o WhatsApp:
*"escreva como quem digita no celular; se passar de umas 4-5 linhas,
corte o assunto e deixe o resto pra próxima mensagem"*.

## Riscos

- **Escassez some quando deveria aparecer.** Se a turma encher de verdade
  (≤3), o limiar tem que disparar. Caso de aceite explícito.
- **"Convite antes de ficha" virar enrolação.** Quem já chega perguntando
  preço tem que receber preço, não convite. Por isso a regra tem os dois
  momentos, e o aceite testa o caminho direto também.
- **Reescrever o `systemMessage` inteiro é a mudança mais arriscada da
  spec** — é o mesmo texto que a 023 ajustou com 3 rodadas de teste real.
  Mitigação: as regras que a 023 provou (handoff amarrado à ação, curso no
  `registrar_lead`, não oferecer opção inexistente) são transportadas
  **literalmente**, não reescritas.
