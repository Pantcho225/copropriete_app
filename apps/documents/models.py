# apps/documents/models.py
from __future__ import annotations

from django.conf import settings
from django.db import models


def generated_document_upload_to(instance, filename: str) -> str:
    copro_id = instance.copropriete_id or "global"
    doc_type = (instance.document_type or "document").lower()
    return f"documents/generated/{copro_id}/{doc_type}/{filename}"


class GeneratedDocument(models.Model):
    """
    Document métier généré par l'application :
    - courrier de relance impayé ;
    - mandat AG ;
    - convocation AG ;
    - PV ;
    - reçu de paiement ;
    - autres documents futurs.

    Ce modèle devient le registre documentaire transverse du SaaS.
    """

    class Type(models.TextChoices):
        RELANCE_IMPAYE = "RELANCE_IMPAYE", "Relance impayé"
        MISE_EN_DEMEURE = "MISE_EN_DEMEURE", "Mise en demeure"
        MANDAT_AG = "MANDAT_AG", "Mandat AG"
        CONVOCATION_AG = "CONVOCATION_AG", "Convocation AG"
        PV_AG = "PV_AG", "Procès-verbal AG"
        RECU_PAIEMENT = "RECU_PAIEMENT", "Reçu de paiement"
        AUTRE = "AUTRE", "Autre document"

    class Statut(models.TextChoices):
        GENERE = "GENERE", "Généré"
        ENVOYE = "ENVOYE", "Envoyé"
        CONSULTE = "CONSULTE", "Consulté"
        ANNULE = "ANNULE", "Annulé"
        ARCHIVE = "ARCHIVE", "Archivé"

    copropriete = models.ForeignKey(
        "core.Copropriete",
        on_delete=models.CASCADE,
        related_name="generated_documents",
    )

    document_type = models.CharField(
        max_length=40,
        choices=Type.choices,
        db_index=True,
    )
    title = models.CharField(max_length=255)
    reference = models.CharField(max_length=80, unique=True, db_index=True)

    file = models.FileField(
        upload_to=generated_document_upload_to,
        null=True,
        blank=True,
    )
    file_hash = models.CharField(max_length=64, blank=True, default="")

    related_owner = models.ForeignKey(
        "owners.Coproprietaire",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="generated_documents",
    )
    related_lot = models.ForeignKey(
        "lots.Lot",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="generated_documents",
    )
    related_ag = models.ForeignKey(
        "ag.AssembleeGenerale",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="generated_documents",
    )
    related_dossier_impaye = models.ForeignKey(
        "relances.DossierImpaye",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="generated_documents",
    )
    related_relance = models.ForeignKey(
        "relances.Relance",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="generated_documents",
    )

    is_visible_to_owner = models.BooleanField(default=False, db_index=True)
    status = models.CharField(
        max_length=30,
        choices=Statut.choices,
        default=Statut.GENERE,
        db_index=True,
    )

    metadata = models.JSONField(default=dict, blank=True)

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="generated_documents_created",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at", "-id"]
        indexes = [
            models.Index(fields=["copropriete", "document_type"]),
            models.Index(fields=["copropriete", "status"]),
            models.Index(fields=["related_owner", "is_visible_to_owner"]),
            models.Index(fields=["related_lot", "is_visible_to_owner"]),
            models.Index(fields=["related_ag"]),
            models.Index(fields=["related_dossier_impaye"]),
            models.Index(fields=["created_at"]),
        ]

    def __str__(self) -> str:
        return f"{self.reference} - {self.title}"

    @property
    def filename(self) -> str:
        if not self.file:
            return ""
        try:
            return self.file.name.split("/")[-1]
        except Exception:
            return ""


class DocumentMasqueCoproprietaire(models.Model):
    """
    Masquage personnel d'un document dans l'espace copropriétaire.

    Important :
    - le document source n'est jamais supprimé physiquement ;
    - on mémorise seulement que ce user ne veut plus voir ce document
      dans son espace personnel.
    """

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="documents_masques_coproprietaire",
    )
    document_id = models.CharField(max_length=255)
    categorie = models.CharField(max_length=50, blank=True)
    source = models.CharField(max_length=120, blank=True)
    titre = models.CharField(max_length=255, blank=True)
    hidden_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Document masqué copropriétaire"
        verbose_name_plural = "Documents masqués copropriétaires"
        constraints = [
            models.UniqueConstraint(
                fields=["user", "document_id"],
                name="unique_document_masque_par_user",
            )
        ]
        indexes = [
            models.Index(fields=["user", "document_id"]),
            models.Index(fields=["user", "categorie"]),
            models.Index(fields=["hidden_at"]),
        ]

    def __str__(self) -> str:
        return f"{self.user_id} - {self.document_id}"