# Spec 014 (Fase A) — passo 2/3: migration de DADOS.
#
# Ordem importa (ver specs/014-aluno-duravel-matricula-whatsapp/plan.md,
# seção "Migração de dados"): aqui só se copia/funde/gera dado, nenhuma
# coluna é removida ainda (isso é a 0005 de educacional + 0006 de cursos,
# que rodam DEPOIS). Passos, na ordem:
#
#   1. Normaliza `Aluno.cpf` pra só dígitos; o que ficou vazio vira NULL.
#   2. Funde Alunos com o mesmo CPF: mantém o mais antigo (`criado_em`),
#      repontua as Matriculas dos duplicados pro sobrevivente (descartando
#      a duplicata quando o sobrevivente já tiver Matrícula na mesma
#      Turma — não dá pra violar a unicidade (aluno, turma) que a 0005 vai
#      criar) e apaga os Alunos duplicados.
#   3. Dá um `token` (uuid) distinto pra cada Aluno.
#   4. Migra a carteirinha: pra cada Aluno, copia código/validade da sua
#      Matrícula preenchida mais antiga (a `Matricula.codigo_carteirinha`
#      de hoje já nasce em toda Matrícula criada, preenchida ou não — só
#      as com `aluno_id` preenchido interessam aqui). Aluno que sobrar sem
#      nenhuma Matrícula (não deveria acontecer, mas por via das dúvidas)
#      ganha uma carteirinha gerada na hora (prefixo genérico "MAG").
#   5. Matrículas-fantasma (escopo=turma, sem aluno, nunca preenchidas):
#      cada Turma que tiver uma vira dona de um `token_cadastro` igual ao
#      `token` da fantasma (reusa o link já distribuído). Todas as
#      fantasmas são apagadas depois.
#   6. Qualquer Matrícula que sobrar sem `aluno_id` (não é fantasma nem
#      tem aluno — dado órfão/inconsistente, ex.: aluno apagado depois de
#      preenchida) é apagada: o modelo novo exige `aluno` obrigatório, e
#      não existe aluno pra vincular a essas linhas.
#   7. Toda Turma que não ganhou `token_cadastro` de uma fantasma recebe
#      um novo, gerado aqui.
#
# Fusão de CPF, geração de token e apagar fantasma/órfã são operações com
# perda de informação (dado ficou irrecuperável ou nunca existiu um Aluno
# pra vincular) — não tem como desfazer com segurança, por isso o reverse
# é `noop` documentado, e não uma tentativa de "desfusão".
from django.db import migrations


def normalizar_cpf(valor):
    digitos = "".join(ch for ch in (valor or "") if ch.isdigit())
    return digitos or None


def migrar_dados(apps, schema_editor):
    Aluno = apps.get_model("educacional", "Aluno")
    Matricula = apps.get_model("educacional", "Matricula")
    Turma = apps.get_model("cursos", "Turma")

    # --- 1. normaliza CPF (vazio -> NULL) -----------------------------
    for aluno in Aluno.objects.all():
        cpf_normalizado = normalizar_cpf(aluno.cpf)
        if aluno.cpf != cpf_normalizado:
            aluno.cpf = cpf_normalizado
            aluno.save(update_fields=["cpf"])

    # --- 2. funde Alunos duplicados por CPF ---------------------------
    alunos_por_cpf = {}
    for aluno in Aluno.objects.all().order_by("criado_em", "pk"):
        if not aluno.cpf:
            continue
        alunos_por_cpf.setdefault(aluno.cpf, []).append(aluno)

    for cpf, grupo in alunos_por_cpf.items():
        if len(grupo) < 2:
            continue
        sobrevivente, *duplicados = grupo  # já ordenado: mais antigo primeiro
        turmas_do_sobrevivente = set(
            Matricula.objects.filter(aluno_id=sobrevivente.pk).values_list(
                "turma_id", flat=True
            )
        )
        for duplicado in duplicados:
            for matricula in Matricula.objects.filter(aluno_id=duplicado.pk):
                if matricula.turma_id in turmas_do_sobrevivente:
                    # sobrevivente já matriculado nessa turma — a
                    # duplicata não pode virar uma 2ª Matrícula pro mesmo
                    # (aluno, turma) sob a unique constraint nova.
                    matricula.delete()
                else:
                    matricula.aluno_id = sobrevivente.pk
                    matricula.save(update_fields=["aluno_id"])
                    turmas_do_sobrevivente.add(matricula.turma_id)
            duplicado.delete()

    # --- 3. token distinto por Aluno -----------------------------------
    import uuid

    for aluno in Aluno.objects.all():
        aluno.token = uuid.uuid4()
        aluno.save(update_fields=["token"])

    # --- 4. migra carteirinha da Matricula preenchida pro Aluno --------
    from django.utils import timezone
    from datetime import timedelta

    for aluno in Aluno.objects.all():
        if aluno.codigo_carteirinha:
            continue
        primeira_matricula = (
            Matricula.objects.filter(aluno_id=aluno.pk, codigo_carteirinha__gt="")
            .order_by("criado_em", "pk")
            .first()
        )
        if primeira_matricula:
            aluno.codigo_carteirinha = primeira_matricula.codigo_carteirinha
            aluno.validade_carteirinha = primeira_matricula.validade_carteirinha
            aluno.validade_carteirinha_meses = (
                primeira_matricula.validade_carteirinha_meses
            )
            aluno.save(
                update_fields=[
                    "codigo_carteirinha",
                    "validade_carteirinha",
                    "validade_carteirinha_meses",
                ]
            )
        else:
            # aluno sem nenhuma matrícula (nunca deveria existir no fluxo
            # antigo, mas não custa cobrir): gera carteirinha genérica.
            competencia = timezone.now().strftime("%y%m")
            aluno.codigo_carteirinha = f"MAG-{competencia}-{aluno.pk:04d}"
            aluno.validade_carteirinha = (
                timezone.now() + timedelta(days=30 * aluno.validade_carteirinha_meses)
            ).date()
            aluno.save(
                update_fields=["codigo_carteirinha", "validade_carteirinha"]
            )

    # --- 5. fantasmas viram token_cadastro da Turma --------------------
    fantasmas = Matricula.objects.filter(
        aluno_id__isnull=True, escopo="turma", preenchida_em__isnull=True
    ).order_by("criado_em", "pk")
    turmas_atendidas = set()
    for fantasma in fantasmas:
        if fantasma.turma_id in turmas_atendidas:
            continue
        Turma.objects.filter(pk=fantasma.turma_id).update(
            token_cadastro=fantasma.token
        )
        turmas_atendidas.add(fantasma.turma_id)
    fantasmas.delete()

    # --- 6. qualquer Matricula ainda sem aluno é órfã — apaga ----------
    Matricula.objects.filter(aluno_id__isnull=True).delete()

    # --- 7. token_cadastro pras turmas que sobraram sem um -------------
    for turma in Turma.objects.filter(token_cadastro__isnull=True):
        turma.token_cadastro = uuid.uuid4()
        turma.save(update_fields=["token_cadastro"])


class Migration(migrations.Migration):

    dependencies = [
        ("educacional", "0003_aluno_token_carteirinha_cpf_nullable"),
        ("cursos", "0005_turma_token_cadastro"),
    ]

    operations = [
        migrations.RunPython(migrar_dados, migrations.RunPython.noop),
    ]
