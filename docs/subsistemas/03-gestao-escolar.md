# Subsistema 03 — Gestão Escolar

## Propósito

Ser o núcleo operacional e a fonte única de verdade da escola: cursos, turmas, alunos, matrículas, presença, notas e financeiro. Elimina papel, fila e controle manual.

## Usuários

Gestor/secretaria (principal), professores (presença e notas), alunos (matrícula e situação), demais subsistemas (consomem seus dados).

## Capacidades

**Catálogo e turmas**
- Cadastro de cursos (ementa, carga horária, requisitos, preço) e turmas (datas, horários, capacidade, instrutor).
- Controle de vagas em tempo real — alimenta a vitrine pública.

**Matrícula online**
- Fluxo completo: escolha de curso/turma → dados do aluno → contrato com aceite digital → pagamento.
- Pagamento: Pix, cartão, boleto; à vista ou parcelado.
- Matrícula presencial pela secretaria usa o mesmo fluxo (fonte única).

**Vida acadêmica**
- Lista de presença digital (ex.: QR code na sala) por aula.
- Lançamento de avaliações teóricas e práticas.
- Critérios de conclusão por curso (presença mínima + aprovação) → dispara emissão de certificado.

**Financeiro**
- Controle de parcelas, conciliação automática de pagamentos.
- Cobrança proativa: lembretes de vencimento e renegociação via subsistema de Comunicação.
- Visão de inadimplência por turma/curso.

**Painel do gestor**
- Receita, ocupação de turmas, funil de captação, inadimplência, alunos por status.
- Histórico para decisões: quais cursos abrir, quando, com que preço.

## Relações com outros subsistemas

- **Fonte de verdade** de alunos, turmas e vagas para todos os demais.
- Conclusão de curso dispara o **04 Certificação**.
- Matrícula cria acesso na **05 Área do Aluno**.
- Eventos financeiros e acadêmicos geram notificações via **02 Comunicação**.
- Dados de funil e ocupação alimentam decisões de campanha na **01 Vitrine**.

## Princípios

Tudo que acontece na escola vira dado estruturado. Nenhum processo exige papel. O que a secretaria faz manualmente hoje deve ser possível fazer em menos cliques amanhã.
