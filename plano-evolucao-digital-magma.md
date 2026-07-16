# Plano de Evolução Digital — Magma Cursos

> Projeto pessoal de Daniel Fernandes | Julho/2026
> Objetivo: entrar como sócio-desenvolvedor e transformar a Magma em um ecossistema físico + digital de formação profissional na Baixada Fluminense.

---

## 1. Diagnóstico

**Situação atual**
- Escola presencial em Nova Iguaçu (Nilopolis), estrutura alugada.
- 5 cursos: Socorrista APH (120h), Punção Venosa, Cuidador de Idosos, Aux. de Farmácia, Bombeiro Mirim.
- Comunicação: apenas Instagram (@magma_curso). Sem site, sem funil, sem sistema de gestão.
- Concorrentes locais já mais digitalizados: Invictus (bolsas de 50% via landing page), Opusseg (certificação internacional HSI), ESESP, Acqua Fire, Cruz Vermelha RJ.

**Leitura estratégica**
- O produto da Magma tem forte componente prático (APH, punção) — isso é uma *vantagem* contra EAD puro: ninguém aprende punção venosa só por vídeo. O digital deve alimentar o presencial, não substituí-lo.
- Mercado 2026 favorece exatamente o modelo híbrido: ~78% dos estudantes preferem híbrido ao presencial puro, e microcertificações/cursos curtos estão em alta.
- Concorrência local compete por preço e certificação. A Magma pode competir por **experiência digital + comunidade + recorrência**, onde ninguém da região está forte.

**Ativo escondido:** todo aluno formado é um lead vitalício (recertificação, novos cursos, indicação, vaga de emprego). Hoje esse ativo se perde ao fim da turma.

---

## 2. Visão

**"O colégio digital da saúde da Baixada"** — um ecossistema onde:

1. O **físico** é o palco da prática e da certificação (o que só a Magma entrega).
2. O **digital** capta, ensina a teoria, retém e monetiza de forma recorrente.
3. **Agentes de IA** operam atendimento, marketing e produção de conteúdo com equipe mínima.

```
Instagram/TikTok → Agente WhatsApp → Matrícula online → Curso híbrido
      ↑                                                      ↓
 Fábrica de conteúdo IA  ←  Comunidade/Assinatura ← Aluno certificado
```

---

## 3. Roadmap incremental

### Fase 0 — Fundação (semanas 1–4) · custo ~R$0–150/mês

Presença digital mínima viável. Nada de código complexo ainda.

| Ação | Ferramenta | Custo |
|---|---|---|
| Google Business Profile completo (fotos, cursos, avaliações de ex-alunos) | Google | R$0 |
| WhatsApp Business com catálogo de cursos e respostas rápidas | Meta | R$0 |
| Landing page com os 5 cursos + formulário de interesse | Você desenvolve (Astro/Next) + Vercel/Cloudflare Pages | R$0 + domínio ~R$40/ano |
| Pixel Meta + Google Tag na landing | Meta/Google | R$0 |
| Link na bio estruturado (cada curso → WhatsApp com mensagem pré-preenchida rastreável) | Na própria landing | R$0 |
| Planilha/CRM simples de leads | Google Sheets ou NocoDB | R$0 |

**Meta da fase:** todo interessado vira um registro rastreável, não uma DM perdida.

### Fase 1 — Captação e atendimento com IA (meses 2–3) · ~R$200–500/mês

| Ação | Ferramenta | Custo |
|---|---|---|
| Agente IA no WhatsApp: responde dúvidas (preço, datas, carga horária), qualifica lead, agenda visita, avisa humano | n8n (você já domina) + Evolution API ou WhatsApp Cloud API + Claude/GPT | VPS ~R$50 + API ~R$50–150 |
| Tráfego pago local: Meta Ads geolocalizado (Nova Iguaçu + municípios vizinhos), criativo por curso | Meta Ads | R$300–500/mês (começar com R$10–15/dia) |
| Remarketing para quem clicou e não matriculou | Meta Ads | incluso |
| Sequência de nutrição: lead frio recebe conteúdo (dicas de primeiros socorros, mercado de trabalho do cuidador) até a próxima turma abrir | n8n + WhatsApp | R$0 extra |
| Prova social sistematizada: depoimento em vídeo de cada turma formada | celular + CapCut | R$0 |

**Meta da fase:** dobrar leads/mês e responder 100% em <1 min, 24/7.

### Fase 2 — Operação digitalizada (meses 3–6) · seu core como sócio-dev

Aqui entra o **sistema próprio da Magma** — o ativo tecnológico que justifica sua sociedade. Desenvolver incremental, um módulo por vez:

1. **Matrícula online** — aluno escolhe curso/turma, preenche dados, assina contrato digital, paga (Pix/cartão/boleto via Asaas ou Mercado Pago — taxas por transação, sem mensalidade).
2. **Gestão de turmas** — vagas, lista de presença digital (QR code na sala), notas práticas.
3. **Certificado digital verificável** — PDF com QR code que valida em `certificados.magmacursos.com.br`. Diferencial competitivo real: empregador confere autenticidade na hora (concorrentes locais não têm isso).
4. **Cobrança automática** — parcelas, lembrete de vencimento via WhatsApp, redução de inadimplência.
5. **Painel do gestor** — receita, ocupação de turmas, funil de leads.

