# apps/lots/models.py
from __future__ import annotations

from decimal import Decimal

from django.core.exceptions import ValidationError
from django.core.validators import MinValueValidator
from django.db import models
from django.db.models import Sum

from apps.core.models import Copropriete, TimeStampedModel


DECIMAL_0 = Decimal("0.0000")


class Lot(TimeStampedModel):
    """
    Référentiel des lots d'une copropriété.

    Ce modèle doit être pilotable depuis l'Admin React :
    - création des lots ;
    - modification des informations techniques ;
    - activation / désactivation ;
    - affectation des propriétaires ;
    - rattachement des tantièmes ;
    - suivi de l'occupant principal ;
    - exploitation AG, appels de fonds, relances et votes.
    """

    class TypeLot(models.TextChoices):
        APPARTEMENT = "APPARTEMENT", "Appartement"
        PARKING = "PARKING", "Parking"
        CAVE = "CAVE", "Cave"
        COMMERCE = "COMMERCE", "Commerce"
        BUREAU = "BUREAU", "Bureau"
        DEPOT = "DEPOT", "Dépôt"
        AUTRE = "AUTRE", "Autre"

    class Statut(models.TextChoices):
        OCCUPE = "OCCUPE", "Occupé"
        VACANT = "VACANT", "Vacant"
        EN_TRAVAUX = "EN_TRAVAUX", "En travaux"
        INACTIF = "INACTIF", "Inactif"

    TYPE_CHOICES = TypeLot.choices

    copropriete = models.ForeignKey(
        Copropriete,
        on_delete=models.CASCADE,
        related_name="lots",
        db_index=True,
    )

    reference = models.CharField(
        max_length=50,
        db_index=True,
        help_text="Référence officielle du lot. Exemple : A-101, LOT-001.",
    )

    numero = models.CharField(
        max_length=50,
        blank=True,
        db_index=True,
        help_text="Numéro interne ou cadastral du lot si différent de la référence.",
    )

    type_lot = models.CharField(
        max_length=30,
        choices=TypeLot.choices,
        default=TypeLot.APPARTEMENT,
        db_index=True,
    )

    statut = models.CharField(
        max_length=30,
        choices=Statut.choices,
        default=Statut.OCCUPE,
        db_index=True,
    )

    batiment = models.CharField(max_length=80, blank=True, db_index=True)
    escalier = models.CharField(max_length=80, blank=True)
    etage = models.CharField(max_length=20, blank=True, db_index=True)
    porte = models.CharField(max_length=30, blank=True, db_index=True)

    nombre_pieces = models.PositiveSmallIntegerField(
        null=True,
        blank=True,
        validators=[MinValueValidator(0)],
        help_text=(
            "Nombre de pièces du logement. Champ optionnel, surtout utile pour "
            "les appartements."
        ),
    )

    description = models.TextField(blank=True)

    surface = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        validators=[MinValueValidator(Decimal("0.00"))],
        help_text="Surface en m².",
    )

    actif = models.BooleanField(default=True, db_index=True)

    class Meta:
        ordering = ("reference", "id")
        verbose_name = "Lot"
        verbose_name_plural = "Lots"
        constraints = [
            models.UniqueConstraint(
                fields=["copropriete", "reference"],
                name="uniq_lot_reference_par_copropriete",
            ),
        ]
        indexes = [
            models.Index(fields=["copropriete", "actif"]),
            models.Index(fields=["copropriete", "reference"]),
            models.Index(fields=["copropriete", "type_lot"]),
            models.Index(fields=["copropriete", "statut"]),
            models.Index(fields=["batiment", "etage"]),
            models.Index(fields=["nombre_pieces"]),
        ]

    def __str__(self) -> str:
        return self.reference

    def clean(self):
        if not self.copropriete_id:
            raise ValidationError({"copropriete": "La copropriété est obligatoire."})

        if not self.reference or not self.reference.strip():
            raise ValidationError({"reference": "La référence du lot est obligatoire."})

        self.reference = self.reference.strip().upper()

        if self.numero:
            self.numero = self.numero.strip().upper()

        if self.batiment:
            self.batiment = self.batiment.strip()

        if self.escalier:
            self.escalier = self.escalier.strip()

        if self.etage:
            self.etage = self.etage.strip()

        if self.porte:
            self.porte = self.porte.strip()

        if self.surface is not None and self.surface < 0:
            raise ValidationError(
                {"surface": "La surface doit être supérieure ou égale à 0."}
            )

        if self.nombre_pieces is not None and self.nombre_pieces < 0:
            raise ValidationError(
                {"nombre_pieces": "Le nombre de pièces ne peut pas être négatif."}
            )

        if self.statut == self.Statut.INACTIF:
            self.actif = False

        if not self.actif and self.statut != self.Statut.INACTIF:
            self.statut = self.Statut.INACTIF

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)

    @property
    def label(self) -> str:
        parts = [self.reference]

        if self.batiment:
            parts.append(f"Bât. {self.batiment}")

        if self.etage:
            parts.append(f"Étage {self.etage}")

        if self.porte:
            parts.append(f"Porte {self.porte}")

        return " · ".join(parts)

    @property
    def total_tantiemes_value(self) -> Decimal:
        return self.total_tantiemes()

    def total_tantiemes(self) -> Decimal:
        total = self.tantiemes.aggregate(total=Sum("valeur"))["total"]
        return Decimal(str(total or DECIMAL_0))

    def tantiemes_par_categorie(self) -> dict[str, Decimal]:
        rows = self.tantiemes.select_related("categorie").order_by("categorie__code")

        result: dict[str, Decimal] = {}

        for row in rows:
            code = row.categorie.code
            result[code] = Decimal(str(row.valeur or DECIMAL_0))

        return result

    @property
    def proprietaire_principal(self):
        """
        Retourne l'affectation propriétaire principale active du lot.

        Le modèle réel est dans apps.owners.ProprietaireLot.
        On passe par le related_name 'proprietaires'.
        """
        return (
            self.proprietaires.filter(
                principal=True,
                date_fin__isnull=True,
            )
            .select_related("coproprietaire")
            .first()
        )

    @property
    def proprietaire_principal_display(self) -> str:
        affectation = self.proprietaire_principal

        if not affectation:
            return ""

        return affectation.coproprietaire.display_name

    @property
    def occupant_principal(self):
        """
        Retourne l'occupant principal actif du lot.

        Le modèle réel est dans apps.owners.LotOccupant.
        On passe par le related_name 'occupants'.
        """
        try:
            return (
                self.occupants.filter(
                    actif=True,
                    occupant_principal=True,
                    date_sortie__isnull=True,
                )
                .order_by("-date_entree", "-id")
                .first()
            )
        except Exception:
            return None

    @property
    def occupant_principal_display(self) -> str:
        occupant = self.occupant_principal

        if not occupant:
            return ""

        return occupant.display_name


