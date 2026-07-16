# 02 · Backend Django — Apps e Modelos

> Convenção: nomes de modelos/campos em PT-BR (o dono lê esses nomes no painel).
> Todos os modelos têm `criado_em` / `atualizado_em` (`auto_now_add` / `auto_now`).
> Código abaixo é esqueleto de referência — ajustar detalhes na implementação.

## Base abstrata: rastreio de origem (seed-first — ver [doc 08](08-conteudo-inicial-seeds.md))

Todo modelo de **conteúdo editável pelo gestor** (Curso, Habilidade, PerguntaFrequente,
Instrutor, Turma, ConfiguracaoSite, Avaliacao-template) herda:

```python
class ConteudoRastreavel(models.Model):
    class Origem(models.TextChoices):
        TEMPLATE = "template"   # criado pelo seed, aguardando revisão do gestor
        EDITADO = "editado"     # gestor/instrutor já salvou por cima

    conteudo_origem = models.CharField(choices=Origem.choices,
                                       default=Origem.TEMPLATE, max_length=10)
    class Meta:
        abstract = True
```

- ViewSets do painel setam `conteudo_origem="editado"` em todo PATCH/PUT.
- O comando `seed_inicial` só cria/atualiza registros com origem `template`.
- O serializer do painel expõe o campo → o front mostra o badge "revisar".

## App `contas`

```python
class Usuario(AbstractUser):
    class Papel(models.TextChoices):
        GESTOR = "gestor"          # dono: acesso total ao painel
        INSTRUTOR = "instrutor"    # preenche curso/turma/anotações; não vê leads nem pesos
    papel = models.CharField(max_length=20, choices=Papel.choices, default=Papel.GESTOR)
    whatsapp = models.CharField(max_length=20, blank=True)
```

- Autenticação do painel: `djangorestframework-simplejwt` (`/api/token/`, `/api/token/refresh/`).
- Permissões DRF: `IsGestor`, `IsGestorOuInstrutor` (classes simples baseadas em `papel`).

## App `nucleo` — configuração e toggles globais

```python
class ConfiguracaoSite(models.Model):
    """Singleton (usar django-solo ou get_or_create(pk=1))."""
    whatsapp_principal = models.CharField(max_length=20, default="5521964946079")
    instagram = models.CharField(max_length=60, default="@magma_curso")
    email = models.EmailField(default="curso.magma21@gmail.com")
    endereco = models.TextField(default="Rua Nossa Senhora de Fátima, 495 — Olinda, Nilópolis/RJ")
    nota_google = models.DecimalField(max_digits=2, decimal_places=1, null=True, blank=True)
    total_alunos_formados = models.PositiveIntegerField(null=True, blank=True)
    exibir_nota_google = models.BooleanField(default=False)      # só liga quando tiver dado real
    exibir_total_formados = models.BooleanField(default=False)
```

> **Padrão de toggle:** cada dado "de prova social" tem o valor **e** um booleano
> `exibir_*`. O dono só liga quando o número é real — nada de placeholder no ar.

## App `cursos` — o coração do preenchimento

### Curso (conteúdo perene da página)

