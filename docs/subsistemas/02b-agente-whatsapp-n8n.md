# Subsistema 02b — MAG: o Funcionário Digital da Magma (multi-agente n8n + WhatsApp)

> **Status (2026-07-20):** Fase 0 completa + parte da Fase 1 em produção de
> teste (dev). Implementado via `specs/009` (identificação de contato),
> `specs/010` (A1 SDR), `specs/011` (A2 Nutridora T+0) e `specs/012`
> (Handoff) — todas ENTREGUES e validadas com teste real. As 7 decisões do
> §10 abaixo já foram batidas pelo Daniel (ver `.context/decisoes.md`).
> Detalhes de implementação/bugs achados: `.context/status.md` e
> `.context/historico/2026-07-20-agente-whatsapp-fase1-a1-a2.md`.
> Restante do roadmap (§9) segue como próximas specs. Base técnica:
> Camada de Ações (`/api/acoes/`, `TokenAgente`, `LogAcao` — spec 005),
> gancho `N8N_LEAD_WEBHOOK` (`apps/leads/signals.py`) e n8n no compose
> (`plataforma/n8n/README.md`, `plataforma/evolution/README.md`).

---

## 1. Visão

Um **funcionário digital** da Magma que mora no WhatsApp — canal onde o público da
Baixada já vive — e opera a plataforma pelos dois lados do balcão:

- **Pra fora:** atende lead, responde preço/data/vaga, qualifica, agenda visita,
  colhe depoimento, nutre até a matrícula. Resposta imediata, 24/7.
- **Pra dentro:** o Daniel/gestor manda *"status da 03/2026"*, *"gera link de
  avaliação"*, *"quantos leads hoje?"*, ou simplesmente **manda uma foto da aula**
  — e o agente executa na plataforma. A operação que hoje exige abrir o admin e
  N cliques vira uma mensagem.

**Persona única pública:** o atendimento externo se apresenta como **MAG, a
atendente virtual da Magma** (nome confirmado pelo Daniel, 2026-07-20). Por trás dela, um
squad de subagentes especializados — o cliente nunca percebe a troca de bastidor.
Princípio do subsistema 02 mantido: **o agente nunca finge ser humano** e todo
caso sensível escala pra equipe.

## 2. Arquitetura

```
WhatsApp (números da Magma)
        │  QR pairing / webhooks
        ▼
┌─────────────────────┐   webhook interno    ┌──────────────────────────────┐
│  Gateway WhatsApp    │ ───────────────────▶ │  n8n (compose, loopback 5678)│
│  (Evolution API,     │ ◀─────────────────── │                              │
│   container no       │   REST: enviar msg,  │  W0 RECEPCIONISTA (roteador) │
│   compose)           │   mídia, presença    │   ├─ identifica o contato    │
└─────────────────────┘                      │   ├─ classifica a intenção   │
                                             │   └─ delega (Execute Workflow│
                                             │        / agente-como-tool):  │
                                             │  W1 SDR  W2 Nutrição  W3 Ops │
                                             │  W4 Acervo  W5 Radar  ...    │
                                             └──────────┬───────────────────┘
                                                        │ X-Agente-Token (1 por agente,
                                                        │ escopo mínimo) + APIs públicas
                                                        ▼
                                             backend Django  http://backend:8000
                                             /api/acoes/executar/  /api/cursos/…
                                             /api/leads/  /api/midia/…  /api/ia/…
```

- **Tudo no compose de prod** (`docker-compose.prod.yml`): gateway WhatsApp entra
  como serviço novo ao lado de `backend` e `n8n`, porta só no loopback, rede
  interna do compose pra conversar (`http://n8n:5678`, `http://backend:8000`).
  Em dev: entra no `n8n/docker-compose.dev.yml` (flag `--n8n` do `init-dev.sh`,
  ou nova flag `--wpp`).
- **Padrão n8n:** um workflow-mãe (roteador) + um workflow por subagente,
  chamados via *Execute Workflow* ou como *tools* de um nó AI Agent. Cada
  subagente tem prompt próprio, tools próprias e **token próprio** da plataforma.
