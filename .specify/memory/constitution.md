# Constituição — Magma Cursos

> Princípios que **nenhuma spec, sessão ou agente pode violar**. Mudança aqui é decisão
> do Daniel, registrada em `.context/decisoes.md`. Concepção original:
> `docs/plataforma/09-fluxo-speckit-dotcontext.md`.

1. **SEED-FIRST.** Todo conteúdo do template é registro inicial no banco
   (`docs/plataforma/08`). Nenhuma feature assume banco vazio, e nenhuma feature
   sobrescreve `conteudo_origem="editado"`. Seed idempotente: rodar 2× não muda nada.

2. **O GESTOR É A FONTE DOS DADOS.** Conteúdo de produção só muda pelo painel (ou pelo
   seed enquanto `origem="template"`). O dev edita funcionalidade, não conteúdo. Toda
   tela do painel deve ser operável por um não-técnico pelo celular.

3. **TOGGLE ANTES DE FEATURE.** Tudo que aparece/some no site público tem booleano
   `exibir_*` editável no painel. A regra de exibição vive no serializer (API entrega
   `null` quando desligado/expirado); o front apenas renderiza condicionalmente.

4. **ZERO REDESIGN.** O visual é lei: `design-system/` (tokens + AGENTS.md) é a
   referência. Specs de UI referenciam componentes/classes existentes, nunca inventam
   estilo novo.

5. **FASES ENTREGÁVEIS.** Cada spec cabe em uma fase do roadmap (`docs/plataforma/07`)
   e termina em estado deployável. Nada da fase N+1 entra na fase N.

6. **API É CONTRATO.** `docs/plataforma/03` é a fonte de verdade; mudança de payload
   exige atualizar o doc na mesma mudança. Erros: `{"detail": "..."}`; IDs públicos são
   slug/uuid, nunca PK sequencial.

7. **MEMÓRIA VIVA.** Sessão que muda um módulo atualiza o `.context/` correspondente;
   sessão significativa termina com `.context/status.md` atualizado + entrada em
   `.context/historico/`. Um projeto sem memória atualizada é considerado quebrado.
