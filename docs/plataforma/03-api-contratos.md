# 03 · Contratos da API

> Prefixo: `/api/`. Público = sem auth, cacheável. Painel = JWT + papel.
> Este doc é o contrato: o front tipa (TypeScript) a partir daqui.

## Públicos (consumidos pelo site)

### `GET /api/site/config/`
```json
{
  "whatsapp_principal": "5521964946079",
  "instagram": "@magma_curso",
  "email": "curso.magma21@gmail.com",
  "endereco": "Rua Nossa Senhora de Fátima, 495 — Olinda, Nilópolis/RJ",
  "nota_google": 4.9,
  "exibir_nota_google": true,
  "total_alunos_formados": 500,
  "exibir_total_formados": true
}
```

### `GET /api/cursos/` — lista para a home (só `status=publicado`)
```json
[
  {
    "slug": "socorrista-aph",
    "nome": "Socorrista APH",
    "carga_horaria": 120,
    "subtitulo": "Formação completa em Atendimento Pré-Hospitalar...",
    "imagem_hero": "https://.../media/cursos/hero/aph.jpg",
    "turma_destaque": { "codigo": "03/2026", "status": "inscricoes" }
  }
]
```

### `GET /api/cursos/{slug}/` — payload completo da LP
```json
{
  "slug": "socorrista-aph",
  "nome": "Socorrista APH",
  "titulo_venda": "Em 120 horas você estará pronto para salvar vidas — e viver disso",
  "titulo_destaque": "salvar vidas",
  "subtitulo": "A formação de Socorrista APH mais prática da Baixada...",
  "imagem_hero": "https://.../hero-rcp.jpg",
  "carga_horaria": 120,
  "formato": "Presencial",
  "dias_e_horario_padrao": "Sábados, 09h–16h",
  "texto_pratica": "...",
  "imagem_pratica": "https://.../pratica.jpg",
  "texto_carreira": "...",
  "imagem_carreira": "https://.../ambulancia.jpg",
  "itens_inclusos": ["120 horas de formação presencial", "Prática inclusa", "..."],
  "saidas_profissionais": ["Ambulâncias e remoções", "Eventos e shows", "..."],
  "habilidades": [
    {"ordem": 1, "icone": "rcp", "titulo": "RCP e DEA", "descricao": "..."}
  ],
  "faqs": [
    {"ordem": 1, "pergunta": "Preciso ter formação...?", "resposta": "Não. ..."}
  ],
  "fotos": [                                // galeria do curso (carrossel do /avaliar/[token], ver doc 05)
    {"ordem": 1, "imagem": "https://.../galeria/foto1.jpg", "legenda": "Prática de RCP"}
  ],
  "instrutores": [
    {"nome": "João Paulo Bello dos Santos", "registro": "COREN-RJ 525874-ENF",
     "especializacao": "Enfermagem Neonatal e Pediátrica", "foto": "https://..."}
  ],
  "turma_destaque": {
    "codigo": "03/2026",
    "status": "inscricoes",
    "inicio_aulas": "2026-03-07",
    "exibir_inicio": true,
    "dias_e_horario": "Sábados, 09h–16h",
    "vagas_restantes": 8,
    "exibir_vagas": true,
    "countdown": {                          // null quando desativado/expirado
      "ate": "2026-02-20T23:59:59-03:00",
      "rotulo": "Condição de matrícula antecipada encerra em"
    },
    "preco": {                              // null quando exibir_preco=false
      "cheio": 1200.00,
      "avista": 990.00,
      "parcelas_qtd": 12,
      "parcela_valor": 99.00,
      "obs": "PIX com desconto à vista"
    }
  },
  "avaliacoes": [                           // aprovadas, ordem: -peso, -estrelas, -data
    {"nome": "Marcos Ribeiro", "cargo_atual": "Socorrista em eventos",
     "estrelas": 5, "comentario": "...", "foto": null, "turma_codigo": "2025"}
  ],
  "seo": {"titulo": "...", "descricao": "..."}
}
```

