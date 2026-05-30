# apps/core/models.py
from __future__ import annotations

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.utils.text import slugify


class TimeStampedModel(models.Model):
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class Copropriete(TimeStampedModel):
    """
    Référentiel principal d'une copropriété.

    Ce modèle est la source de vérité pour l'Admin React :
    - création d'une copropriété ;
    - activation / suspension ;
    - rattachement des utilisateurs ;
    - rattachement des lots ;
    - rattachement des copropriétaires ;
    - gestion des tantièmes.
    """

    class Statut(models.TextChoices):
        ACTIVE = "ACTIVE", "Active"
        SUSPENDUE = "SUSPENDUE", "Suspendue"
        ARCHIVEE = "ARCHIVEE", "Archivée"

    nom = models.CharField(max_length=150, db_index=True)

    slug = models.SlugField(
        max_length=180,
        unique=True,
        blank=True,
        null=True,
        db_index=True,
        help_text="Identifiant lisible utilisé pour les URLs ou références externes.",
    )

    adresse = models.TextField(blank=True)
    ville = models.CharField(max_length=100, blank=True, db_index=True)
    pays = models.CharField(max_length=80, default="Côte d'Ivoire", db_index=True)

    description = models.TextField(blank=True)

    telephone = models.CharField(max_length=50, blank=True)
    email_contact = models.EmailField(blank=True)

    statut = models.CharField(
        max_length=20,
        choices=Statut.choices,
        default=Statut.ACTIVE,
        db_index=True,
    )

    is_active = models.BooleanField(
        default=True,
        db_index=True,
        help_text="Compatibilité historique. Préférer aussi le champ statut côté produit.",
    )

    class Meta:
        ordering = ("nom", "id")
        indexes = [
            models.Index(fields=["is_active", "nom"]),
            models.Index(fields=["statut", "nom"]),
            models.Index(fields=["pays", "ville"]),
            models.Index(fields=["slug"]),
        ]

    def __str__(self) -> str:
        return self.nom

    def clean(self):
        if not self.nom or not self.nom.strip():
            raise ValidationError({"nom": "Le nom de la copropriété est obligatoire."})

        if self.statut == self.Statut.ACTIVE and not self.is_active:
            raise ValidationError(
                {
                    "is_active": (
                        "Une copropriété avec le statut ACTIVE doit aussi avoir "
                        "is_active=True."
                    )
                }
            )

    def save(self, *args, **kwargs):
        if not self.slug and self.nom:
            self.slug = self._generate_unique_slug()

        if self.statut in {self.Statut.SUSPENDUE, self.Statut.ARCHIVEE}:
            self.is_active = False

        if self.statut == self.Statut.ACTIVE:
            self.is_active = True

        super().save(*args, **kwargs)

    def _generate_unique_slug(self) -> str:
        base_slug = slugify(self.nom)[:160] or "copropriete"
        slug = base_slug
        counter = 2

        queryset = Copropriete.objects.filter(slug=slug)
        if self.pk:
            queryset = queryset.exclude(pk=self.pk)

        while queryset.exists():
            suffix = f"-{counter}"
            slug = f"{base_slug[: 180 - len(suffix)]}{suffix}"

            queryset = Copropriete.objects.filter(slug=slug)
            if self.pk:
                queryset = queryset.exclude(pk=self.pk)

            counter += 1

        return slug

    @property
    def is_available(self) -> bool:
        return self.is_active and self.statut == self.Statut.ACTIVE

    @property
    def display_name(self) -> str:
        if self.ville:
            return f"{self.nom} — {self.ville}"
        return self.nom


