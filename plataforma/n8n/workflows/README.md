# Workflows do agente MAG — versionados

Exportados manualmente (via n8n-mcp) a partir da instância de **dev**. Fonte
de verdade é este JSON, não o que está no editor — qualquer edição feita
direto no n8n (dev ou prod) sem atualizar este arquivo diverge silenciosamente.

| Arquivo | Workflow no n8n | Spec |
|---|---|---|
| `mag-fase-0-sdr.json` | `MAG - Fase 0 (eco WhatsApp)` | 009 (identificação), 010 (SDR), 012 (handoff) |
| `mag-nutridora-t0.json` | `MAG - Nutridora (T+0)` | 011 |

## Por que dá pra usar o MESMO arquivo em dev e prod

Todo valor que muda entre ambientes foi tirado de dentro dos nós:

- **URL do Django**: sempre `http://magma-backend-interno:8000/...` — hostname
  que os dois `docker-compose*.yml` resolvem pro lugar certo (ver
  `../README.md`). Não é env var porque o nó `toolHttpRequest` (as tools da
  IA) tem um parser de `{placeholder}` próprio que **quebra** se o campo
  `url` usar uma expression `{{ }}` do n8n — por isso a solução foi um
  hostname idêntico nos dois ambientes, não um `$env` no nó (achado
  2026-07-20, ver `.context/decisoes.md`).
- **URL da Evolution**: `http://evolution-api:8080/...` — já é igual nos dois
  ambientes (mesmo nome de serviço nos dois composes), não precisou de nada.
- **Filtro de números de teste**: os 2 nós IF que restringem quem o bot
  responde em dev usam `{{ $env.MAGMA_NUMEROS_TESTE_REGEX }}` — essa aqui É
  uma env var comum (não é campo de `toolHttpRequest`, então não tem o
  problema acima). Prod deixa a variável vazia → regex vazia casa com
  qualquer string → sem filtro.
- **Segredos** (`X-Agente-Token`, apikey da Evolution): todos os nós usam
  credencial n8n (`authentication: genericCredentialType`), nunca valor
  hardcoded. Credenciais NÃO viajam no JSON (nem deveriam) — ver checklist
  abaixo.

## Importar em prod pela primeira vez

1. No editor de prod, criar as 3 credenciais com **o mesmo nome** usadas em
   dev (nomes exatos, o import tenta casar por nome):
   - `MAG - X-Agente-Token` (Header Auth: `X-Agente-Token` = token real de um
     `TokenAgente` criado em prod, escopos `nucleo:identificar_contato` +
     `nucleo:escalar_contato` + `cursos:status_turma` +
     `avaliacoes:gerar_link_avaliacao` + `leads:listar_leads` +
     `educacional:gerar_link_matricula` + `cursos:listar_turmas` (os 5
     últimos desde a spec 013, Operadora) — ver
     `docs/plataforma/03-api-contratos.md`).
   - `MAG - Evolution apikey` (Header Auth: `apikey` = `EVOLUTION_API_KEY`
     real do `.env.prod`).
   - `MAG - Gemini` (Google Gemini/PaLM API: chave de produção).
2. Import: editor n8n → Workflows → Import from File → escolher o `.json`.
3. Abrir cada nó que usa credencial e conferir se casou sozinho pelo nome; se
   não casou, reselecionar manualmente (n8n as vezes exige isso mesmo com
   nome idêntico).
4. Nomear a instância Evolution de prod **exatamente** `Agente Whatsapp`
   (mesmo nome usado em dev) — evita ter que editar a URL em 4 nós só por
   causa do nome da instância.
5. Ativar o workflow (toggle "Active").
6. Testar com um número de teste antes de liberar geral (ver
   `docs/subsistemas/02b-agente-whatsapp-n8n.md` para o número usado em dev —
   NÃO reusar o mesmo em prod se já for número real de alguém).

## Atualizando depois de editar em dev

Reexportar (n8n-mcp `n8n_get_workflow` mode=full, montar o JSON limpo — ver
histórico em `.context/historico/` de como foi feito da primeira vez) e
substituir o arquivo aqui. Repetir o import em prod (passo 2-3 acima) quando
for promover a mudança.
