from decimal import Decimal

from django.db import models
from django.core.validators import MinValueValidator

from apps.core.models import Copropriete


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

    def __str__(self):
        return f"{self.reference}"


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

    def __str__(self):
        return f"{self.code} - {self.libelle}"


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

    def __str__(self):
        return f"{self.lot.reference} - {self.categorie.code} = {self.valeur}"