# Spec 021 — Registro e análise das conversas do agente

> Fecha a lacuna `registrar_interacao_lead` do plano-mãe
> (`docs/subsistemas/02b-agente-whatsapp-n8n.md` §7, e o princípio do §8:
> "o n8n é descartável; a plataforma é a fonte de verdade"). Motivador
> imediato: a campanha de tráfego pago (`docs/subsistemas/01b-trafego-pago-meta-ads.md`,
> spec 018) pode começar nos próximos dias e trazer leads reais pelo
> WhatsApp — são exatamente as conversas mais valiosas pra calibrar a MAG.

## Problema / oportunidade

Hoje, pra saber se a MAG está atendendo bem e convertendo, o Daniel abre
as execuções do n8n uma por uma. Isso não escala e não permite análise:

- **Execuções do n8n**: 1 execução = 1 mensagem. Não agrupam por conversa,
  são podadas com o tempo e não dá pra exportar em lote.
- **Postgres da Evolution API** (persistência ligada em 21/07): guarda a
  mensagem crua, mas é schema de terceiro, não sabe *qual agente*
  respondeu nem *quais ferramentas* ele chamou, e não tem vínculo com
  `Lead`/`Aluno`.
- **`memoryBufferWindow`** dos dois agentes (SDR e Operadora): volátil,
  10 turnos, morre quando o container do n8n reinicia. Serve pra
  continuidade da conversa, não pra análise.

Consequência: não dá pra responder perguntas como "em quantas conversas
a MAG chegou a registrar o lead?", "onde ela está perdendo a venda?",
"ela inventou preço alguma vez?" — nem manualmente, nem entregando o
histórico pra uma LLM analisar.

## O que muda para o usuário

- Toda conversa entre a MAG e um contato passa a ficar **registrada na
  própria plataforma**, agrupada por conversa (não por mensagem solta),
  com quem falou, o que cada lado disse, qual agente respondeu e quais
  ferramentas ele chamou.
- O Daniel consegue ler qualquer conversa no Django Admin, filtrando por
  agente, período ou desfecho.
- O Daniel (ou uma LLM, numa sessão como esta) consegue pedir **todas as
  conversas dos últimos N dias em texto corrido** e analisar em bloco:
  taxa de conversão, onde trava, o que a MAG errou.
- O registro **não atrasa nem quebra** a resposta ao lead: acontece
  depois do envio, e se falhar o lead nem percebe.
- **Retenção configurável pelo Admin** (padrão 15 dias), sem redeploy:
  o Daniel muda o número no celular se quiser guardar mais tempo.

## Critérios de aceite

- [ ] App novo `apps/conversas/` com dois modelos:
  - `Conversa` — canal, número, nome do contato, papel
    (`lead`/`gestor`/`instrutor`/`aluno`/`desconhecido`), vínculo opcional
    com `Lead` e `Usuario`, agente que atendeu, `iniciada_em`,
    `ultima_atividade_em`, `escalada` (houve handoff) e `desfecho`.
  - `Turno` — conversa, papel (`contato`/`agente`/`sistema`), texto,
    agente, `ferramentas` (JSON com nome + argumentos de cada tool
    chamada), id da execução n8n de origem, timestamp.
- [ ] **Sessão por janela de inatividade**: mensagem de um número que já
      tem conversa com atividade recente entra na mesma `Conversa`;
      depois da janela (6h), abre conversa nova. Uma pessoa que volta
      três dias depois não vira um fio infinito.
- [ ] **`desfecho` derivado automaticamente** das ferramentas registradas
      (sem LLM): `registrar_lead` → `lead_registrado`; `matricular_aluno`
      → `matricula`; `gerar_cobranca` → `cobranca`; `escalar_contato` →
      `handoff`. Mantém o desfecho mais "avançado" alcançado na conversa.
- [ ] Ação `registrar_turnos` (escopo `conversas:registrar_turnos`):
      recebe número, textos do contato e do agente, papel, nome, agente,
      lista de ferramentas e id da execução; cria ou reaproveita a
      `Conversa`, grava os turnos, atualiza `ultima_atividade_em` e o
      desfecho. Aceita gravar só o lado do agente (mensagens proativas da
      Nutridora, que não respondem nada).
