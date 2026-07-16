from rest_framework.permissions import BasePermission

from apps.contas.models import Usuario


class IsGestor(BasePermission):
    """Acesso liberado só para o papel gestor (dono: acesso total ao painel)."""

    def has_permission(self, request, view):
        usuario = request.user
        return bool(
            usuario
            and usuario.is_authenticated
            and usuario.papel == Usuario.Papel.GESTOR
        )


class IsGestorOuInstrutor(BasePermission):
    """Acesso liberado para gestor ou instrutor autenticados."""

    def has_permission(self, request, view):
        usuario = request.user
        return bool(
            usuario
            and usuario.is_authenticated
            and usuario.papel in (Usuario.Papel.GESTOR, Usuario.Papel.INSTRUTOR)
        )
