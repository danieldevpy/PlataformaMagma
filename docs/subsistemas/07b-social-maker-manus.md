# Subsistema 07 (implementação) — Social Maker rodando no Manus AI

> Complementa `07-social-maker.md`. Aquele documento define o *o quê* (spec do subsistema); este define o *como*, usando o Manus como motor de execução.

## 1. Por que Manus se encaixa aqui

O Manus (empresa dona: Meta) evoluiu de "assistente que responde" para agente que executa e publica. Quatro recursos batem diretamente com o que o spec 07 pede:

| Recurso do Manus | Para que serve no Social Maker |
|---|---|
| **Instagram Connector nativo** | Gera *e publica* posts, stories, reels, carrosséis direto no Instagram da Magma, sem sair do Manus. Também puxa métricas (views, reach, likes, comentários, saves) — cobre a "inteligência de audiência" do spec. |
| **Skills** | Arquivo de instruções reutilizável — é onde você registra o tom de voz, identidade visual, hashtags padrão e regras de aprovação da Magma. Uma Skill = a "constituição de marca" que todo post deve seguir. |
| **Scheduled Tasks / Projects** | Automação recorrente (ex.: "toda segunda, gerar 3 posts a partir do material da semana") e templates reativos (ex.: "sempre que uma foto nova cair nesta pasta, gerar um post"). É exatamente o gatilho "foto de turma → post" do spec. |
| **Memória persistente em arquivos** | O agente lembra decisões, preferências e histórico entre sessões — não precisa reexplicar o tom da marca a cada conversa. |

Modelo mental: **Manus é a fábrica de conteúdo + publicação**; o **n8n continua sendo o sistema nervoso** (WhatsApp, CRM, retenção, matrícula) já previsto no `plano-evolucao-digital-magma.md`. Não sobrepor os dois.

## 2. O que o Manus NÃO deve fazer aqui

- **Atendimento ao lead/aluno** — isso é o subsistema 02 (Atendimento), já desenhado para n8n + WhatsApp Cloud API. Manus não deve responder aluno diretamente.
- **Agente de retenção (churn, recertificação)** — depende de dados do seu sistema próprio (matrículas, datas de certificado). Fica no n8n, que já tem acesso a esse banco. O Manus pode *gerar a peça de comunicação* (texto/imagem), mas quem decide e dispara é o n8n.
- **Fonte de verdade dos alunos/turmas** — continua sendo o sistema próprio (Fase 2 do roadmap). O Manus só recebe matéria-prima (fotos, transcrições, avisos), nunca é onde o dado mora.

## 3. Arquitetura proposta

```
Matéria-prima                         Manus (fábrica + publicação)              Saída
─────────────                         ───────────────────────────              ─────
Foto/vídeo de turma prática   ──┐
Corte de aula (Estúdio, doc 06) ├──►  Project com pasta de entrada   ──►  Draft gerado
Dúvida recorrente (WhatsApp)   │      (Scheduled Task dispara ao          (post/carrossel/reel)
Formatura / vaga publicada     ┘       detectar novo arquivo)                    │
                                       + Skill "Marca Magma"                     ▼
                                       (tom, identidade, hashtags)      Fila de aprovação
                                                                          (Telegram/Slack —
                                                                        gestor aprova/edita)
                                                                                  │
                                                                                  ▼
                                                                       Instagram Connector
                                                                      publica (post/story/reel)
                                                                                  │
                                                                                  ▼
                                                                    Métricas voltam ao Manus
                                                                  → retroalimentam o calendário
```

**Fluxo de aprovação humana (não-negociável, já é princípio do projeto):** o Manus gera o rascunho e entrega num canal de mensageiro (Telegram, já suportado; Slack como alternativa). O gestor aprova, ajusta ou rejeita ali mesmo. Só depois disso o Instagram Connector publica. Isso preserva o princípio "IA produz, humano aprova" do documento de visão.

## 4. A Skill "Marca Magma" — o que colocar nela

Uma Skill é o lugar certo para consistência de marca. Sugestão de conteúdo:

