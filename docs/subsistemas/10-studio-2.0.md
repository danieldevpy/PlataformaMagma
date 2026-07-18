# 10 — Studio 2.0: plano mestre (multi-template, IA embutida, agent-first)

> Plano completo da evolução do Studio (subsistema 09) para uma central de produção
> de conteúdo. Consolida a sessão de planejamento de 2026-07-18.
> Relação com outros docs: `09-acervo-studio-postagem.md` (base implementada),
> `07-social-maker.md` / `07b-social-maker-manus.md` (publicação/Manus),
> `design-system/AGENTS.md` (marca é lei).
> Execução: quebrado em specs `specs/002..007` (ver §9) — este doc é o mapa, as
> specs são a obra.

## 1. Visão e princípios

O Studio deixa de ser "gerador de carrossel de formação" e vira a **central onde todo
conteúdo da Magma nasce, sem sair dele** — feed, story, depoimento, vagas, formatura,
educativo, capa/vídeo de reel — a partir do que já existe: fotos do acervo, avaliações
reais e dados da turma.

Princípios inegociáveis deste plano:

1. **Faça muito com pouco.** Uma seleção de conteúdo → várias entregas (kit).
2. **Humano primeiro, agente em paralelo** (herdado do 09). Toda capacidade tem UI
   polida E ação de API equivalente. O agente (n8n/WhatsApp, Manus) usa a MESMA API.
3. **IA é complemento, nunca requisito.** O Studio funciona 100% sem nenhum provedor
   configurado. Cada recurso de IA é um aprimoramento de um fluxo manual que já
   funciona — se a chave expira, o Studio não quebra, só perde os botões ✨.
4. **Configuração progressiva.** Daniel configura provedor de texto → recursos de
   texto acendem. Configura imagem → recursos de imagem acendem. Etc. Nada de
   "instale tudo antes de usar".
5. **Todo artefato nasce no acervo.** IA ou humano, o resultado é sempre
   `MidiaTurma`/`Postagem` — nada vive fora do fluxo já existente (curadoria, ZIP,
   avaliação, timeline de postagem continuam valendo para tudo).
6. **Zero redesign** (constituição §4). Visual segue `design-system/AGENTS.md`;
   formatos de mídia seguem a tabela §6 do guia (feed 1080², story 1080×1920 com
   250px livres topo/base, thumb 1280×720).

## 2. Modelo conceitual: Seleção × Modo × Formato

```
SELEÇÃO (matéria-prima)      MODO (template)          FORMATO (saída)
─────────────────────        ───────────────          ───────────────
fotos do acervo         ×    formação de turma   ×    feed 1:1 (1080²)
avaliações reais (4–5★)      depoimento               story 9:16 (1080×1920)
dados da turma               vagas/urgência           capa de reel 9:16
texto livre                  formatura                (fase 2: vídeo reel)
                             educativo
                             capa de reel
```

Toda produção no Studio é `selecionar → aplicar modo → escolher formato(s) → exportar`.
Esse contrato é o mesmo para a UI e para agentes (`gerar_arte` na Camada de Ações,
fase final). **Um template novo é dados + uma função de desenho, nunca uma tela nova.**

## 3. Motor de templates declarativo (a fundação antirretrabalho)

O motor atual (`static/midia/templates-engine.js`) desenha bem, mas é acoplado a
1080×1080 e ao DOM do browser. O refactor que evita retrabalho em TODAS as fases
seguintes:

### 3.1 Template como definição registrada

