"""Ações expostas via `POST /api/acoes/executar/` (ver apps/nucleo/acoes.py).
Diferente do `CATALOGO_ACOES` de apps/midia/views.py (rotas REST próprias,
descritivas), esta ação passa pelo executor central — é a fila que o Manus
consulta pra saber o que publicar."""

from apps.midia.models import Postagem
from apps.nucleo.acoes import registrar_acao


@registrar_acao(
    nome="listar_postagens_agendadas",
    descricao=(
        "Lista as postagens com `agendada_para` preenchido (fila pro Manus "
        "publicar), da mais próxima pra mais distante no futuro."
    ),
    params={},
    escopo="midia:listar_postagens_agendadas",
)
def listar_postagens_agendadas(params, request):
    # Sem `id` no retorno: PK sequencial é identificador interno, nunca
    # público (constituição §6/spec 005 critério 6). `contexto` +
    # `agendada_para` já identificam a postagem sem ambiguidade prática (o
    # Manus não agenda duas postagens do mesmo contexto pro mesmo instante) —
    # `Postagem` não tem slug/uuid próprio, então não há campo público a
    # trocar por aqui. Desde a spec 008 a postagem pode ser de turma, de
    # curso ou da marca: turma_codigo/curso_slug saem None quando não se
    # aplicam (turma_codigo mantido por compat com consumidores antigos).
    postagens = Postagem.objects.filter(agendada_para__isnull=False).order_by(
        "agendada_para"
    )
    return [
        {
            "contexto": (
                "turma"
                if postagem.turma_id
                else "curso" if postagem.curso_id else "marca"
            ),
            "turma_codigo": postagem.turma.codigo if postagem.turma_id else None,
            "curso_slug": postagem.curso.slug if postagem.curso_id else None,
            "titulo": postagem.titulo,
            "legenda": postagem.legenda,
            "canal": postagem.canal,
            "status": postagem.status,
            "agendada_para": postagem.agendada_para,
        }
        for postagem in postagens.select_related("turma", "curso")
    ]
