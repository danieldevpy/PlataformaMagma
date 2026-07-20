# Plan 009 — como fazer

> Referências: `docs/subsistemas/02b-agente-whatsapp-n8n.md` (§3 papéis, §7
> ações novas), spec 005 (Camada de Ações — mecanismo já pronto, reusado
> aqui sem mudança).

## Toques no sistema

| Camada | O que muda | Referência |
|---|---|---|
| Modelos/migrations | Nenhum — `contas.Usuario` já tem `whatsapp` e `papel` (gestor/instrutor) | `docs/plataforma/02` |
| API | Ação nova `nucleo:identificar_contato` (via `/api/acoes/executar/`, endpoint já existe) | `docs/plataforma/03` (registrar a ação na mesma PR) |
| n8n | Workflow `MAG - Fase 0 (eco WhatsApp)` (já existe, criado via `n8n-mcp`) ganha um nó HTTP Request pra `/api/acoes/executar/` antes do nó de resposta | `plataforma/evolution/README.md` |

## Sem modelo novo (descoberto na implementação)

O plano original desenhava um `OperadorWhatsApp` novo, mas `contas.Usuario`
**já tem** `whatsapp` (`CharField`) e `papel` (`Papel.GESTOR` /
`Papel.INSTRUTOR`) — exatamente o que a ação precisa. Criar um modelo
paralelo duplicaria dado (dois lugares pra manter o telefone do mesmo
usuário sincronizado) sem ganho. Daniel só precisa preencher o campo
`whatsapp` do seu próprio `Usuario` no admin — campo já existe, zero
migration.

## Ação (`apps/nucleo/acoes_contato.py` — módulo próprio pra não colidir com
o `apps/nucleo/acoes.py` de infra do registry; `NucleoConfig` ganha
`ready()` importando ele, mesmo padrão de `cursos`/`avaliacoes`/`midia`)

`identificar_contato(params, request)`, escopo `nucleo:identificar_contato`:

- `numero = (params.get("numero") or "").strip()` — só dígitos, sem
  `@s.whatsapp.net` (quem chama, o n8n, já faz o `.split('@')[0]`, como no
  workflow eco atual).
- Resolve em ordem: `Usuario.objects.filter(whatsapp=numero,
  is_active=True).first()` → papel = `usuario.papel` (`"gestor"` ou
  `"instrutor"`, direto do `TextChoices` existente), nome =
  `usuario.get_full_name() or usuario.username`; senão
  `Lead.objects.filter(whatsapp=numero).first()` (campo já existe em
  `apps/leads/models.py`) → papel `"lead"`, nome = `lead.nome`; senão papel
  `"desconhecido"`, nome `None`.
- Nunca levanta `ErroAcao` por "não encontrado" — desconhecido é uma
  resposta válida, não um erro (mesma filosofia de "nenhum dado inventado"
  do guia de marca).

## n8n (workflow `MAG - Fase 0 (eco WhatsApp)`, id `ypeJKZLsGq1WxkQB` já
criado nesta sessão via `n8n-mcp`)

Entre "Extrair dados" e "Responder no WhatsApp": nó HTTP Request novo
chamando `POST http://host.docker.internal:8000/api/acoes/executar/` (dev —
Django roda no host via `runserver`, mesmo padrão já usado pro n8n dev
alcançar o backend; endereço muda pra `http://backend:8000/...` em prod,
mesma rede do compose) com header `X-Agente-Token` (token do
`agente-recepcionista-mag`) e body `{"acao": "identificar_contato",
"params": {"numero": "={{$json.numero}}"}}`; o nó de resposta passa a usar
o `papel`/`nome` devolvido pra montar a mensagem em vez do texto fixo de eco
atual.

## Decisões desta feature

- Escopo do token do roteador fica só em `nucleo:identificar_contato` (não
  `*`) — princípio de menor privilégio já estabelecido na spec 005; cada
  agente novo do plano (SDR, Nutridora etc.) ganha token próprio quando
  nascer.
- "Desconhecido" é resposta válida da ação, não erro — evita a MAG inventar
  dado ou travar quando não reconhece o número.

## Riscos / pontos de atenção

- Migration do `OperadorWhatsApp` roda em SQLite (dev) e MySQL (prod) sem
  diferença de comportamento (campo simples, sem JSONField — baixo risco).
- O nó IF do workflow n8n hoje só responde ao número de teste `991920338`
  (filtro adicionado durante os testes desta sessão). Ao ligar pra
  produção essa restrição sai (ou vira allowlist editável — mas isso é
  `RegraAgente`, Fase 1).
