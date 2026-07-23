# Spec 014 (Fase A) — passo 3/3: agora que a 0004 já normalizou/fundiu e
# populou tudo, liga as constraints definitivas e derruba as colunas
# órfãs de Matricula.
#
# `matricula.aluno` vira obrigatório (CASCADE) com segurança porque a
# 0004 já apagou toda Matricula sem `aluno_id` (fantasma ou órfã).
import django.db.models.deletion
import uuid
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("educacional", "0004_migrar_dados_aluno_matricula_turma"),
    ]

    operations = [
        migrations.AlterField(
            model_name="aluno",
            name="cpf",
            field=models.CharField(max_length=14, unique=True, null=True, blank=True),
        ),
        migrations.AlterField(
            model_name="aluno",
            name="token",
            field=models.UUIDField(default=uuid.uuid4, unique=True, editable=False),
        ),
        migrations.AlterField(
            model_name="aluno",
            name="codigo_carteirinha",
            field=models.CharField(
                max_length=30, unique=True, editable=False, blank=True
            ),
        ),
        migrations.AlterField(
            model_name="matricula",
            name="aluno",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name="matriculas",
                to="educacional.aluno",
            ),
        ),
        migrations.RemoveField(model_name="matricula", name="token"),
        migrations.RemoveField(model_name="matricula", name="escopo"),
        migrations.RemoveField(model_name="matricula", name="codigo_carteirinha"),
        migrations.RemoveField(
            model_name="matricula", name="validade_carteirinha_meses"
        ),
        migrations.RemoveField(model_name="matricula", name="validade_carteirinha"),
        migrations.RemoveField(model_name="matricula", name="expira_em"),
        migrations.RemoveField(model_name="matricula", name="preenchida_em"),
        migrations.AddConstraint(
            model_name="matricula",
            constraint=models.UniqueConstraint(
                fields=("aluno", "turma"), name="matricula_aluno_turma_unica"
            ),
        ),
    ]
