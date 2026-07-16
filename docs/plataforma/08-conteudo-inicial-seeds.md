# 08 · Conteúdo Inicial (Seed-First)

> **Princípio central da v1:** o sistema nasce **igual à landing page template** — mesmas
> informações, mesmo visual. Todo conteúdo hardcodado do template vira **registro inicial
> no banco** no primeiro deploy. A partir daí, o gestor/instrutor **edita e corrige** pelo
> painel — nunca preenche do zero. O programador desenvolve funcionalidades; o gestor é a
> fonte da verdade dos dados. Nenhum dos dois precisa instruir o outro.

## O que muda em relação ao plano anterior

| Antes (fallback-first) | Agora (seed-first) |
|---|---|
| Conteúdo do template vivia em `lib/fallback.ts` no front | Conteúdo do template vive no **banco**, criado por seed no deploy |
| Site usava template quando API vazia | API **nunca está vazia** — seeds garantem dados desde o dia 1 |
| Gestor preenchia formulários em branco | Gestor **corrige valores existentes** (UX de revisão, não de criação) |
| Dev instruía o que preencher | O painel **sinaliza sozinho** o que ainda é valor de template |

O `lib/fallback.ts` é rebaixado a tratamento de erro (API fora do ar) — deixa de ser
mecanismo de conteúdo.

## Fonte única do conteúdo inicial: `backend/conteudo_inicial/`

Extrair o conteúdo da LP atual ([landing-page/cursos/socorrista-aph/index.html](../../landing-page/cursos/socorrista-aph/index.html))
para arquivos de dados versionados — legíveis por humanos, agentes e pelo comando de seed:

```
backend/conteudo_inicial/
├── config_site.json          # contatos, endereço, prova social do template
├── cursos/
│   └── socorrista-aph.json   # TODO o conteúdo da LP: hero, skills, faq, textos, seo
├── turmas/
│   └── socorrista-aph-template.json   # turma exemplo com os valores [colchetes]
├── avaliacoes/
│   └── template.json         # os 3 depoimentos-modelo da LP
└── imagens/                  # copiadas de landing-page/assets/
    ├── hero-rcp.jpg
    ├── pratica-imobilizacao.jpg
    ├── instrutor-dea.jpg
    └── socorrista-ambulancia.jpg
```

Exemplo (`cursos/socorrista-aph.json`) — os valores são **exatamente** os do template,
inclusive os `[colchetes]`:

```json
{
  "slug": "socorrista-aph",
  "nome": "Socorrista APH",
  "status": "publicado",
  "titulo_venda": "Em 120 horas você estará pronto para salvar vidas — e viver disso",
  "titulo_destaque": "salvar vidas",
  "carga_horaria": 120,
  "habilidades": [
    {"ordem": 1, "icone": "rcp", "titulo": "RCP e DEA",
     "descricao": "Reanimação em adulto, criança e bebê + uso do desfibrilador — a manobra que mais salva vidas."}
  ],
  "faqs": [ ... ],
  "turma_template": {
    "codigo": "[03/2026]",
    "inicio_aulas_texto": "[07 de março]",
    "exibir_countdown": true,
    "countdown_ate": "2026-08-01T23:59:59-03:00",
    "vagas_restantes_texto": "[08]"
  }
}
```

## Rastreio de origem: `conteudo_origem`

Todo modelo editável de conteúdo ganha o par:

```python
class OrigemConteudo(models.TextChoices):
    TEMPLATE = "template"   # veio do seed, nunca foi revisado por humano
    EDITADO = "editado"     # gestor/instrutor já salvou por cima

conteudo_origem = models.CharField(choices=OrigemConteudo.choices,
                                   default=OrigemConteudo.TEMPLATE, max_length=10)
```

- **Painel:** qualquer PATCH via API do painel seta `conteudo_origem="editado"` automaticamente.
- **Seed:** o comando **só cria ou atualiza registros com `conteudo_origem="template"`** —
  jamais toca no que o gestor editou (idempotente e seguro de rodar em todo deploy).
- **UX:** o painel exibe badge **"valor do template — revisar"** em cada campo/registro
  `template`, e o dashboard mostra o checklist: *"Curso APH: 14 de 22 itens revisados"*.
  É assim que o gestor sabe o que fazer **sem o programador instruir**.

## Comando de seed

```bash
python manage.py seed_inicial            # roda em todo deploy (idempotente)
python manage.py seed_inicial --dry-run  # mostra o que criaria/atualizaria
```

Regras do comando:
1. `get_or_create` por chave natural (`slug`, `codigo`); imagens copiadas para media/ se ausentes.
2. Atualiza registro existente **apenas se** `conteudo_origem == "template"` (permite o dev
   evoluir o template pelo git enquanto ninguém revisou aquele item).
3. Nunca cria segunda turma-template se já existir turma editada para o curso.
4. Loga resumo: `criados: 3 · atualizados(template): 2 · preservados(editado): 17`.

## Política de placeholders `[colchetes]` no ar

A v1 renderiza **idêntica ao template atual** — incluindo `[MARÇO]`, `[08]`, `[12]x de [R$ 000]` —
porque é esse o estado validado do design e o material de trabalho do gestor.

- O painel prioriza no checklist os campos que aparecem **na página pública** com colchetes
  (regex `\[.*\]` marca o item como "placeholder visível — prioridade alta").
- Botão opcional por turma no painel: **"Ocultar dados de exemplo"** — desliga em lote
  `exibir_preco/exibir_countdown/exibir_vagas/exibir_inicio` da turma-template, caso o
  gestor prefira tirar os exemplos do ar antes de ter os valores reais.
- Recomendação registrada (decisão do gestor, não do dev): revisar os campos de
  prioridade alta antes de rodar tráfego pago.

## Critério de pronto da v1 (redefine a Fase 2 do roadmap)

> Deploy da v1 aprovado quando: **diff visual entre a LP estática atual e a página
> servida por Next+Django+seed = zero** (mesmos textos, imagens, countdown, colchetes),
> e editar qualquer campo no Django Admin muda o site em ≤60s sem quebrar nada.
