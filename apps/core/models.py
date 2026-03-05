# apps/core/models.py
from __future__ import annotations

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models


class TimeStampedModel(models.Model):
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class Copropriete(TimeStampedModel):
    nom = models.CharField(max_length=150, db_index=True)
    adresse = models.TextField(blank=True)
    ville = models.CharField(max_length=100, blank=True, db_index=True)
    pays = models.CharField(max_length=80, default="Côte d'Ivoire", db_index=True)
    is_active = models.BooleanField(default=True, db_index=True)

    class Meta:
        ordering = ("nom", "id")
        indexes = [
            models.Index(fields=["is_active", "nom"]),
            models.Index(fields=["pays", "ville"]),
        ]

    def __str__(self) -> str:
        return self.nom


class CoproMembre(TimeStampedModel):
    """
    Membership User <-> Copropriete (source of truth multi-copro)
    - role: contrôle des droits (ADMIN/SYNDIC/...)
    - is_active: désactivation logique de l'accès
    """

    class Role(models.TextChoices):
        ADMIN = "ADMIN", "Admin"
        SYNDIC = "SYNDIC", "Syndic"
        COMPTABLE = "COMPTABLE", "Comptable"
        CONSEIL = "CONSEIL", "Conseil syndical"
        COPROPRIETAIRE = "COPROPRIETAIRE", "Copropriétaire"

    copropriete = models.ForeignKey(
        Copropriete,
        on_delete=models.CASCADE,
        related_name="membres",
        db_index=True,
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="copro_memberships",
        db_index=True,
    )
    role = models.CharField(
        max_length=20,
        choices=Role.choices,
        default=Role.COPROPRIETAIRE,
        db_index=True,
    )
    is_active = models.BooleanField(default=True, db_index=True)

    class Meta:
        ordering = ("-id",)
        constraints = [
            models.UniqueConstraint(fields=["copropriete", "user"], name="uniq_copro_membre_par_user"),
        ]
        indexes = [
            models.Index(fields=["copropriete", "is_active"]),
            models.Index(fields=["copropriete", "role"]),
            models.Index(fields=["user", "is_active"]),
        ]

    def clean(self):
        # Sécurité applicative (évite role vide si jamais)
        if not self.role:
            raise ValidationError({"role": "Le rôle est obligatoire."})

    def __str__(self) -> str:
        username = getattr(self.user, "username", None) or getattr(self.user, "email", None) or f"user#{self.user_id}"
        copro = getattr(self.copropriete, "nom", None) or f"copro#{self.copropriete_id}"
        return f"{username} ({self.role}) - {copro}"

    @property
    def is_admin(self) -> bool:
        return self.role == self.Role.ADMIN

    @property
    def is_syndic(self) -> bool:
        return self.role == self.Role.SYNDIC

    @property
    def can_write_compta(self) -> bool:
        return self.role in {self.Role.ADMIN, self.Role.SYNDIC, self.Role.COMPTABLE}