# 2026-07-25 — Implementação das specs 024 (tom e pesos) e 027 (blindagens)

## Prompt do Daniel

> "comece agora a desevolver as tasks baseado no nosso plano"

Vindo direto da sessão anterior, que produziu a bateria de 6 conversas
simuladas, o feedback do Daniel sobre elas e as specs 024–027.

## O que foi feito

### Spec 024 — A MAG conversa melhor (T1–T13 entregues, em dev)

Uma edição só do `systemMessage` do nó `SDR - Capitã de Matrículas`, mais
dois nós. **Zero backend.**

**Orçamento de regras respeitado** (o princípio que o Daniel deu junto com
a aprovação — *"quanto mais regra colocamos, mais engessados deixamos"*):

| | Antes | Depois |
|---|---|---|
| Regras inegociáveis | 4 | 5 (ganhou o teto de formato) |
| "SEU OBJETIVO" | 8 | 7 (a regra 8, de tool repetida, virou ajuste de `contextWindowLength`) |
| **Total** | **12** | **12** |

As fusões:

- Regra 1 absorveu o caminho do **curso inexistente** (negar + listar todos).
- Regra 2 nova (**ordem: convite antes de ficha**) absorveu a antiga regra 2
  ("responder preço/data com `detalhes_curso`") como o ramo de interesse
  específico.
- Regra 3 trocou "urgência legítima com dado real" por **limiar de 3 vagas**.
- Regra 6 virou **positiva** ("pergunte o nome e mais nada"), sem a lista de
  frases proibidas que o modelo contornava com sinônimo, e proibindo sobrenome.
