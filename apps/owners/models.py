from django.db import models
from django.core.exceptions import ValidationError

from apps.core.models import Copropriete


class Coproprietaire(models.Model):
    copropriete = models.ForeignKey(
        Copropriete,
        on_delete=models.CASCADE,
        related_name="coproprietaires",
    )

    nom = models.CharField(max_length=120)
    prenom = models.CharField(max_length=120, blank=True)
    email = models.EmailField(blank=True)
    telephone = models.CharField(max_length=30, blank=True)
    adresse = models.TextField(blank=True)

    actif = models.BooleanField(default=True)
    date_creation = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("copropriete", "nom", "prenom")

    def __str__(self):
        return f"{self.prenom} {self.nom}".strip()


class ProprietaireLot(models.Model):
    """
    Historique de propriété d'un lot.
    Un lot peut avoir plusieurs propriétaires successifs.
    """

    copropriete = models.ForeignKey(
        Copropriete,
        on_delete=models.CASCADE,
        related_name="proprietes_lots",
    )

    # ✅ IMPORTANT : pas d'import direct de Lot (évite ImportError / circular import)
    lot = models.ForeignKey(
        "lots.Lot",
        on_delete=models.CASCADE,
        related_name="proprietaires",
    )

    coproprietaire = models.ForeignKey(
        Coproprietaire,
        on_delete=models.CASCADE,
        related_name="lots_possedes",
    )

    date_debut = models.DateField()
    date_fin = models.DateField(null=True, blank=True)

    principal = models.BooleanField(default=True)  # propriétaire principal

    class Meta:
        unique_together = ("lot", "coproprietaire", "date_debut")

    def clean(self):
        # ⚠️ Cohérence copropriété
        # On protège au cas où lot / coproprietaire n'est pas encore défini
        if self.lot_id and self.copropriete_id and getattr(self.lot, "copropriete_id", None) != self.copropriete_id:
            raise ValidationError("Le lot doit appartenir à la même copropriété.")
        if self.coproprietaire_id and self.copropriete_id and self.coproprietaire.copropriete_id != self.copropriete_id:
            raise ValidationError("Le copropriétaire doit appartenir à la même copropriété.")

        # Empêcher deux propriétaires principaux actifs en même temps pour un même lot
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
                raise ValidationError("Un propriétaire principal actif existe déjà pour ce lot.")

        # Cohérence des dates
        if self.date_fin and self.date_fin < self.date_debut:
            raise ValidationError("La date de fin ne peut pas être antérieure à la date de début.")

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)

    def __str__(self):
        # On évite de casser l'affichage si le lot n'a pas "reference" (au cas où)
        ref = getattr(self.lot, "reference", str(self.lot_id))
        return f"{self.coproprietaire} → {ref}"