- **LLM dos agentes:** credencial Anthropic/Gemini cadastrada no n8n
  (recomendação: modelo barato/rápido no roteador e nos fluxos simples; modelo
  forte só no SDR e no Redator). O `/api/ia/executar/` da plataforma continua
  sendo usado quando o assunto é **texto de marca** (mantém auditoria e custo
  no `ExecucaoIA`).

### 2.1 Gateway: Evolution API × whatsmeow

| Critério | Evolution API | whatsmeow (lib Go) |
|---|---|---|
| Esforço inicial | Baixo — container pronto, REST + webhooks, docs e comunidade n8n enormes | Alto — você escreve e mantém um microserviço Go |
| Peso no compose | Médio — v2 pede **Postgres** (e Redis recomendado) só pra ela | Mínimo — binário único, store SQLite |
| Recursos prontos | Multi-instância, mídia, grupos, presença "digitando…", botões/listas | Só o protocolo; cada recurso é código seu |
| Controle fino | Menor (caixa preta configurável) | Total |
| Manutenção | Atualiza imagem | Acompanhar breaking changes do protocolo |

**Recomendação: começar com Evolution API** — o objetivo é ter o agente rodando
antes do 08/08, não escrever infraestrutura. Migrar pra um serviço whatsmeow é
uma evolução possível (o n8n só enxerga webhooks + REST; trocar o gateway não
toca nos workflows se mantivermos um contrato interno estável).

⚠️ **Risco assumido:** ambos são API **não-oficial** (protocolo do WhatsApp Web)
→ risco real de banimento do número. Mitigação: (a) **número dedicado ao bot**,
nunca o número principal da escola no início; (b) aquecimento gradual e limite de
disparos/minuto; (c) opt-out honrado sempre; (d) mensagens em massa só pra quem
deu o número espontaneamente (lead do site). A **WhatsApp Cloud API oficial**
fica registrada como caminho "de gente grande" se o volume/risco justificar.

## 3. Identificação: quem está falando?

Primeiro passo de TODA mensagem — nova ação no registry, `nucleo:identificar_contato`:

| Papel | Como reconhece | Tratamento |
|---|---|---|
| **Gestor / Admin** | número na lista de operadores (novo modelo `OperadorWhatsApp` ligado ao `User` staff) | Acesso ao squad interno (W3–W6). Ações de escrita pedem **confirmação** ("Confirma? sim/não"); as críticas pedem PIN |
| **Instrutor** | número no cadastro `Instrutor` (campo novo `whatsapp`) | Subconjunto do squad interno: status de turma, acervo, link de avaliação |
| **Aluno / ex-aluno** | fase 3 — quando `educacional` tiver matrícula com telefone | Agente do Aluno (situação, agenda, materiais, avaliação) |
| **Lead conhecido** | `Lead.whatsapp` bate | SDR com contexto: nome, curso de interesse, estágio do funil |
| **Desconhecido** | nenhum match | Recepção calorosa da MAG → qualifica → vira `Lead` via `POST /api/leads/` |

Segurança em camadas: papel por número é **conveniência**, não autenticação —
número pode ser clonado. Por isso: escopos mínimos por token, confirmação nas
escritas, PIN nas críticas (ex.: mexer em preço), e `LogAcao` gravando tudo.

## 4. O elenco de agentes

> "Já roda hoje" = a API necessária existe. "Precisa de ação nova" = entra na
> lista da §7. Fases na §9.

### Squad de Atendimento (público externo — persona MAG)

**A0 · Recepcionista (roteador)** — Fase 1 · ✅ **implementado (spec 009)**
O cérebro do funil. Identifica o contato, saúda pelo nome, classifica a intenção
(dúvida de curso? preço? avaliação? gestor dando ordem?) e delega ao subagente
certo. Detecta os gatilhos de **handoff humano**: intenção clara de fechar
matrícula, reclamação, assunto de saúde sensível, pedido explícito de humano —
avisa a equipe (mensagem no grupo interno) e silencia naquele contato até
liberação. *Handoff implementado na spec 012 (adiantada da Fase 2 concepção
original) — hoje avisa o Daniel direto (DM), não um grupo (nenhum configurado
ainda).*