- Tom de voz: acolhedor, técnico sem ser frio, linguagem da Baixada (não é "corporativês").
- O que nunca fazer: prometer emprego garantido, prometer aprovação em concurso, usar termos técnicos de saúde sem explicar.
- Hashtags fixas + variáveis por curso (ex.: `#SocorristaAPH #NovaIguaçu` sempre; + tag do curso específico).
- Paleta e identidade visual (logo, cores) — igual ao que a landing page/design-system já define.
- CTA padrão: sempre apontar para WhatsApp com mensagem pré-preenchida rastreável por curso (mesmo princípio da Fase 0 do roadmap) ou para a página do curso na vitrine.
- Formatos por público (ver seção 5) — a Skill deve saber diferenciar tom para pais (Bombeiro Mirim) vs. profissional de saúde (APH/Punção).

## 5. Técnicas de marketing alinhadas ao projeto

O `01-ofertas-e-publicos.md` já mapeia 5 cursos e públicos distintos — a estratégia de conteúdo deve variar por curso, não ser genérica.

**Pilares de conteúdo por curso**

| Curso | Pilar de conteúdo | Gatilho psicológico |
|---|---|---|
| Socorrista APH | Bastidores da prática (manequim, simulação) + prova social de quem já atua | Autoridade / competência |
| Punção Venosa | Vídeo curto "erro comum vs. certo" | Curiosidade / medo de errar |
| Cuidador de Idosos | Histórias reais de impacto (com permissão) | Emoção / propósito |
| Auxiliar de Farmácia | "Depois da Magma, fui contratado em X" + mural de vagas | Prova social + urgência de emprego |
| Bombeiro Mirim | Fotos/vídeos fofos da turma infantil, depoimento de pais | Emoção / orgulho dos pais |

**Princípios operacionais (herdados do spec e reforçados pela pesquisa de mercado 2026)**

1. **Constância > viralidade.** O spec já diz isso: presença diária previsível constrói marca local melhor que um post viral isolado. O Scheduled Task do Manus existe justamente para garantir isso sem depender de alguém "lembrar".
2. **Rastreamento de origem em tudo.** Todo post deve linkar para WhatsApp/landing com UTM ou mensagem pré-preenchida — sem isso você não sabe o que funciona (o Instagram Connector traz métricas de engajamento, mas conversão em lead só se mede rastreando o clique).
3. **Geo-marketing local.** Conteúdo e Meta Ads devem reforçar "Nova Iguaçu e Baixada" — é onde a Magma compete por proximidade, não por preço (Invictus/Opusseg já competem em preço).
4. **Prova social como ativo central.** Cada aluno formado é conteúdo e é lead vitalício (carteirinha digital, certificado verificável) — o pilar de conteúdo mais barato e mais crível é sempre "aluno real".
5. **O aluno formado retroalimenta o funil.** Formatura → post → convite para próxima turma → nutrição de quem ainda não matriculou. Fecha o ciclo do diagrama da visão geral.

## 6. Passo a passo para montar (ordem sugerida)

1. Criar a Skill "Marca Magma" no Manus (texto da seção 4).
2. Conectar o Instagram Connector (Settings → Connectors → Instagram) na conta oficial da Magma.
3. Criar um Project com pasta de entrada (fotos de turma, cortes do Estúdio, prints de dúvidas do WhatsApp).
4. Configurar Scheduled Task semanal: "gerar N rascunhos de post a partir do que entrou na pasta esta semana, aplicando a Skill Marca Magma".
5. Conectar a saída dos rascunhos a um canal Telegram (já suportado) para aprovação do gestor antes da publicação.
6. Rodar 2–3 semanas manualmente supervisionado antes de confiar 100% no agendamento.
7. Definir o parâmetro de sucesso: 15–20 posts/semana com ~2h de trabalho humano (meta já definida no spec original).

## 7. Riscos / pontos de atenção

- Conector de Instagram é relativamente novo — testar publicação em conta secundária antes de usar na conta oficial.
- Skills e Scheduled Tasks consomem plano/créditos do Manus — checar limites de plano antes de programar automações em massa (o próprio Manus recomenda checar `get_me_context`/limites antes de rodar lotes).
- Conteúdo envolvendo menores (Bombeiro Mirim) e pacientes/idosos exige autorização de imagem — isso é processo humano, não automatizável, e deve ser um passo obrigatório *antes* de a foto entrar na pasta de matéria-prima do Manus.
