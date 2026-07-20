# Spec 009 — Fundação do agente WhatsApp (identificação de contato)

> Fecha a Fase 0 do plano `docs/subsistemas/02b-agente-whatsapp-n8n.md` (§9). Backend puro.

## Problema / oportunidade

O gateway WhatsApp (Evolution API) e o roteador no n8n já estão no ar (branch
`feature/evolution-api-compose`): número dedicado pareado, workflow "eco"
testado ponta a ponta (WhatsApp → n8n → resposta real, via `n8n-mcp`). Mas o
bot hoje responde a QUALQUER remetente sem saber quem é — não dá pra abrir
pro squad de atendimento/operações do plano sem esse alicerce. Critério da
Fase 0 (§9 do plano): "mandar 'oi' e a MAG responder sabendo quem eu sou."

## O que muda para o usuário

- Daniel manda "oi" do número cadastrado como operador → MAG responde
  reconhecendo que é ele (papel "gestor").
- Um número já cadastrado como lead (`Lead.whatsapp`) → MAG reconhece como
  lead.
- Qualquer outro número → MAG trata como desconhecido, sem inventar dado.

## Critérios de aceite

- [x] Ação `nucleo:identificar_contato(numero)` no registry da Camada de
      Ações (spec 005): resolve papel entre `gestor`/`instrutor` (via
      `Usuario.whatsapp` + `Usuario.papel`, campos já existentes — nenhum
      modelo novo) → `lead` (via `Lead.whatsapp`) → `desconhecido`; devolve
      nome quando aplicável.
- [x] `TokenAgente` `agente-recepcionista-mag` criado, escopo só
      `nucleo:identificar_contato`.
- [x] Workflow "eco" do n8n (`MAG - Fase 0 (eco WhatsApp)`) chama a ação
      antes de responder — resposta muda de acordo com o papel identificado.
- [x] `LogAcao` grava cada chamada (sucesso e erro), mesmo padrão da spec 005.

## Critério de aceite do gestor

Daniel preenche o campo WhatsApp do seu próprio usuário pelo admin (pelo
celular — campo `whatsapp` já existe em `Usuario`), manda "oi" pro número da
MAG, e recebe de volta um reconhecimento ("Oi, Daniel!") de que é o gestor —
sem precisar mexer em código.

## Fora de escopo

- Papel "instrutor" **de conteúdo** (bio pública em `cursos.Instrutor` —
  modelo diferente do `Usuario` de login, ainda sem campo `whatsapp`) e
  "aluno" (precisa de matrícula com telefone, Fase 3) — ficam pra spec
  própria quando esses módulos existirem. Um `Usuario` com
  `papel=instrutor` (login existente) já é identificado por essa spec, sem
  trabalho extra.
- `RegraAgente` (regras editáveis — nome da persona, horário, alçadas): Fase 1.
- Qualquer lógica de SDR, preço ou vaga.
- PIN / confirmação de escrita — não há ação de escrita nesta spec.
