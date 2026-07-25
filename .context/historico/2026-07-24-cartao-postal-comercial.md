# 2026-07-24 — Cartão-postal comercial (documento de venda do serviço)

## Prompt do Daniel (resumo)

A Magma só tinha uma página no Instagram e contato orgânico via WhatsApp direto com o
instrutor; o Daniel acredita ter gerado valor real e quer "importar" esse valor pra outras
empresas que estão começando — como renda extra. Pediu um documento único ("o real cartão
postal") que mostre esse valor usando **uma empresa fictícia** (sem ser a Magma) no mesmo
cenário de partida, **sem explorar a parte técnica** (será lido por outros donos de negócio),
mostrando o que agregou e o que dá pra fazer a mais.

## O que foi feito

- **`docs/comercial/cartao-postal-negocio-digital.html`** — documento comercial em formato
  literal de cartão-postal aéreo (borda *par avion*, selo "90 dias à frente", carimbo postal):
  - Empresa fictícia: **"Doce Ofício"**, escola de confeitaria de bairro (mesmo ponto de
    partida: perfil no Instagram + WhatsApp da instrutora).
  - Estrutura: dores do cenário inicial → linha do tempo de "uma terça-feira depois da
    virada" (resumo diário 8h, atendimento imediato, lead da madrugada, toques D+1/3/7,
    aviso de cliente quente pra equipe, matrícula+pagamento na conversa) → grade de valor
    (receita, tempo, confiança, memória, crescimento, marca) → "o que dá pra construir em
    cima" (artes, anúncios, gestão, inteligência) → nota de honestidade (**o Doce Ofício é
    fictício; a operação é real**, rodando em produção na Baixada) → CTA assinado
    "Daniel Fernandes · Operação digital para negócios locais".
  - Cada momento da linha do tempo corresponde a uma entrega real da plataforma
    (Radar/spec 019, SDR/specs 010+017+023, Nutridora/specs 011+020, handoff/spec 012,
    matrícula+cobrança/specs 014+015, conversas/spec 021, pixel/spec 018) — traduzida em
    linguagem de dono de negócio, zero jargão técnico.
  - Dois mockups de conversa de WhatsApp (resumo diário e aviso de handoff) com números
    marcados como ilustrativos.
  - Tema claro/escuro, responsivo, sem dependência externa.
- **Publicado como Artifact** (privado até o Daniel compartilhar):
  https://claude.ai/code/artifact/ff7bb159-7dfe-4d79-ab69-23ab836530b2

## Revisão (mesma sessão)

Feedback do Daniel: a 1ª versão fazia parecer que o único valor era o agente/automação de
atendimento, escondendo o grosso do trabalho — site do zero, Studio e painel do zero,
domínio, VPS, infra inteira, integração de pagamento. Reestruturado:

- Centro do postal virou o **"Manifesto de carga"** — 3 volumes do que foi construído do
  zero: **A casa própria** (domínio, site sob medida, servidor próprio, identidade visual),
  **O comando** (painel completo, Estúdio de artes, acervo, avaliações) e **A operação que
  não dorme** (recepcionista, toques D+1/3/7, handoff, resumo, matrícula+pagamento) — com
  tag "do zero" nos itens construídos integralmente.
- Seção nova **"Em pedaços, isso seria meia dúzia de fornecedores"** (construtor de site +
  CRM + chatbot + designer + link de pagamento avulso + agência, contra a peça única
  integrada e própria).
- Linha do tempo rebalanceada pra mostrar o ecossistema, não só o chat: painel atualizando
  o site na hora (09:30), site achado no Google (10:12), arte no Estúdio em 20 min (14:00).
- Grade de valor ganhou o cartão **Patrimônio** ("nada é alugado") em primeiro.
- Hero e nota de honestidade reescritos: "não é um robô de atendimento — é uma operação
  digital completa, construída do zero, peça por peça".

## Estado ao sair

- Documento pronto e publicado; fonte versionado em `docs/comercial/` (sem commit — regra).
- Pendente opcional: adicionar WhatsApp/Instagram de contato real na assinatura do CTA e
  republicar na mesma URL (basta editar o HTML e rodar o Artifact de novo com o mesmo path).