**A1 · SDR — "Capitã de Matrículas"** — Fase 1 · ✅ **implementado (spec 010)** · *o agente que enche a turma do 08/08*
Vende sem inventar: responde preço, datas, carga horária, requisitos, localização
e FAQ **lendo a API pública** (`GET /api/cursos/{slug}/` já entrega FAQs, preço,
`turma_destaque`, `vagas_restantes`, countdown — a mesma verdade da LP, toggles
respeitados: preço desligado → "consulte condições", exatamente como o site).
Qualifica (curso, urgência, disponibilidade), registra via `POST /api/leads/`
com `utm_source=whatsapp`, cria senso de urgência legítimo ("restam 8 vagas" —
dado real), agenda visita e escala pro humano na hora de fechar.
*Já roda hoje* — só a agenda de visitas precisa de decisão (n8n Data Table no
MVP; Google Calendar depois).

**A2 · Nutridora de Leads** — Fase 1 · 🟡 **T+0 implementado (spec 011)**, T+1d/3d/7d pendentes
Não conversa: **age no tempo**. O gancho já existe: todo lead novo dispara
`POST N8N_LEAD_WEBHOOK`. Sequência editável: T+0 boas-vindas da MAG ✅ (sem
mandar de novo se o lead nasceu dentro da própria conversa de WhatsApp via
SDR — `utm_source=whatsapp` pula o toque, evita redundância) · T+1d
conteúdo útil do pilar do curso · T+3d prova social (avaliação real aprovada) ·
T+7d "as vagas estão acabando" (se `exibir_vagas`) · silêncio respeitado
(opt-out marca o lead). Atualiza `status` do lead a cada resposta
(`PATCH /api/painel/leads/{id}/`). *T+1d/3d/7d precisam de cron + campo novo
no `Lead` pra rastrear qual toque já foi mandado — spec própria.*

**A3 · Colhedora de Depoimentos ("Prova Social")** — Fase 2
Fecha o ciclo da formatura: gestor avisa (ou gatilho futuro de conclusão) → ela
chama `gerar_link_avaliacao` (**ação já existe**), manda o magic-link com
mensagem calorosa, acompanha quem respondeu (`status_turma` devolve contagem de
avaliações), agradece quem avaliou e avisa o gestor quando há avaliação
`pendente` esperando aprovação.

**A4 · Agente do Aluno** — Fase 3 (depende do `educacional` ganhar matrícula)
Situação da matrícula, agenda das práticas, materiais, 2ª via de pagamento,
carteirinha/certificado, aviso de **recertificação vencendo** (o motor da
recorrência do subsistema 04). Fica especificado desde já pra o modelo de
matrícula nascer com telefone + opt-in.

### Squad de Operações (gestor/instrutor — o "menos cliques")

**B1 · Operadora da Plataforma ("Secretária Digital")** — Fase 1 (leitura) / Fase 2 (escrita)
O coração do pedido do Daniel. Conversas reais:

```
Daniel: status da 03/2026
MAG:    Socorrista APH · inscrições abertas · começa 07/03
        8/20 vagas restantes · 14 mídias · 3 postagens · 12 avaliações
        [ação existente: status_turma]

Daniel: link de avaliação da 03/2026
MAG:    https://site/avaliar/3f2b… (expira 01/08) — quer o texto pronto
        pra encaminhar pros alunos?     [ação existente: gerar_link_avaliacao]

Daniel: leads de hoje
MAG:    5 novos: Maria (APH, "o quanto antes"), João (Farmácia)…
        Quer que eu puxe papo com os que ainda não respondi?
        [ação nova: listar_leads]

Daniel: baixa as vagas da 03/2026 pra 5
MAG:    Turma 03/2026 (Socorrista APH): vagas 8 → 5. Confirma? 
Daniel: sim
MAG:    Feito ✅ — o site já mostra 5.   [ação nova: atualizar_turma]
```

