# Magma Cursos — Guia de Marca para Agentes (v2.0)

> **Propósito deste arquivo:** permitir que qualquer agente de IA (ou humano) produza
> peças 100% fiéis à marca Magma Cursos sem precisar de contexto extra.
> Leia este arquivo inteiro antes de gerar qualquer arte, página, documento ou texto.

## 0. Fontes de verdade

| O quê | Onde |
|---|---|
| Tokens (cores, fontes, raios, sombras, formatos) | `tokens/tokens.json` (dados) e `tokens/tokens.css` (CSS pronto) |
| Símbolo oficial | `assets/simbolo-magma.svg` |
| Logo vertical / horizontal | `assets/logo-vertical.svg` / `assets/logo-horizontal.svg` |
| Showcase visual com todos os componentes | `index.html` |
| Logo original de referência (PDF) | `../Design System Magma Cursos/uploads/MAGMA_Logo_Logo+Simbolo+Tagline_CentralizadoPDF.pdf` |
| Certificado oficial de referência (PDF) | `../Design System Magma Cursos/uploads/certificado-conclusao-aph.pdf` |

## 1. Quem é a marca

- **Negócio:** escola de cursos profissionalizantes de saúde na Baixada Fluminense — carro-chefe: **Socorrista APH (120h)**; especializações (Punção Venosa/ICVP), treinamentos Lei Lucas para escolas.
- **Público:** pessoas que querem entrar na área da saúde, muitas trabalham durante a semana (por isso turmas aos sábados).
- **Posicionamento:** prática de verdade + credencial verificável. "Educar também é cuidar."
- **Dados:** Curso Magma LTDA — CNPJ 48.330.206/0001-06 · Rua Nossa Senhora de Fátima, 495, Olinda, Nilópolis/RJ · WhatsApp (21) 97100-5197 / (21) 96494-6079 · @magma_curso · curso.magma21@gmail.com

## 2. O símbolo (NUNCA inventar outro)

O símbolo oficial é a **Estrela da Vida** (azul `#1D4F91`, com bastão de Asclépio branco)
dentro de um **hexágono vermelho** `#C8102E` com filete branco e contorno grafite `#232C3D`,
cantos arredondados. Use SEMPRE `assets/simbolo-magma.svg` — não redesenhe, não troque a
estrela por cruz, não mude as cores internas.

- **Wordmark:** "MAGMA" em Archivo 900 (caixa alta) navy `#1B2A4D`; "CURSOS" abaixo/ao lado em Archivo 700 com letter-spacing largo.
- **Sobre fundo escuro:** wordmark em branco, "CURSOS" pode ir em dourado `#DCB96A`. O símbolo não muda de cor.
- **Área de respiro:** altura da letra "M" em todos os lados. Tamanho mínimo: 32px de altura do símbolo.
- **Proibido:** distorcer, rotacionar, aplicar sombra pesada, recolorir o hexágono, usar o monograma antigo de "cruz" (versão v1 descontinuada).

## 3. Cores — regras de uso (hex em `tokens/tokens.json`)

- **Navy (`#1B2A4D` / deep `#101C38` / soft `#24365E`)** — base da marca. Fundos de hero, header, footer, artes sociais. Títulos sobre fundo claro.
- **Dourado (`#B8933F` / claro `#DCB96A` / pálido `#F0E3C4`)** — valor e credencial. Botão primário (gradiente metálico `--grad-gold-metal`), filetes, selos, destaques de texto sobre navy.
- **Vermelho (`#C8102E`)** — SOMENTE urgência: badges "Matrículas abertas"/"Últimas vagas", tarja de assunto, o símbolo. **Nunca** como fundo de seção ou botão comum.
- **Azul Vida (`#1D4F91`)** — exclusivo da Estrela da Vida e ilustrações médicas. Não usar em UI.
- **Fundos claros:** `paper #FAF8F4` (padrão) e `sand #ECEAE4`. Texto claro: `ink #212A3D`; secundário `muted #5B6476`.
- Proporção aproximada em qualquer peça: **60% navy/neutros · 30% branco/paper · 8% dourado · 2% vermelho**.

## 4. Tipografia

- **Archivo** (500–900): títulos, rótulos, botões, números. Títulos grandes em 800–900.
- **Inter** (400–700): corpo de texto e interface.
- **Great Vibes**: EXCLUSIVAMENTE a palavra "Certificado" em documentos formais.
- Eyebrow/rótulo: Archivo 700, caixa alta, letter-spacing `.14em`, dourado sobre claro (`#B8933F`) ou dourado claro sobre navy (`#DCB96A`).