**Regras no serializer:**
- `countdown`: já sai `null` se `exibir_countdown=false` OU `countdown_ate < agora` — o front não decide regra de negócio.
- `preco`: `null` se `exibir_preco=false` → front mostra "Consulte condições".
- `avaliacoes`: máx. 6, apenas `status=aprovada`.

### `POST /api/leads/`
```json
// request
{"nome": "Maria", "curso_slug": "socorrista-aph", "quando_pretende": "O quanto antes",
 "utm_source": "instagram", "utm_campaign": "bio", "pagina_origem": "/cursos/socorrista-aph"}
// response 201
{"ok": true, "whatsapp_url": "https://wa.me/5521964946079?text=..."}
```
O back monta a mensagem do WhatsApp (fonte única) e devolve pronta.

### Magic link de avaliação
```
GET  /api/avaliacoes/convite/{token}/     → dados p/ montar a página
POST /api/avaliacoes/convite/{token}/     → cria a avaliação
```
```json
// GET 200
{"valido": true, "curso": "Socorrista APH", "turma_codigo": "2025",
 "nome_aluno": "Marcos Ribeiro",
 "fotos": [{"ordem": 1, "imagem": "https://.../galeria/foto1.jpg", "legenda": "Prática de RCP"}]}
// turma_codigo é null quando o convite não está preso a uma turma específica
// fotos vem de curso.fotos (a avaliação é do curso, não da turma — ele roda várias turmas)
// GET quando inválido → 200 {"valido": false, "motivo": "expirado" | "usado" | "inexistente"}

// POST request
{"nome": "Marcos Ribeiro", "estrelas": 5, "comentario": "...", "cargo_atual": "Socorrista"}
// POST 201 → {"ok": true}   (marca convite.usado_em; status inicial: pendente)
```

## Painel (JWT — `Authorization: Bearer`)

```
POST /api/token/            {username, password} → {access, refresh}

# Cursos e turmas (gestor + instrutor)
GET/PATCH        /api/painel/cursos/{slug}/
POST             /api/painel/cursos/
CRUD             /api/painel/cursos/{slug}/habilidades/  (idem faqs/)
GET/POST         /api/painel/turmas/?curso={slug}
PATCH            /api/painel/turmas/{id}/                # inclui toggles e preço
POST             /api/painel/turmas/{id}/anotacoes/

# Avaliações (gestor)
GET  /api/painel/avaliacoes/?status=pendente
PATCH /api/painel/avaliacoes/{id}/          {"status": "aprovada", "peso": 80}
POST /api/painel/convites/                  {"curso": "socorrista-aph", "turma": 12,
                                             "nome_aluno": "Marcos"}
      → 201 {"url": "https://site/avaliar/3f2b...", "whatsapp_share":
              "https://wa.me/?text=Oi%20Marcos!%20..."}

# Leads (gestor)
GET   /api/painel/leads/?status=novo
PATCH /api/painel/leads/{id}/               {"status": "em_contato"}

# Config
GET/PATCH /api/painel/config/
```

## Studio 2.0 — Mídia, IA e Camada de Ações

> Fonte de verdade: código de `apps/midia`, `apps/ia` e `apps/nucleo`
> (specs `003-studio-templates-campanha`, `004-ia-config-e-texto` e
> `005-camada-de-acoes`). Auth Session/JWT = mesma cookie/Bearer do painel.

### `GET /api/midia/turmas/{id}/avaliacoes/` — picker de depoimentos

Auth: Session ou JWT, `IsGestorOuInstrutor`. Alimenta o picker do template
Depoimento no Studio: avaliações **aprovadas** da turma, ordenadas por
`-estrelas, -peso, -criado_em`. Sem filtros de query string — a view
sempre devolve a lista completa filtrada por turma+status.

```bash
curl -H "Authorization: Bearer $JWT" \
  https://.../api/midia/turmas/12/avaliacoes/
```
```json
// 200
[
  {"id": 41, "nome": "Marcos Ribeiro", "cargo_atual": "Socorrista em eventos",
   "estrelas": 5, "comentario": "...", "criado_em": "2026-06-01T14:00:00-03:00"}
]
// turma inexistente → 404 {"detail": "Not found."} (get_object_or_404 padrão DRF)
// apps.avaliacoes fora do INSTALLED_APPS (cenário defensivo) → 200 []
```

