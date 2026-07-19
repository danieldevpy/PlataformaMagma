"""Spec 008 — acervo em camadas. MidiaTurma vira Midia (RenameModel — o
autodetector sugeria delete+create, que destruiria os dados; escrito à mão
de propósito), turma/curso viram contexto opcional e nasce `camada`.
Nenhum arquivo físico muda de lugar: o upload_to novo mantém turmas/<id>/…
quando há turma, e o backfill marca todo o legado como camada="turma"."""

import django.db.models.deletion
from django.db import migrations, models

import apps.midia.models


def backfill_camada_turma(apps, schema_editor):
    Midia = apps.get_model("midia", "Midia")
    # Todo item pré-spec-008 tinha turma obrigatória — vira camada "turma".
    Midia.objects.all().update(camada="turma")


class Migration(migrations.Migration):

    dependencies = [
        ("cursos", "0001_initial"),
        ("midia", "0002_postagem_agendada_para"),
    ]

    operations = [
        migrations.RenameModel(old_name="MidiaTurma", new_name="Midia"),
        migrations.AlterModelOptions(
            name="midia",
            options={
                "ordering": ["ordem", "id"],
                "verbose_name": "Mídia do acervo",
                "verbose_name_plural": "Mídias do acervo",
            },
        ),
        migrations.AlterField(
            model_name="midia",
            name="turma",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="midias",
                to="cursos.turma",
            ),
        ),
        migrations.AlterField(
            model_name="midia",
            name="arquivo",
            field=models.FileField(upload_to=apps.midia.models.caminho_midia),
        ),
        migrations.AddField(
            model_name="midia",
            name="curso",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="midias_acervo",
                to="cursos.curso",
            ),
        ),
        migrations.AddField(
            model_name="midia",
            name="camada",
            field=models.CharField(
                choices=[
                    ("turma", "Turma"),
                    ("curso", "Curso"),
                    ("instrutores", "Instrutores"),
                    ("estrutura", "Estrutura"),
                    ("externa", "Externa (banco de imagens)"),
                    ("geral", "Geral da marca"),
                ],
                default="geral",
                max_length=12,
            ),
        ),
        migrations.AddField(
            model_name="midia",
            name="credito",
            field=models.CharField(blank=True, max_length=200),
        ),
        migrations.RunPython(backfill_camada_turma, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="postagem",
            name="turma",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="postagens",
                to="cursos.turma",
            ),
        ),
        migrations.AddField(
            model_name="postagem",
            name="curso",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="postagens",
                to="cursos.curso",
            ),
        ),
    ]
