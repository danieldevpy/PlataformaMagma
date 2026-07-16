# Subsistema 06 — Estúdio de Conteúdo (Estúdio Maker)

## Propósito

Industrializar a produção de conteúdo didático: o professor fornece o conhecimento bruto e a plataforma, com IA, estrutura e deriva todos os artefatos da aula. Remove o gargalo humano da criação de material e da gravação de aulas, com baixa fricção para quem ensina.

## Usuários

Professores/instrutores (fornecem conhecimento e aprovam), equipe de conteúdo/gestor (supervisiona), demais subsistemas (consomem o material).

## Conceito central: documento mestre

> Uma fonte de verdade por aula; todo artefato é derivação.

```
Professor (brain dump: áudio, texto, PDF antigo, foto de anotação)
        ↓ IA transcreve, analisa e estrutura
DOCUMENTO MESTRE da aula
(objetivos, tópicos, teoria × prática, exemplos, erros comuns)
        ↓ professor revisa e aprova (human-in-the-loop)
        ↓ derivações automáticas:
├── Apostila / e-book (identidade visual Magma)
├── Slides da aula
├── Roteiro de gravação (hook, blocos, marcações, CTA)
├── Quiz / avaliação
└── Pós-gravação: legendas, capítulos, cortes para redes
```

Editar o mestre regenera as derivações. Tudo versionado.

## Capacidades

**Entrada de conhecimento**
- **Entrada por áudio como caminho principal**: professor explica a aula falando; IA transcreve e estrutura. Barreira de adoção próxima de zero.
- Aceita também texto livre, apostilas antigas, PDFs e fotos de anotações.

**Composição assistida**
- IA analisa o material, aponta lacunas, sugere estrutura e exemplos; professor conversa com a IA para refinar a ideia da aula.

**Geração de artefatos**
- Apostila/e-book, slides, roteiro de gravação, quiz — todos derivados do mestre, com identidade visual da escola.

**Apoio à gravação e pós-produção**
- Teleprompter com o roteiro rolando durante a gravação (webcam/celular).
- Pós automático: transcrição da gravação vira legendas, capítulos e sugestões de cortes.

**Biblioteca de conhecimento**
- Acervo estruturado e versionado de todas as aulas — ativo intelectual da Magma, reutilizável em novos formatos.

## Relações com outros subsistemas

- Abastece a **05 Área do Aluno** (vídeo-aulas, apostilas, quiz).
- Alimenta a base de conhecimento do agente do **02 Atendimento** (respostas fiéis ao conteúdo real dos cursos).
- Cortes e materiais derivados suprem o **07 Social Maker** — cada aula gravada gera marketing de graça.
- Estrutura de cursos/aulas espelha o catálogo do **03 Gestão Escolar**.

## Princípios

O professor é fonte de conhecimento, não operador de software. IA propõe, professor dispõe: nada vai ao aluno sem aprovação humana. Um conhecimento capturado uma vez serve a muitos formatos.
