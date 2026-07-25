import logging
import re
import unicodedata

from rest_framework import serializers

from apps.cursos.models import Curso
from apps.leads.models import Lead
from apps.nucleo.numeros import numero_de_pessoa

logger = logging.getLogger(__name__)


# Palavras que não distinguem um curso de outro — entram em quase todo
# nome/slug e só atrapalhariam a pontuação.
_TERMOS_IGNORADOS = {"curso", "de", "do", "da", "e", "em", "o", "a", "para", "pra"}


def _termos(texto):
    """Quebra em termos comparáveis: sem acento, minúsculo, sem pontuação."""
    sem_acento = (
        unicodedata.normalize("NFKD", texto or "").encode("ascii", "ignore").decode()
    )
    brutos = re.split(r"[^a-z0-9]+", sem_acento.lower())
    return {t for t in brutos if len(t) > 1 and t not in _TERMOS_IGNORADOS}


def resolver_curso(curso_slug):
    """Resolve o curso tolerando o que o agente de IA erra na prática.

    Achado real (spec 023): a MAG **nunca acertou o slug**. Em três
    tentativas mandou `socorrista-aph-120h`, `aph-120h` e
    `socorrista-aph-120h` — sempre montando o slug a partir do nome
    exibido ("Socorrista APH (120h)"), mesmo tendo `"slug":
    "socorrista-aph"` no contexto vindo de `detalhes_curso`. O lead nascia
    sem curso e ninguém ficava sabendo, porque slug errado era
    indistinguível de slug ausente. Isso quebra a régua da Nutridora
    (spec 020), que monta o toque T+1 com as habilidades reais do curso.

    Como o modelo erra o identificador mas acerta o ASSUNTO, a resolução é
    por sobreposição de termos entre o que ele mandou e o slug+nome de
    cada curso. Exige vencedor único: no empate devolve None, porque lead
    sem curso é ruim mas lead com o curso ERRADO é pior. Nunca levanta
    erro — perder o curso é ruim, perder o lead é pior ainda.
    """
    consulta = (curso_slug or "").strip()
    if not consulta:
        return None

    curso = Curso.objects.filter(slug=consulta).first()
    if curso is not None:
        return curso

    termos_consulta = _termos(consulta)
    if not termos_consulta:
        return None

    pontuados = []
    for candidato in Curso.objects.all():
        termos_curso = _termos(candidato.slug) | _termos(candidato.nome)
        pontos = len(termos_consulta & termos_curso)
        if pontos:
            pontuados.append((pontos, candidato))

    pontuados.sort(key=lambda par: par[0], reverse=True)
    empatou = len(pontuados) > 1 and pontuados[0][0] == pontuados[1][0]

    if pontuados and not empatou:
        vencedor = pontuados[0][1]
        logger.warning(
            "curso_slug %r não existe; resolvido por semelhança para %r "
            "(provável slug inventado pelo agente de IA)",
            consulta,
            vencedor.slug,
        )
        return vencedor

    logger.warning(
        "curso_slug %r não resolveu para um curso único (%d candidatos) — "
        "lead vai nascer sem curso",
        consulta,
        len(pontuados),
    )
    return None


