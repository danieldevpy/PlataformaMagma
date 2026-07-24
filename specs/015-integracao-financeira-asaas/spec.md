# Spec 015 — Integração financeira (Asaas)

> O QUÊ e PORQUÊ. Sem stack, sem nome de arquivo. Fase do roadmap: meta **média**
> de `.context/status.md` ("gestão escolar operável pelo celular: matrícula,
> presença, **pagamentos**") + primeiro passo do "Financeiro" descrito em
> `docs/subsistemas/03-gestao-escolar.md` + base para o agente **C1 Matriculadora**
> e **C2 Cobradora Gentil** de `docs/subsistemas/02b-agente-whatsapp-n8n.md`
> (aqui só a geração/consulta manual — cobrança proativa de atraso fica pra uma
> spec futura, já mapeada como C2).

## Problema / oportunidade

Hoje `Turma` tem campos de preço (`preco_cheio`, `preco_avista`, `parcelas_qtd`,
`parcela_valor`, `obs_pagamento`) e `Matricula` tem `valor_fechado`/
`forma_pagamento` — mas são só texto informativo. Não existe cobrança de
verdade: o gestor combina o pagamento por fora (dinheiro, PIX manual, maquininha
avulsa) e anota o valor combinado na matrícula depois. Não há como saber se um
aluno pagou sem perguntar pessoalmente, não existe link de pagamento pra mandar
por WhatsApp, e não há nenhum registro auditável de cobrança/recebimento.

## O que muda para o usuário

- O gestor consegue gerar uma **cobrança real** (PIX, boleto ou cartão — o
  aluno escolhe na hora de pagar) pra uma matrícula específica, com um valor
  definido por ele, e recebe um link pra mandar pro aluno.
- O gestor consegue perguntar pro agente MAG, pelo WhatsApp, se um aluno já
  pagou — sem abrir nada além do chat.
- Quando o aluno paga (PIX confirmado, boleto compensado, cartão aprovado), o
  status muda sozinho na plataforma — ninguém precisa marcar "pago" na mão.
- Toda cobrança gerada fica registrada e visível no painel, ligada à matrícula
  e ao aluno — dá pra ver o histórico de cobranças de qualquer pessoa.

## Critérios de aceite

- [ ] Gestor cria uma cobrança pra uma `Matrícula` existente (valor + forma de
      pagamento aceita: PIX, boleto, cartão ou "o aluno escolhe") e recebe de
      volta um link de pagamento hospedado no Asaas.
- [ ] Cobrança criada fica registrada na plataforma (valor, forma, status,
      vencimento, link, quando foi criada, quem criou) — visível na matrícula.
- [ ] Asaas notifica a plataforma quando o status muda (pago, vencido,
      cancelado, estornado) via webhook, e o status registrado reflete isso
      sem intervenção manual.
- [ ] Agente MAG ganha 2 ações novas: gerar cobrança pra uma matrícula
      (devolve o link) e consultar o status de pagamento de um aluno/matrícula
      — seguindo o mesmo padrão de confirmação já usado pra matricular_aluno
      (nunca gera cobrança sem o gestor confirmar valor e destinatário).
- [ ] Chave de API do Asaas fica guardada com o mesmo padrão de segurança já
      usado pra credenciais sensíveis na plataforma (cifrada, nunca em texto
      puro no banco nem exposta em log) — ambiente sandbox e produção
      distintos, nunca testar com dinheiro real sem querer.
- [ ] Suíte de testes cobrindo criação de cobrança, recebimento do webhook
      (assinatura/token válido e inválido) e as 2 ações novas do agente.

## Critério de aceite do gestor

- [ ] "Eu escolho um aluno matriculado, digo o valor, e em segundos tenho um
      link de PIX/boleto/cartão pra mandar pra ele — pelo celular, sem abrir
      o Asaas."
- [ ] "Eu pergunto pro MAG 'o Fulano já pagou a 026?' e ele me responde com o
      status real, sem eu precisar checar em lugar nenhum."

## Fora de escopo

- Cobrança automática (a matrícula nascer já com uma cobrança gerada sozinha)
  — gatilho continua manual, decisão do gestor, nesta spec.
- Lembrete/cobrança proativa de atraso (agente **C2 Cobradora Gentil**) — fica
  pra uma spec futura, depois que a geração/consulta manual já estiver rodando
  na prática.
- Parcelamento automático de múltiplas cobranças (gerar N cobranças de uma vez
  pra um plano parcelado) — nesta spec cada cobrança é gerada uma de cada vez;
  parcelamento de cartão em si (o aluno parcelar na fatura dele) o próprio
  Asaas resolve na cobrança única.
- Painel financeiro agregado (receita total, inadimplência por turma/curso,
  conciliação em massa) — visão é só por matrícula/aluno nesta spec.
- Estorno/cancelamento de cobrança pelo agente — só pelo painel (ação
  sensível o bastante pra não confiar num "confirma?" de chat, por ora).
- Nota fiscal / integração contábil.