```js
MagmaTemplates.registrar({
  id: 'depoimento',
  nome: 'Depoimento',
  descricao: 'Prova social a partir de avaliações reais',
  formatos: ['feed', 'story'],           // quais formatos sabe desenhar
  fontes: ['avaliacao', 'foto?'],        // o que o picker deve oferecer ('?' = opcional)
  campos: [                              // gera o formulário do painel direito
    { id: 'frase',   tipo: 'texto-longo', rotulo: 'Frase do depoimento', ia: 'texto' },
    { id: 'nome',    tipo: 'texto',       rotulo: 'Nome + turma' },
    { id: 'estrelas',tipo: 'numero',      rotulo: 'Estrelas', min: 1, max: 5 },
  ],
  variantes: ['aspas', 'foto-fundo'],    // sorteio "saco embaralhado" (padrão do 09)
  legendaPadrao: '⭐ {{frase_curta}} — {{nome}} ... {{hashtags_curso}}',
  desenhar(ctx, formato, dados, assets) { /* canvas 2D puro */ },
});
```

- `FORMATOS` centralizado: `{ feed: {w:1080,h:1080,margem:88}, story: {w:1080,h:1920, zonaSegura:{topo:250,base:250}}, capa_reel: {w:1080,h:1920} }`.
- `campos[].ia` marca onde botões ✨ podem aparecer (ver §5) — o template declara,
  a camada de IA decide se estão ativos.

### 3.2 Motor desacoplado do browser (decisão crítica)

`desenhar()` recebe TUDO injetado — contexto canvas, imagens já carregadas, símbolo,
fontes prontas — e usa **somente a API Canvas 2D** (nada de `document`, `Image`,
`Blob` dentro dos templates). O bootstrap do browser (carregar fontes/fotos, criar
canvas, exportar blob) fica num adaptador. Motivo: na fase final o MESMO arquivo de
templates roda em Node (`node-canvas`) para a ação `gerar_arte` de agente, sem
reescrever nenhum template. Essa regra entra no topo do arquivo como comentário-lei.

### 3.3 Compatibilidade

O template "Formação de Turma" atual é portado como primeiro template declarativo,
com as mesmas 4 variantes (moldura/lateral/full/classic) e saída pixel-idêntica no
feed — critério de aceite da spec 002. O comentário "motor intocável" do arquivo é
substituído por esta nova lei (o MVP `mvp-apps/studio/` vira referência histórica).

## 4. Catálogo de templates v1 (ordem = prioridade para encher turma)

| # | Template | Fontes | Formatos | Detalhes |
|---|---|---|---|---|
| 1 | **Depoimento** | avaliação (picker novo) + foto opcional de fundo | feed, story | Puxa avaliações 4–5★ do app `avaliacoes` via API nova (`GET /api/midia/turmas/<id>/avaliacoes/` — nota, comentário, nome). Card estilo design system (navy-deep, aspas Georgia douradas, estrelas). Prova social que hoje dorme no banco. |
| 2 | **Vagas/Urgência** | dados da turma + foto opcional | feed, story | "Restam X vagas · começa dd/mm · sábados". Badge vermelho (≤2% da área!), CTA WhatsApp. X editável (automático quando gestão escolar existir). |
| 3 | **Formação de Turma** | fotos | feed (hoje) + story (novo) | Já existe; portado ao motor declarativo. |
| 4 | **Formatura/Celebração** | fotos | feed, story | Foto grande + "Parabéns turma NNN" + CTA "próxima turma: NNN+1" (fecha o ciclo formado→lead). |
| 5 | **Educativo** | texto (sem foto obrigatória) | feed, story | "Você sabia? / Erro comum × certo". Fundo navy + hexágonos, tipografia grande. Garante constância nos dias sem material. Melhor amigo da IA de texto (pauta) e de imagem (ilustração). |
| 6 | **Capa de Reel** | foto + título | capa_reel | Máx. 4 palavras em destaque, selo Magma no canto, alto contraste (guia §6). O vídeo do reel é fase 2 (§7.3). |

### Ferramentas transversais (valem para todos os templates)

- **Gerar kit**: checkboxes de formato na exportação — uma seleção → post + story
  (+ capa) num clique. Cada formato vira arte na mesma `Postagem`.