**B2 · Zeladora do Acervo** — Fase 2 · *a feature mais "mágica" do plano*
O gestor/instrutor **manda a foto da aula direto no WhatsApp**. Ela pergunta o
destino ("Turma 03/2026, curso, ou geral da marca?"), sobe via
`POST /api/midia/acervo/enviar/` (multipart já pronto, dedup 409 tratado:
"essa você já mandou 😉"), confirma com o thumb. A ponte celular → Mesa de Luz
sem abrir o admin. Legenda por voz/texto vira `legenda` do item.

**B3 · Publicadora ("Social Maker executor")** — Fase 2
Braço operacional do plano Social Maker (`07-social-maker.md`): consulta a fila
(`listar_postagens_agendadas` — **ação já existe**), avisa de manhã "tem
postagem agendada pra hoje", manda as artes + legenda pro gestor **aprovar pelo
WhatsApp** (regra de ouro do Social Maker: nunca publica sem aprovação), e após
o "aprovado" marca como publicada / entrega o kit pronto pra postar.

**B4 · Redatora de Marca** — Fase 2
Proxy do `/api/ia/executar/` (`texto.gerar|melhorar|variacoes` — **já roda**,
auditado em `ExecucaoIA`): "escreve 3 legendas pra essa foto da prática de RCP,
tom do guia" → volta com variações no tom da marca (o prompt de sistema da
plataforma já carrega as regras). Zero invenção de dado: datas/preços ela busca
na API antes de escrever.

**B5 · Radar ("Bom dia, Magma")** — Fase 2
Único agente **proativo por cron** (n8n Schedule): resumo diário no WhatsApp do
gestor — leads novos e funil, vagas restantes das turmas em inscrição, avaliações
pendentes de aprovação, postagens agendadas pro dia, uso de IA do mês
(`/api/ia/uso/`). Um relance de celular substitui abrir 4 telas do admin.
Composição do resumo = ação nova `resumo_diario` (uma chamada, uma resposta).

### Squad futura (Fase 3+ — registrada pra arquitetura já nascer pronta)

| Agente | Missão | Depende de |
|---|---|---|
| **C1 · Matriculadora** | pré-matrícula guiada no chat (dados → contrato → link de pagamento) | spec 006 (pré-matrícula pública) + gestão escolar |
| **C2 · Cobradora Gentil** | lembrete de parcela, 2ª via, renegociação com alçada limitada | financeiro (subsistema 03) |
| **C3 · Recertificadora** | validade do APH vencendo → oferta de recertificação (recorrência!) | certificação (subsistema 04) |
| **C4 · Apontadora de Presença** | instrutor dita a presença da aula pelo chat | vida acadêmica (subsistema 03) |

## 5. Regras pré-definidas e EDITÁVEIS (constituição §2: o gestor é a fonte)

As regras não moram hardcoded no prompt do n8n. Novo modelo na plataforma
(`nucleo.RegraAgente` ou similar), editável no admin pelo celular, servido por
ação `nucleo:regras_agente` que o roteador busca no início da conversa (cache
curto no n8n):

| Grupo | Exemplos de regra editável |
|---|---|
| **Identidade** | nome da persona, saudação, assinatura, emoji sim/não |
| **Horário** | fora do horário: responde? só recepciona? avisa "amanhã cedo te respondo"? |
| **Alçadas** | o que o bot pode responder sobre preço (sempre / só se `exibir_preco` / nunca — manda pro humano) |
| **Handoff** | palavras/intenções que escalam na hora ("quero pagar", "reclamação", "cancelar") + pra qual número avisar |
| **Sequência de nutrição** | textos e intervalos dos toques T+0/1/3/7 |
| **Limites** | máx. mensagens proativas por lead/semana, janela de silêncio, lista de opt-out |
| **Proibições fixas** (NÃO editáveis — herdam do guia de marca) | nunca fingir ser humano, nunca prometer emprego, nunca inventar preço/data/resultado, nunca publicar sem aprovação |

