# apps/owners/models.py
from __future__ import annotations

from decimal import Decimal

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models

from apps.core.models import Copropriete, TimeStampedModel


class Coproprietaire(TimeStampedModel):
    """
    Référentiel des copropriétaires d'une copropriété.

    Ce modèle est destiné à être piloté depuis l'Admin React :
    - création des copropriétaires ;
    - modification des informations de contact ;
    - activation / désactivation ;
    - rattachement aux lots ;
    - exploitation dans les appels de fonds, relances, AG et votes ;
    - création d'un accès utilisateur copropriétaire.
    """

    class TypePersonne(models.TextChoices):
        PHYSIQUE = "PHYSIQUE", "Personne physique"
        MORALE = "MORALE", "Personne morale"

    class Civilite(models.TextChoices):
        M = "M", "Monsieur"
        MME = "MME", "Madame"
        MLLE = "MLLE", "Mademoiselle"
        SOCIETE = "SOCIETE", "Société"
        AUTRE = "AUTRE", "Autre"

    copropriete = models.ForeignKey(
        Copropriete,
        on_delete=models.CASCADE,
        related_name="coproprietaires",
        db_index=True,
    )

    user_account = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="coproprietaire_profiles",
        db_index=True,
        help_text="Compte utilisateur lié à cette fiche copropriétaire.",
    )

    type_personne = models.CharField(
        max_length=20,
        choices=TypePersonne.choices,
        default=TypePersonne.PHYSIQUE,
        db_index=True,
    )

    civilite = models.CharField(
        max_length=20,
        choices=Civilite.choices,
        blank=True,
        db_index=True,
    )

    nom = models.CharField(max_length=120, db_index=True)
    prenom = models.CharField(max_length=120, blank=True, db_index=True)

    raison_sociale = models.CharField(
        max_length=180,
        blank=True,
        db_index=True,
        help_text="Utilisé lorsque le copropriétaire est une personne morale.",
    )

    email = models.EmailField(blank=True, db_index=True)
    telephone = models.CharField(max_length=30, blank=True, db_index=True)

    adresse = models.TextField(blank=True)
    ville = models.CharField(max_length=100, blank=True, db_index=True)
    pays = models.CharField(max_length=80, default="Côte d'Ivoire", db_index=True)

    notes = models.TextField(blank=True)

    actif = models.BooleanField(default=True, db_index=True)

    # Compatibilité avec votre ancien modèle.
    date_creation = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ("nom", "prenom", "id")
        constraints = [
            models.UniqueConstraint(
                fields=["copropriete", "nom", "prenom"],
                name="uniq_coproprietaire_nom_prenom_par_copro",
            ),
        ]
        indexes = [
            models.Index(fields=["copropriete", "actif"]),
            models.Index(fields=["copropriete", "nom", "prenom"]),
            models.Index(fields=["copropriete", "type_personne"]),
            models.Index(fields=["email"]),
            models.Index(fields=["telephone"]),
            models.Index(fields=["user_account"]),
        ]

    def __str__(self) -> str:
        return self.display_name

    def clean(self):
        if not self.copropriete_id:
            raise ValidationError({"copropriete": "La copropriété est obligatoire."})

        if not self.nom or not self.nom.strip():
            raise ValidationError({"nom": "Le nom est obligatoire."})

        if self.type_personne == self.TypePersonne.MORALE:
            if not self.raison_sociale and not self.nom:
                raise ValidationError(
                    {
                        "raison_sociale": (
                            "La raison sociale ou le nom de la personne morale "
                            "est obligatoire."
                        )
                    }
                )

        if self.email:
            self.email = self.email.strip().lower()

        if self.nom:
            self.nom = self.nom.strip()

        if self.prenom:
            self.prenom = self.prenom.strip()

        if self.raison_sociale:
            self.raison_sociale = self.raison_sociale.strip()

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)

    @property
    def display_name(self) -> str:
        if self.type_personne == self.TypePersonne.MORALE:
            return self.raison_sociale or self.nom

        full_name = f"{self.prenom} {self.nom}".strip()
        return full_name or self.nom

    @property
    def contact_label(self) -> str:
        parts = []

        if self.email:
            parts.append(self.email)

        if self.telephone:
            parts.append(self.telephone)

        return " / ".join(parts)

    @property
    def has_user_access(self) -> bool:
        return bool(self.user_account_id)