- Regra 7 absorveu a **promessa de apuração** ("não diga que vai verificar,
  consultar ou levantar nada que nenhuma ferramenta sua responde").

Transportadas **literalmente** (são as que a spec 023 provou em campo): o
bloco de handoff inteiro, incluindo a REGRA ABSOLUTA, e a regra do
`curso_slug` no `registrar_lead`.

Fora do prompt:

- `Preparar contexto SDR`: `nome` ganhou `|| $('Consolidar mensagens').item.json.nome`
  — o `pushName` que a Evolution já entregava e era jogado fora.
- `Memória da conversa` (SDR): `contextWindowLength` 10 → 20. A da Operadora
  ficou em 10 (fora de escopo).

### Spec 027 — Blindagens (T2, T5, T6, T7 entregues, só dev)

- **Timeout**: `settings.executionTimeout: 60` no workflow. O plano dizia
  pra pôr timeout no nó do agente — **o nó não tem essa opção**, nem o do
  modelo. Ver ADR.
- **Poda**: `EXECUTIONS_DATA_PRUNE=true` + `EXECUTIONS_DATA_MAX_AGE=168`
  (7 dias), nos dois composes.
- **Versão fixada**: `n8nio/n8n:2.31.5` em dev (era `latest`; o container
  já rodava exatamente essa versão, então foi no-op de imagem).
- **`mem_limit: 2g`** em dev.
- **Prod ficou de fora do pin e do `mem_limit`, de propósito** — ver ADR.

## Como foi testado

Mesmo harness da bateria de 25/07 (números com DDD 00, payload
`messages.upsert` injetado em `POST /webhook/whatsapp-in`, transcrição lida
do `execution_data` do n8n). **Números novos** (`...0011`–`...0031`) em vez
de reusar os antigos, porque os antigos já estavam marcados como escalados
e entrariam silenciados — e apagar o resíduo é decisão do Daniel, ainda
pendente.

19 turnos de conversa + 3 de teste de escassez. Nenhuma mensagem chegou a
telefone real.

### Placar dos critérios de aceite da 024

| Critério | Resultado |
|---|---|
| Escassez com limiar | ✅ 14 vagas → não citou; 3 vagas → "apenas 3 vagas", mesma pergunta |
| Convite antes de ficha | ✅ |
| Curso inexistente abre leque | ✅ só na 2ª tentativa (ver abaixo) |
| Nome sem pretexto, sem sobrenome | ✅ |
| `pushName` aproveitado | ✅ |
| Sem promessa de apuração | ✅ |
| Tool não repetida | ⚠️ melhorou (2–3× vs 4×), não zerou |
| Teto de ~600 caracteres | ⚠️ maioria 250–450; uma foi a ~830 |
| Suíte verde | ✅ 289 testes |

**O antes e depois que mais importa** — Sandra, mãe perguntando pelo filho:

> **Antes:** "Temos uma turma aberta com início previsto para 08 de agosto,
> aos sábados e domingos, das 09h às 16h. Restam 14 vagas para esta turma."

> **Depois:** "Olha, ele pode fazer o curso sim! O APH é justamente a porta
> de entrada para quem quer começar na saúde, não precisa ter experiência
> nenhuma. O curso é 100% focado na prática, com manequins e equipamentos
> reais, então ele aprende tudo fazendo, o que ajuda muito a perder o medo
> e ganhar segurança. O valor do curso é R$ 650,00. Quer que eu te conte
> mais sobre como funcionam as aulas práticas?"

E o Thiago, que antes matava a venda prometendo um calendário que não
existe (*"vou verificar se já temos o calendário das próximas turmas"*),
agora **escala de verdade** — chamou `escalar_contato` + `avisar_equipe` e
avisou que a equipe retorna.

### O critério que falhou na primeira rodada

"Curso inexistente abre leque" **reprovou**. A primeira redação da regra 1
dizia *"apresente os cursos que existem, com o Socorrista APH 120h em
destaque como carro-chefe"* — e a MAG respondeu ao Thiago citando **só o
APH**, que é exatamente o vício que a regra existia pra corrigir. Reescrita
como instrução contável, com a leitura errada nomeada, passou (citou APH e
BLS). Virou ADR, porque é a terceira vez que o mesmo padrão aparece.

Leitura importante pra quem for reavaliar: dev tem só **2 cursos
publicados** (APH e BLS). Os outros que a spec menciona (Primeiros
Socorros/Lei Lucas, Punção Venosa) existem na base mas não estão
publicados, então `listar_cursos` não os devolve — "abrir o leque" em dev é
citar dois.

### Confirmações incidentais

- **`resolver_curso()` (spec 023) de novo em campo:** o modelo inventou
  `socorrista-aph-120h`, e o lead #34 nasceu com `curso_id=2`
  (`socorrista-aph`) mesmo assim.
- **Nenhum travamento.** Os 19 turnos rodaram inteiros; ao fim, 0,19% de
  CPU e 513 MiB de 2 GiB, `healthz` 200. Não é reprodução do incidente (a
  carga foi sequencial, não concorrente), mas reforça a hipótese de que o
  gatilho é **concorrência**, não volume acumulado — sinal pra T1 da 027.

### A evidência mais forte a favor da spec 025

Em **3 dos 6 perfis** o contato mandou mensagem depois de ser escalado e
recebeu **silêncio absoluto**: Rafael perguntando de desconto à vista,
Sandra perguntando *"onde fica a escola? é longe de Belford Roxo?"*, Thiago
pedindo o calendário. São perguntas triviais, e o sistema não responde
nenhuma. A 025 é mais urgente do que a ordem 024→025→026 sugere.

## Estado ao sair

- **Dev restaurado ao estado versionado**: regex de números de teste de
  volta ao original, override da simulação fora, n8n saudável.
- **`vagas_restantes` da turma 026 restaurado** (capacidade 15 → 4 → 15).
- **Nada foi apagado do banco de dev.** A limpeza do resíduo continua sendo
  decisão do Daniel.
- **Nada foi commitado nem promovido pra prod.**

### Resíduo novo em dev (da própria bateria)

- Leads **#32** (Carlos), **#33** (Paulo), **#34** (Rafael) — números
  `55009000000{12,13,21}`.
- `ContatoEscalado` dos números `55009000000{21..26,31}`.
- Os antigos (#9–#14 e leads #29–#31) continuam lá.

### Pendências

1. **Decisões suas em aberto** (bloqueiam 025 e 026): prazo de expiração do
   handoff e status do lead escalado; tag nova × reusar `destaque`, e se
   vídeo entra na mídia curada.
2. **Apagar ou não o resíduo de dev.**
3. **027-T3/T4** (watchdog + alarme) não foram feitos.
4. **027-T6/T7 em prod** dependem de rodar `n8n --version` e `free -m` na VPS.
5. **Promoção pra prod** (024 + 021/022/023, mesmo arquivo) — sua decisão.
6. **O harness de simulação continua fora do repo**, em
   `/tmp/.../scratchpad/sim/`. Foi reaproveitado nesta sessão por sorte
   (mesmo id de sessão); numa sessão nova ele não existe mais, e a T1 da
   027 depende dele.
