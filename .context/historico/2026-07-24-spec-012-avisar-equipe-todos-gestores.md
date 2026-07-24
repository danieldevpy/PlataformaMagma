# 2026-07-24 (continuação) — Spec 012 (adendo): avisar_equipe pra todos os gestores

## Prompt do Daniel

Depois de perguntar sobre o resumo diário mandar pra todos os gestores, o
Daniel confirmou que em produção vão existir 2 gestores e pediu pra
buscar a lista no backend também — e antes de fechar a sessão, pediu
explicitamente pra corrigir o mesmo problema no `avisar_equipe`
(handoff), que eu tinha registrado como lacuna conhecida fora de escopo
do adendo anterior (spec 019-T9).

## O problema específico

`avisar_equipe` é diferente do Radar: não é um pipeline linear
(`HTTP Request → Code → HTTP Request`), é uma **tool chamada pelo
raciocínio do AI Agent** (`toolHttpRequest`, dentro da SDR). Isso limita
a correção — não dá pra simplesmente inserir um `HTTP Request` +
`Split Out` no meio, porque não existe "meio": o tool faz UMA chamada
HTTP e devolve o resultado pro LLM continuar.

## Solução

Sub-workflow novo `MAG - Avisar Equipe` (`mag-avisar-equipe.json`,
id `8PELlklNlOVVrTl9`) — um mini-pipeline igual ao do Radar, só que
disparado por `Webhook` (`responseMode: lastNode`, pra devolver resposta
só depois de mandar as mensagens todas) em vez de `Schedule Trigger`:

```
Webhook (POST /webhook/avisar-equipe, recebe {mensagem})
  → HTTP Request: listar_gestores
  → Split Out: separar por gestor
  → HTTP Request: Evolution sendText (number = gestor.whatsapp, text = mensagem)
```

O node `avisar_equipe` dentro do SDR (`mag-fase-0-sdr.json`) só mudou 2
campos: `url` (de `http://evolution-api:8080/message/sendText/...` pra
`http://localhost:5678/webhook/avisar-equipe` — **o n8n chamando a si
mesmo**) e `jsonBody` (`{"mensagem": "{mensagem}"}`, sem mais o `number`
fixo). `toolDescription` e `placeholderDefinitions` ficaram idênticos, e
o system prompt do SDR não precisou mudar nada — pro LLM, a tool continua
tendo exatamente a mesma interface de antes.

**Por que essa URL funciona igual em dev e prod sem nenhuma config**:
`localhost:5678` é sempre a porta interna do próprio container n8n,
independente de nginx, hostname externo ou qualquer coisa — não é uma
URL "de fora", é o n8n falando com ele mesmo. Registrado como novo
padrão no `plataforma/n8n/workflows/README.md` (seção "Por que dá pra
usar o mesmo arquivo em dev e prod").

## Teste real completo

Simulei um pedido de matrícula ("Quero pagar agora e fechar minha
matrícula...") no número de teste. A SDR:
1. Chamou `listar_cursos` e `registrar_lead` (fluxo normal de qualificação).
2. Chamou `escalar_contato` (marca `ContatoEscalado`).
3. Chamou `avisar_equipe` com uma mensagem resumindo o pedido — a
   observação da tool trouxe a resposta **real** da Evolution API
   (`status: PENDING`), confirmando que a mensagem realmente saiu.
4. Respondeu pro lead confirmando que a equipe foi acionada — também
   confirmada via Evolution real.

Suíte completa 249/249 (a ação `listar_gestores` já tinha 4 testes da
spec 019-T9, reaproveitados aqui sem mudança).

## Estado ao sair

- Backend: sem mudança nesta parte (só reusa `listar_gestores`, já
  commitado no adendo anterior).
- n8n dev: `mag-fase-0-sdr.json` atualizado (só o node `avisar_equipe`) +
  `mag-avisar-equipe.json` novo, ambos ativos e testados com mensagem
  real.
- Dado de teste limpo: `ContatoEscalado` de teste (`5521979070319`)
  removido do banco de dev depois do teste.
- **Pendente**: promover `mag-avisar-equipe.json` pra prod **junto** com
  `mag-fase-0-sdr.json` — se subir o SDR atualizado sem esse sub-workflow
  (ou sem ele ativo), a tool `avisar_equipe` vai falhar chamando um
  webhook que não existe.
