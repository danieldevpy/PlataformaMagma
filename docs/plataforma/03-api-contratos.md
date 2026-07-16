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

## Utilitário

```
POST /api/revalidate-hook/   # interno Django→Next (on-demand ISR), header X-Secret
```

## Versionamento e erros

- Sem versionamento por ora (`/api/`); se necessário no futuro, `/api/v2/`.
- Erros sempre `{"detail": "mensagem legível"}` + status HTTP correto.
- Paginação DRF padrão (`?page=`) apenas em leads e avaliações do painel.
