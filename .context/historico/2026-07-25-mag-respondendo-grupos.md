# 2026-07-25 — Incidente: a MAG estava respondendo dentro de grupos

## Como apareceu

Não foi reportado: caiu no colo durante o deploy da etapa 2. Ao conferir o
estado de produção, o único `ContatoEscalado` da base tinha `numero`
`<id-do-grupo-A>` — e `120363…` é prefixo de **JID de grupo** do
WhatsApp, não de telefone. O Daniel perguntou "que grupo?", e a
investigação abriu o caso inteiro.

## O que aconteceu de verdade

Consultado o Postgres da Evolution de **produção** (a instância está
conectada em `<whatsapp-do-negocio>` — *Magma Cursos*, o WhatsApp principal do
negócio; o dev usa outro número, `<whatsapp-do-dev>`):

| Quando | Grupo | O que a MAG fez |
|---|---|---|
| 23/07 14:27 | `grupo de turma 1` (turma, 1448 msgs) | ofereceu o curso a alunos **já matriculados nele** |
| 23/07 14:27 | `grupo de turma 2` | idem |
| 23/07 18:00 | `grupo pessoal do Daniel` | ofereceu cursos da Magma no grupo da família |
| 24/07 13:22 | `grupo de turma 3` | 4 mensagens + acionou a equipe |

O caso do `grupo de turma 3` é o mais grave. O instrutor postou o link de
inscrição da turma de BLS e escreveu *"Olá pessoal / Por favor fazer
inscrição / Nesse link"*. A MAG tratou o **anúncio do instrutor** como um
lead conversando com ela: deu boas-vindas, perguntou qual curso ele
queria, e terminou com *"já acionei nossa equipe (…) um de nossos
consultores entrará…"* — tudo na frente do grupo.

## Causa

Uma linha, no nó `Extrair dados`:

```
{{ $json.body.data.key.remoteJid.split('@')[0] }}
```

Chat individual: `5521999999999@s.whatsapp.net` → devolve o telefone.
Grupo: `<id-do-grupo-A>@g.us` → devolve **o id do grupo**, que passa por
número sem levantar suspeita: só dígitos, sem pontuação, plausível à
vista. Nada no caminho perguntava "isso é uma pessoa?".

## Correção, em duas camadas

**1. Backend** (`84e173c`) — `apps/nucleo/numeros.py`, novo:
`numero_de_pessoa()` aceita só dígitos, 10 a 15 caracteres. Id de grupo tem
18+, `status@broadcast` e `@newsletter` caem por não serem dígitos ou por
comprimento. Aplicado em cinco pontos:

- `identificar_contato` → **400 em vez de "desconhecido"**. É a primeira
  ação de toda conversa, então a execução morre ali, antes de qualquer
  texto ser gerado ou enviado. Devolver "desconhecido" era exatamente o
  que produzia o incidente.
- `escalar_contato` → 400, sem criar `ContatoEscalado` nem `Lead`.
- `LeadPublicoSerializer.validate_whatsapp` + `garantir_lead` → id de
  grupo nunca vira `Lead`. Vazio continua válido: a LP **não coleta
  WhatsApp** (manda nome/curso/quando e redireciona), então a checagem não
  arrisca o caminho do formulário do site.
- `processar_nutridora` → último cadeado antes do envio, pros leads que já
  tivessem nascido errados.
- `listar_gestores` → filtra número inválido digitado no Admin.

**2. n8n** (`08f2a1c`) — condição nova no nó `É mensagem de texto
recebida?`: `remoteJid endsWith "@s.whatsapp.net"`. É lista de
**permissão**, não de bloqueio — um tipo de JID que o WhatsApp inventar
amanhã já nasce de fora. Barrar aqui é economia (não gasta execução, nem
chamada ao Django, nem token de IA), não segurança: quem garante é o
backend, mesma lição da spec 023.

## Como foi validado

**Backend, dentro do processo de produção em execução** (não só a suíte —
lição da spec 023, teste verde não prova que o processo tem o código
novo): os três ids de grupo reais recusados, o WhatsApp da Magma aceito,
`identificar_contato` e `escalar_contato` levantando `ErroAcao`.

**n8n, em dev, com o regex de números permitidos temporariamente ampliado
pra ACEITAR id de grupo** — sem isso o grupo seria barrado pelo filtro
antigo e o teste não provaria nada:

- payload de grupo (id real do `grupo de turma 3`): **3 nós, 116 ms**, parou no
  IF. Não chegou em `Extrair dados`, nem no agente, nem no envio.
- payload individual: **22 nós**, a SDR respondeu com dado real (R$ 650,
  120h, presencial). O único erro foi o envio, porque o número de teste
  com DDD 00 não existe no WhatsApp (`exists: false`) — o mecanismo de
  segurança do harness funcionando.

Suíte: **304 → 315**.

## Estado da base depois

Zero `Lead`, zero `ContatoEscalado` e zero `Conversa` com número que não
seja de pessoa, em produção. O registro do `grupo de turma 3` foi **apagado pelo
próprio Daniel** pelo Admin às 16:55 (confirmado no `LogEntry`,
`action_flag=3`) enquanto lia o relato — não foi perda de dado.

## O que fica em aberto

- **A MAG segue sem nenhuma noção de "vários interlocutores".** A decisão
  aqui foi ignorar grupo por completo, não tratá-lo. Se um dia fizer
  sentido ela atuar num grupo de turma, é feature própria, com desenho
  próprio (quem ela responde, quando se cala, como não vira ruído).
- **Nenhuma mensagem real passou pela MAG depois da correção.** A prova
  final é o Daniel mandar uma mensagem individual e ver a resposta chegar.