```python
class Curso(models.Model):
    class Status(models.TextChoices):
        RASCUNHO = "rascunho"      # visível só no painel
        PUBLICADO = "publicado"    # aparece no site

    slug = models.SlugField(unique=True)                  # socorrista-aph
    nome = models.CharField(max_length=120)               # Socorrista APH
    status = models.CharField(choices=Status.choices, default=Status.RASCUNHO, max_length=12)

    # Hero
    titulo_venda = models.CharField(max_length=160)       # "Em 120 horas você estará pronto..."
    titulo_destaque = models.CharField(max_length=60, blank=True)  # trecho dourado ("salvar vidas")
    subtitulo = models.TextField()                        # lead do hero
    imagem_hero = models.ImageField(upload_to="cursos/hero/", blank=True)

    # Ficha técnica
    carga_horaria = models.PositiveIntegerField(help_text="em horas")
    formato = models.CharField(max_length=80, default="Presencial")   # "Presencial"
    dias_e_horario_padrao = models.CharField(max_length=80, blank=True)  # "Sábados, 09h–16h"
    publico_alvo = models.TextField(blank=True)
    requisitos = models.TextField(blank=True, default="Nenhum — formação do zero")

    # Seções da LP (listas ordenadas → tabelas filhas abaixo)
    texto_pratica = models.TextField(blank=True)          # seção "mão na massa"
    imagem_pratica = models.ImageField(upload_to="cursos/pratica/", blank=True)
    texto_carreira = models.TextField(blank=True)
    imagem_carreira = models.ImageField(upload_to="cursos/carreira/", blank=True)
    itens_inclusos = models.JSONField(default=list, blank=True)   # ["120h presenciais", ...]
    saidas_profissionais = models.JSONField(default=list, blank=True)

    # SEO
    seo_titulo = models.CharField(max_length=70, blank=True)
    seo_descricao = models.CharField(max_length=160, blank=True)

class Habilidade(models.Model):
    """Cards 'O que você vai dominar' — 6 por curso na LP."""
    curso = models.ForeignKey(Curso, related_name="habilidades", on_delete=models.CASCADE)
    ordem = models.PositiveSmallIntegerField(default=0)
    icone = models.CharField(max_length=30, blank=True)   # chave de ícone do front
    titulo = models.CharField(max_length=60)
    descricao = models.CharField(max_length=200)

class FotoCurso(models.Model):
    """Carrossel de fotos do curso — usado na tela de avaliação pós-curso
    (magic link, ver doc 05) e reaproveitável na própria LP do curso.
    Fica no curso, não na turma: um curso roda com várias turmas ao longo
    do tempo, mas as fotos ilustram a experiência do curso como um todo."""
    curso = models.ForeignKey(Curso, related_name="fotos", on_delete=models.CASCADE)
    ordem = models.PositiveSmallIntegerField(default=0)
    imagem = models.ImageField(upload_to="cursos/galeria/")
    legenda = models.CharField(max_length=120, blank=True)

class PerguntaFrequente(models.Model):
    curso = models.ForeignKey(Curso, related_name="faqs", on_delete=models.CASCADE)
    ordem = models.PositiveSmallIntegerField(default=0)
    pergunta = models.CharField(max_length=160)
    resposta = models.TextField()

class Instrutor(models.Model):
    usuario = models.OneToOneField("contas.Usuario", null=True, blank=True, on_delete=models.SET_NULL)
    nome = models.CharField(max_length=120)
    registro = models.CharField(max_length=60, blank=True)      # "COREN-RJ 525874-ENF"
    especializacao = models.CharField(max_length=160, blank=True)
    bio = models.TextField(blank=True)
    foto = models.ImageField(upload_to="instrutores/", blank=True)
    cursos = models.ManyToManyField(Curso, related_name="instrutores", blank=True)
```

### Turma (o que muda a cada ciclo — inclui preço e controles)

```python
class Turma(models.Model):
    class Status(models.TextChoices):
        RASCUNHO = "rascunho"
        INSCRICOES = "inscricoes"      # exibida na LP como "matrículas abertas"
        LOTADA = "lotada"
        EM_ANDAMENTO = "em_andamento"
        ENCERRADA = "encerrada"

    curso = models.ForeignKey(Curso, related_name="turmas", on_delete=models.CASCADE)
    codigo = models.CharField(max_length=20)               # "03/2026"
    status = models.CharField(choices=Status.choices, default=Status.RASCUNHO, max_length=14)

    # Datas e formato reais (controláveis)
    inicio_aulas = models.DateField(null=True, blank=True)
    exibir_inicio = models.BooleanField(default=False)     # só mostra data quando confirmada
    dias_e_horario = models.CharField(max_length=80, blank=True)  # herda do curso se vazio
    capacidade = models.PositiveSmallIntegerField(null=True, blank=True)
    vagas_restantes = models.PositiveSmallIntegerField(null=True, blank=True)
    exibir_vagas = models.BooleanField(default=False)      # barra de urgência on/off

    # Countdown da condição antecipada — ativável/desativável
    exibir_countdown = models.BooleanField(default=False)
    countdown_ate = models.DateTimeField(null=True, blank=True)
    rotulo_countdown = models.CharField(max_length=80, default="Condição de matrícula antecipada encerra em")

    # Preço (preenchido pelo instrutor/gestor)
    preco_cheio = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)
    preco_avista = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)
    parcelas_qtd = models.PositiveSmallIntegerField(null=True, blank=True)
    parcela_valor = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)
    exibir_preco = models.BooleanField(default=False)      # False → LP mostra "Consulte condições"
    obs_pagamento = models.CharField(max_length=160, blank=True)  # "PIX com desconto, boleto..."

    instrutor = models.ForeignKey(Instrutor, null=True, blank=True, on_delete=models.SET_NULL)

    @property
    def countdown_ativo(self):
        return bool(self.exibir_countdown and self.countdown_ate
                    and self.countdown_ate > timezone.now())

class AnotacaoTurma(models.Model):
    """Memória interna de turmas anteriores — nunca vai para o site."""
    turma = models.ForeignKey(Turma, related_name="anotacoes", on_delete=models.CASCADE)
    autor = models.ForeignKey("contas.Usuario", null=True, on_delete=models.SET_NULL)
    texto = models.TextField()          # "turma de 18 alunos, 2 desistências, ajustar ritmo do módulo 4"
```