### Acervo em camadas (spec 008)

Auth: Session ou JWT, `IsGestorOuInstrutor` (todas). O acervo é da MARCA,
organizado em camadas (`turma | curso | instrutores | estrutura | externa |
geral`); as rotas por turma (`turmas/{id}/…`) seguem valendo com o contrato
antigo. Invariantes: camada `turma` ⇔ `turma_id`; camada `curso` ⇔
`curso_id`; demais camadas sem nenhum dos dois (violação → 400). Itens agora
saem com `camada`, `contexto` (rótulo humano) e `credito` (fonte/licença de
imagem externa — editável no `PATCH itens/{pk}/`).

#### `GET /api/midia/acervo/` — listar com filtros

Query string combinável: `camada`, `curso` (id), `turma` (id), `tipo`
(`foto|video|arte`), `tag` (`destaque|capa|avaliacao`), `q` (busca na
legenda). Sem filtro → tudo, mais novo primeiro (com `turma` → ordem de
curadoria `ordem,id`).

```json
// 200
{"itens": [{"id": 7, "camada": "geral", "contexto": "Geral da marca",
            "tipo": "foto", "arquivo_url": "...", "thumb_url": "...",
            "legenda": "", "credito": "", "tags": [], "ordem": 0,
            "aula_data": null, "origem": "instrutor", "meta": {...},
            "criado_em": "..."}],
 "contagens": {"fotos": 1, "videos": 0, "artes": 0,
               "destaque": 0, "capa": 0, "avaliacao": 0}}
```

#### `GET /api/midia/acervo/camadas/` — resumo pros seletores

Contagens por camada fixa (Geral primeiro — é o balde padrão), por curso e
por turma, INCLUINDO as vazias (são alvo válido de upload).

```json
// 200
{"gerais": [{"camada": "geral", "rotulo": "Geral da marca",
             "contagens": {"fotos": 1, "videos": 0, "artes": 0}}, ...],
 "cursos": [{"id": 2, "nome": "Socorrista APH", "slug": "socorrista-aph",
             "contagens": {...}}],
 "turmas": [{"id": 4, "codigo": "027", "curso": "Socorrista APH",
             "contagens": {...}}]}
```

#### `POST /api/midia/acervo/enviar/` — upload em qualquer camada

Multipart: `arquivo` (1 por request, image/video, máx 1 GB), `camada`,
`turma_id`/`curso_id` (conforme invariantes), `legenda`, `credito`,
`aula_data`, `forcar`. Dedup nome+tamanho **no escopo da camada de destino**
(mesmo arquivo em camadas diferentes NÃO é duplicata) → 409
`{duplicado: true, item_existente}`.

#### `GET/POST /api/midia/postagens/` — postagens multi-contexto

- `GET` filtra por `turma`, `curso` ou `contexto=marca` (sem turma nem
  curso). `PostagemOut` ganhou `contexto` (rótulo: "Turma … — curso", nome
  do curso ou `"Marca"`).
- `POST` multipart: `titulo`, `legenda`, `artes` (N PNGs) + `turma_id` OU
  `curso_id` opcionais (os dois juntos → 400; nenhum = postagem da marca).
  As artes entram no acervo na camada do contexto (`turma`/`curso`/`geral`).

#### Ação `listar_postagens_agendadas` (executor central)

Cada item agora traz `contexto` (`"turma"|"curso"|"marca"`) + `turma_codigo`
e `curso_slug` (null quando não se aplicam; `turma_codigo` mantido por
compat). Continua sem PK no retorno.

#### Páginas staff da marca

`/dj-admin/midia/midia/acervo/` (Mesa de Luz da marca, com seletor de
camada, sem toggle de consentimento — consentimento é conceito de turma) e
`/dj-admin/midia/midia/studio/` (Studio da marca — templates com
`requer: ['turma']` aparecem desabilitados). Servidas via
`MidiaAdmin.get_urls`, mesmos templates das páginas por turma.

### `GET /api/ia/capacidades/` — quais recursos de IA estão ligados