Prompts de sistema dos subagentes versionados no repo
(`plataforma/n8n/prompts/*.md`) — mudança de comportamento é commit revisável;
o que é "conteúdo" (textos, horários, alçadas) fica no modelo editável.

## 6. Segurança, auditoria e LGPD

- **Um `TokenAgente` por subagente**, escopo mínimo (`SDR` → `leads:*` +
  `cursos:status_turma`; `Zeladora` → só mídia; etc.). O mecanismo inteiro já
  existe (spec 005): hash SHA-256, escopos `app:acao`/`app:*`, revogação
  individual (`ativo=False`) sem derrubar o resto do squad.
- **`LogAcao` grava toda execução** (sucesso e erro) com o agente autor — a
  auditoria veio de graça.
- Escritas confirmam antes de executar; críticas (preço, countdown) pedem PIN.
- **LGPD:** opt-out em qualquer mensagem ("não quero mais receber") marca o
  contato e cala os proativos; dados de conversa ficam nos volumes do compose
  (mesma VPS da plataforma, nada em SaaS de terceiros além do LLM); mensagens
  ao LLM não incluem dado sensível desnecessário.

## 7. O que precisa nascer na PLATAFORMA (pré-requisitos por fase)

A beleza do desenho da spec 005: agente novo ≈ **ações novas no registry**, não
endpoints novos. Cada uma é um `@registrar_acao` + testes:

| Ação nova | App | Fase | Pra quê | Status |
|---|---|---|---|---|
| `identificar_contato` | nucleo | 1 | número → papel + nome + `escalado` (lead? operador? instrutor? silenciado?) | ✅ spec 009 (+`escalado` na spec 012) |
| `escalar_contato` | nucleo | 1 | marca contato como escalado pro humano (handoff) — não estava prevista aqui, nasceu da spec 012 | ✅ spec 012 |
| `regras_agente` | nucleo | 1 | servir as regras editáveis da §5 | pendente |
| `listar_leads` | leads | 1 | filtro status/período — "leads de hoje" | pendente (B1) |
| `atualizar_status_lead` | leads | 1 | funil andando pelo chat | pendente (B1) |
| `registrar_interacao_lead` | leads | 1 | conversa vira registro no CRM (princípio do subsistema 02) | pendente |
| ~~`proximas_turmas`~~ | cursos | 1 | SDR responder "quando começa?" sem slug | **não precisou** — a SDR (spec 010) usa `GET /api/cursos/` (lista) + `GET /api/cursos/{slug}/` (detalhe) direto, sem ação nova |
| `atualizar_turma` | cursos | 2 | vagas/toggles/countdown por chat (restrita, com confirmação) | pendente |
| `listar_avaliacoes_pendentes` + `aprovar_avaliacao` | avaliacoes | 2 | moderação pelo WhatsApp | pendente |
| `resumo_diario` | nucleo | 2 | payload único pro Radar | pendente |
| `marcar_postagem_publicada` | midia | 2 | Publicadora fechar o ciclo | pendente |

Modelos novos (mínimos): `OperadorWhatsApp` (número ↔ user staff, PIN),
`RegraAgente` (§5), campo `whatsapp` em `Instrutor`. Upload da Zeladora usa a
rota REST já existente (`acervo/enviar/`) — só precisa aceitar `X-Agente-Token`
(hoje é Session/JWT; decisão a tomar na spec: liberar o header ali ou criar ação).

Infra: serviço Evolution API (+ Postgres dela) no compose prod/dev, bloco nginx
se precisar de webhook externo (a Evolution fala com o n8n por rede interna —
possivelmente **nenhuma porta pública nova**), variáveis `.env.prod`.

## 8. Memória e CRM

- **Memória de conversa:** nativa do nó AI Agent do n8n, chave = número do
  contato, janela curta (últimas N trocas). Suficiente pro MVP.
