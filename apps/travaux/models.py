# apps/travaux/models.py
from __future__ import annotations

from decimal import Decimal

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import MinValueValidator
from django.db import models, transaction
from django.db.models import Q, F
from django.utils import timezone

from apps.core.models import Copropriete

DEC_0 = Decimal("0.00")


class Fournisseur(models.Model):
    copropriete = models.ForeignKey(
        Copropriete,
        on_delete=models.CASCADE,
        related_name="fournisseurs",
    )

    nom = models.CharField(max_length=255)
    email = models.EmailField(blank=True, default="")
    telephone = models.CharField(max_length=50, blank=True, default="")
    adresse = models.TextField(blank=True, default="")
    identifiant = models.CharField(
        max_length=100,
        blank=True,
        default="",
        help_text="RCCM / IFU / SIRET / etc.",
    )

    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=["copropriete", "nom"]),
            models.Index(fields=["copropriete", "is_active"]),
            models.Index(fields=["copropriete", "created_at"]),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["copropriete", "nom"],
                name="travaux_fournisseur_unique_nom_par_copro",
            ),
        ]

    def clean(self):
        super().clean()
        if self.nom:
            self.nom = self.nom.strip()

    def save(self, *args, **kwargs):
        if self.nom:
            self.nom = self.nom.strip()
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return f"{self.nom} (copro={self.copropriete_id})"