class ProprietaireLot(TimeStampedModel):
    """
    Historique de propriété d'un lot.

    Un lot peut :
    - avoir plusieurs propriétaires successifs ;
    - avoir plusieurs copropriétaires actifs en cas d'indivision ;
    - avoir un seul propriétaire principal actif pour le contact principal.
    """

    copropriete = models.ForeignKey(
        Copropriete,
        on_delete=models.CASCADE,
        related_name="proprietes_lots",
        db_index=True,
    )

    # Important : pas d'import direct de Lot pour éviter les imports circulaires.
    lot = models.ForeignKey(
        "lots.Lot",
        on_delete=models.CASCADE,
        related_name="proprietaires",
        db_index=True,
    )

    coproprietaire = models.ForeignKey(
        Coproprietaire,
        on_delete=models.CASCADE,
        related_name="lots_possedes",
        db_index=True,
    )

    date_debut = models.DateField(db_index=True)
    date_fin = models.DateField(null=True, blank=True, db_index=True)

    principal = models.BooleanField(
        default=True,
        db_index=True,
        help_text="Contact principal du lot pour la période active.",
    )

    quote_part = models.DecimalField(
        max_digits=6,
        decimal_places=2,
        default=Decimal("100.00"),
        help_text="Quote-part de propriété sur le lot. Exemple : 100.00 ou 50.00.",
    )

    notes = models.TextField(blank=True)

    class Meta:
        ordering = ("-date_debut", "-id")
        constraints = [
            models.UniqueConstraint(
                fields=["lot", "coproprietaire", "date_debut"],
                name="uniq_proprietaire_lot_date_debut",
            ),
        ]
        indexes = [
            models.Index(fields=["copropriete", "lot"]),
            models.Index(fields=["copropriete", "coproprietaire"]),
            models.Index(fields=["lot", "date_fin"]),
            models.Index(fields=["lot", "principal", "date_fin"]),
            models.Index(fields=["coproprietaire", "date_fin"]),
        ]

    def clean(self):
        if not self.copropriete_id:
            raise ValidationError({"copropriete": "La copropriété est obligatoire."})

        if not self.lot_id:
            raise ValidationError({"lot": "Le lot est obligatoire."})

        if not self.coproprietaire_id:
            raise ValidationError(
                {"coproprietaire": "Le copropriétaire est obligatoire."}
            )

        if self.lot_id and self.copropriete_id:
            lot_copropriete_id = getattr(self.lot, "copropriete_id", None)
            if lot_copropriete_id != self.copropriete_id:
                raise ValidationError(
                    {"lot": "Le lot doit appartenir à la même copropriété."}
                )

        if self.coproprietaire_id and self.copropriete_id:
            owner_copropriete_id = getattr(
                self.coproprietaire,
                "copropriete_id",
                None,
            )
            if owner_copropriete_id != self.copropriete_id:
                raise ValidationError(
                    {
                        "coproprietaire": (
                            "Le copropriétaire doit appartenir à la même copropriété."
                        )
                    }
                )

        if not self.date_debut:
            raise ValidationError({"date_debut": "La date de début est obligatoire."})

        if self.date_fin and self.date_fin < self.date_debut:
            raise ValidationError(
                {
                    "date_fin": (
                        "La date de fin ne peut pas être antérieure à la date de début."
                    )
                }
            )

        if self.quote_part is None:
            raise ValidationError({"quote_part": "La quote-part est obligatoire."})

        if self.quote_part <= 0:
            raise ValidationError(
                {"quote_part": "La quote-part doit être supérieure à 0."}
            )

        if self.quote_part > 100:
            raise ValidationError(
                {"quote_part": "La quote-part ne peut pas dépasser 100%."}
            )

        # Un seul propriétaire principal actif par lot.
        # On autorise plusieurs propriétaires actifs non principaux en cas d'indivision.
        if self.principal and not self.date_fin and self.lot_id:
            exists = (
                ProprietaireLot.objects.filter(
                    lot_id=self.lot_id,
                    principal=True,
                    date_fin__isnull=True,
                )
                .exclude(pk=self.pk)
                .exists()
            )

            if exists:
                raise ValidationError(
                    {
                        "principal": (
                            "Un propriétaire principal actif existe déjà pour ce lot."
                        )
                    }
                )

        # Contrôle simple : la somme des quotes-parts actives ne doit pas dépasser 100%.
        if self.lot_id and not self.date_fin:
            active_qs = ProprietaireLot.objects.filter(
                lot_id=self.lot_id,
                date_fin__isnull=True,
            ).exclude(pk=self.pk)

            total_existing = sum(
                item.quote_part or Decimal("0.00")
                for item in active_qs
            )

            if total_existing + self.quote_part > Decimal("100.00"):
                raise ValidationError(
                    {
                        "quote_part": (
                            "La somme des quotes-parts actives du lot ne peut pas "
                            "dépasser 100%."
                        )
                    }
                )

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)

    def __str__(self) -> str:
        ref = getattr(self.lot, "reference", None) or getattr(
            self.lot,
            "numero",
            None,
        ) or str(self.lot_id)

        return f"{self.coproprietaire} → {ref}"

    @property
    def is_active(self) -> bool:
        return self.date_fin is None

    @property
    def periode_label(self) -> str:
        if self.date_fin:
            return f"Du {self.date_debut} au {self.date_fin}"

        return f"Depuis le {self.date_debut}"