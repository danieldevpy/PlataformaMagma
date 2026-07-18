# Studio Magma — MVP

Editor visual de aulas no estilo PowerPoint, usando o **design system Magma** e os
**10 componentes** já existentes. Você monta o deck slide a slide no navegador, exporta
um `deck.json` e o Python gera o `.pptx` final — mesma fidelidade do fluxo original.

```
Studio (HTML/CSS/JS)  →  deck.json  →  montar_powerpoint.py  →  .pptx
```

## Estrutura

```
studio/
├── montar_powerpoint.py   # renderizador data-driven (lê deck.json → .pptx)
├── deck.json              # deck "Lei Lucas" (28 slides) já convertido — exemplo
├── app/
│   ├── index.html         # o Studio
│   ├── css/
│   │   ├── tokens.css     # design tokens Magma (cores, fontes, sombras)
│   │   ├── slides.css     # os 10 componentes em preview 1920×1080
│   │   ├── studio.css     # interface do editor
│   │   └── print.css      # impressão/PDF (1 slide por página)
│   └── js/
│       ├── components.js  # registro dos componentes (schema + preview)
│       └── studio.js      # estado, editor, import/export
└── README.md
```

## Como abrir o Studio

Sirva por HTTP **a partir da raiz do projeto** (onde fica a pasta `textos e imagens/`),
para que as fotos e o exemplo carreguem. Abrir via `file://` também funciona, mas aí só
o botão **Importar** carrega decks (o botão **Exemplo** precisa de HTTP).

```bash
# na pasta "Montagem PowerPoint" (a que contém studio/ e textos e imagens/):
python3 -m http.server 8000
# abra http://localhost:8000/studio/app/
```

- **+ Slide** — adiciona um dos 10 componentes.
- **↑ ↓ ⧉ ✕** (no slide selecionado) — reordena, duplica, exclui.
- Edição ao vivo no painel da direita; **`**negrito**`** vira negrito.
- **Exportar deck.json** — baixa o deck.
- **Importar** — carrega um `deck.json`.
- **Exemplo** — carrega o deck Lei Lucas (precisa de HTTP).
- **Imprimir / PDF** — preview rápido de todos os slides.
- Salva automático no navegador (localStorage).

## Gerar o PowerPoint

```bash
pip install python-pptx pillow          # só na primeira vez

# renderiza o deck.json exportado pelo Studio:
python3 montar_powerpoint.py deck.json

# ou saída com nome próprio:
python3 montar_powerpoint.py deck.json aula.pptx
```

Imagens: os slides referenciam arquivos por nome (ex.: `slide_01_image_1.png`),
buscados em `../textos e imagens/`. No preview do Studio, também busca lá; se não achar,
mostra o placeholder. URLs `http(s)` também funcionam.

## Notas técnicas

- **Schema único**: o `deck.json` do Studio é exatamente o que o Python consome.
- **`montar_powerpoint.py`** virou *data-driven*: o deck é dados (`DECK`), não código.
  Use `--dump deck.json` para regravar o exemplo embutido.
- **Fidelidade do preview**: 1pt do pptx = 2px no HTML (1920px = 13,333" @144dpi).
- Componentes: `cover, content_card, step_card, split, two_col, grid, grid3, do_dont, flow, hero`.