**Regra de exibição na LP:** a página do curso usa a turma com `status=inscricoes`
mais recente ("turma em destaque"). Sem turma nesse status → LP renderiza sem card de
turma (CTA vira "entrar na lista de espera").

## App `avaliacoes` — ver detalhes em [05-avaliacoes-magic-link.md](05-avaliacoes-magic-link.md)

```python
class ConviteAvaliacao(models.Model):
    token = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    curso = models.ForeignKey("cursos.Curso", on_delete=models.CASCADE)
    turma = models.ForeignKey("cursos.Turma", null=True, blank=True, on_delete=models.SET_NULL)
    nome_aluno = models.CharField(max_length=120, blank=True)   # pré-preenche o form
    enviado_por = models.ForeignKey("contas.Usuario", null=True, on_delete=models.SET_NULL)
    expira_em = models.DateTimeField()                           # default: +30 dias
    usado_em = models.DateTimeField(null=True, blank=True)       # 1 convite = 1 avaliação

    @property
    def url(self):
        return f"{settings.FRONTEND_URL}/avaliar/{self.token}"

class Avaliacao(models.Model):
    class Status(models.TextChoices):
        PENDENTE = "pendente"
        APROVADA = "aprovada"
        REJEITADA = "rejeitada"

    convite = models.OneToOneField(ConviteAvaliacao, null=True, blank=True, on_delete=models.SET_NULL)
    curso = models.ForeignKey("cursos.Curso", related_name="avaliacoes", on_delete=models.CASCADE)
    turma = models.ForeignKey("cursos.Turma", null=True, blank=True, on_delete=models.SET_NULL)
    nome = models.CharField(max_length=120)
    cargo_atual = models.CharField(max_length=120, blank=True)   # "Socorrista em eventos"
    estrelas = models.PositiveSmallIntegerField(validators=[MinValueValidator(1), MaxValueValidator(5)])
    comentario = models.TextField(max_length=600)
    foto = models.ImageField(upload_to="avaliacoes/", blank=True)  # opcional
    status = models.CharField(choices=Status.choices, default=Status.PENDENTE, max_length=10)
    peso = models.PositiveSmallIntegerField(default=0)   # 0–100, definido pelo gestor
    exibir_na_home = models.BooleanField(default=False)

    class Meta:
        ordering = ["-peso", "-estrelas", "-criado_em"]  # ordem que o site consome
```

## App `leads`

```python
class Lead(models.Model):
    nome = models.CharField(max_length=120)
    whatsapp = models.CharField(max_length=20, blank=True)
    curso = models.ForeignKey("cursos.Curso", null=True, blank=True, on_delete=models.SET_NULL)
    quando_pretende = models.CharField(max_length=60, blank=True)
    utm_source = models.CharField(max_length=60, blank=True)
    utm_campaign = models.CharField(max_length=60, blank=True)
    pagina_origem = models.CharField(max_length=200, blank=True)
    status = models.CharField(max_length=20, default="novo")  # novo/em_contato/matriculado/perdido
```

`post_save` → dispara webhook n8n (`N8N_LEAD_WEBHOOK`) com o payload do lead.
O front continua abrindo o WhatsApp (comportamento atual do `lp.js`), mas **antes**
registra o lead via `POST /api/leads/`.

## App `educacional` (FASE FUTURA — modelar, não implementar agora)

Estrutura planejada para gestão escolar completa e integrações com IA
(ver docs conceituais [subsistemas/03](../subsistemas/03-gestao-escolar.md) e
[04](../subsistemas/04-certificacao-credenciais.md)):

```
Aluno        (nome, cpf, whatsapp, email, endereço, origem_lead FK)
Matricula    (aluno FK, turma FK, status, valor_fechado, forma_pagamento)
Aula         (turma FK, data, tema, modulo, conteudo_programatico)
Presenca     (aula FK, matricula FK, presente, reposicao_de FK)
Certificado  (matricula FK, codigo "MG-2026-0001", uuid_verificacao,
              emitido_em, pdf, qr aponta p/ /verificar/{uuid})
```

- `Certificado.uuid_verificacao` alimenta a página pública `/verificar/[codigo]` —
  fecha o ciclo com o QR do certificado do design system.
- Toda a modelagem usa nomes/relacionamentos explícitos para servir de contexto
  a agentes de IA (ex.: MCP server lendo a API com token de escopo restrito).

## Django Admin (dev)

Registrar tudo com `list_display`/`list_filter` úteis, mas tratar como ferramenta do
desenvolvedor: URL `dj-admin/`, acesso só `is_superuser`. O que o dono usa no dia a dia
tem tela no painel React ([06-painel-gestor.md](06-painel-gestor.md)).
