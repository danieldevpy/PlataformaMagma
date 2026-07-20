# 2026-07-20 — Studio ✨: campo de instrução livre pra melhorar/encurtar/variações

## Prompt do Daniel

Daniel percebeu que, quando pedia pra IA "melhorar" um texto no Studio, o
resultado não parecia levar em conta o texto atual — pediu pra investigar
como a camada de IA para texto monta o "contexto resumo" enviado ao
modelo.

## Investigação

Leitura de ponta a ponta do pipeline (`studio.js` → `views.py` →
`prompts.py` → adaptadores OpenAI/Anthropic/Gemini) confirmou que
`texto_atual` **já** era enviado corretamente em todas as camadas —
inclusive coberto por teste (`apps/ia/tests.py`). A suspeita original não
se confirmou.

O ponto fraco real, identificado durante a investigação: o campo
`instrucao` do contexto (que o prompt usa pra saber *como* reescrever) só
recebia uma palavra fixa (`"melhorar"` ou `"encurtar"`, hardcoded em
`studio.js`) — não havia espaço pro usuário dizer *como* queria a
reescrita (ex.: "mais informal", "focar nas vagas restantes"). Esse
espaço já estava previsto no contrato da spec 004
(`specs/004-ia-config-e-texto/plan.md`), só faltava UI.

## O que foi feito

Branch `feature/ia-instrucao-livre` (a partir de `master`).

- **`apps/ia/prompts.py`**: novo campo de contexto `detalhe` (rótulo
  "Detalhe pedido pelo usuário"), distinto de `instrucao` (que continua
  sendo a palavra-chave da ação). `PROMPT_POR_CAPACIDADE` de
  `texto.melhorar`/`texto.variacoes` instrui a IA a seguir `detalhe` à
  risca quando presente.
- **`apps/ia/tests.py`**: teste novo (`test_detalhe_do_usuario_vira_linha_propria`)
  cobrindo a linha nova no prompt final. Suíte `apps.ia`: 43/43 (era 42).
- **`static/midia/studio.js`**: ao clicar Melhorar/Encurtar/3 variações,
  abre um campo de texto opcional (`pedirDetalhe()`) antes de disparar a
  chamada; Enter ou o botão confirmam. "Tentar de novo" reaproveita o
  mesmo detalhe (`ultimoDetalhe`). Ação `gerar` (campo vazio) não mudou —
  fica fora do escopo por ora.
- **`static/midia/studio.css`**: estilo do novo input (`.ia-instrucao`,
  `.ia-instrucao__input`), reaproveitando as variáveis de cor já usadas
  no Studio.

## Estado ao sair

- Testes automatizados passando (43/43 em `apps.ia`).
- **Falta**: teste manual no browser (subir o Studio, digitar um detalhe
  tipo "mais informal" ao clicar Melhorar, confirmar que o resultado
  reflete o pedido) — não feito nesta sessão.
- Branch não commitada nem mergeada em `master` — Daniel decide quando.
- Não foi criada pasta `specs/NNN-nome/` nova: é extensão dentro do
  contrato já previsto em `specs/004-ia-config-e-texto` (o campo
  `instrucao?`/contexto livre já estava no `plan.md` daquela spec).
