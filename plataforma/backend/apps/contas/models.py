from django.contrib.auth.models import AbstractUser
from django.db import models


class Usuario(AbstractUser):
    class Papel(models.TextChoices):
        GESTOR = "gestor", "Gestor"
        INSTRUTOR = "instrutor", "Instrutor"

    papel = models.CharField(max_length=20, choices=Papel.choices, default=Papel.GESTOR)
    whatsapp = models.CharField(max_length=20, blank=True)

    def __str__(self):
        return self.get_full_name() or self.username
