# 05 · Avaliações por Magic Link

> A primeira ferramenta de alimentação do sistema: o dono envia um link pelo WhatsApp,
> o ex-aluno avalia em 1 minuto sem cadastro, o dono modera e define peso, e o site
> exibe as melhores automaticamente.

## Fluxo completo

```
GESTOR (painel)                EX-ALUNO (link público)           SITE PÚBLICO
─────────────────              ────────────────────────          ─────────────
1. "Novo convite"
   escolhe curso/turma,
   digita nome do aluno
2. Recebe URL única +
   botão "enviar no WhatsApp"
   (mensagem pronta)      ──►  3. Abre /avaliar/{token}
                                  → instruções curtas
                                  → nome já preenchido
                                  → escolhe 1–5 estrelas
                                  → escreve comentário
                                  → (opcional) cargo atual
                               4. Envia → tela de obrigado
5. Avaliação cai como
   PENDENTE no painel
6. Aprova + define PESO
   (0–100) e destaque    ─────────────────────────────────►  7. LP exibe aprovadas
                                                                 ordenadas por
                                                                 -peso, -estrelas, -data
                                                                 (máx. 6)
```

## Regras de negócio

| Regra | Valor |
|---|---|
| Validade do convite | 30 dias (campo `expira_em`, editável ao criar) |
| Usos por convite | **1** — `usado_em` preenchido bloqueia reuso |
| Status inicial | `pendente` — nada entra no site sem moderação |
| Peso | 0–100; empate → mais estrelas → mais recente |
| Exibição na LP | só `status=aprovada`, máx. 6, do curso da página |
| Exibição na home | flag `exibir_na_home` (curadoria manual) |
| Anti-abuso | token UUID4; rate-limit no POST (ex. 5/min/IP); comentário máx. 600 chars; sem HTML |
| Escopo do convite | atrelado ao **curso** (`ConviteAvaliacao.curso`, obrigatório) — a `turma` é opcional, só um metadado. Um curso roda várias turmas ao longo do tempo; o convite/avaliação não trava numa turma específica |

## Página `/avaliar/[token]` (Next.js)

Página **client-side**, não indexável (`robots: noindex`), componente
`components/client/AvaliacaoExperience.tsx`, estilos em `styles/avaliacao.css`.
Fluxo em dois estágios, pensado pra não interromper quem só quer ver as fotos:

1. `GET /api/avaliacoes/convite/{token}/` — `valido: false` → tela amigável
   ("link expirou/já foi usado/inválido", nunca erro técnico). `valido: true` traz
   `curso`, `turma_codigo` (pode ser `null`), `nome_aluno` e `fotos` (galeria do
   **curso** — `Curso.fotos`, não da turma).
2. **Carrossel sempre visível**, parte normal do layout da página (nunca modal):
   fotos do curso com autoplay de ~3 fotos, swipe no celular, setas/dots. Depois do
   autoplay, a seta "próxima" pulsa discretamente se houver mais fotos.
3. **Peek discreto** (depois de ~3s): só o título + estrelas 1–5 aparecem — sem
   backdrop, sem travar nada. No celular é uma barra fixa no rodapé (não cobre o
   carrossel); no computador é um bloco compacto logo abaixo do carrossel.
4. **Aberto** (ao tocar numa estrela): revela agradecimento + comentário (textarea,
   obrigatório) + "Onde você trabalha hoje?" (opcional, vira o subtítulo do
   depoimento no site) + botão `btn-gold` "Avaliar". No celular a barra vira modal de
   verdade (backdrop, `role="dialog"`, scroll travado, Escape fecha, foco preso); no
   computador o bloco expande no lugar e a página rola sozinha até ele.
5. Envio → `POST /api/avaliacoes/convite/{token}/` (nome vem do convite, sem input) →
   loading no botão → "Obrigado pela sua avaliação!" → fecha sozinho revelando o
   resto da página.

## Painel do gestor — telas (detalhe em [06-painel-gestor.md](06-painel-gestor.md))

> **Status atual:** o painel React descrito abaixo ainda não foi construído. Por ora
> o gestor cria convites e modera avaliações direto pelo Django Admin
> (`ConviteAvaliacaoAdmin`/`AvaliacaoAdmin` em `apps/avaliacoes/admin.py`) — já
> cobre criar convite (com `url` pronta pra copiar), aprovar/rejeitar, definir peso e
> `exibir_na_home`. O painel React é a fase própria descrita a seguir.

**Convites**
- Botão "Novo convite" → modal: curso (select), turma (select opcional), nome do aluno.
- Resposta mostra: URL copiável + botão verde **"Enviar pelo WhatsApp"** que abre
  `wa.me` com mensagem pronta:
  > "Oi [Marcos]! Aqui é da Magma Cursos 💛 Que orgulho ter você formado com a gente!
  > Pode nos ajudar com uma avaliação rapidinha (1 min)? É só abrir: {url}"
- Lista de convites com status: `aguardando` / `respondido` / `expirado`.

**Moderação**
- Fila de pendentes: card com estrelas, comentário, nome, curso/turma.
- Ações rápidas: **Aprovar** (abre slider de peso 0–100 com presets
  "Destaque 90 / Boa 60 / Normal 30"), **Rejeitar** (com motivo opcional).
- Aba "Aprovadas": reordenar peso a qualquer momento (a LP reflete em ≤60s).

## Endpoints envolvidos

Ver [03-api-contratos.md](03-api-contratos.md):
`POST /api/painel/convites/`, `GET|POST /api/avaliacoes/convite/{token}/`,
`GET|PATCH /api/painel/avaliacoes/`.

## Evoluções futuras (não fazer agora)

- Foto do aluno no upload da avaliação (com consentimento explícito de uso de imagem).
- Convite em lote (colar lista de nomes/telefones → n8n dispara os links).
- Pedido automático de avaliação X dias após a conclusão da turma (quando o módulo
  educacional existir).
- Sincronizar nota média real com `ConfiguracaoSite.nota_google` exibida no hero.