Auth: Session ou JWT, `IsGestorOuInstrutor`. Reflete só provedores **ativos
e já testados** (`testado_em` preenchido) — provedor cadastrado mas nunca
testado não acende a capacidade. Capacidades hoje: `texto.gerar`,
`texto.melhorar`, `texto.variacoes`, `imagem.melhorar`,
`imagem.remover_fundo`, `imagem.gerar`, `video.gerar` — as 4 últimas
sempre `false` no código atual (nenhum adaptador de imagem/vídeo
implementado ainda, ver "Divergências" abaixo).

```bash
curl -H "Authorization: Bearer $JWT" https://.../api/ia/capacidades/
```
```json
// 200
{"texto.gerar": true, "texto.melhorar": true, "texto.variacoes": true,
 "imagem.melhorar": false, "imagem.remover_fundo": false,
 "imagem.gerar": false, "video.gerar": false}
```

### `POST /api/ia/executar/` — proxy de execução (chave nunca no browser)

Auth: Session ou JWT, `IsGestorOuInstrutor`. `contexto` segue o formato
livre de `apps/ia/prompts.py::montar_mensagem` — campos conhecidos
`tipo_conteudo`, `template`, `turma`, `curso`, `texto_atual` (obrigatório
em `texto.melhorar`/`texto.variacoes` na prática, mas não validado no
schema), `instrucao`; campos extras são aceitos e apenas anexados ao
prompt. Toda chamada (sucesso ou erro) grava `ExecucaoIA`.

```bash
curl -X POST -H "Authorization: Bearer $JWT" -H "Content-Type: application/json" \
  -d '{"capacidade": "texto.melhorar",
       "contexto": {"tipo_conteudo": "legenda", "template": "depoimento",
                     "turma": "03/2026", "texto_atual": "Texto atual aqui...",
                     "instrucao": "deixar mais informal"}}' \
  https://.../api/ia/executar/
```
```json
// 200
{"resultado": "Texto reescrito pronto pra colar no post..."}

// 400 — erro de INPUT do chamador (capacidade/contexto mal formados, ou
// nenhum provedor do tipo certo ativo+testado, ou provedor não sabe
// executar aquela capacidade)
{"detail": "Informe 'capacidade'."}
{"detail": "'contexto' precisa ser um objeto."}
{"detail": "Capacidade \"texto.xyz\" desconhecida."}
{"detail": "Nenhum provedor de Texto configurado e testado. Configure em Integrações de IA."}
{"detail": "O provedor configurado não sabe executar \"texto.gerar\"."}

// 502 — erro do PROVEDOR (chamada saiu, mas falhou ou o adaptador
// quebrou) — nunca vaza stack trace nem payload cru do provedor
{"detail": "Anthropic recusou a chamada: <mensagem do provedor>"}
{"detail": "Erro inesperado ao executar a IA."}
```

### `GET/POST /api/ia/provedores/` e `PATCH /api/ia/provedores/{pk}/`

Auth: Session ou JWT, `IsGestorOuInstrutor`. Página staff "Integrações de
IA". A credencial **nunca** volta em texto puro — só o booleano
`tem_credencial`. Escrita usa `credencial_nova` (write-only): obrigatória
no POST (criação), opcional no PATCH — **em branco/ausente no PATCH
mantém a chave já salva** (mesmo padrão do `ProvedorIAForm` do admin).
Ativar um provedor desativa automaticamente os demais do mesmo `tipo`
(`ProvedorIA.save`, não é regra só de UI).

> ⚠️ **Operação:** a credencial é cifrada com uma chave derivada do
> `DJANGO_SECRET_KEY` (`apps/ia/crypto.py`). Rotacionar o `SECRET_KEY` em
> produção invalida **silenciosamente** todas as credenciais já salvas
> (`decifrar()` passa a devolver `""`, sem erro) — recadastre as chaves
> aqui depois de qualquer rotação de `SECRET_KEY`.

