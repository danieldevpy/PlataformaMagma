# Spec 014 (Fase A) — passo 1/3 do `token_cadastro` da Turma.
#
# Adiciona a coluna de forma permissiva (nula, sem default, sem unique).
# Motivo: um UUIDField com `default=uuid.uuid4` faz o SQLite reconstruir a
# tabela inteira (`_remake_table`) e usar UM ÚNICO valor de default,
# calculado uma vez, para todas as linhas existentes — com `unique=True`
# isso quebra na hora (colisão) em qualquer Turma com mais de 1 registro.
# Por isso o valor real e distinto por linha é populado na migration de
# dados (0004 de `educacional`, que também mexe em Turma) e só a migration
# 0006 (depois dos dados prontos) liga unique=True + default definitivo.
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('cursos', '0004_turma_consentimento_midia_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='turma',
            name='token_cadastro',
            field=models.UUIDField(null=True, blank=True, editable=False),
        ),
    ]
