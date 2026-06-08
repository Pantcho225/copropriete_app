# apps/core/models.py
from __future__ import annotations

import hashlib
import secrets
from datetime import timedelta

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone
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
        copropriete = getattr(self.copropriete, "nom", f"copro#{self.copropriete_id}")
        return f"{username} — {copropriete} — {self.role}"


class UserSecurityProfile(TimeStampedModel):
    """
    Profil de sécurité rattaché à un utilisateur.

    Utilisé notamment pour :
    - imposer le changement du mot de passe temporaire ;
    - tracer la dernière modification du mot de passe ;
    - préparer les futurs contrôles de sécurité d'accès.
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
        help_text="Force l'utilisateur à changer son mot de passe avant d'utiliser les API métier.",
    )

    password_changed_at = models.DateTimeField(
        blank=True,
        null=True,
        db_index=True,
    )

    class Meta:
        ordering = ("-id",)
        indexes = [
            models.Index(fields=["must_change_password"]),
            models.Index(fields=["password_changed_at"]),
        ]

    def __str__(self) -> str:
        username = (
            getattr(self.user, "username", None)
            or getattr(self.user, "email", None)
            or f"user#{self.user_id}"
        )
        return f"Profil sécurité — {username}"


class PasswordResetToken(models.Model):
    """
    Token sécurisé de récupération d'accès.

    Règles :
    - le token brut n'est jamais stocké en base ;
    - seul le hash SHA-256 est conservé ;
    - le token expire automatiquement ;
    - un token déjà utilisé ne peut pas être réutilisé ;
    - les anciens tokens actifs du même utilisateur sont invalidés à la création d'un nouveau.
    """

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="password_reset_tokens",
        db_index=True,
    )

    token_hash = models.CharField(
        max_length=128,
        unique=True,
        db_index=True,
    )

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    expires_at = models.DateTimeField(db_index=True)
    used_at = models.DateTimeField(blank=True, null=True, db_index=True)

    requested_ip = models.GenericIPAddressField(blank=True, null=True)
    requested_user_agent = models.TextField(blank=True)

    consumed_ip = models.GenericIPAddressField(blank=True, null=True)
    consumed_user_agent = models.TextField(blank=True)

    class Meta:
        ordering = ("-created_at",)
        indexes = [
            models.Index(fields=["user", "created_at"]),
            models.Index(fields=["user", "used_at"]),
            models.Index(fields=["expires_at", "used_at"]),
        ]

    def __str__(self) -> str:
        username = (
            getattr(self.user, "username", None)
            or getattr(self.user, "email", None)
            or f"user#{self.user_id}"
        )
        return f"Password reset token — {username}"

    @staticmethod
    def hash_token(raw_token: str) -> str:
        return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()

    @classmethod
    def generate_for_user(
        cls,
        *,
        user,
        requested_ip: str | None = None,
        requested_user_agent: str = "",
        ttl_minutes: int = 30,
    ) -> tuple[str, "PasswordResetToken"]:
        now = timezone.now()

        cls.objects.filter(
            user=user,
            used_at__isnull=True,
            expires_at__gt=now,
        ).update(used_at=now)

        raw_token = secrets.token_urlsafe(48)
        token_hash = cls.hash_token(raw_token)

        reset_token = cls.objects.create(
            user=user,
            token_hash=token_hash,
            expires_at=now + timedelta(minutes=ttl_minutes),
            requested_ip=requested_ip,
            requested_user_agent=(requested_user_agent or "")[:1000],
        )

        return raw_token, reset_token

    @property
    def is_used(self) -> bool:
        return self.used_at is not None

    @property
    def is_expired(self) -> bool:
        return timezone.now() >= self.expires_at

    @property
    def is_valid(self) -> bool:
        return not self.is_used and not self.is_expired

    def consume(
        self,
        *,
        consumed_ip: str | None = None,
        consumed_user_agent: str = "",
    ):
        self.used_at = timezone.now()
        self.consumed_ip = consumed_ip
        self.consumed_user_agent = (consumed_user_agent or "")[:1000]
        self.save(
            update_fields=[
                "used_at",
                "consumed_ip",
                "consumed_user_agent",
            ]
        )