class TantiemeCategorie(TimeStampedModel):
    """
    Catégorie de tantième.

    Exemples :
    - GENERAL : charges générales ;
    - ASCENSEUR : charges ascenseur ;
    - PARKING : charges parking ;
    - BATIMENT_A : charges bâtiment A.
    """

    copropriete = models.ForeignKey(
        Copropriete,
        on_delete=models.CASCADE,
        related_name="tantieme_categories",
        db_index=True,
    )

    code = models.CharField(max_length=30, db_index=True)
    libelle = models.CharField(max_length=120)

    description = models.TextField(blank=True)

    actif = models.BooleanField(default=True, db_index=True)

    class Meta:
        ordering = ("code", "id")
        verbose_name = "Catégorie de tantième"
        verbose_name_plural = "Catégories de tantièmes"
        constraints = [
            models.UniqueConstraint(
                fields=["copropriete", "code"],
                name="uniq_tantieme_categorie_code_par_copropriete",
            ),
        ]
        indexes = [
            models.Index(fields=["copropriete", "actif"]),
            models.Index(fields=["copropriete", "code"]),
        ]

    def __str__(self) -> str:
        return f"{self.code} - {self.libelle}"

    def clean(self):
        if not self.copropriete_id:
            raise ValidationError({"copropriete": "La copropriété est obligatoire."})

        if self.code:
            self.code = self.code.strip().upper()

        if self.libelle:
            self.libelle = self.libelle.strip()

        if not self.code:
            raise ValidationError({"code": "Le code de la catégorie est obligatoire."})

        if not self.libelle:
            raise ValidationError(
                {"libelle": "Le libellé de la catégorie est obligatoire."}
            )

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)


class LotTantieme(TimeStampedModel):
    """
    Valeur de tantième d'un lot pour une catégorie donnée.

    Exemple :
    - Lot A-101
    - Catégorie GENERAL
    - Valeur 125.0000

    La somme globale d'une catégorie peut ensuite être utilisée pour :
    - appels de fonds ;
    - votes AG ;
    - quorum ;
    - répartition des charges.
    """

    lot = models.ForeignKey(
        Lot,
        on_delete=models.CASCADE,
        related_name="tantiemes",
        db_index=True,
    )

    categorie = models.ForeignKey(
        TantiemeCategorie,
        on_delete=models.PROTECT,
        related_name="lots_tantiemes",
        db_index=True,
    )

    valeur = models.DecimalField(
        max_digits=10,
        decimal_places=4,
        validators=[MinValueValidator(Decimal("0"))],
    )

    class Meta:
        ordering = ("lot_id", "categorie_id")
        verbose_name = "Tantième de lot"
        verbose_name_plural = "Tantièmes des lots"
        constraints = [
            models.UniqueConstraint(
                fields=["lot", "categorie"],
                name="uniq_tantieme_par_lot_et_categorie",
            ),
        ]
        indexes = [
            models.Index(fields=["lot", "categorie"]),
            models.Index(fields=["categorie", "valeur"]),
        ]

    def __str__(self) -> str:
        return f"{self.lot.reference} - {self.categorie.code} = {self.valeur}"

    def clean(self):
        if not self.lot_id:
            raise ValidationError({"lot": "Le lot est obligatoire."})

        if not self.categorie_id:
            raise ValidationError({"categorie": "La catégorie est obligatoire."})

        if self.lot_id and self.categorie_id:
            if self.lot.copropriete_id != self.categorie.copropriete_id:
                raise ValidationError(
                    {
                        "categorie": (
                            "La catégorie de tantième doit appartenir à la même "
                            "copropriété que le lot."
                        )
                    }
                )

        if self.valeur is None:
            raise ValidationError({"valeur": "La valeur du tantième est obligatoire."})

        self.valeur = Decimal(str(self.valeur or DECIMAL_0))

        if self.valeur < 0:
            raise ValidationError(
                {
                    "valeur": (
                        "La valeur du tantième doit être supérieure ou égale à 0."
                    )
                }
            )

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)

    @property
    def copropriete_id(self):
        if not self.lot_id:
            return None

        return self.lot.copropriete_id