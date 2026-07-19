# Spec 004 — IA: configuração de provedores + capacidades de texto

> Fase do plano mestre `docs/subsistemas/10-studio-2.0.md` (§5). Independe da 002/003
> no backend; a fiação dos botões ✨ no Studio depende da 003-T4.

## O quê / porquê

App backend `apps.ia`: provedores configuráveis por tipo (texto/imagem/vídeo) com
credencial criptografada, proxy de execução (chave NUNCA no browser), auditoria de
uso e as primeiras capacidades de texto (`texto.gerar`, `texto.melhorar`,
`texto.variacoes`) falando no tom da marca. IA é complemento: nada no Studio quebra
sem provedor configurado.

## Critérios de aceite

1. Admin (ou página staff) permite cadastrar provedor de TEXTO (anthropic|openai),
   modelo e chave (write-only, exibida como `••••`), com "testar conexão" real.
2. `GET /api/ia/capacidades/` → `{"texto.gerar": true, ...}` refletindo APENAS
   provedores ativos e testados; sem provedor → tudo `false` (e nada quebra).
3. `POST /api/ia/executar/` `{capacidade, contexto}` → `{resultado}` ou
   `{detail}` de erro em linguagem humana; toda execução gera `ExecucaoIA`
   (tokens, duração, status, quem pediu).
4. Prompt de sistema por capacidade embute a marca (tom §8 do AGENTS.md,
   proibições, hashtags, CTA) — módulo `prompts.py`.
5. Chave criptografada no banco (nunca em texto puro, nunca em logs), auth
   `IsGestorOuInstrutor`, mesmos padrões do app `midia`.

## Critério de aceite do gestor

Daniel cola a chave da Anthropic no painel pelo celular, toca "testar conexão",
vê ✅ — e os recursos de texto passam a responder na API.
