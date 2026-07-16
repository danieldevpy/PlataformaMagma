# 00 — Visão e Contexto

## A empresa hoje

**Magma Cursos** — escola presencial de cursos e treinamentos profissionais em Nova Iguaçu, RJ (R. Prof. Norberto Cataldi, 98 — Rua Nossa Senhora de Fátima, 495 — Olinda, Nilópolis), com estrutura física alugada.

**Cursos atuais:** Socorrista APH (120h), Punção Venosa, Cuidador de Idosos, Auxiliar de Farmácia, Bombeiro Mirim.

**Canais atuais:** apenas Instagram (@magma_curso). Sem site, sem sistema de gestão, sem funil estruturado.

**Concorrência local:** Invictus, Opusseg, ESESP, Acqua Fire, Cruz Vermelha RJ — competem por preço e certificação; nenhum tem presença digital forte com experiência de aluno, credenciais verificáveis ou recorrência.

**Contexto do projeto:** Daniel entra como sócio-desenvolvedor; a tecnologia construída é o seu equity na sociedade.

## Tese estratégica

O produto da Magma tem forte componente **prático** (APH, punção venosa) — isso é vantagem contra EAD puro: a prática presencial é o que só a Magma entrega. Portanto:

> **O digital não substitui o presencial; ele capta, ensina a teoria, retém e monetiza. O físico é o palco da prática e da certificação.**

Ativo hoje desperdiçado: **todo aluno formado é um relacionamento vitalício** (recertificação, novos cursos, indicação, encaminhamento a vagas). A plataforma existe para capturar e cultivar esse ativo.

## Visão

**"O colégio digital da saúde da Baixada Fluminense"** — um ecossistema onde:

1. O **físico** entrega prática e certificação.
2. O **digital** atrai, ensina teoria, retém e gera receita recorrente.
3. **Agentes de IA** operam atendimento, produção de conteúdo e marketing com equipe mínima.

## Princípios de produto

1. **Uma plataforma, vários subsistemas** — módulos independentes que compartilham dados e identidade, evoluindo de forma incremental.
2. **Fonte única de verdade** — cada informação (aluno, curso, aula, certificado) vive em um só lugar; tudo mais deriva dela.
3. **Human-in-the-loop** — IA produz, humano aprova. Vale para atendimento, conteúdo didático e posts.
4. **O aluno como vitrine** — credenciais verificáveis e carteirinha digital transformam cada formado em prova social ambulante.
5. **Recorrência sobre transação** — o desenho favorece vínculos contínuos (assinatura, recertificação, comunidade, vagas) em vez de venda única de curso.
6. **Baixa fricção para o professor** — quem ensina não vira operador de software; entrada por áudio/voz e automação do resto.

## Mapa de subsistemas

```
                    ┌─────────────────────┐
  Redes sociais ◄───┤ 07 Social Maker     │◄── conteúdo derivado
        │           └─────────────────────┘         das aulas
        ▼                                             ▲
┌─────────────────┐   ┌─────────────────────┐  ┌──────────────────┐
│ 01 Vitrine &    │──►│ 02 Atendimento &    │  │ 06 Estúdio de    │
│    Captação     │   │    Comunicação      │  │    Conteúdo      │
└─────────────────┘   └──────────┬──────────┘  └────────┬─────────┘
   lead capturado                │ matrícula            │ material didático
                                 ▼                      ▼
                      ┌─────────────────────┐  ┌──────────────────┐
                      │ 03 Gestão Escolar   │─►│ 05 Área do Aluno │
                      └──────────┬──────────┘  │  (híbrido/Magma+)│
                                 │ conclusão   └────────┬─────────┘
                                 ▼                      │
                      ┌─────────────────────┐           │
                      │ 04 Certificação &   │◄──────────┘
                      │    Credenciais      │──► volta ao 02 (recertificação)
                      └─────────────────────┘
```

**Ciclo de vida do relacionamento:** desconhecido → lead → aluno → certificado → membro (Magma+) → recertificação/indicação → novo ciclo.
