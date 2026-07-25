# Plan 025 — Handoff de ponta a ponta

## Toques no sistema

| Camada | O que muda | Referência |
|---|---|---|
| Backend | `apps/nucleo/models.py::ContatoEscalado` — ganha estado (`resolvido_em`, `expira_em`) + `Meta.unique` revisto | `docs/plataforma/02-modelos.md` |
| Backend | `apps/nucleo/acoes_contato.py::escalar_contato` — garante o `Lead` (cria-ou-atualiza) e aceita `nome`/`curso_slug` opcionais | `docs/plataforma/03-api-contratos.md` |
| Backend | `apps/leads/serializers.py::resolver_curso` — reusado pelo `escalar_contato` (mesma tolerância a slug inventado da spec 023) | spec 023 |
| Backend | `apps/leads/acoes.py::processar_nutridora` — filtro de "escalado" passa a olhar só os **ativos** | spec 020 |
| Backend | `ConfiguracaoSite` — campo novo com o prazo de expiração do handoff | spec 021 (mesmo padrão da retenção) |
| Backend | `apps/nucleo/admin.py` — `ContatoEscalado` editável: resolver pelo Admin, listar por estado | — |
| n8n | `mag-fase-0-sdr.json` → nó `Está escalado?` (só ativos) + ramo novo de cortesia | `plataforma/n8n/workflows/README.md` |
| n8n | `mag-avisar-equipe.json` → texto do aviso com canal único + número copiável | spec 012 / adendo 019-T9 |
| n8n | `mag-fase-0-sdr.json` → `systemMessage`: critério pagamento-neutro × objeção-de-preço | spec 024 (mesmo arquivo — coordenar) |
| Migrações | 2 (`nucleo`: `ContatoEscalado` + `ConfiguracaoSite`) | — |
| Docs | `03-api-contratos.md` (payload de `escalar_contato` muda) + `.context/backend.md` + status/historico/ADR | higiene do CLAUDE.md |

## Decisões desta feature

### O lead é garantido no backend, não pedido no prompt

A tentação é escrever no prompt *"registre o lead antes de escalar"*. A
spec 023 já provou duas vezes que isso não sustenta integridade de dado: a
regra "uma vez só por conversa" existia e o modelo chamou duas vezes; a
regra do `curso_slug` existia e ele mandou slug inventado três vezes.

Então **`escalar_contato` passa a ser responsável pelo lead**. Ele já
recebe o número; passa a fazer cria-ou-atualiza no `Lead` pelo mesmo
caminho de dedup da spec 023. Se o modelo mandar `nome`/`curso_slug`
(parâmetros novos, opcionais), melhor — entram no registro. Se não mandar,
**o lead nasce mesmo assim**, só com o WhatsApp.

Contrapartida aceita: leads sem nome na base. É de longe o menor mal —
lead sem nome ainda é um número pra ligar, e ele **já está silenciado**
pro automático, então não vira spam da Nutridora. Perder o contato que
disse "quero garantir minha vaga" não tem conserto.

### `ContatoEscalado` deixa de ser "existe = silenciado"

O docstring atual é explícito: *"a presença do registro já é o estado
(existe = silenciado; apagar pelo admin = libera)"*. Era uma simplificação
correta pra spec 012, quando o handoff era exceção. Com 6 de 6 conversas
escalando, ela vira o buraco principal: **apagar** o registro é a única
saída, e apagar perde o histórico de que houve handoff.

Passa a ter estado explícito:

- `resolvido_em` (null = ativo) — o gestor assumiu e devolveu.
- `expira_em` — preenchido na criação a partir da config; passado o prazo,
  o contato volta ao automático sozinho.
- `unique=True` no `numero` **cai** (senão o segundo handoff do mesmo
  contato, meses depois, colide com o registro resolvido). Vira índice não
  único + consulta sempre por "ativo mais recente".

Efeito colateral obrigatório: `processar_nutridora` (spec 020) hoje exclui
quem está em `ContatoEscalado` — precisa passar a excluir só os **ativos**,
senão quem já foi atendido nunca mais recebe nutrição.

### Prazo de expiração: 24h, configurável, e reversível pelo Admin

Mesmo padrão da retenção de conversas da spec 021 — campo em
`ConfiguracaoSite`, editável no Admin sem redeploy, `0` = nunca expira
(volta ao comportamento de hoje). Default proposto: **24h**.

O raciocínio do default: o pior caso hoje é silêncio infinito; o pior caso
com 24h é a MAG voltar a falar com alguém que o gestor já está atendendo —
recuperável e visível. Errar pro lado de voltar a atender é mais barato
que errar pro lado de sumir.

**Decisão do Daniel na revisão** (ver "Perguntas abertas" da spec).

### Cortesia: uma vez, não a cada mensagem

Contato escalado que manda mensagem nova hoje cai no `noOp`. Passa a
receber **uma** resposta curta, honesta e sem promessa de prazo — algo
como *"Já avisei a equipe e alguém vem falar com você por aqui. Enquanto
isso, se quiser adiantar alguma dúvida pode mandar que eu registro."*

"Uma vez" é importante: repetir a cada mensagem é pior que o silêncio
(vira robô de porta). Controle proposto: marca no Redis com TTL igual ao
do handoff, chave própria (`mag:cortesia:{numero}`) — não usa o
`ContatoEscalado` pra não escrever no banco a cada mensagem.

O texto **não** passa pelo agente (nada de LLM aqui): é mensagem fixa
enviada direto pela Evolution, como a Nutridora e o Radar já fazem. Sem
custo, sem risco de o modelo inventar prazo.

### Canal único no aviso ao gestor

Muda só o texto montado em `mag-avisar-equipe.json`. Passa a conter:

- a instrução explícita: **responder pelo WhatsApp da Magma**, não pelo
  número pessoal;
- o número do contato isolado numa linha própria (copiável no celular);
- o motivo do handoff (já existe).

Fica registrado como **limitação conhecida**: isso é orientação, não
trava — nada impede o gestor de responder do celular dele. Uma trava real
exigiria caixa de entrada compartilhada, que é assunto de outra spec
(e provavelmente de outro produto).

### Pagamento neutro × objeção de preço

Vai no `systemMessage`, junto da spec 024 (mesmo arquivo — **as duas specs
tocam o mesmo texto, coordenar a ordem de implementação**). O critério em
uma linha:

- *"Como pago? / dá pra parcelar? / aceita PIX?"* → **responde pelo FAQ**,
  sem escalar.
- *"tá caro / tá salgado / tem desconto? / consegue fazer por menos?"* →
  **escala**, porque quem decide preço é a escola, não a MAG.

Confirmado pelo Daniel como comportamento desejado, não como bug.

## Riscos

- **Base de leads com registros magros** (só WhatsApp). Aceito
  conscientemente — ver acima.
- **Voltar a atender quem o gestor já está atendendo**, quando o prazo
  expira. Mitigação: a MAG retoma reconhecendo o histórico (a memória do
  Redis tem TTL 6h, então em 24h ela já perdeu o contexto — o retorno tem
  que ser explicitamente humilde, não fingir que lembra).
- **Duas specs no mesmo `systemMessage`** (024 e 025). Implementar em
  sequência, nunca em paralelo, e reexportar o JSON uma vez só no fim.