- **Memória de negócio:** o que importa não fica no n8n — vira dado na
  plataforma via `registrar_interacao_lead` ("perguntou preço do APH dia 20/07").
  O n8n é descartável/reconstruível; a plataforma é a fonte de verdade
  (coerente com o resto do ecossistema).
- Visão de funil continua no admin (e no Radar diário).

## 9. Roadmap em fases entregáveis (constituição §5)

**Fase 0 — Fundação** · ✅ **CONCLUÍDA (2026-07-20, spec 009)**
Evolution API no compose (dev+prod) · número dedicado pareado · workflow
"eco" de ponta a ponta (WhatsApp → n8n → resposta) · `identificar_contato`
(sem `OperadorWhatsApp` — `contas.Usuario` já tinha `whatsapp`+`papel`) ·
`TokenAgente agente-recepcionista-mag` criado.
*Critério: mandar "oi" e a MAG responder sabendo quem eu sou. ✅ validado com Daniel.*

**Fase 1 — MVP que ajuda o 08/08** ⭐ prioridade máxima · **em andamento**
✅ A0 Recepcionista (spec 009) · ✅ A1 SDR (spec 010, API pública +
`POST /api/leads/`) · ✅ A2 Nutridora T+0 (spec 011, gancho
`N8N_LEAD_WEBHOOK` ligado — T+1d/3d/7d ainda faltam) · ✅ Handoff (spec 012,
adiantado da concepção do A0 por pedido do Daniel) · ⬜ B1 Operadora **só
leitura** (`status_turma`, `gerar_link_avaliacao`, `listar_leads`) · ⬜
regras editáveis mínimas (`RegraAgente`).
*Critério: lead real atendido em segundos ✅ validado · Daniel opera consultas pelo chat — pendente (B1).*

**Fase 2 — Funcionário completo**
B1 com escrita (confirmação/PIN) · B2 Zeladora do Acervo (foto pelo chat!) ·
B3 Publicadora · B4 Redatora · B5 Radar diário · A3 Depoimentos.
*Critério: um dia inteiro de operação de conteúdo + funil sem abrir o admin.*

**Fase 3 — Escola no chat** (acompanha a evolução da plataforma)
A4 Aluno · C1 Matrícula · C2 Cobrança · C3 Recertificação · C4 Presença.
Avaliar aqui: Cloud API oficial e/ou migração do gateway pra whatsmeow.

## 10. Riscos e decisões — **batidas pelo Daniel em 2026-07-20** (ver `.context/decisoes.md`)

1. ~~**Gateway:** Evolution API × whatsmeow~~ → **Evolution API**, já
   implementado (Fase 0, `plataforma/evolution/`).
2. ~~**Número:** dedicado novo × número atual da escola~~ → **dedicado**; o
   número de teste usado na Fase 0 fica só de teste — o número oficial de
   produção é escolha futura, separada.
3. ~~**Persona:** nome "MAG"? única × squad~~ → **"MAG", persona única
   pública**; squad de subagentes fica invisível por trás dela.
4. ~~**LLM e custo:** provedor fixo?~~ → **configurável/trocável**, não
   hardcoded — modelo escolhido via credencial/parâmetro no node do n8n
   (AI Agent/LangChain), pra dar pra comparar custo-benefício sem deploy.
   Teto mensal ainda fica em aberto pra quando o custo real aparecer.
5. ~~**Agenda de visitas:** Data Table × Google Calendar~~ → **Data Table
   do n8n** (MVP, sem dependência externa).
6. **Auth do upload de acervo por agente:** ainda em aberto — recomendação
   técnica registrada (`.context/decisoes.md`, 2026-07-20): reaproveitar
   `X-Agente-Token` na rota REST existente em vez de criar ação dedicada;
   decidir na hora de implementar B2 Zeladora do Acervo (Fase 2).
7. ~~**Postgres extra da Evolution no compose:** aceitável?~~ → **aceito**,
   já implementado.