```bash
# listar
curl -H "Authorization: Bearer $JWT" https://.../api/ia/provedores/

# criar
curl -X POST -H "Authorization: Bearer $JWT" -H "Content-Type: application/json" \
  -d '{"tipo": "texto", "provedor": "anthropic", "modelo": "claude-sonnet-5",
       "credencial_nova": "sk-ant-...", "ativo": true}' \
  https://.../api/ia/provedores/

# editar sem trocar a chave (credencial_nova omitido/"")
curl -X PATCH -H "Authorization: Bearer $JWT" -H "Content-Type: application/json" \
  -d '{"modelo": "claude-sonnet-5", "config": {"max_tokens": 2048}}' \
  https://.../api/ia/provedores/3/
```
```json
// 200/201 (mesmo shape de leitura)
{"id": 3, "tipo": "texto", "tipo_label": "Texto", "provedor": "anthropic",
 "provedor_label": "Anthropic", "modelo": "claude-sonnet-5",
 "config": {"max_tokens": 2048}, "ativo": true,
 "testado_em": "2026-07-18T10:00:00-03:00", "criado_em": "2026-07-01T09:00:00-03:00",
 "tem_credencial": true}

// 400 (criação sem chave)
{"credencial_nova": ["Informe a chave de API."]}
```

### `POST /api/ia/provedores/{pk}/testar/` — testar conexão real

Auth: Session ou JWT, `IsGestorOuInstrutor`. Faz uma chamada mínima real
ao provedor; só grava `testado_em` (now) se a chamada funcionar.

```bash
curl -X POST -H "Authorization: Bearer $JWT" https://.../api/ia/provedores/3/testar/
```
```json
// 200
{"testado_em": "2026-07-18T10:00:00-03:00"}
// 400 — erro de input/credencial (ex. sem chave configurada, provedor sem adaptador)
{"detail": "Provedor Anthropic sem credencial configurada."}
// 502 — falha inesperada não classificada como ErroAdaptadorIA
{"detail": "Erro inesperado ao testar a conexão."}
```

### `GET /api/ia/uso/` — card de uso do mês corrente

Auth: Session ou JWT, `IsGestorOuInstrutor`. Contagens de `ExecucaoIA`
desde o dia 1 do mês corrente (sem filtro por período na query string).

```bash
curl -H "Authorization: Bearer $JWT" https://.../api/ia/uso/
```
```json
// 200
{"mes_referencia": "2026-07", "execucoes": 42, "execucoes_ok": 39,
 "execucoes_erro": 3, "tokens_entrada": 18400, "tokens_saida": 6200}
```

### `GET /api/acoes/` — catálogo de ações (registry + descritivo do midia)

Auth: Session/JWT (gestor ou instrutor) **ou** header `X-Agente-Token`
(qualquer token de agente ativo — o catálogo é a "documentação viva"; o
filtro por escopo só entra na hora de **executar**). Devolve o registry
central (ações executáveis via `/api/acoes/executar/`) concatenado com o
`CATALOGO_ACOES` do `midia` (descritivo — rotas REST próprias, não passam
pelo executor).