- [ ] Ação `exportar_conversas` (escopo `conversas:exportar_conversas`):
      filtros `dias` (padrão 7), `agente`, `desfecho`, `numero`, `limite`;
      devolve cada conversa com metadados **e a transcrição já formatada
      em texto corrido**, pronta pra uma LLM ler em bloco.
- [ ] Ação `purgar_conversas` (escopo `conversas:purgar_conversas`):
      apaga conversas cuja `ultima_atividade_em` é mais antiga que a
      retenção configurada; devolve quantas apagou.
- [ ] **Retenção configurável**: `ConfiguracaoSite.conversas_retencao_dias`
      (padrão **15**, editável no Admin, `0` = nunca apagar). A purga lê
      esse campo a cada execução — mudar o número no Admin muda o
      comportamento no dia seguinte, sem deploy.
- [ ] n8n dev: 1 nó `HTTP Request` por pista (SDR e Operadora) **depois**
      do `Responder no WhatsApp`, com `onError: continueRegularOutput` —
      grava entrada + saída + ferramentas de uma vez, aproveitando o
      `returnIntermediateSteps` que os dois agentes já têm ligado.
- [ ] n8n dev: as duas Nutridoras (T+0 e T+1/3/7) também registram o
      toque enviado (papel `sistema`), pra a análise saber o que o lead
      recebeu antes de responder (ou de não responder).
- [ ] n8n dev: o Radar diário ganha um nó final que chama
      `purgar_conversas` — depois de enviar o resumo, pra falha na purga
      nunca atrapalhar o relatório.
- [ ] Django Admin: `Conversa` com busca por número/nome, filtros por
      agente/desfecho/data, e os turnos visíveis em linha (somente
      leitura — registro de conversa não se edita).
- [ ] Escopos novos no `TokenAgente` de dev.
- [ ] `docs/plataforma/03-api-contratos.md` com as três ações novas.
- [ ] Testado de ponta a ponta em dev com mensagem real: conversa
      aparece no Admin, `exportar_conversas` devolve a transcrição, purga
      respeita a configuração.

## Critério de aceite do gestor

O Daniel abre o Admin no celular, acha a conversa de um lead pelo número
e lê o diálogo inteiro do jeito que aconteceu — sem abrir o n8n. E, numa
sessão de trabalho, consegue pedir "analisa as conversas da semana" e
receber um diagnóstico baseado nas conversas de verdade.

## Privacidade / LGPD

Conversa de venda com pessoa real (nome, telefone, o que ela contou).
Por isso, nesta spec: retenção com prazo definido e purga automática
(padrão 15 dias), acesso só a staff pelo Admin, dado ficando na VPS da
própria Magma (nada em SaaS de terceiro além do LLM que já processa a
mensagem em tempo real). Coerente com §6 do plano-mãe.

## Fora de escopo

- **Análise automática por LLM** (um "Radar semanal de qualidade" que lê
  as conversas e manda diagnóstico sozinho). Esta spec entrega o dado e
  a exportação; quem analisa, por ora, é o Daniel ou uma sessão de
  trabalho. Vira spec própria depois de existir volume real.
- Painel de conversas fora do Django Admin (mesma regra da pendência 5
  do `.context/status.md`: o Admin é o painel por ora).
- Trocar o `memoryBufferWindow` por memória persistente — o contexto do
  lead se perde se o n8n reiniciar. É um problema real e vizinho, mas com
  outro perfil de risco (esta spec só pendura nós no fim do fluxo; aquela
  altera o caminho vivo do atendimento). Virou **spec 022**, a ser
  implementada logo depois desta e promovida junto.
- Migrar/importar as conversas que já aconteceram (estão só na Evolution
  e nas execuções do n8n). Começa do zero na data da entrega.
- Registrar as conversas do Studio/plataforma (`ExecucaoIA` já cobre uso
  de IA interno, com outro propósito).
- Comando `manage.py` de purga manual — a purga roda pelo Radar; se
  aparecer necessidade de rodar à mão em prod, vira adendo.