def garantir_lead(whatsapp, curso=None, **campos):
    """Cria-ou-atualiza um `Lead` pelo WhatsApp. Nunca duplica, nunca apaga.

    Extraído de `LeadPublicoSerializer.create` na spec 025, quando o
    `escalar_contato` passou a precisar da mesma garantia: a bateria de
    conversas simuladas mostrou 3 contatos escalados que **não viraram
    lead** — incluindo quem disse "quero garantir minha vaga". A causa era
    a própria regra de handoff, que manda parar de qualificar, e a MAG
    parava antes de registrar.

    Deixar isso a cargo do prompt não sustenta: a spec 023 já provou duas
    vezes que regra no `systemMessage` não garante invariante de dado.
    Quem garante é o backend, nos dois caminhos de entrada.

    Campo com valor vazio não sobrescreve o que já se sabia — reencontro
    não pode apagar dado bom.
    """
    whatsapp = (whatsapp or "").strip()

    # Número que não é de gente (id de grupo, canal, transmissão) não vira
    # lead nunca — senão a Nutridora manda toque automático pra dentro de
    # um grupo. Vazio continua permitido: é o caso do formulário da LP, que
    # não coleta WhatsApp (a pessoa é redirecionada pro WhatsApp depois).
    if whatsapp and not numero_de_pessoa(whatsapp):
        raise ValueError(f"{whatsapp!r} não é o WhatsApp de uma pessoa.")

    # Sem número não dá pra saber se é a mesma pessoa — e deduplicar por
    # vazio colapsaria TODOS os leads sem WhatsApp num só (bug pior que o
    # que esta função corrige).
    existente = Lead.objects.filter(whatsapp=whatsapp).first() if whatsapp else None
    if existente is None:
        return Lead.objects.create(whatsapp=whatsapp, curso=curso, **campos)

    for campo, valor in campos.items():
        if valor not in (None, ""):
            setattr(existente, campo, valor)
    if curso is not None:
        existente.curso = curso
    # `criado_em` e `nutridora_ultimo_toque` ficam intocados de propósito:
    # reencontrar um lead não reinicia a régua da Nutridora (spec 020) nem
    # infla "leads das últimas 24h" do Radar (spec 019).
    existente.save()
    return existente


class LeadPublicoSerializer(serializers.ModelSerializer):
    curso_slug = serializers.CharField(
        required=False, allow_null=True, allow_blank=True, write_only=True
    )
    # `Lead.nome` virou `blank=True` na spec 025 pro handoff conseguir
    # garantir o lead sem saber o nome. Aqui NÃO afrouxa: quem preenche o
    # formulário da LP (ou é registrado pelo `registrar_lead` da MAG, que
    # só chama depois de perguntar) continua tendo que dizer como se chama.
    nome = serializers.CharField(max_length=120, required=True, allow_blank=False)

    def validate_whatsapp(self, valor):
        """Recusa id de grupo/canal com 400 em vez de deixar virar lead.

        `garantir_lead` também barra (é ele que protege os dois caminhos),
        mas lá o erro é `ValueError` — que viraria 500. Aqui vira 400 com
        mensagem, que é o que o `registrar_lead` do agente precisa ler.
        """
        valor = (valor or "").strip()
        if valor and not numero_de_pessoa(valor):
            raise serializers.ValidationError(
                "Não é o WhatsApp de uma pessoa (parece id de grupo, canal "
                "ou transmissão)."
            )
        return valor

    class Meta:
        model = Lead
        fields = [
            "nome",
            "whatsapp",
            "curso_slug",
            "quando_pretende",
            "utm_source",
            "utm_campaign",
            "pagina_origem",
        ]

    def create(self, validated_data):
        """Busca-ou-atualiza por WhatsApp em vez de sempre criar (spec 023).

        O agente MAG chamou `registrar_lead` duas vezes na mesma conversa e
        gerou dois `Lead` pra mesma pessoa, mesmo com o system prompt
        pedindo "uma vez só por conversa" — prompt é orientação
        probabilística, então quem garante a integridade da base é aqui.
        Vale também pro formulário da LP: preencher duas vezes deixa de
        virar dois leads.

        `Lead` passa a significar "pessoa interessada", não "cada vez que
        alguém falou com a gente" — o histórico de interação vive em
        `apps.conversas` (spec 021), que é o lugar certo pra isso.
        """
        curso = resolver_curso(validated_data.pop("curso_slug", None))
        whatsapp = validated_data.pop("whatsapp", "")
        return garantir_lead(whatsapp, curso=curso, **validated_data)


class LeadPainelSerializer(serializers.ModelSerializer):
    curso = serializers.SlugRelatedField(slug_field="slug", read_only=True)
    curso_nome = serializers.CharField(source="curso.nome", read_only=True)

    class Meta:
        model = Lead
        fields = [
            "id",
            "nome",
            "whatsapp",
            "curso",
            "curso_nome",
            "quando_pretende",
            "utm_source",
            "utm_campaign",
            "pagina_origem",
            "status",
            "criado_em",
        ]
        read_only_fields = [
            "id",
            "nome",
            "whatsapp",
            "curso",
            "curso_nome",
            "quando_pretende",
            "utm_source",
            "utm_campaign",
            "pagina_origem",
            "criado_em",
        ]
