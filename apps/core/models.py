from django.db import models

from django.db import models
from django.contrib.auth.models import User


class TimeStampedModel(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class Copropriete(TimeStampedModel):
    nom = models.CharField(max_length=150)
    adresse = models.TextField(blank=True)
    ville = models.CharField(max_length=100, blank=True)
    pays = models.CharField(max_length=80, default="Côte d'Ivoire")

    def __str__(self):
        return self.nom


class CoproMembre(TimeStampedModel):
    class Role(models.TextChoices):
        ADMIN = "ADMIN", "Admin"
        SYNDIC = "SYNDIC", "Syndic"
        COMPTABLE = "COMPTABLE", "Comptable"
        CONSEIL = "CONSEIL", "Conseil syndical"
        COPROPRIETAIRE = "COPROPRIETAIRE", "Copropriétaire"

    copropriete = models.ForeignKey(Copropriete, on_delete=models.CASCADE, related_name="membres")
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="copro_memberships")
    role = models.CharField(max_length=20, choices=Role.choices)
    is_active = models.BooleanField(default=True)

    class Meta:
        unique_together = ("copropriete", "user")

    def __str__(self):
        return f"{self.user.username} ({self.role}) - {self.copropriete.nom}"
