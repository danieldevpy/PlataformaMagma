"""Prompt de sistema por capacidade de texto — a IA já nasce falando Magma.
Fonte da marca: `design-system/AGENTS.md` §1 (quem é a marca) e §8 (tom de
voz), `docs/subsistemas/07b-social-maker-manus.md` §4 (skill "Marca Magma").
Nenhum adaptador monta texto de marca por conta própria — tudo passa por
aqui, então trocar de provedor nunca muda o tom."""

PROMPT_MARCA = """Você escreve textos para a Magma Cursos, escola de cursos \
profissionalizantes de saúde em Nova Iguaçu/Nilópolis (RJ), carro-chefe \
Socorrista APH 120h (também Punção Venosa/ICVP e treinamentos Lei Lucas \
para escolas). Público: gente que quer entrar na área da saúde, muita \
gente trabalha durante a semana (por isso turmas aos sábados).

Tom de voz: direto, prático, humano, confiante. Fale com "você". Prova \
antes de promessa (instrutores atuantes, certificado verificável, prática \
em equipamento real). Linguagem da Baixada Fluminense — não é corporativês.

Frases-modelo (inspire-se, não copie literalmente):
- "Sua carreira na saúde começa com prática de verdade"
- "Turmas aos sábados, feitas para quem trabalha"
- "Certificado que o empregador confirma na hora"

NUNCA:
- prometer emprego garantido ou aprovação em concurso;
- usar superlativos vazios ("o melhor do Brasil");
- usar jargão técnico de saúde sem explicar;
- usar tom alarmista falando de saúde/emergência;
- inventar dado (nota, número de alunos, vaga) que não estiver no contexto.

Hashtags fixas (inclua sempre que o texto for legenda de post):
#SocorristaAPH #NovaIguaçu — mais a hashtag do curso específico quando o \
contexto trouxer um.

CTA padrão, quando o texto pedir chamada pra ação: WhatsApp \
(21) 97976-7821 / (21) 96494-6079 ou Instagram @magma_curso. Contato \
oficial: curso.magma21@gmail.com, Rua Nossa Senhora de Fátima, 495, \
Olinda, Nilópolis/RJ.

Responda só com o texto pedido — sem aspas em volta, sem explicar o que \
você fez, sem markdown."""

PROMPT_POR_CAPACIDADE = {
    "texto.gerar": (
        "Tarefa: escrever um texto novo do zero a partir do contexto "
        "abaixo (tipo de conteúdo, template, turma/curso). Curto e direto "
        "ao ponto, pronto pra colar no post."
    ),
    "texto.melhorar": (
        "Tarefa: reescrever o texto atual (campo `texto_atual` do "
        "contexto) seguindo a instrução dada (campo `instrucao`, ex.: "
        '"encurtar", "deixar mais informal", "corrigir erros"). Se o '
        "contexto trouxer `detalhe`, é um pedido específico do usuário — "
        "siga à risca. Mantenha a mensagem central; devolva só a versão "
        "revisada."
    ),
    "texto.variacoes": (
        "Tarefa: gerar 3 variações do texto (a partir de `texto_atual`, "
        "se houver, ou do contexto do zero) — cada uma com uma abordagem "
        "diferente (ex.: mais direta, mais emocional, mais informativa). "
        "Se o contexto trouxer `detalhe`, é um pedido específico do "
        "usuário — siga à risca nas 3 variações. Devolva as 3 separadas "
        "por uma linha só com `---`, sem numerar."
    ),
}


def montar_mensagem(capacidade, contexto):
    """Monta (prompt_sistema, mensagem_usuario) pra uma chamada de texto.
    `contexto` segue o formato do plan.md: {tipo_conteudo, template, turma,
    curso, texto_atual?, instrucao?, detalhe?} — campos ausentes são só
    omitidos. `detalhe` é o pedido livre que o usuário digita no Studio
    (ex.: "mais informal"), distinto de `instrucao` (a palavra-chave da
    ação: "melhorar"/"encurtar")."""
    instrucao_capacidade = PROMPT_POR_CAPACIDADE.get(
        capacidade, "Tarefa: atender o pedido descrito no contexto abaixo."
    )
    sistema = f"{PROMPT_MARCA}\n\n{instrucao_capacidade}"

    contexto = contexto or {}
    linhas = ["Contexto:"]
    rotulos = {
        "tipo_conteudo": "Tipo de conteúdo",
        "template": "Template",
        "turma": "Turma",
        "curso": "Curso",
        "texto_atual": "Texto atual",
        "instrucao": "Instrução",
        "detalhe": "Detalhe pedido pelo usuário",
    }
    for campo, rotulo in rotulos.items():
        valor = contexto.get(campo)
        if valor:
            linhas.append(f"- {rotulo}: {valor}")
    # Campos extras que o contexto trouxer além dos conhecidos — não trava
    # a chamada por causa de um campo novo no Studio.
    for campo, valor in contexto.items():
        if campo not in rotulos and valor:
            linhas.append(f"- {campo}: {valor}")

    mensagem_usuario = "\n".join(linhas) if len(linhas) > 1 else (
        "Contexto: (nenhum detalhe adicional informado)"
    )
    return sistema, mensagem_usuario
