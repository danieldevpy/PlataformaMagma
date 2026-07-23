# Spec 014 (Fase A) — passo 1/3: ganha os campos novos do Aluno de forma
# permissiva (sem unique ainda) e libera `cpf` pra aceitar NULL.
#
# `token` entra sem `default`/`unique` pelo mesmo motivo do
# `cursos.0005_turma_token_cadastro`: SQLite recria a tabela inteira ao
# adicionar um campo com default e, se fosse unique, aplicaria o MESMO
# valor calculado uma única vez a todas as linhas existentes — colide na
# hora com mais de 1 Aluno. O valor distinto por linha nasce na migration
# de dados (0004) e só a 0005 liga unique=True (+ default definitivo pros
# alunos futuros).
#
# `codigo_carteirinha` entra sem unique (mesmo raciocínio: ainda não tem
# dado real pra garantir a unicidade — vem da 0004, que copia da
# Matricula preenchida ou gera um código novo).
#
# `cpf` vira nullable aqui (mas AINDA NÃO unique) só pra permitir que a
# migration de dados grave `None` nos CPFs em branco — sem isso a coluna
# não aceitaria NULL. A unicidade em si só é ligada na 0005, depois que a
# 0004 já tiver fundido os alunos duplicados.
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('educacional', '0002_matricula_escopo'),
    ]

    operations = [
        migrations.AddField(
            model_name='aluno',
            name='token',
            field=models.UUIDField(null=True, blank=True, editable=False),
        ),
        migrations.AddField(
            model_name='aluno',
            name='codigo_carteirinha',
            field=models.CharField(max_length=30, blank=True, editable=False),
        ),
        migrations.AddField(
            model_name='aluno',
            name='validade_carteirinha',
            field=models.DateField(null=True, blank=True, editable=False),
        ),
        migrations.AddField(
            model_name='aluno',
            name='validade_carteirinha_meses',
            field=models.PositiveSmallIntegerField(default=24),
        ),
        migrations.AlterField(
            model_name='aluno',
            name='cpf',
            field=models.CharField(max_length=14, null=True, blank=True),
        ),
    ]
