# Spec 014 (Fase A) — passo 3/3 do `token_cadastro` da Turma.
#
# Só roda depois de `educacional.0004_migrar_dados_aluno_matricula_turma`
# (que já populou um `token_cadastro` distinto em toda Turma — reusando o
# da Matrícula-fantasma quando havia uma) — por isso a dependência
# explícita abaixo, mesmo essa migration sendo de outro app.
#
# `vagas_restantes` sai de vez: virou `@property` calculada (capacidade -
# matrículas ativas/concluídas), nunca mais um número digitado à mão.
from django.db import migrations, models
import uuid


class Migration(migrations.Migration):

    dependencies = [
        ("cursos", "0005_turma_token_cadastro"),
        ("educacional", "0004_migrar_dados_aluno_matricula_turma"),
    ]

    operations = [
        migrations.AlterField(
            model_name="turma",
            name="token_cadastro",
            field=models.UUIDField(default=uuid.uuid4, unique=True, editable=False),
        ),
        migrations.RemoveField(model_name="turma", name="vagas_restantes"),
    ]
