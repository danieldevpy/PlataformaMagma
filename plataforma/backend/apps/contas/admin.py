from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from apps.contas.models import Usuario


@admin.register(Usuario)
class UsuarioAdmin(UserAdmin):
    list_display = (
        "username",
        "email",
        "first_name",
        "last_name",
        "papel",
        "whatsapp",
        "is_staff",
        "is_active",
    )
    list_filter = ("papel", "is_staff", "is_active")
    search_fields = ("username", "email", "first_name", "last_name")
    fieldsets = UserAdmin.fieldsets + (
        ("Magma", {"fields": ("papel", "whatsapp")}),
    )
