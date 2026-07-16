# Subsistema 02 — Atendimento & Comunicação

## Propósito

Centralizar todo o relacionamento conversacional e as mensagens em massa da Magma, com o WhatsApp como canal principal. Garante resposta imediata 24/7 e comunicação proativa ao longo de todo o ciclo de vida (lead → aluno → formado → assinante).

## Usuários

Leads, alunos, ex-alunos, pais; internamente, a equipe que supervisiona o agente.

## Capacidades

**Agente IA de atendimento (WhatsApp)**
- Responde dúvidas frequentes: preços, datas, carga horária, pré-requisitos, localização.
- Qualifica o lead (curso de interesse, urgência, disponibilidade) e registra no CRM.
- Agenda visitas à escola e encaminha para matrícula.
- Escala para humano quando detecta caso fora do escopo ou intenção de fechamento sensível.
- Human-in-the-loop: equipe supervisiona e assume conversas a qualquer momento.

**Disparo e nutrição**
- Sequências de nutrição para leads frios: conteúdo útil (dicas de primeiros socorros, mercado de trabalho) até a próxima turma abrir.
- Campanhas segmentadas: por curso de interesse, por município, por estágio do funil.
- Remarketing coordenado com campanhas pagas.

**Notificações transacionais**
- Confirmação de matrícula, lembrete de aula prática, aviso de vencimento de parcela.
- **Aviso de recertificação vencendo** — gatilho central da recorrência.
- Comunicados de turma (mudança de horário, material necessário).

**CRM**
- Registro único do contato com histórico completo: origem, conversas, matrículas, certificados, assinatura.
- Visão de funil: novo → qualificado → visitou → matriculado → formado → membro.

## Relações com outros subsistemas

- Recebe leads da **01 Vitrine** com origem rastreada.
- Lê turmas, vagas e financeiro do **03 Gestão Escolar** para responder e notificar.
- Recebe gatilhos do **04 Certificação** (validade vencendo) e do **05 Área do Aluno** (aluno parado no conteúdo).
- Base de conhecimento do agente é alimentada pelo **06 Estúdio** (conteúdo estruturado dos cursos).

## Princípios

Nenhuma DM perdida: toda conversa vira registro. Toda mensagem em massa é segmentada e com opt-out. O agente nunca finge ser humano.
