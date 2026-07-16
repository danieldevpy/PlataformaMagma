# 06 · Painel do Gestor/Instrutor (`/painel`)

> UX pensada para **quem não é técnico**: o dono e o instrutor alimentam o sistema
> aos poucos, com formulários guiados que espelham a página pública. O desenvolvedor
> nunca precisa entrar no meio; o Django Admin fica só para casos excepcionais.

## Princípios de UX

1. **Formulário espelha a LP.** Cada campo mostra onde aparece no site (miniatura ou
   descrição: "Este texto é o título grande do topo da página").
2. **Preencher aos poucos.** Tudo salva parcial; um medidor "página X% completa"
   mostra o que falta para publicar. Nada é obrigatório para salvar rascunho.
3. **Toggle explícito.** O que aparece/some no site é um switch com preview do efeito
   ("Countdown LIGADO — aparece no card da turma até 20/02 23:59").
4. **Mobile-first.** O dono vai usar do celular.

## Autenticação e papéis

- Login `/painel/login` → JWT (armazenado em cookie httpOnly via route handler).
- `gestor` (dono): tudo.
- `instrutor`: cursos/turmas/anotações dos seus cursos. **Não vê**: leads, pesos de
  avaliação, config do site.

## Telas

### 1. Dashboard (`/painel`)
- Cards de pendência: "3 avaliações aguardando moderação", "5 leads novos",
  "Turma 03/2026: countdown termina em 2 dias", "Curso BLS está 40% preenchido".
- Atalhos grandes: + Convite de avaliação · + Turma · Editar curso.

### 2. Cursos (`/painel/cursos` e `/painel/cursos/[slug]`)
Editor em abas, salvando por seção (PATCH parcial):

| Aba | Campos | Observação |
|---|---|---|
| Essencial | nome, slug, carga horária, formato, dias/horário padrão, status | publicar exige mínimo: hero + 3 habilidades + 1 FAQ |
| Página de venda | título de venda, trecho dourado, subtítulo, textos prática/carreira, itens inclusos (lista dinâmica), saídas profissionais | contador de caracteres nos títulos (limite do design) |
| Habilidades | lista reordenável (6 cards) com ícone (picker visual), título, descrição | drag-and-drop |
| FAQ | lista reordenável pergunta/resposta | — |
| Imagens | hero, prática, carreira — upload com crop/preview no formato usado | mostra a proporção correta de cada slot |
| Instrutores | vincular instrutor(es), editar bio/registro | instrutor edita a própria bio |
| SEO | seo_titulo (70), seo_descricao (160) | preview estilo resultado Google |

### 3. Turmas (`/painel/cursos/[slug]/turmas`)
Lista + editor da turma. **Esta é a tela de controle fino da LP:**

```
┌─ Turma 03/2026 ─────────────────────────── status: [Inscrições ▼] ┐
│ Início das aulas   [07/03/2026]   Mostrar no site?     (●) ON     │
│ Dias e horário     [Sábados, 09h–16h]                             │
│ Capacidade [20]    Vagas restantes [8]   Barra de vagas (●) ON    │
│──────────────────────────────────────────────────────────────────│
│ COUNTDOWN da condição antecipada             (●) LIGADO           │
│   Termina em  [20/02/2026 23:59]                                  │
│   Rótulo      [Condição de matrícula antecipada encerra em]       │
│   ⚠ preview: "17 dias 04 h 22 min" — some sozinho ao expirar      │
│──────────────────────────────────────────────────────────────────│
│ PREÇO                        Mostrar preço no site?  (○) OFF      │
│   De R$ [1.200]  À vista R$ [990]   [12]x de R$ [99]              │
│   Obs: [PIX com desconto]                                         │
│   (OFF → o site mostra "Consulte condições")                      │
│──────────────────────────────────────────────────────────────────│
│ ANOTAÇÕES INTERNAS (nunca vão para o site)              [+ nova]  │
│  • 12/07 (João): turma anterior teve 2 desistências; reforçar...  │
└──────────────────────────────────────────────────────────────────┘
```

- Mudar `status` para `inscricoes` torna a turma a "turma em destaque" da LP
  (aviso se já existir outra em inscrições para o mesmo curso).
- `encerrada` → sugere criar convites de avaliação para os alunos (gancho da doc 05).

### 4. Avaliações (`/painel/avaliacoes`) — gestor
Fila de moderação + convites (especificada em [05-avaliacoes-magic-link.md](05-avaliacoes-magic-link.md)).

### 5. Leads (`/painel/leads`) — gestor
- Lista com filtros (novo/em contato/matriculado/perdido), origem UTM, curso.
- Ação rápida: abrir conversa no WhatsApp do lead; mudar status.
- Futuro: sincroniza com CRM via n8n (o painel é a visão simples).

### 6. Configurações (`/painel/config`) — gestor
- Contatos (WhatsApp, Instagram, e-mail, endereço).
- Prova social global: nota Google + toggle, total de formados + toggle.

## Implementação (client)

- Rotas `/painel/*` como client components + fetch autenticado (`lib/api-painel.ts`).
- Formulários: `react-hook-form` + `zod` (validação espelhando o serializer).
- Feedback: toast de sucesso + "ver no site" (link com `?preview=1` ignorando cache).
- Reordenáveis (habilidades/FAQ): `@dnd-kit/sortable`.
- Uploads: `FormData` direto para DRF; preview client-side antes de enviar.
