from __future__ import annotations

from decimal import Decimal

from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models


DECIMAL_ZERO = Decimal("0.00")


class TimeStampedModel(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class DossierImpaye(TimeStampedModel):
    class Statut(models.TextChoices):
        A_PAYER = "A_PAYER", "À payer"
        EN_RETARD = "EN_RETARD", "En retard"
        PARTIELLEMENT_PAYE = "PARTIELLEMENT_PAYE", "Partiellement payé"
        PAYE = "PAYE", "Payé"
        REGULARISE = "REGULARISE", "Régularisé"
        FERME = "FERME", "Fermé"

    copropriete = models.ForeignKey(
        "core.Copropriete",
        on_delete=models.CASCADE,
        related_name="dossiers_impayes",
    )
    lot = models.ForeignKey(
        "lots.Lot",
        on_delete=models.PROTECT,
        related_name="dossiers_impayes",
    )
    coproprietaire = models.ForeignKey(
        "owners.Coproprietaire",
        on_delete=models.PROTECT,
        related_name="dossiers_impayes",
        null=True,
        blank=True,
    )
    appel = models.ForeignKey(
        "billing_app.AppelDeFonds",
        on_delete=models.PROTECT,
        related_name="dossiers_impayes",
    )

    reference_appel = models.CharField(max_length=120, blank=True)
    date_echeance = models.DateField()

    montant_initial = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=DECIMAL_ZERO,
        validators=[MinValueValidator(DECIMAL_ZERO)],
    )
    montant_paye = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=DECIMAL_ZERO,
        validators=[MinValueValidator(DECIMAL_ZERO)],
    )
    reste_a_payer = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=DECIMAL_ZERO,
        validators=[MinValueValidator(DECIMAL_ZERO)],
    )

    statut = models.CharField(
        max_length=30,
        choices=Statut.choices,
        default=Statut.A_PAYER,
        db_index=True,
    )

    niveau_relance = models.PositiveSmallIntegerField(default=0)
    relances_count = models.PositiveIntegerField(default=0)
    derniere_relance_at = models.DateTimeField(null=True, blank=True)
    date_dernier_paiement = models.DateField(null=True, blank=True)

    est_regularise = models.BooleanField(default=False, db_index=True)
    regularise_at = models.DateTimeField(null=True, blank=True)

    auto_relance_active = models.BooleanField(default=True)
    commentaire_interne = models.TextField(blank=True)

    class Meta:
        ordering = ["-updated_at", "-created_at"]
        indexes = [
            models.Index(fields=["copropriete", "statut"]),
            models.Index(fields=["copropriete", "est_regularise"]),
            models.Index(fields=["copropriete", "date_echeance"]),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["appel", "lot"],
                name="uniq_dossier_impaye_par_appel_et_lot",
            )
        ]

    def __str__(self) -> str:
        return f"Dossier impayé lot={self.lot_id} appel={self.appel_id}"


