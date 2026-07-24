# Workflows do agente MAG — versionados

Exportados manualmente (via n8n-mcp) a partir da instância de **dev**. Fonte
de verdade é este JSON, não o que está no editor — qualquer edição feita
direto no n8n (dev ou prod) sem atualizar este arquivo diverge silenciosamente.

| Arquivo | Workflow no n8n | Spec |
|---|---|---|
| `mag-fase-0-sdr.json` | `MAG - Fase 0 (eco WhatsApp)` | 009 (identificação), 010 (SDR), 012 (handoff), 017 (info institucional) |
| `mag-nutridora-t0.json` | `MAG - Nutridora (T+0)` | 011 |
| `mag-radar-resumo-diario.json` | `MAG - Radar (resumo diário)` | 019 — dispara por `Schedule Trigger` (cron, não webhook); sem AI Agent, é relatório factual formatado por código; manda pra **todos** os gestores (busca `listar_gestores` no backend, adendo 019-T9), não mais número fixo |
| `mag-nutridora-t1-t3-t7.json` | `MAG - Nutridora (T+1/3/7)` | 020 — `Schedule Trigger` diário; sem AI Agent; usa `Split Out` (`n8n-nodes-base.splitOut`) pra transformar o array de leads elegíveis em N itens antes do envio |
| `mag-avisar-equipe.json` | `MAG - Avisar Equipe` | 012, adendo 019-T9 — sub-workflow chamado pela tool `avisar_equipe` do SDR (dentro de `mag-fase-0-sdr.json`) via `toolHttpRequest` apontando pro próprio n8n (`http://localhost:5678/webhook/avisar-equipe`); busca `listar_gestores` e manda a notificação de handoff pra cada um, em vez de um número fixo |

`mag-radar-resumo-diario.json`, `mag-nutridora-t1-t3-t7.json` e
`mag-avisar-equipe.json` reusam as mesmas credenciais `MAG - X-Agente-Token`
e `MAG - Evolution apikey` dos outros workflows (não precisam de
`MAG - Gemini` — nenhum tem AI Agent). Nenhum dos três está em
`ids-prod.json` ainda (nunca foram promovidos) — na primeira promoção,
seguir a seção "Importar em prod pela primeira vez" abaixo pra cada
arquivo. `mag-radar-resumo-diario.json` e `mag-nutridora-t1-t3-t7.json`
precisam ser **ativados manualmente** depois de importar (workflows com
`Schedule Trigger` não disparam sozinhos se ficarem inativos);
`mag-avisar-equipe.json` também precisa estar ativo (é chamado por
webhook a qualquer momento, não só por cron). **`mag-nutridora-t1-t3-t7.json`
é prioridade alta pra promover** — a campanha de tráfego pago (spec 018)
pode trazer leads reais a qualquer momento, e sem esse workflow em prod
eles só recebem o T+0 e depois silêncio. **`mag-avisar-equipe.json` é
pré-requisito de `mag-fase-0-sdr.json`** — se promover o SDR sem promover
esse sub-workflow junto (e sem ativá-lo), a tool `avisar_equipe` do
handoff vai falhar (chamando um webhook que não existe em prod).

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
- **URL do sub-workflow `avisar_equipe`**: `http://localhost:5678/webhook/avisar-equipe`
  — o n8n chamando a si mesmo (mesmo container, mesma porta interna em
  qualquer ambiente), então nunca muda entre dev e prod. Padrão adotado
  pra contornar a mesma limitação do `toolHttpRequest` (não dá pra usar
  `{{ }}` no campo `url`): em vez de fazer o tool falar direto com a
  Evolution (que exigiria repetir a lógica de "buscar todos os gestores"
  dentro de cada tool que precisa avisar alguém), o tool chama um
  workflow pequeno (`mag-avisar-equipe.json`) que faz isso uma vez só.
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
     últimos desde a spec 013, Operadora) + `educacional:buscar_aluno` +
     `educacional:matricular_aluno` + `educacional:listar_matriculas_turma`
     (spec 014, Fase B — Operadora ganha matrícula pelo WhatsApp e a lista
     de quem está matriculado numa turma) + `financeiro:gerar_cobranca` +
     `financeiro:consultar_pagamento` (spec 015 — Operadora gera link de
     pagamento Asaas e consulta status pelo WhatsApp; exige também
     `ConfiguracaoAsaas` de produção cadastrada, ver `.context/status.md`) +
     `nucleo:info_institucional` (spec 017 — SDR responde endereço/
     Instagram/e-mail sem inventar) + `nucleo:resumo_diario` (spec 019 —
     Radar diário) + `leads:processar_nutridora` (spec 020 — régua
     T+1/3/7) + `nucleo:listar_gestores` (spec 019-T9 — Radar manda pra
     todos os gestores, não só um número fixo) —
     ver `docs/plataforma/03-api-contratos.md`).
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

1. Reexportar do dev (n8n-mcp `n8n_get_workflow` mode=full, montar o JSON
   limpo — ver histórico em `.context/historico/` de como foi feito da
   primeira vez) e substituir o arquivo aqui (`git add`/commit normal).
2. Promover pra prod com o script — **um comando**, sem precisar reabrir o
   editor nem redescobrir nada:
   ```bash
   plataforma/n8n/workflows/promover-prod.sh mag-fase-0-sdr.json
   ```
   O script (`promover-prod.sh` + `_montar_json_prod.py`) faz o que antes
   era manual: injeta o `id` do workflow já existente em prod (import
   atualiza em vez de duplicar), remapeia os IDs de credencial pelos nomes
   (cada instância n8n tem os seus próprios IDs, mesmo com credenciais de
   nome idêntico ao de dev), importa, publica e reinicia o n8n de prod pra
   aplicar. **Derruba o processamento de webhook por alguns segundos**
   (reinício do container) — teste manualmente com uma mensagem de teste
   depois de rodar, antes de considerar terminado.
3. Os IDs usados pelo script ficam em [`ids-prod.json`](ids-prod.json)
   (não são segredos, só identificadores de linha do banco — o segredo de
   verdade, o valor da credencial, nunca sai de dentro do n8n). Só precisa
   mexer nesse arquivo se um workflow ou credencial for **recriado do
   zero** em prod (ver seção abaixo).

### Descobrir um ID novo (só se recriar workflow/credencial em prod)

Workflow: `docker exec plataforma-n8n-1 n8n list:workflow` (na VPS).

Credencial — consulta direta no SQLite do n8n, só id/nome/tipo (nunca
decifra o valor):
```bash
docker exec plataforma-n8n-1 node -e "
const sqlite3 = require('/usr/local/lib/node_modules/n8n/node_modules/.pnpm/sqlite3@5.1.7/node_modules/sqlite3');
const db = new sqlite3.Database('/home/node/.n8n/database.sqlite', sqlite3.OPEN_READONLY);
db.all('SELECT id, name, type FROM credentials_entity', (err, rows) => {
  rows.forEach(r => console.log(r.id, '|', r.name, '|', r.type));
});
"
```
(O caminho do `sqlite3` dentro do pnpm store pode mudar entre versões do
n8n — se o `require` falhar, `find /usr/local/lib/node_modules/n8n -iname
'*sqlite3*' -type d` acha o caminho certo.) Atualizar `ids-prod.json` com
o novo ID e commitar.