class CoproMembre(TimeStampedModel):
    """
    Membership User <-> Copropriete.

    Source de vérité multi-copropriété :
    - définit à quelle copropriété un utilisateur a accès ;
    - définit son rôle local dans cette copropriété ;
    - permet au frontend React de lister les copropriétés disponibles ;
    - permet de contrôler les droits métier.
    """

    class Role(models.TextChoices):
        ADMIN = "ADMIN", "Administrateur"
        SYNDIC = "SYNDIC", "Syndic"
        GESTIONNAIRE = "GESTIONNAIRE", "Gestionnaire"
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
        max_length=30,
        choices=Role.choices,
        default=Role.COPROPRIETAIRE,
        db_index=True,
    )

    is_active = models.BooleanField(default=True, db_index=True)

    class Meta:
        ordering = ("-id",)
        constraints = [
            models.UniqueConstraint(
                fields=["copropriete", "user"],
                name="uniq_copro_membre_par_user",
            ),
        ]
        indexes = [
            models.Index(fields=["copropriete", "is_active"]),
            models.Index(fields=["copropriete", "role"]),
            models.Index(fields=["user", "is_active"]),
            models.Index(fields=["role", "is_active"]),
        ]

    def clean(self):
        if not self.role:
            raise ValidationError({"role": "Le rôle est obligatoire."})

        if self.is_active and self.copropriete_id:
            if self.copropriete and not self.copropriete.is_available:
                raise ValidationError(
                    {
                        "copropriete": (
                            "Impossible d'activer un membre sur une copropriété "
                            "inactive, suspendue ou archivée."
                        )
                    }
                )

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)

    def __str__(self) -> str:
        username = (
            getattr(self.user, "username", None)
            or getattr(self.user, "email", None)
            or f"user#{self.user_id}"
        )

        copro = (
            getattr(self.copropriete, "nom", None)
            or f"copro#{self.copropriete_id}"
        )

        return f"{username} ({self.role}) - {copro}"

    @property
    def is_admin(self) -> bool:
        return self.role == self.Role.ADMIN

    @property
    def is_syndic(self) -> bool:
        return self.role == self.Role.SYNDIC

    @property
    def is_gestionnaire(self) -> bool:
        return self.role == self.Role.GESTIONNAIRE

    @property
    def is_comptable(self) -> bool:
        return self.role == self.Role.COMPTABLE

    @property
    def is_coproprietaire(self) -> bool:
        return self.role == self.Role.COPROPRIETAIRE

    @property
    def can_manage_copropriete(self) -> bool:
        return self.role in {
            self.Role.ADMIN,
            self.Role.SYNDIC,
        }

    @property
    def can_manage_referentiel(self) -> bool:
        return self.role in {
            self.Role.ADMIN,
            self.Role.SYNDIC,
            self.Role.GESTIONNAIRE,
        }

    @property
    def can_manage_users(self) -> bool:
        return self.role in {
            self.Role.ADMIN,
            self.Role.SYNDIC,
        }

    @property
    def can_write_compta(self) -> bool:
        return self.role in {
            self.Role.ADMIN,
            self.Role.SYNDIC,
            self.Role.GESTIONNAIRE,
            self.Role.COMPTABLE,
        }

    @property
    def can_read_reports(self) -> bool:
        return self.role in {
            self.Role.ADMIN,
            self.Role.SYNDIC,
            self.Role.GESTIONNAIRE,
            self.Role.COMPTABLE,
            self.Role.CONSEIL,
        }


class UserSecurityProfile(TimeStampedModel):
    """
    Profil sécurité complémentaire d'un utilisateur.

    Objectif :
    - forcer le changement du mot de passe temporaire ;
    - tracer la création d'un mot de passe temporaire ;
    - préparer l'espace copropriétaire séparé.
    """

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="security_profile",
        db_index=True,
    )

    must_change_password = models.BooleanField(
        default=False,
        db_index=True,
        help_text=(
            "Si True, l'utilisateur doit changer son mot de passe "
            "à la prochaine connexion."
        ),
    )

    temporary_password_created_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Date de génération du dernier mot de passe temporaire.",
    )

    class Meta:
        ordering = ("-id",)
        indexes = [
            models.Index(fields=["must_change_password"]),
        ]

    def __str__(self) -> str:
        username = (
            getattr(self.user, "username", None)
            or getattr(self.user, "email", None)
            or f"user#{self.user_id}"
        )

        return f"Sécurité utilisateur — {username}"