Stack sugerida: Next.js/Node + Postgres (Supabase free tier) + Asaas. Custo de infra <R$100/mês.

**Meta da fase:** zero papel, zero fila, dado de tudo.

### Fase 3 — Colégio digital híbrido + assinatura (meses 6–12)

1. **Teoria EAD + prática presencial**: gravar a parte teórica dos cursos (APH tem muita teoria) → aluno faz online no seu ritmo, vem à escola só para prática e avaliação. Efeitos: turmas práticas menores e mais frequentes, alcance além de Nova Iguaçu, custo por aluno menor, escala sem aumentar aluguel.
   - Plataforma: área do aluno no seu sistema próprio (vídeos no Cloudflare Stream/Vimeo, ~R$30–100/mês) — evita taxas de Hotmart enquanto o volume é local.
2. **Assinatura "Magma+"** (R$19,90–39,90/mês):
   - Comunidade de socorristas/cuidadores formados (WhatsApp/Discord ou no app).
   - Microaulas mensais de atualização (protocolos, novidades).
   - Recertificação anual com desconto (APH exige atualização — recorrência natural!).
   - Mural de vagas: parcerias com clínicas, home cares, eventos que precisam de socorrista. **Este é o gancho mais forte: a Magma vira ponte de emprego, não só escola.**
3. **Microcertificações**: cursos curtos de fim de semana (DEA, primeiros socorros para leigos/escolas/academias, RCP para pais) — tíquete menor, porta de entrada para os cursos longos.
4. **B2B**: treinamentos in-company (NR, brigada, primeiros socorros para escolas, condomínios, indústrias de Queimados/Seropédica). Tíquete alto, mesma estrutura docente.

### Fase 4 — Social maker agêntico + expansão (12+ meses)

1. **Fábrica de conteúdo com agentes**: pipeline n8n que transforma cada aula/evento em conteúdo — foto da turma → post + legenda; dúvida frequente do WhatsApp → carrossel; gravação de aula → cortes para Reels/TikTok. Aprovação humana no final, publicação agendada. 15–20 posts/semana com ~2h de trabalho humano.
2. **Agente de retenção**: monitora alunos EAD parados, ex-alunos sem recertificar, assinantes em risco de churn → aciona campanha personalizada.
3. **IA preditiva simples**: qual curso abrir, em qual mês, com base no histórico de leads e sazonalidade.
4. **Expansão**: licenciamento do modelo (sistema + método + marca) para escolas parceiras em outros municípios da Baixada — o software que você construiu vira o produto.

---

## 4. Cases de referência

- **Invictus (concorrente direto)**: landing page com "bolsa de até 50%" — funil de captação agressivo simples de replicar e superar.
- **Amei Care (Nova Iguaçu)**: já vende curso de cuidador online — valida demanda EAD local.
- **Cruz Vermelha RJ**: autoridade via marca e recertificação — o modelo de recorrência que a Magma+ pode capturar localmente.
- **Modelo geral**: escolas de aviação civil e NR no Brasil migraram para "teoria EAD + prática presencial" com sucesso; é o mesmo desenho regulatório-prático da Magma.

## 5. Orçamento consolidado (dentro de R$1.000/mês)

| Item | Fase | R$/mês |
|---|---|---|
| Domínio + hospedagem/infra (VPS, Supabase, Vercel) | 0–2 | ~100 |
| APIs de IA (Claude/GPT para agente WhatsApp) | 1+ | 100–200 |
| WhatsApp API (Evolution self-hosted ≈ 0 / Cloud API por conversa) | 1+ | 0–100 |
| Meta Ads | 1+ | 400–500 |
| Vídeo (Stream/Vimeo) | 3 | 30–100 |
| **Total** | | **~700–1.000** |

## 6. KPIs por fase

- **F0:** 100% dos leads registrados; landing no ar; 20+ avaliações Google.
- **F1:** leads/mês (baseline → 2x); tempo de resposta <1 min; custo por lead <R$15; taxa lead→matrícula.
- **F2:** % matrículas online; inadimplência; certificados verificáveis emitidos.
- **F3:** assinantes Magma+; receita recorrente (MRR); % receita não-presencial; NPS.
- **F4:** posts/semana automatizados; taxa de recertificação; contratos B2B.

## 7. Quick wins — esta semana

1. Criar/reivindicar o Google Business Profile e pedir avaliação a 10 ex-alunos.
2. Migrar o número para WhatsApp Business com catálogo dos 5 cursos.
3. Registrar domínio (ex.: `magmacursos.com.br`) e subir landing v1.
4. Começar a gravar depoimentos da próxima turma que se formar.
5. Definir com o dono o acordo de sociedade *antes* de escrever a primeira linha do sistema próprio (Fase 2) — o software é o seu equity.

---

## Princípio geral

Cada fase se paga antes da próxima começar: Fase 0/1 aumenta receita de matrículas → financia o desenvolvimento da Fase 2 → que viabiliza o produto digital da Fase 3 → que financia a escala da Fase 4. Nada depende de aposta grande; tudo é incremental e reversível.
