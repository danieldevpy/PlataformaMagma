# 2026-07-18 — Plano mestre do Studio 2.0

## Prompt do Daniel (essência)
> Transformar o Studio em uma central completa: diversos templates (formação, reels,
> avaliação, stories), selecionar fotos e produzir conteúdo sem sair dele. IA embutida
> em tudo (texto, imagem, vídeo) via APIs externas, com configuração simples por tipo
> (modelo/api de texto, imagem, vídeo) — funcionalidades acendem conforme configuro.
> IA é complemento, não regra. Backend reformulado para agente via WhatsApp operar
> sem interfaces (ex.: "gere link de matrícula para a turma 027" via n8n).
> Bem planejado para evitar retrabalho. Meta: encher 20 alunos/turma.

## O que foi feito
- Análise em sessão: tese "Studio = camada de ações" (Seleção × Modo × Formato;
  humano e agente usam a mesma API — o `CATALOGO_ACOES` do `midia` é a semente).
- Escrito o plano mestre completo: `docs/subsistemas/10-studio-2.0.md`, cobrindo:
  - motor de templates declarativo desacoplado do browser (renderizável em Node depois);
  - catálogo de 6 templates priorizados p/ campanha (Depoimento, Vagas, Formação,
    Formatura, Educativo, Capa de Reel) + kit multi-formato + legenda com variáveis;
  - camada de IA por capacidades nomeadas (`texto.*`, `imagem.*`, `video.*`),
    adaptadores por provedor, proxy backend (chave nunca no browser), app novo
    `apps.ia` (`ProvedorIA` com credencial criptografada + `ExecucaoIA` auditoria/custo);
  - UX: página "Integrações de IA" (3 cards, testar conexão, matriz "o que destrava"),
    padrão ✨ (sempre ao lado do manual, sugestão nunca sobrescreve, original sagrado);
  - Camada de Ações plataforma-wide (registry no `nucleo`, `TokenAgente`, `LogAcao`,
    `gerar_link_matricula` como pré-matrícula pública → Lead);
  - fases → specs `002-studio-motor-declarativo` .. `007-ia-video-e-render-server`.
- `.context/status.md` atualizado (EM ANDAMENTO).

## Estado ao sair / handoff
- Plano escrito, specs AINDA NÃO criadas. Próximo passo: criar `specs/002-studio-motor-declarativo/`
  (spec → plan → tasks) e seguir a ordem do §9 do doc 10.
- Nenhum código tocado nesta sessão; nada commitado (Daniel pede o commit).