- **Legenda com variáveis**: `{{curso}}`, `{{turma}}`, `{{data_inicio}}`,
  `{{hashtags_curso}}` — banco de hashtags fixas+variáveis por curso (doc 07b §4)
  em um JSON versionado (`static/midia/marca.js`), editável depois via painel.
- **Fila de postagens com data**: `Postagem.agendada_para` (DateTime null) + visão
  de calendário simples no painel de postagens. É o que Manus/n8n consomem.

## 5. Camada de IA embutida

### 5.1 Arquitetura: capacidades ≠ provedores (segunda decisão antirretrabalho)

O Studio nunca fala "OpenAI" ou "Claude" — fala **capacidades nomeadas**:

| Capacidade | Exemplos de uso no Studio |
|---|---|
| `texto.gerar` | legenda a partir do contexto (template+turma+fotos), frase do educativo, pauta da semana |
| `texto.melhorar` | reescrever/encurtar/mudar tom da legenda ou frase |
| `texto.variacoes` | 3 alternativas de legenda para escolher |
| `imagem.melhorar` | upscale/nitidez/iluminação de foto do acervo |
| `imagem.remover_fundo` | destacar aluno/instrutor para composições |
| `imagem.gerar` | ilustração para o template Educativo |
| `video.gerar` | reel a partir de fotos selecionadas + roteiro |
| `audio.transcrever` | (futuro) legendas automáticas de vídeo de aula |

Cada **provedor** é um adaptador no backend que declara quais capacidades implementa.
Trocar de provedor não toca o Studio; adicionar provedor = 1 arquivo novo.

```
Studio (botão ✨) ──► POST /api/ia/executar/ {capacidade, contexto}
                          │ (backend escolhe o provedor ativo p/ aquela capacidade)
                          ├─ AdaptadorAnthropic  (texto.*)
                          ├─ AdaptadorOpenAI     (texto.*, imagem.gerar)
                          ├─ AdaptadorFal        (imagem.*, video.gerar)   ← fal.ai/replicate
                          └─ ...
```

- **Chave de API NUNCA vai ao browser.** Tudo via proxy backend.
- Prompt de sistema fixo por capacidade de texto = **a marca** (tom de voz §8 do
  guia, proibições — "nunca prometer emprego garantido" —, hashtags, CTA padrão).
  A IA já nasce falando Magma.
- `GET /api/ia/capacidades/` → `{"texto.gerar": true, "imagem.melhorar": false, ...}`
  — é o que faz a UI acender/apagar recursos conforme a configuração (§5.3).

### 5.2 Modelos (app novo `apps.ia`)

```python
class ProvedorIA(ComTimestamps):
    tipo        Char choices: TEXTO | IMAGEM | VIDEO      # 1 ativo por tipo
    provedor    Char choices: anthropic|openai|google|fal|replicate|...
    modelo      Char           # ex.: claude-sonnet-5, flux-1.1, kling-2.5
    credencial  Char encriptada (Fernet + SECRET_KEY derivado; NUNCA em texto puro)
    config      JSONField      # temperatura, tamanho, extras por provedor
    ativo       Bool
    testado_em  DateTime null  # última verificação de conexão OK

class ExecucaoIA(ComTimestamps):                          # auditoria + custo
    provedor FK, capacidade Char, contexto_resumo Char,
    tokens_entrada/saida Int null, duracao_ms Int,
    status Char choices: OK|ERRO, erro Text blank,
    usuario FK null, agente Char blank                    # quem pediu
```

### 5.3 UX da configuração ("vai funcionando conforme eu configuro")

Página **"Integrações de IA"** (mesmo padrão staff do 09: template Django sob
`/dj-admin/`, link na home do Studio via ícone ⚙):

- **3 cards: Texto · Imagem · Vídeo.** Cada card: dropdown de provedor, campo de
  chave (write-only, exibe `••••` depois de salva), dropdown/campo de modelo,
  botão **"Testar conexão"** (chamada mínima real → badge ✅ "funcionando" com
  data, ou ❌ com o erro em linguagem humana).
