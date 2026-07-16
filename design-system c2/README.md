# Design System Magma Cursos — v2.0

Sistema de design profissionalizado da Magma Cursos, construído sobre a identidade
**real** da marca (logo com Estrela da Vida e certificado oficial em uso).

## Estrutura

```
design-system/
├── index.html          → Showcase visual completo (abra no navegador)
├── AGENTS.md           → Guia de marca para agentes de IA (leia antes de gerar qualquer peça)
├── tokens.json     → Design tokens em JSON (formato W3C) — fonte de verdade dos dados
│── tokens.css      → Os mesmos tokens como variáveis CSS prontas para importar
└── assets/
    ├── simbolo-magma.svg    → Símbolo oficial (Estrela da Vida no hexágono)
    ├── logo-vertical.svg    → Assinatura vertical (símbolo + MAGMA CURSOS)
    └── logo-horizontal.svg  → Assinatura horizontal
```

## Como usar

- **Humano:** abra `index.html` no navegador e navegue pelas seções.
- **Agente de IA:** aponte o agente para `AGENTS.md` — ele contém tudo (cores, regras,
  receitas de componentes, anatomia do certificado, tom de voz e checklist).
- **Site/app:** importe `tokens/tokens.css` e use as variáveis (`var(--navy)` etc.).
- **Automações (n8n, scripts):** consuma `tokens/tokens.json`.

## O que mudou da v1 (pasta "Design System Magma Cursos")

1. **Logo corrigido** — a v1 usava um monograma de cruz inventado; a v2 usa o símbolo
   oficial: Estrela da Vida azul (#1D4F91) em hexágono vermelho com contorno grafite.
2. **Certificado fiel ao modelo em uso** — reproduz o PDF oficial (cantos navy com fitas
   douradas, caligrafia "Certificado", QR de verificação), em vez de um layout genérico.
3. **Tokens legíveis por máquina** — JSON + CSS versionados, reutilizáveis por qualquer agente.
4. **AGENTS.md** — guia autocontido para automações fiéis à marca.
5. **Templates sociais menos engessados** — dois temas de feed (Turma escuro / Educativo claro),
   stories com zona segura e thumbnail de vídeo.

A paleta de cores da v1 foi mantida (estava bem estruturada) e ampliada com
`vida-blue` e `graphite`, as cores reais do símbolo.