## 5. Componentes (receitas prontas — ver `index.html` para o visual)

- **Botão primário:** fundo `--grad-gold-metal`, texto navy-deep, Archivo 700, padding 15×30, raio 10px, sombra `--shadow-gold`. Hover: sobe 2px.
- **Botão secundário:** navy sólido (fundo claro) ou outline branco (fundo escuro).
- **Botão WhatsApp:** verde `#25D366` com ícone — único caso de verde.
- **Card de curso:** borda superior de 4px em gradiente dourado, chip de categoria, carga horária em dourado, lista com checks dourados, CTA no pé. Variante destaque: fundo navy + chip vermelho.
- **Card de depoimento:** fundo navy-deep, aspas Georgia douradas gigantes, avatar/foto, nome + turma.
- **Credencial verificável:** card navy com borda dourada, foto do aluno, ID `MG-AAAA-NNNN` em mono, QR de verificação.
- **Header:** fita dourada de 5px no topo + barra navy-deep com logo horizontal e CTA dourado.
- **Footer:** navy-deep, 3 colunas (marca/cursos/contato), rodapé legal com CNPJ.
- **Textura de fundo escuro:** trama de hexágonos dourados a 6% (`.magma-hex-texture`).

## 6. Formatos de mídia

| Formato | Dimensão | Regras |
|---|---|---|
| Post feed | 1080×1080 | margem segura 88px; marca no topo; badge vermelho + título 900; pílulas de dados; CTA dourado + @magma_curso na base |
| Stories/Reels | 1080×1920 | 250px livres no topo e na base; conteúdo essencial no centro |
| Thumbnail vídeo | 1280×720 | máx. 4 palavras em destaque; selo Magma no canto; alto contraste |
| Certificado | A4 paisagem (1123×794 @96dpi) | ver §7 — seguir o modelo oficial |

## 7. Certificado — SIGA O MODELO OFICIAL (não criar layouts novos)

O layout do certificado é o do PDF oficial (`certificado-conclusao-aph.pdf`), reproduzido em
`index.html#certificado`. Anatomia obrigatória:

1. **Fundo:** branco acetinado (textura de seda suave), moldura interna fina navy.
2. **Cantos diagonais navy** (`#101C38→#1B2A4D`): topo-direito e base-esquerda/base-direita, separados por **fitas douradas em gradiente metálico**.
3. **Topo esquerdo:** QR code de verificação.
4. **Topo direito:** palavra **"Certificado"** em Great Vibes dourado, sobre o canto navy.
5. **Centro:** símbolo oficial → wordmark **MAGMA** navy → barra dourada com **"Cursos"**.
6. **Texto:** "O Curso Magma LTDA confere orgulhosamente este Certificado para" → **NOME DO ALUNO** (linha) → "Portador do CPF n° … por ter frequentado integralmente o curso de **[CURSO]** perfazendo um total de [N] ([por extenso]) horas."
7. **Base esquerda (sobre navy):** endereço, e-mail, telefones, CNPJ em branco.
8. **Base direita:** assinatura do instrutor (nome + COREN) e, sobre o canto navy, **cidade + data** (ex.: "NOVA IGUAÇU 28/04/2025").
9. **Página 2:** tabela "CONTEÚDO PROGRAMÁTICO" com checkmarks, professores e total de horas.

Campos variáveis: `[NOME]`, `[CPF]`, `[CURSO]`, `[HORAS]`, `[CIDADE DATA]`, `[INSTRUTOR/COREN]`, `[QR/CÓDIGO]`.

## 8. Tom de voz

- **É:** direto, prático, humano, confiante. Fala com "você". Prova antes de promessa (instrutores atuantes, certificado verificável, prática em equipamento real).
- **Frases-modelo:** "Sua carreira na saúde começa com prática de verdade" · "Turmas aos sábados, feitas para quem trabalha" · "Certificado que o empregador confirma na hora".
- **Nunca:** superlativos vazios ("melhor do Brasil"), promessa de emprego garantido, jargão sem explicação, tom alarmista com saúde.

## 9. Checklist antes de entregar qualquer peça

- [ ] Símbolo = Estrela da Vida oficial (não a cruz antiga)?
- [ ] Cores só da paleta de `tokens.json`? Vermelho ≤ 2% da área?
- [ ] Títulos Archivo 800/900, corpo Inter?
- [ ] CTA principal em gradiente dourado com texto navy?
- [ ] Contato correto (@magma_curso, WhatsApp, Nilópolis/RJ)?
- [ ] Se certificado: layout do modelo oficial (§7)?
- [ ] Texto no tom de voz (§8), sem promessas proibidas?