```bash
curl -H "X-Agente-Token: $TOKEN_AGENTE" https://.../api/acoes/
```
```json
// 200 — cada item do registry central:
[
  {"nome": "gerar_link_avaliacao",
   "descricao": "Devolve o link público de avaliação da turma (escopo turma, compartilhável) — reusa um convite válido existente ou cria um novo.",
   "parametros": {"turma_codigo": "string, código da turma"},
   "escopo": "avaliacoes:gerar_link_avaliacao",
   "executavel": true, "metodo": "POST", "rota": "/api/acoes/executar/"},
  {"nome": "status_turma", "descricao": "Devolve curso, status, datas e contagens (mídias/postagens/avaliações) de uma turma.",
   "parametros": {"turma_codigo": "string, código da turma"},
   "escopo": "cursos:status_turma",
   "executavel": true, "metodo": "POST", "rota": "/api/acoes/executar/"},
  {"nome": "listar_postagens_agendadas",
   "descricao": "Lista as postagens com `agendada_para` preenchido (fila pro Manus publicar), da mais próxima pra mais distante no futuro.",
   "parametros": {}, "escopo": "midia:listar_postagens_agendadas",
   "executavel": true, "metodo": "POST", "rota": "/api/acoes/executar/"},
  {"nome": "identificar_contato",
   "descricao": "Resolve o papel de quem está falando no WhatsApp (gestor/instrutor via Usuario, lead via Lead, ou desconhecido) a partir do número, e se o contato está escalado (silenciado até liberação manual).",
   "parametros": {"numero": "string, só dígitos com DDI (sem @s.whatsapp.net)"},
   "escopo": "nucleo:identificar_contato",
   "executavel": true, "metodo": "POST", "rota": "/api/acoes/executar/"},
  {"nome": "escalar_contato",
   "descricao": "Marca um número como escalado pro humano — a MAG para de responder automaticamente até alguém da equipe liberar (apagar o registro no admin).",
   "parametros": {"numero": "string, só dígitos com DDI", "motivo": "string, por que está escalando"},
   "escopo": "nucleo:escalar_contato",
   "executavel": true, "metodo": "POST", "rota": "/api/acoes/executar/"},
  // ... + itens do CATALOGO_ACOES do midia (executavel: false), ex.:
  {"nome": "listar_avaliacoes_turma", "descricao": "...", "parametros": {},
   "escopo": null, "executavel": false, "metodo": "GET",
   "rota": "/api/midia/turmas/<id>/avaliacoes/"}
]
```

### `POST /api/acoes/executar/` — executor central

Auth: Session/JWT (gestor/instrutor sempre autorizado) **ou**
`X-Agente-Token` (autorizado só se o escopo do token cobrir o escopo
declarado da ação — ver "Auth por token de agente" abaixo). Body:
`{"acao": "<nome>", "params": {...}}`. **Toda** execução (sucesso e erro)
grava `LogAcao` (`acao`, `params`, `status`, `resultado_resumo` ou `erro`,
`usuario` ou `agente`).

Ações v1 registradas:

| Ação | App | Escopo | Params | Retorno |
|---|---|---|---|---|
| `gerar_link_avaliacao` | avaliacoes | `avaliacoes:gerar_link_avaliacao` | `turma_codigo` | `{turma_codigo, url, expira_em}` — reusa convite de escopo turma ainda válido; cria um novo só se não houver |
| `status_turma` | cursos | `cursos:status_turma` | `turma_codigo` | `{turma_codigo, curso, status, inicio_aulas, capacidade, vagas_restantes, matriculas, midias, postagens, avaliacoes}` — `matriculas` conta só `Matricula` com status `ativa`\|`concluida` (convite de escopo turma ainda não preenchido não conta) |
| `listar_turmas` | cursos | `cursos:listar_turmas` | `status` (opcional, exato) | lista de `{turma_codigo, curso, status, inicio_aulas, capacidade, vagas_restantes}` (sem `id`), mais recente primeiro — pra achar o código de uma turma sem lembrar de cabeça |
| `listar_postagens_agendadas` | midia | `midia:listar_postagens_agendadas` | `{}` | lista de `{turma_codigo, titulo, legenda, canal, status, agendada_para}` (sem `id` — PK nunca é identificador público, constituição §6; `turma_codigo` + `agendada_para` já identificam a postagem sem ambiguidade prática), ordenada por `agendada_para` asc |
| `identificar_contato` | nucleo | `nucleo:identificar_contato` | `numero` | `{papel, nome, escalado}` — `papel` em `gestor`\|`instrutor` (via `Usuario.whatsapp`/`papel`, sem modelo novo) \| `lead` (via `Lead.whatsapp`) \| `desconhecido` (`nome: null`, nunca inventa dado); `Usuario` tem prioridade sobre `Lead` no mesmo número; `escalado` = existe `ContatoEscalado` pra esse número (silenciado até liberação manual) |
| `escalar_contato` | nucleo | `nucleo:escalar_contato` | `numero`, `motivo` | `{ok: true}` — cria/atualiza `ContatoEscalado`; reescalar com novo motivo não é erro (`update_or_create`) |
| `listar_leads` | leads | `leads:listar_leads` | `dias` (opcional, padrão 1 = hoje), `status` (opcional, exato) | lista de `{nome, whatsapp, curso, quando_pretende, status, utm_source, criado_em}` (sem `id`), mais recente primeiro; `dias` conta dias corridos (calendário), não janela rolante de 24h |
| `gerar_link_matricula` | educacional | `educacional:gerar_link_matricula` | `turma_codigo` | `{turma_codigo, url, expira_em}` — reusa convite de `Matricula` escopo turma ainda válido (link de matrícula/carteirinha); cria um novo só se não houver, mesmo padrão de `gerar_link_avaliacao` |

