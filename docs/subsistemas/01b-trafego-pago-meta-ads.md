# Subsistema 01b (implementação) — Tráfego Pago (Meta Ads)

> Complementa `01-vitrine-captacao.md` (que já lista "landing pages por campanha,
> com pixel e rastreamento de conversão" como capacidade). Este documento é o
> *como* da primeira campanha real, refeito em cima de um guia gerado pelo Manus
> (`magma_meta_ads_guide.md`, entregue 2026-07-24) — adaptado ao que já existe
> no sistema e às restrições reais deste ciclo.

## 0. Escopo e restrições desta fase (definidas com o Daniel em 24/07)

- **Só aquisição.** Nenhuma campanha de retenção/reativação agora — não há base
  de retargeting/lookalike madura, e não há tempo até 08/08 pra isso valer a pena.
- **Orçamento teto: R$1.000.** Não precisa gastar tudo de uma vez; a ideia é
  começar pequeno e **reinvestir conforme a campanha gerar matrícula**.
- **Prazo:** meta é turma cheia até 08/08/2026 — de hoje (24/07) são ~15 dias.
- **Só Socorrista APH.** É o único curso com vaga aberta, conteúdo pronto e
  prova social real. Os 3 cursos novos (BLS, Primeiros Socorros, Punção Venosa)
  ainda estão em rascunho (`.context/status.md`, 23/07) — fora desta campanha.

## 1. Por que o plano do Manus foi refeito, não só copiado

O guia original (`magma_meta_ads_guide.md`) acertou a parte de marca (cores,
tipografia, formatos — bate com `design-system/AGENTS.md`) mas tinha 4 problemas
pro nosso caso concreto:

1. **Assumia Pixel/Conversions API já instalados.** Conferido: não existe Pixel
   nem GTM no frontend hoje. Toda a estrutura de retargeting/lookalike do guia
   (§3.3.2-3.3.3) depende de um sinal que a gente não tem.
2. **Cronograma de 5+ semanas** (Fase 1→2→3) não cabe nos 15 dias até 08/08.
3. **Orçamento em USD e genérico** ("$30-50/dia por conjunto" × múltiplos
   conjuntos/campanhas) — não calibrado pro porte de uma escola local com teto
   de R$1.000 no ciclo inteiro.
4. **Não considerava que o funil real é WhatsApp-first.** MAG (agente SDR, spec
   010/013/014) já qualifica e matricula pelo chat — o objetivo de campanha mais
   direto ("Mensagens"/Click-to-WhatsApp) nem foi citado no guia original.

## 2. Estrutura da campanha (única, para este ciclo)

| Item | Definição |
|---|---|
| Campanhas | **1** — "Captação Socorrista APH" |
| Conjuntos de anúncios | **1** (orçamento pequeno demais pra justificar split/CBO) |
| Objetivo | **Mensagens** (Click-to-WhatsApp) — não depende de pixel pra funcionar, cai direto na conversa com o número oficial `(21) 97976-7821`, onde o MAG já assume a qualificação |
| Público | Advantage+ Audience como base, raio ~20km em torno de Nilópolis/Nova Iguaçu (cobre a Baixada: Mesquita, Belford Roxo, Duque de Caxias), 18-45 anos, sem restrição de gênero |
| Posicionamento | Automático (Advantage+ placements) |
| Criativos | 3-4 variações no mesmo conjunto (Studio já produz nos formatos certos — 1080×1080 feed, 1080×1920 stories) |
| Orçamento | R$40-50/dia nos primeiros 3-4 dias (fase de aprendizado); ajustar pra cima/baixo depois conforme custo por conversa, sempre dentro do teto de R$1.000 total |
| CTA | "Enviar mensagem", texto pré-preenchido: *"Olá! Vi o anúncio do Socorrista APH e quero saber mais sobre a próxima turma."* |

**Por que Mensagens e não Leads/Tráfego para a LP:** sem pixel maduro, uma
campanha otimizada por conversão no site não tem sinal suficiente pra sair da
fase de aprendizado em 15 dias. Click-to-WhatsApp é nativo (não depende de
pixel), tem menos fricção (mais volume pro orçamento pequeno) e cai direto no
canal que já é comprovadamente forte (MAG). A credibilidade que a LP daria
(credenciais do instrutor, prova social — diferencial citado em `01-vitrine-captacao.md`)
fica por conta do **criativo do anúncio** (foto/depoimento/selo), não da página.

### Criativos sugeridos (dentro do único conjunto)

1. Vídeo/foto de simulação prática (autoridade — manequim, equipamento real).
2. Depoimento de aluno formado (prova social — Studio já tem template pronto).
3. Estático "Últimas vagas" (urgência real, vermelho com moderação — regra de marca).
4. Carrossel bastidores + credencial do instrutor (COREN, experiência).

## 3. Rastreamento — o que entra agora vs. o que fica pra depois

**Agora (spec `specs/018-rastreamento-trafego-pago/`):** Meta Pixel **client-side**
apenas — `PageView` na LP + evento `Contact`/`Lead` nos cliques de WhatsApp que
já existem (`WaLinks`, `LeadForm`). Mesmo a campanha principal não dependendo de
pixel, isso começa a acumular sinal de quem visitou o site vindo do anúncio —
sem custo de implementação real (poucas linhas, reaproveita componentes que já
existem) e sem travar o lançamento.

**Como amarrar a origem ao anúncio:** o texto pré-preenchido da mensagem do
anúncio serve de "UTM manual" — quem cai direto no WhatsApp sem passar pela LP
não carrega `utm_source` automaticamente (o campo já existe em `Lead`, só não
tem como o Meta preenchê-lo num Click-to-WhatsApp direto). Registrado como
lacuna conhecida: ajustar o prompt do MAG pra reconhecer esse texto padrão e
marcar `utm_source=meta_ads` ao criar o `Lead` fica **fora do escopo agora**
(possível spec futura, pequena).

**Depois (só se decidir reinvestir/escalar pós-08/08):**
- Conversions API server-side, reaproveitando o padrão do webhook já existente
  em `apps/leads/signals.py` (mesmo princípio: `post_save` → chamada HTTP externa).
- Custom Audiences a partir de `Aluno`/`Matricula` (dado já limpo e correto).
- Só então Lookalike e campanha de retargeting — sem isso agora, é otimização
  sem dado suficiente pra valer a pena.

## 4. Do guia original, o que continua valendo

- **Poucos criativos é ruim** — manter 3-5 variações no conjunto.
- **Não fragmentar** em muitas campanhas/conjuntos — 1 campanha, 1 conjunto.
- **Não reestruturar toda hora** — dar ~4-5 dias por leva de criativos antes de trocar.
- Tom de voz e regras visuais do §4 do guia original (prova antes de promessa,
  Archivo/Inter, símbolo oficial) seguem válidas e já batem com `design-system/AGENTS.md`.

## 5. Métricas deste ciclo

- **Custo por conversa iniciada** (WhatsApp) — métrica primária no Ads Manager.
- **Leads qualificados pelo MAG** — o agente já registra `Lead` com curso/interesse.
- **Taxa conversa → matrícula** — via `Matricula` (já existe, spec 014).
- **CPA real** = gasto total / matrículas novas atribuíveis à campanha (atribuição
  aproximada, via texto da mensagem — ver §3).

## 6. Passo a passo pra colocar no ar

1. Confirmar Business Manager + WhatsApp Business (número oficial) + Página
   conectados no Ads Manager.
2. Criar campanha, objetivo **Mensagens**, 1 conjunto de anúncios, orçamento
   R$40-50/dia pra começar.
3. Segmentação: raio ~20km em torno de Nilópolis/Nova Iguaçu, 18-45 anos,
   Advantage+ Audience.
4. Subir 3-4 criativos (gerar/adaptar no Studio).
5. Configurar a mensagem pré-preenchida do anúncio (texto padrão do §2).
6. Rodar 3-4 dias sem mexer — deixar o algoritmo aprender.
7. A partir do dia 4-5: pausar o criativo mais fraco, subir 1 novo, ajustar
   orçamento dentro do teto de R$1.000.
8. Repetir até 08/08 ou até o teto acabar — decidir reinvestimento com o Daniel
   conforme matrícula entrar.

## 7. Fora de escopo (explícito)

- Campanha de retenção/reativação de ex-alunos.
- Lookalike audience.
- Conversions API / envio de PII.
- Advantage+ Shopping (catálogo) — não se aplica a 1 curso só.
- Múltiplas campanhas/CBO.
