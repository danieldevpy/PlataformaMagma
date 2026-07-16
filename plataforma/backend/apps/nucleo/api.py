from rest_framework.pagination import PageNumberPagination


class PaginacaoPainel(PageNumberPagination):
    page_size = 20
    page_size_query_param = "page_size"
    max_page_size = 100


class MarcarEditadoMixin:
    """Todo PATCH/PUT do painel em modelo com `conteudo_origem` marca o
    registro como revisado pelo gestor/instrutor (doc 02/08)."""

    def perform_update(self, serializer):
        campos = {f.name for f in serializer.Meta.model._meta.get_fields()}
        if "conteudo_origem" in campos:
            serializer.save(conteudo_origem="editado")
        else:
            serializer.save()
