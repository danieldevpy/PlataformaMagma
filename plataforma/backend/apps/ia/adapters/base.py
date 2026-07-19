"""Contrato comum de adaptador de provedor de IA (ver
docs/subsistemas/10-studio-2.0.md §5.1 — "capacidades ≠ provedores"). Cada
provedor novo é 1 arquivo que implementa esta interface e se registra em
`apps/ia/adapters/__init__.py::REGISTRO_ADAPTADORES` — o resto do sistema
(views, Studio) nunca fala o nome do provedor, só a capacidade."""


class ErroAdaptadorIA(Exception):
    """Erro de adaptador de IA — a mensagem já vem em linguagem humana,
    pronta pra ir direto no `{"detail": ...}` da resposta da API (nunca
    vazar stack trace nem payload cru do provedor pro cliente)."""


class AdaptadorBase:
    """`capacidades`: conjunto de nomes tipo "texto.gerar" que este
    adaptador sabe executar. `executar`/`testar` recebem a instância de
    `ProvedorIA` (com credencial, modelo e config) já resolvida."""

    capacidades: set[str] = set()

    def __init__(self, provedor_ia):
        self.provedor_ia = provedor_ia

    def executar(self, capacidade, contexto):
        """Executa `capacidade` com o `contexto` (dict) recebido do Studio.
        Retorna dict `{"resultado": ..., "tokens_entrada": int|None,
        "tokens_saida": int|None}`. Levanta `ErroAdaptadorIA` em falha."""
        raise NotImplementedError

    def testar(self):
        """Faz uma chamada mínima real pra confirmar que credencial/modelo
        funcionam ("testar conexão" do §5.3). Retorna True ou levanta
        `ErroAdaptadorIA` com o motivo em linguagem humana."""
        raise NotImplementedError
