# apps/compta/models.py
from __future__ import annotations

from decimal import Decimal

from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models, transaction
from django.db.models import Q
from django.utils import timezone


DEC_0 = Decimal("0.00")


class CompteBancaire(models.Model):
    copropriete = models.ForeignKey(
        "core.Copropriete",
        on_delete=models.CASCADE,
        related_name="comptes_bancaires",
    )
    nom = models.CharField(max_length=120)
    banque = models.CharField(max_length=120, blank=True)
    iban = models.CharField(max_length=60, blank=True)
    rib = models.CharField(max_length=60, blank=True)
    devise = models.CharField(max_length=10, default="XOF")
    solde_initial = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        default=DEC_0,
        validators=[MinValueValidator(DEC_0)],
    )
    is_active = models.BooleanField(default=True)

    # ✅ Phase 4 MVP+ : compte bancaire par défaut par copropriété
    is_default = models.BooleanField(default=False)

    created_at = models.DateTimeField(default=timezone.now, editable=False)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=["copropriete", "is_active"]),
            models.Index(fields=["copropriete", "nom"]),
            models.Index(fields=["copropriete", "is_default"]),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["copropriete", "nom"],
                name="uniq_compte_nom_par_copro",
            ),
            # ✅ Un seul default par copropriété
            models.UniqueConstraint(
                fields=["copropriete"],
                condition=Q(is_default=True),
                name="uniq_compte_default_par_copro",
            ),
        ]

    def save(self, *args, **kwargs):
        """
        Bonus robustesse:
        - si ce compte passe is_default=True, on retire is_default aux autres comptes
          de la même copropriété (atomique, évite conflit).
        """
        making_default = bool(self.is_default)
        super().save(*args, **kwargs)

        if making_default and self.copropriete_id:
            # met à false tous les autres comptes de la même copro
            CompteBancaire.objects.filter(
                copropriete_id=self.copropriete_id,
                is_default=True,
            ).exclude(pk=self.pk).update(is_default=False)

    def __str__(self) -> str:
        return f"Compte#{self.id} {self.nom} (copro={self.copropriete_id})"


class MouvementBancaire(models.Model):
    class Sens(models.TextChoices):
        CREDIT = "CREDIT", "Crédit"
        DEBIT = "DEBIT", "Débit"

    copropriete = models.ForeignKey(
        "core.Copropriete",
        on_delete=models.CASCADE,
        related_name="mouvements_bancaires",
    )
    compte = models.ForeignKey(
        CompteBancaire,
        on_delete=models.PROTECT,
        related_name="mouvements",
    )

    sens = models.CharField(max_length=10, choices=Sens.choices)
    montant = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.01"))],
    )
    date_operation = models.DateField()
    reference = models.CharField(max_length=120, blank=True)
    libelle = models.CharField(max_length=200)
    note = models.TextField(blank=True)

    # Rapprochement MVP (un seul paiement max)
    paiement_travaux = models.ForeignKey(
        "travaux.PaiementTravaux",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="mouvements_bancaires",
    )
    paiement_appel = models.ForeignKey(
        "billing_app.PaiementAppel",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="mouvements_bancaires",
    )

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="mouvements_bancaires_crees",
    )
    created_at = models.DateTimeField(default=timezone.now, editable=False)

    class Meta:
        indexes = [
            models.Index(fields=["copropriete", "compte", "date_operation"]),
            models.Index(fields=["copropriete", "sens", "date_operation"]),
            models.Index(fields=["copropriete", "paiement_travaux"]),
            models.Index(fields=["copropriete", "paiement_appel"]),
        ]
        constraints = [
            # Interdit d’avoir les 2 en même temps
            models.CheckConstraint(
                condition=~(Q(paiement_travaux__isnull=False) & Q(paiement_appel__isnull=False)),
                name="chk_mvt_rapprochement_exclusif",
            ),
        ]

    @property
    def is_rapproche(self) -> bool:
        return bool(self.paiement_travaux_id or self.paiement_appel_id)

    def __str__(self) -> str:
        return f"Mvt#{self.id} {self.sens} {self.montant} ({self.date_operation})"