class Relance(TimeStampedModel):
    class Canal(models.TextChoices):
        EMAIL = "EMAIL", "Email"
        WHATSAPP = "WHATSAPP", "WhatsApp"
        PDF = "PDF", "PDF"
        SMS = "SMS", "SMS"

    class Statut(models.TextChoices):
        ENVOYEE = "ENVOYEE", "Envoyée"
        ECHEC = "ECHEC", "Échec"
        ANNULEE = "ANNULEE", "Annulée"

    copropriete = models.ForeignKey(
        "core.Copropriete",
        on_delete=models.CASCADE,
        related_name="relances",
    )
    dossier = models.ForeignKey(
        "relances.DossierImpaye",
        on_delete=models.CASCADE,
        related_name="relances",
    )
    appel = models.ForeignKey(
        "billing_app.AppelDeFonds",
        on_delete=models.PROTECT,
        related_name="relances_recouvrement",
    )
    lot = models.ForeignKey(
        "lots.Lot",
        on_delete=models.PROTECT,
        related_name="relances",
    )
    coproprietaire = models.ForeignKey(
        "owners.Coproprietaire",
        on_delete=models.PROTECT,
        related_name="relances",
        null=True,
        blank=True,
    )

    niveau = models.PositiveSmallIntegerField(default=1)
    canal = models.CharField(
        max_length=20,
        choices=Canal.choices,
        db_index=True,
    )
    statut = models.CharField(
        max_length=20,
        choices=Statut.choices,
        default=Statut.ENVOYEE,
        db_index=True,
    )

    objet = models.CharField(max_length=255, blank=True)
    message = models.TextField()

    montant_du_message = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=DECIMAL_ZERO,
        validators=[MinValueValidator(DECIMAL_ZERO)],
    )
    reste_a_payer_au_moment_envoi = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=DECIMAL_ZERO,
        validators=[MinValueValidator(DECIMAL_ZERO)],
    )

    document_pdf = models.FileField(
        upload_to="relances/pdfs/",
        null=True,
        blank=True,
    )

    date_envoi = models.DateTimeField(auto_now_add=True)
    date_echec = models.DateTimeField(null=True, blank=True)
    motif_echec = models.TextField(blank=True)

    envoye_par = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="relances_envoyees",
    )

    annulee_at = models.DateTimeField(null=True, blank=True)
    annulee_par = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="relances_annulees",
    )
    motif_annulation = models.TextField(blank=True)

    class Meta:
        ordering = ["-date_envoi", "-id"]
        indexes = [
            models.Index(fields=["copropriete", "statut"]),
            models.Index(fields=["copropriete", "canal"]),
            models.Index(fields=["dossier", "niveau"]),
        ]

    def __str__(self) -> str:
        return f"Relance #{self.pk} dossier={self.dossier_id}"


class AvisRegularisation(TimeStampedModel):
    class Canal(models.TextChoices):
        EMAIL = "EMAIL", "Email"
        WHATSAPP = "WHATSAPP", "WhatsApp"
        PDF = "PDF", "PDF"
        INTERNE = "INTERNE", "Interne"

    class Statut(models.TextChoices):
        GENERE = "GENERE", "Généré"
        ENVOYE = "ENVOYE", "Envoyé"
        ECHEC = "ECHEC", "Échec"

    copropriete = models.ForeignKey(
        "core.Copropriete",
        on_delete=models.CASCADE,
        related_name="avis_regularisations",
    )
    dossier = models.OneToOneField(
        "relances.DossierImpaye",
        on_delete=models.CASCADE,
        related_name="avis_regularisation",
    )
    appel = models.ForeignKey(
        "billing_app.AppelDeFonds",
        on_delete=models.PROTECT,
        related_name="avis_regularisations",
    )
    lot = models.ForeignKey(
        "lots.Lot",
        on_delete=models.PROTECT,
        related_name="avis_regularisations",
    )
    coproprietaire = models.ForeignKey(
        "owners.Coproprietaire",
        on_delete=models.PROTECT,
        related_name="avis_regularisations",
        null=True,
        blank=True,
    )

    montant_initial = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(DECIMAL_ZERO)],
    )
    montant_total_regle = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(DECIMAL_ZERO)],
    )
    date_regularisation = models.DateTimeField()

    canal = models.CharField(
        max_length=20,
        choices=Canal.choices,
        default=Canal.INTERNE,
    )
    statut = models.CharField(
        max_length=20,
        choices=Statut.choices,
        default=Statut.GENERE,
        db_index=True,
    )

    message = models.TextField(blank=True)
    document_pdf = models.FileField(
        upload_to="relances/avis_regularisation/",
        null=True,
        blank=True,
    )

    genere_par = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="avis_regularisations_generes",
    )

    envoye_at = models.DateTimeField(null=True, blank=True)
    motif_echec = models.TextField(blank=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["copropriete", "statut"]),
            models.Index(fields=["copropriete", "date_regularisation"]),
        ]

    def __str__(self) -> str:
        return f"Avis régularisation #{self.pk} dossier={self.dossier_id}"