```bash
# humano (Session/JWT) — sempre autorizado, sem checar escopo
curl -X POST -H "Authorization: Bearer $JWT" -H "Content-Type: application/json" \
  -d '{"acao": "gerar_link_avaliacao", "params": {"turma_codigo": "03/2026"}}' \
  https://.../api/acoes/executar/

# agente (n8n) — precisa de escopo compatível no token
curl -X POST -H "X-Agente-Token: $TOKEN_AGENTE" -H "Content-Type: application/json" \
  -d '{"acao": "status_turma", "params": {"turma_codigo": "03/2026"}}' \
  https://.../api/acoes/executar/
```
```json
// 200
{"resultado": {"turma_codigo": "03/2026", "url": "https://site/avaliar/3f2b...",
               "expira_em": "2026-08-01T23:59:59-03:00"}}

// 400 — erro de negócio esperado (ErroAcao), ex. turma_codigo ausente/inexistente
{"detail": "Informe 'turma_codigo'."}
{"detail": "Turma '03/2026' não encontrada."}

// 403 — agente autenticado mas sem escopo pra essa ação (PermissaoAcao)
// (resposta padrão DRF de permissão, sem LogAcao — a checagem é antes da view)

// 404 — nome de ação desconhecido no registry
{"detail": "Ação não encontrada."}

// 500 — qualquer exceção não prevista (nunca vaza detalhe interno)
{"detail": "Erro ao executar a ação."}
```

### Auth por token de agente (`X-Agente-Token`)

- Header `X-Agente-Token: <token bruto>`. Sem o header, cai pra
  Session/JWT normalmente; com o header presente mas inválido/inativo,
  recusa direto (401) — não tenta autenticar como humano.
- Token é gerado no Django Admin (`TokenAgente`) — **aparece em texto
  puro só uma vez**, na criação; o banco guarda só o hash SHA-256.
  Perdeu o token → desativa (`ativo=False`) e cria outro.
- `escopos` é uma lista JSON no `TokenAgente`, formato `"app:acao"` (exato,
  ex. `"avaliacoes:gerar_link_avaliacao"`), `"app:*"` (prefixo — todas as
  ações daquele app, ex. `"midia:*"`) ou `"*"` (qualquer ação). Ações sem
  escopo declarado (as descritivas do `midia`, que não passam pelo
  executor) nunca são autorizadas via `autoriza()` — só fazem sentido
  chamadas via rota REST própria com Session/JWT.
- `TokenAgente.ultimo_uso_em` é atualizado a cada request autenticado com
  aquele token.

## Utilitário

```
POST /api/revalidate-hook/   # interno Django→Next (on-demand ISR), header X-Secret
```

## Versionamento e erros

- Sem versionamento por ora (`/api/`); se necessário no futuro, `/api/v2/`.
- Erros sempre `{"detail": "mensagem legível"}` + status HTTP correto.
- Paginação DRF padrão (`?page=`) apenas em leads e avaliações do painel.
- `/api/ia/executar/` e `/api/ia/provedores/{pk}/testar/` distinguem 400
  (erro de input do chamador — capacidade/contexto/credencial ausente,
  provedor não configurado) de 502 (a chamada saiu mas o provedor de IA
  falhou ou recusou) — mesmo formato `{"detail": ...}` nos dois casos.
- `/api/acoes/executar/` responde 404 pra ação inexistente, 400 pra erro
  de negócio esperado (`ErroAcao`), 403 (corpo padrão DRF, sem `detail`
  custom) quando o token de agente não tem escopo, e 500 genérico pra
  qualquer exceção não prevista — nunca vaza detalhe interno.
