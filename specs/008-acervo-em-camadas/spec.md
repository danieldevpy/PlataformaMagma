# Spec 008 — Acervo em camadas (turma · curso · marca) + acesso pelo Studio

> Correção de rumo do Studio 2.0 (sessão de 2026-07-18): o acervo deixa de ser
> exclusivo da turma e vira o **acervo da marca, organizado em camadas**. A turma
> passa a ser UMA camada entre várias. Motivação: produção de conteúdo diária
> (página do curso, stories, reels) mistura fotos de turmas, do curso, de
> instrutores, da estrutura e de banco de imagens — o modelo turma-cêntrico do
> subsistema 09 não comporta isso.

## O quê / porquê

1. **Modelo**: `MidiaTurma` vira `Midia`, com campo `camada`
   (`turma | curso | instrutores | estrutura | externa | geral`), `turma`
   opcional, `curso` opcional e `credito` (atribuição/licença de imagem externa).
   `Postagem` ganha os mesmos contextos (turma opcional, curso opcional).
2. **API**: rotas gerais ao lado das rotas por turma (que NÃO mudam):
   listar acervo com filtros, resumo de camadas, upload em qualquer camada,
   postagens de qualquer contexto.
3. **Mesa de Luz da marca**: página staff nova para subir/curar mídia das
   camadas não-turma (fotos E vídeos), reaproveitando a Mesa de Luz existente.
4. **Studio**: o picker de fotos ganha um **seletor de camada** — da turma
   atual, de outras turmas, do curso, da marca — e nasce a entrada
   **Studio da marca** (sem turma) para o conteúdo diário; templates que
   dependem de dados de turma declaram `requer: ['turma']` e aparecem
   desabilitados fora desse contexto.

## Invariantes de camada

- `camada = "turma"` ⇔ `turma` preenchida (curso implícito via turma).
- `camada = "curso"` ⇔ `curso` preenchida e `turma` vazia.
- Demais camadas (`instrutores/estrutura/externa/geral`) ⇒ `turma` e `curso` vazias.
- Upload físico: com turma segue `turmas/<id>/<tipo>/` (compat — nenhum arquivo
  existente muda de lugar); sem turma vai para `acervo/<camada>/<tipo>/`
  (curso: `acervo/cursos/<id>/<tipo>/`).
- **Consentimento continua sendo da turma**: foto com aluno identificável mora
  na camada turma (onde o toggle existe). Camadas da marca são instrutor,
  estrutura, banco de imagens e artes. `on_delete` da turma segue CASCADE —
  apagar a turma apaga a mídia dela (LGPD > conveniência).
- Imagem de internet (`camada=externa`) registra `credito` (fonte/licença).

## Critérios de aceite

1. Migração roda em dev e prod **sem mover nenhum arquivo físico**; itens
   existentes ficam `camada="turma"`; suíte antiga continua verde.
2. `GET /api/midia/acervo/` filtra por `camada`, `curso`, `turma`, `tipo`,
   `tag`, `q`; `GET /api/midia/acervo/camadas/` devolve o resumo (contagens por
   camada, por curso e por turma) que alimenta os seletores de camada.
3. `POST /api/midia/acervo/enviar/` sobe mídia em qualquer camada, valida os
   invariantes acima (400 quando violados) e mantém a checagem de duplicado
   (409 + `forcar`) **no escopo da camada de destino**.
4. `GET/POST /api/midia/postagens/` cria/lista postagens de turma, de curso ou
   da marca; as rotas `turmas/<id>/…` continuam respondendo igual (n8n/Manus
   não quebram).
5. Mesa de Luz da marca em `/dj-admin/midia/midia/acervo/` com seletor de
   camada; upload múltiplo, dedup, curadoria (tags/legenda/lightbox) e vídeos
   funcionando como na Mesa da turma; sem toggle de consentimento.
6. No Studio da turma, o picker de fotos tem seletor de camada e uma arte pode
   **misturar fotos de camadas diferentes**; no Studio da marca
   (`/dj-admin/midia/midia/studio/`), educativo e capa de reel funcionam de
   ponta a ponta (arte → postagem da marca) e os templates de turma aparecem
   desabilitados com aviso.
7. `listar_postagens_agendadas` (camada de ações) devolve o contexto da
   postagem (código da turma, slug do curso ou "marca") sem expor PK.
8. `docs/plataforma/03-api-contratos.md` atualizado na mesma mudança.

## Critério de aceite do gestor

Daniel abre o Studio da marca num dia sem evento de turma, escolhe "Educativo",
gera feed+story com foto do acervo geral e cria a postagem — sem precisar de
nenhuma turma. Na Mesa de Luz da marca, sobe 10 fotos da estrutura e 1 vídeo,
e elas aparecem no picker do Studio de qualquer turma.

## Fora de escopo (fica para as próximas)

- Avaliações por curso/marca no template Depoimento (hoje segue exigindo turma).
- Vídeo dentro da arte do Studio e reel automatizado — spec 007.
- Convergência de `FotoCurso` para o acervo (ADR em `.context/decisoes.md`).
- Calendário editorial visual e `sugerir_pauta` — spec própria (010).