- Abaixo de cada card, a **matriz "o que isso destrava"**: lista das capacidades
  com bolinha acesa/apagada ("✅ Gerar legendas · ✅ Melhorar textos · ⚪ Ilustrações
  — configure Imagem").
- Card de **uso**: contagem de execuções/tokens do mês (via `ExecucaoIA`) — sem
  surpresa na fatura do provedor.
- Operável pelo celular (constituição §2).

### 5.4 UX da IA dentro do Studio (padrões obrigatórios)

1. **✨ sempre ao lado de um controle manual equivalente** — nunca no lugar dele.
   Campo de texto → menu ✨ com "Gerar", "Melhorar", "Encurtar", "3 variações".
2. **Sugestão nunca sobrescreve direto.** Resultado aparece como proposta com
   **Aplicar / Descartar / Tentar de novo** (variações: cards lado a lado, toque
   escolhe). O humano sempre dá a palavra final.
3. **Foto original é sagrada.** "Melhorar foto"/"remover fundo" cria NOVO item no
   acervo (`origem="ia"`, novo valor no choices), lado a lado com o original —
   nunca substitui. Curadoria D/C/A vale para a versão nova também.
4. **Sem provedor configurado:** o ✨ aparece esmaecido com tooltip "Configure um
   provedor de texto para ativar" → link direto para a página de Integrações
   (descoberta > mistério; um clique até resolver).
5. **Estados honestos:** spinner com texto do que está acontecendo ("escrevendo
   3 variações…"), erro do provedor em linguagem humana com "tentar de novo",
   timeout visível. IA lenta não pode congelar o Studio (sempre assíncrono).

### 5.5 Provedores sugeridos para começar (1 por tipo basta)

- **Texto:** Anthropic (`claude-sonnet-5` para legendas/pautas; `claude-haiku-4-5`
  se custo apertar). Alternativa: OpenAI.
- **Imagem:** fal.ai ou Replicate (um endpoint, vários modelos: upscale/ESRGAN,
  remoção de fundo/rembg, geração/FLUX) — evita 1 conta por modelo. Alternativa:
  Gemini (geração/edição).
- **Vídeo:** deixar a escolha para a fase 007 (mercado muda rápido); o adaptador
  fal/replicate já cobre Kling/Runway/Veo quando chegar lá.

## 6. Camada de Ações (backend agent-first)

Generaliza o `CATALOGO_ACOES` do app `midia` para a plataforma inteira:

- **Registry no `nucleo`**: cada app registra ações (nome, params, descrição,
  escopo, função). `GET /api/acoes/` lista tudo — é a "documentação viva" que o
  agente n8n lê para saber o que consegue fazer. O catálogo do `midia` migra.
- **Auth de agente**: modelo `TokenAgente` (nome ex.: `agente-n8n`, token, escopos
  tipo `midia:*` / `matricula:gerar_link`, ativo) — separado do login humano.
- **Auditoria obrigatória**: `LogAcao` (quem/qual agente, ação, params, resultado,
  quando). Bot operando a escola exige trilha.
- **Ações da primeira leva**:
  - `gerar_link_avaliacao(turma)` — mecânica já existe, só expor;
  - `gerar_link_matricula(turma)` — **pré-matrícula**: página pública
    `/matricula/<token>` com formulário curto que cria Lead vinculado à turma
    (matrícula real com pagamento continua meta de médio prazo);
  - `status_turma(codigo)` — vagas, datas, leads;
  - `listar_postagens_agendadas()` — fila para o Manus publicar;
  - ações do `midia` existentes (acervo, postagens).
- **Divisão mantida (doc 07b):** Manus = fábrica/publicação; n8n = sistema nervoso
  (WhatsApp, links, retenção); plataforma = fonte de verdade + ferramentas.

## 7. O que fica explicitamente para depois

1. **Render server-side de artes** (`gerar_arte` por agente) — destravado pelo §3.2,
   implementado só na fase 007 (Node + node-canvas reutilizando o mesmo engine).
2. **Vídeo de reel** — slideshow (fotos + transições + trilha) via ffmpeg no
   servidor e/ou `video.gerar` por IA. Até lá: capa de reel + kit de fotos + roteiro
   ✨ de legenda cobrem 80% do valor.
3. **Métricas de post** retroalimentando calendário (vêm do Instagram Connector do
   Manus — doc 07b).
4. **Editor de hashtags/marca via painel** (v1 é JSON versionado).

## 8. UX geral do Studio 2.0 (resumo das telas)

1. **Home do Studio** (por turma, como hoje): grade de cards de **modos** (os 6
   templates, com miniatura e descrição de 1 linha) + acesso ao painel de
   Postagens e ⚙ Integrações de IA.
2. **Editor** (3 zonas, responsivo p/ celular):
   - esquerda: **picker contextual** à fonte do template (fotos com ⭐
     pré-selecionadas — hoje; avaliações 4–5★; dados da turma pré-preenchidos);
   - centro: **preview** com toggle de formato (feed/story) e navegação de slides;
   - direita: **campos do template** (gerados de `campos[]`) com os ✨ onde houver.
3. **Exportação**: checkboxes de formato (kit) → `Postagem` rascunho com todas as
   artes → painel de postagens (timeline rascunho→pronta→publicada, ZIP, copiar
   legenda, confete — tudo já existe) + campo novo **"agendar para"**.

## 9. Fases → specs (cada uma ≤ ~1 semana, deployável — constituição §5)

| Spec | Entrega | Por que nessa ordem |
|---|---|---|
| `002-studio-motor-declarativo` | Refactor §3 (formatos, registry, injeção), Formação portada, story 9:16, seletor de modo/formato na UI | Fundação de tudo; risco controlado (saída idêntica como critério) |
| `003-studio-templates-campanha` | Templates 1,2,4,5,6 do §4 + kit + legenda c/ variáveis + endpoint de avaliações | É o que produz conteúdo para encher a turma até 08/08 |
| `004-ia-config-e-texto` | App `ia`, página Integrações, proxy `/api/ia/`, capacidades `texto.*` nos campos | Texto é a IA mais barata e de maior impacto (legendas/pautas diárias) |
| `005-camada-de-acoes` | Registry, TokenAgente, LogAcao, links de matrícula/avaliação, `agendada_para` + fila | Destrava o bot do WhatsApp e o Manus por API |
| `006-ia-imagem` | `imagem.melhorar` / `remover_fundo` / `gerar` (novo item no acervo, origem `ia`) | Depende do padrão do 004 já rodado em produção |
| `007-ia-video-e-render-server` | Reel (slideshow ffmpeg e/ou `video.gerar`), `gerar_arte` server-side como ação | O mais caro; colhe todas as fundações anteriores |

002+003 são o caminho crítico da campanha; 004 pode andar em paralelo ao 003 se
houver braço (toca arquivos diferentes).

## 10. Riscos e salvaguardas

- **Refactor do motor quebrar a arte atual** → critério "pixel-idêntico no feed"
  na 002; MVP em `mvp-apps/studio/` como referência de comparação.
- **Custo de IA descontrolado** → `ExecucaoIA` + card de uso; limites por
  provedor no `config` (ex.: máx. execuções/dia).
- **Chaves de API** → criptografadas no banco, write-only na UI, nunca no browser,
  nunca em log.
- **Provedor fora do ar** → Studio segue 100% funcional (princípio §1.3); erro
  humano no botão, nunca tela quebrada.
- **Imagem de menores (Bombeiro Mirim)** → consentimento da turma (toggle já
  existente no acervo) é pré-condição para QUALQUER geração/publicação; vale
  dobrado para envio de fotos a APIs externas de imagem.
- **Payloads novos** → `docs/plataforma/03` atualizado na mesma mudança
  (constituição §6).
