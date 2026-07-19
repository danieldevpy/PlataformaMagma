"""Registry central de ações — a "documentação viva" que um agente (n8n,
Manus) lê em `GET /api/acoes/` pra saber o que a plataforma sabe fazer, e
que executa via `POST /api/acoes/executar/` (ver
docs/subsistemas/10-studio-2.0.md §6 e specs/005-camada-de-acoes).

Cada app registra suas próprias ações chamando `registrar_acao` como
decorator num módulo `<app>/acoes.py`, importado no `AppConfig.ready()`
daquele app (garante que o registro aconteça uma vez, no boot). A função
decorada tem assinatura `fn(params: dict, request) -> dict` — `params` é o
corpo JSON recebido em `params`, `request` é o `HttpRequest` (dá acesso a
`request.user`/`request.auth` quando a ação precisa saber quem chamou).

Erros de negócio esperados (turma não encontrada, parâmetro ausente etc.)
devem levantar `ErroAcao` — a view de execução converte pra
`{"detail": str(erro)}` com status 400 e grava `LogAcao` de erro. Qualquer
outra exceção também é logada, mas responde 500 genérico (não vaza detalhe
interno pro agente).
"""

_REGISTRY = {}


class ErroAcao(Exception):
    """Erro de negócio esperado ao executar uma ação (ver módulo)."""


def registrar_acao(nome, descricao, params=None, escopo=None):
    def decorador(fn):
        if nome in _REGISTRY:
            raise ValueError(f"Ação '{nome}' já registrada.")
        _REGISTRY[nome] = {
            "nome": nome,
            "descricao": descricao,
            "parametros": params or {},
            "escopo": escopo,
            "fn": fn,
        }
        return fn

    return decorador


def obter_acao(nome):
    """Entrada crua do registry (com o callable `fn`) — usada só pela view
    de execução; o catálogo público usa `catalogo_registry` (sem `fn`)."""
    return _REGISTRY.get(nome)


def catalogo_registry():
    """Ações executáveis via `/api/acoes/executar/` — sem o callable."""
    return [
        {
            "nome": entrada["nome"],
            "descricao": entrada["descricao"],
            "parametros": entrada["parametros"],
            "escopo": entrada["escopo"],
            "executavel": True,
            "metodo": "POST",
            "rota": "/api/acoes/executar/",
        }
        for entrada in _REGISTRY.values()
    ]


def catalogo_midia_descritivo():
    """Entradas do `CATALOGO_ACOES` do app midia — só descritivas (rotas
    REST próprias, upload multipart etc.), não passam por
    `/api/acoes/executar/`. O endpoint antigo `GET /api/midia/acoes/` não
    muda; isto aqui é uma cópia normalizada pro catálogo geral. Import
    tardio (dentro da função) evita ciclo de import no boot dos apps."""
    from apps.midia.views import CATALOGO_ACOES

    return [
        {
            "nome": entrada["nome"],
            "descricao": entrada["descricao"],
            "parametros": entrada["parametros"],
            "escopo": None,
            "executavel": False,
            "metodo": entrada["metodo"],
            "rota": entrada["rota"],
        }
        for entrada in CATALOGO_ACOES
    ]


def catalogo_completo():
    return catalogo_registry() + catalogo_midia_descritivo()
