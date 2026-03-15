from __future__ import annotations

from decimal import Decimal

from django.core.exceptions import ValidationError
from django.core.validators import MinValueValidator
from django.db import models
from django.db.models import Sum

from apps.core.models import Copropriete


DECIMAL_0 = Decimal("0.0000")


class Lot(models.Model):
    TYPE_CHOICES = [
        ("APPARTEMENT", "Appartement"),
        ("PARKING", "Parking"),
        ("CAVE", "Cave"),
        ("COMMERCE", "Commerce"),
        ("AUTRE", "Autre"),
    ]

    copropriete = models.ForeignKey(
        Copropriete,
        on_delete=models.CASCADE,
        related_name="lots",
    )
    reference = models.CharField(max_length=50)
    type_lot = models.CharField(max_length=20, choices=TYPE_CHOICES)
    description = models.TextField(blank=True)
    surface = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    etage = models.CharField(max_length=20, blank=True)

    actif = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("copropriete", "reference")
        ordering = ["reference"]
        verbose_name = "Lot"
        verbose_name_plural = "Lots"

    def __str__(self):
        return f"{self.reference}"

    def total_tantiemes(self) -> Decimal:
        total = self.tantiemes.aggregate(total=Sum("valeur"))["total"]
        return Decimal(str(total or DECIMAL_0))

    def tantiemes_par_categorie(self) -> dict[str, Decimal]:
        rows = (
            self.tantiemes.select_related("categorie")
            .order_by("categorie__code")
        )
        result: dict[str, Decimal] = {}
        for row in rows:
            code = row.categorie.code
            result[code] = Decimal(str(row.valeur or DECIMAL_0))
        return result

    @property
    def total_tantiemes_value(self) -> Decimal:
        return self.total_tantiemes()


class TantiemeCategorie(models.Model):
    copropriete = models.ForeignKey(
        Copropriete,
        on_delete=models.CASCADE,
        related_name="tantieme_categories",
    )
    code = models.CharField(max_length=20)
    libelle = models.CharField(max_length=120)
    actif = models.BooleanField(default=True)

    class Meta:
        unique_together = ("copropriete", "code")
        ordering = ["code"]
        verbose_name = "Catégorie de tantième"
        verbose_name_plural = "Catégories de tantièmes"

    def __str__(self):
        return f"{self.code} - {self.libelle}"

    def clean(self):
        super().clean()

        if self.code:
            self.code = self.code.strip().upper()

        if self.libelle:
            self.libelle = self.libelle.strip()

        if not self.code:
            raise ValidationError({"code": "Le code de la catégorie est obligatoire."})

        if not self.libelle:
            raise ValidationError({"libelle": "Le libellé de la catégorie est obligatoire."})

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)


class LotTantieme(models.Model):
    lot = models.ForeignKey(
        Lot,
        on_delete=models.CASCADE,
        related_name="tantiemes",
    )
    categorie = models.ForeignKey(
        TantiemeCategorie,
        on_delete=models.PROTECT,
        related_name="lots_tantiemes",
    )
    valeur = models.DecimalField(
        max_digits=10,
        decimal_places=4,
        validators=[MinValueValidator(Decimal("0"))],
    )

    class Meta:
        unique_together = ("lot", "categorie")
        ordering = ["lot_id", "categorie_id"]
        verbose_name = "Tantième de lot"
        verbose_name_plural = "Tantièmes des lots"

    def __str__(self):
        return f"{self.lot.reference} - {self.categorie.code} = {self.valeur}"

    def clean(self):
        super().clean()

        if self.lot_id and self.categorie_id:
            if self.lot.copropriete_id != self.categorie.copropriete_id:
                raise ValidationError(
                    {
                        "categorie": (
                            "La catégorie de tantième doit appartenir à la même copropriété que le lot."
                        )
                    }
                )

        if self.valeur is None:
            raise ValidationError({"valeur": "La valeur du tantième est obligatoire."})

        self.valeur = Decimal(str(self.valeur or DECIMAL_0))

        if self.valeur < 0:
            raise ValidationError({"valeur": "La valeur du tantième doit être supérieure ou égale à 0."})

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)