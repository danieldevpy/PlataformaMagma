# 2026-07-23 — 3 cursos novos criados a partir dos certificados em `certificados/`

## Prompt do Daniel

Pediu para olhar a pasta `certificados/` e usar os certificados como
referência de cada curso (já existia o de Socorrista APH no banco) para
criar esses cursos no banco de dados do ambiente dev (servidor já
inicializado).

## O que foi feito

Lidos os 3 PDFs de certificado (`certificados/bls.pdf`, `leilucas.pdf`,
`punção.pdf`) — cada um com nome do curso, carga horária e conteúdo
programático. A partir deles, criados 3 `Curso` novos via
`manage.py shell` (settings `dev`, mesmo banco do servidor de teste já
rodando), seguindo o padrão do curso `socorrista-aph` (template de
referência) e o tom de voz de `design-system/AGENTS.md` §8:

- `bls-suporte-basico-de-vida` — BLS/SBV, 20h
- `primeiros-socorros-lei-lucas` — Primeiros Socorros c/ ênfase na Lei
  Lucas 13.722/2018, 4h
- `puncao-venosa-coleta-exames` — Punção Venosa e Coleta de Exames
  Laboratoriais, 10h

Cada um ganhou: campos de venda (`titulo_venda`, `subtitulo`,
`publico_alvo`, `texto_pratica`, `texto_carreira`, SEO), 5-6
`Habilidade` (cards "o que você vai dominar", extraídas do conteúdo
programático do certificado) e 3 `PerguntaFrequente`. Os 3 ficaram como
`status=rascunho` (default do model) — sem imagem hero/prática/carreira
ainda, precisam de curadoria antes de publicar. O instrutor `João Paulo
Bello dos Santos` (já cadastrado, COREN-RJ 525874-ENF) foi vinculado aos
3 via `Instrutor.cursos` (M2M) — é quem assina os certificados de
referência.

Script usado (não versionado, one-off):
`/tmp/.../scratchpad/seed_cursos_certificados.py`.

## Estado ao sair

4 cursos no banco dev: `socorrista-aph` (publicado) + os 3 novos
(rascunho). Nenhuma migração de schema — só dados. Nada em prod foi
tocado.

## Pendente

- Revisar/editar o texto gerado (está no tom da marca, mas não foi
  escrito pelo Daniel) e publicar (`status=publicado`) quando aprovado.
- Subir imagens (`imagem_hero`, `imagem_pratica`, `imagem_carreira`) —
  hoje em branco nos 3.
- Decidir se esses cursos entram na campanha/LP agora ou ficam só no
  catálogo interno por enquanto (meta atual do projeto é lotar o
  Socorrista APH até 08/08).