class DossierTravaux(models.Model):
    class Statut(models.TextChoices):
        BROUILLON = "BROUILLON", "Brouillon"
        SOUMIS_AG = "SOUMIS_AG", "Soumis à l'AG"
        VALIDE = "VALIDE", "Validé (AG)"
        EN_COURS = "EN_COURS", "En cours"
        TERMINE = "TERMINE", "Terminé"
        ARCHIVE = "ARCHIVE", "Archivé"

    copropriete = models.ForeignKey(
        Copropriete,
        on_delete=models.CASCADE,
        related_name="dossiers_travaux",
    )

    titre = models.CharField(max_length=255)
    description = models.TextField(blank=True, default="")

    statut = models.CharField(
        max_length=20,
        choices=Statut.choices,
        default=Statut.BROUILLON,
    )

    budget_estime = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=DEC_0,
        validators=[MinValueValidator(DEC_0)],
    )
    budget_vote = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
        validators=[MinValueValidator(DEC_0)],
        help_text="Budget voté en AG (optionnel).",
    )

    # OneToOne = vérité métier (validation AG)
    resolution_validation = models.OneToOneField(
        "ag.Resolution",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="dossier_travaux_validation",  # ⚠️ côté Resolution -> resolution.dossier_travaux_validation
        db_column="resolution_validation_id",
        db_index=True,
        help_text="Résolution AG qui valide ce dossier.",
    )

    locked_at = models.DateTimeField(null=True, blank=True)
    locked_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="travaux_locked",
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    # -------------------------
    # Workflow: transitions autorisées
    # -------------------------
    ALLOWED_TRANSITIONS = {
        Statut.BROUILLON: {Statut.SOUMIS_AG},
        Statut.SOUMIS_AG: {Statut.VALIDE},
        Statut.VALIDE: {Statut.EN_COURS, Statut.ARCHIVE},
        Statut.EN_COURS: {Statut.TERMINE, Statut.ARCHIVE},
        Statut.TERMINE: {Statut.ARCHIVE},
        Statut.ARCHIVE: set(),
    }

    class Meta:
        indexes = [
            models.Index(fields=["copropriete", "statut"]),
            models.Index(fields=["copropriete", "created_at"]),
            models.Index(fields=["copropriete", "titre"]),
            models.Index(fields=["copropriete", "resolution_validation"]),
            models.Index(fields=["copropriete", "locked_at"]),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["copropriete", "titre"],
                name="travaux_dossier_unique_titre_par_copro",
            ),
            models.CheckConstraint(
                condition=Q(budget_estime__gte=DEC_0),
                name="travaux_dossier_budget_estime_gte_0",
            ),
            models.CheckConstraint(
                condition=Q(budget_vote__isnull=True) | Q(budget_vote__gte=DEC_0),
                name="travaux_dossier_budget_vote_null_or_gte_0",
            ),
            models.CheckConstraint(
                condition=Q(budget_vote__isnull=True) | Q(budget_vote__lte=F("budget_estime")),
                name="travaux_dossier_budget_vote_lte_estime",
            ),
            # Si VALIDE => résolution obligatoire
            models.CheckConstraint(
                condition=~Q(statut="VALIDE") | Q(resolution_validation__isnull=False),
                name="travaux_dossier_valide_requires_resolution",
            ),
            # Si verrouillé => pas BROUILLON / SOUMIS_AG
            models.CheckConstraint(
                condition=Q(locked_at__isnull=True) | ~Q(statut__in=["BROUILLON", "SOUMIS_AG"]),
                name="travaux_dossier_locked_forbids_draft_or_submitted",
            ),
        ]

    def __str__(self) -> str:
        return f"DossierTravaux#{self.id} {self.titre} ({self.statut})"

    @property
    def is_locked(self) -> bool:
        return bool(self.locked_at)

    def clean(self):
        super().clean()

        if self.titre:
            self.titre = self.titre.strip()

        if self.statut == self.Statut.VALIDE and not self.resolution_validation_id:
            raise ValidationError(
                {"resolution_validation": "Requis quand le dossier est au statut VALIDE."}
            )

        if self.is_locked and self.statut in {self.Statut.BROUILLON, self.Statut.SOUMIS_AG}:
            raise ValidationError(
                {"statut": "Un dossier verrouillé ne peut pas être BROUILLON / SOUMIS_AG."}
            )

        if (
            self.budget_vote is not None
            and self.budget_estime is not None
            and self.budget_vote > self.budget_estime
        ):
            raise ValidationError({"budget_vote": "Ne peut pas dépasser budget_estime."})

    def save(self, *args, **kwargs):
        if self.titre:
            self.titre = self.titre.strip()
        # Validation métier + unique + contraintes Python (complément DB)
        self.full_clean()
        super().save(*args, **kwargs)

    # -------------------------
    # Locks (robuste, évite full_clean inutile)
    # -------------------------
    def lock(self, user=None, save=True):
        """
        Verrouille le dossier. Interdit si statut BROUILLON / SOUMIS_AG (cohérent avec contraintes DB).
        Utilise UPDATE DB pour éviter les effets de bord (full_clean + update_fields).
        """
        if self.statut in {self.Statut.BROUILLON, self.Statut.SOUMIS_AG}:
            raise ValidationError(
                {"detail": "Verrouillage interdit tant que le dossier est BROUILLON / SOUMIS_AG."}
            )

        now = timezone.now()
        if not self.locked_at:
            self.locked_at = now

        if user is not None and not self.locked_by_id:
            self.locked_by = user

        if save:
            updates = {"locked_at": self.locked_at}
            if user is not None and self.locked_by_id:
                updates["locked_by"] = self.locked_by

            # atomic pour éviter race conditions
            with transaction.atomic():
                self.__class__.objects.filter(pk=self.pk).update(**updates)

    def unlock(self, save=True):
        if save:
            with transaction.atomic():
                self.__class__.objects.filter(pk=self.pk).update(locked_at=None, locked_by=None)
        self.locked_at = None
        self.locked_by = None

    # -------------------------
    # Workflow helpers
    # -------------------------
    def transition_to(self, new_statut: str):
        allowed = self.ALLOWED_TRANSITIONS.get(self.statut, set())
        if new_statut not in allowed:
            raise ValidationError({"statut": f"Transition interdite: {self.statut} -> {new_statut}."})
        self.statut = new_statut

    def submit_ag(self):
        self.transition_to(self.Statut.SOUMIS_AG)

    def validate_ag(self):
        self.transition_to(self.Statut.VALIDE)

    def start(self):
        self.transition_to(self.Statut.EN_COURS)

    def finish(self):
        self.transition_to(self.Statut.TERMINE)

    def archive(self):
        if self.statut not in {self.Statut.VALIDE, self.Statut.EN_COURS, self.Statut.TERMINE}:
            raise ValidationError({"statut": f"Archivage interdit depuis {self.statut}."})
        self.statut = self.Statut.ARCHIVE