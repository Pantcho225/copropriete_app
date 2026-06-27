from __future__ import annotations

from django.conf import settings
from django.db import models
from django.utils import timezone


def reunion_document_upload_to(instance, filename: str) -> str:
    reunion = getattr(instance, "reunion", None)
    copro_id = getattr(reunion, "copropriete_id", None) or "global"
    reunion_id = getattr(reunion, "id", None) or "new"
    return f"reunions/{copro_id}/{reunion_id}/{filename}"


class ReunionRencontre(models.Model):
    class Type(models.TextChoices):
        REUNION_INTERNE = "REUNION_INTERNE", "Réunion interne de pilotage"
        INFORMATION_CONCERTATION = (
            "INFORMATION_CONCERTATION",
            "Réunion d’information et de concertation",
        )
        RENCONTRE_FOURNISSEUR = (
            "RENCONTRE_FOURNISSEUR",
            "Rencontre fournisseur / intervenant",
        )
        RENCONTRE_AUTORITE = (
            "RENCONTRE_AUTORITE",
            "Rencontre autorité / administration",
        )
        AUTRE = "AUTRE", "Autre"

    class Statut(models.TextChoices):
        BROUILLON = "BROUILLON", "Brouillon"
        PROGRAMMEE = "PROGRAMMEE", "Programmée"
        TENUE = "TENUE", "Tenue"
        PUBLIEE = "PUBLIEE", "Publiée"
        ARCHIVEE = "ARCHIVEE", "Archivée"
        ANNULEE = "ANNULEE", "Annulée"

    copropriete = models.ForeignKey(
        "core.Copropriete",
        on_delete=models.CASCADE,
        related_name="reunions_rencontres",
    )

    type = models.CharField(
        max_length=40,
        choices=Type.choices,
        default=Type.REUNION_INTERNE,
        db_index=True,
    )
    statut = models.CharField(
        max_length=30,
        choices=Statut.choices,
        default=Statut.BROUILLON,
        db_index=True,
    )

    titre = models.CharField(max_length=220)
    reference = models.CharField(max_length=120, blank=True, default="")
    objet = models.TextField(blank=True, default="")
    description = models.TextField(blank=True, default="")

    date_debut = models.DateTimeField()
    date_fin = models.DateTimeField(null=True, blank=True)
    lieu = models.CharField(max_length=220, blank=True, default="")

    compte_rendu = models.TextField(blank=True, default="")
    decisions = models.TextField(blank=True, default="")

    visible_coproprietaire = models.BooleanField(default=False, db_index=True)
    date_publication = models.DateTimeField(null=True, blank=True)

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reunions_rencontres_created",
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reunions_rencontres_updated",
    )

    metadata = models.JSONField(default=dict, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Réunion ou rencontre"
        verbose_name_plural = "Réunions et rencontres"
        ordering = ["-date_debut", "-id"]
        indexes = [
            models.Index(fields=["copropriete", "type"]),
            models.Index(fields=["copropriete", "statut"]),
            models.Index(fields=["copropriete", "visible_coproprietaire"]),
            models.Index(fields=["date_debut"]),
            models.Index(fields=["date_publication"]),
            models.Index(fields=["created_at"]),
        ]

    def save(self, *args, **kwargs):
        if self.visible_coproprietaire and self.date_publication is None:
            self.date_publication = timezone.now()

        if not self.visible_coproprietaire:
            self.date_publication = None

        super().save(*args, **kwargs)

    @property
    def is_published_for_owner(self) -> bool:
        return bool(
            self.visible_coproprietaire
            and self.statut == self.Statut.PUBLIEE
        )

    def __str__(self) -> str:
        return self.titre


class ReunionParticipant(models.Model):
    class Type(models.TextChoices):
        INTERNE = "INTERNE", "Interne"
        COPROPRIETAIRE = "COPROPRIETAIRE", "Copropriétaire"
        OCCUPANT = "OCCUPANT", "Occupant / résident"
        PRESTATAIRE = "PRESTATAIRE", "Prestataire"
        AUTORITE = "AUTORITE", "Autorité / administration"
        AUTRE = "AUTRE", "Autre"

    reunion = models.ForeignKey(
        ReunionRencontre,
        on_delete=models.CASCADE,
        related_name="participants",
    )

    type = models.CharField(
        max_length=30,
        choices=Type.choices,
        default=Type.AUTRE,
        db_index=True,
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reunion_participations",
    )
    coproprietaire = models.ForeignKey(
        "owners.Coproprietaire",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reunion_participations",
    )

    nom_complet = models.CharField(max_length=180)
    organisation = models.CharField(max_length=180, blank=True, default="")
    fonction = models.CharField(max_length=160, blank=True, default="")
    email = models.EmailField(blank=True, default="")
    telephone = models.CharField(max_length=60, blank=True, default="")
    present = models.BooleanField(default=False)

    ordre = models.PositiveIntegerField(default=100)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Participant réunion / rencontre"
        verbose_name_plural = "Participants réunions / rencontres"
        ordering = ["ordre", "nom_complet", "id"]
        indexes = [
            models.Index(fields=["reunion", "type"]),
            models.Index(fields=["reunion", "present"]),
            models.Index(fields=["created_at"]),
        ]

    def __str__(self) -> str:
        return self.nom_complet


class ReunionDocument(models.Model):
    class Type(models.TextChoices):
        ORDRE_DU_JOUR = "ORDRE_DU_JOUR", "Ordre du jour"
        COMPTE_RENDU = "COMPTE_RENDU", "Compte rendu"
        PV_SIMPLE = "PV_SIMPLE", "PV simple"
        COURRIER = "COURRIER", "Courrier"
        NOTE = "NOTE", "Note"
        PIECE_JOINTE = "PIECE_JOINTE", "Pièce jointe"
        AUTRE = "AUTRE", "Autre"

    reunion = models.ForeignKey(
        ReunionRencontre,
        on_delete=models.CASCADE,
        related_name="documents",
    )

    type = models.CharField(
        max_length=30,
        choices=Type.choices,
        default=Type.PIECE_JOINTE,
        db_index=True,
    )
    titre = models.CharField(max_length=220)
    description = models.TextField(blank=True, default="")

    fichier = models.FileField(
        upload_to=reunion_document_upload_to,
        null=True,
        blank=True,
    )
    document_administratif = models.ForeignKey(
        "documents.AdministrativeDocument",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reunion_documents",
    )

    nom_fichier_original = models.CharField(max_length=255, blank=True, default="")
    mime_type = models.CharField(max_length=120, blank=True, default="")
    taille_octets = models.PositiveBigIntegerField(default=0)

    visible_coproprietaire = models.BooleanField(default=False, db_index=True)
    ordre = models.PositiveIntegerField(default=100)

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reunion_documents_created",
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Document de réunion / rencontre"
        verbose_name_plural = "Documents de réunions / rencontres"
        ordering = ["ordre", "-created_at", "-id"]
        indexes = [
            models.Index(fields=["reunion", "type"]),
            models.Index(fields=["reunion", "visible_coproprietaire"]),
            models.Index(fields=["created_at"]),
        ]

    @property
    def filename(self) -> str:
        if self.nom_fichier_original:
            return self.nom_fichier_original

        if self.fichier:
            try:
                return self.fichier.name.split("/")[-1]
            except Exception:
                return ""

        if self.document_administratif:
            return self.document_administratif.filename

        return ""

    @property
    def effective_file(self):
        if self.fichier:
            return self.fichier

        if self.document_administratif and self.document_administratif.file:
            return self.document_administratif.file

        return None

    @property
    def effective_mime_type(self) -> str:
        if self.mime_type:
            return self.mime_type

        if self.document_administratif:
            return self.document_administratif.mime_type

        return ""

    def __str__(self) -> str:
        return self.titre


class ReunionAction(models.Model):
    class Statut(models.TextChoices):
        A_FAIRE = "A_FAIRE", "À faire"
        EN_COURS = "EN_COURS", "En cours"
        TERMINEE = "TERMINEE", "Terminée"
        ANNULEE = "ANNULEE", "Annulée"

    class Priorite(models.TextChoices):
        BASSE = "BASSE", "Basse"
        NORMALE = "NORMALE", "Normale"
        HAUTE = "HAUTE", "Haute"

    reunion = models.ForeignKey(
        ReunionRencontre,
        on_delete=models.CASCADE,
        related_name="actions",
    )

    titre = models.CharField(max_length=220)
    description = models.TextField(blank=True, default="")
    statut = models.CharField(
        max_length=20,
        choices=Statut.choices,
        default=Statut.A_FAIRE,
        db_index=True,
    )
    priorite = models.CharField(
        max_length=20,
        choices=Priorite.choices,
        default=Priorite.NORMALE,
        db_index=True,
    )

    responsable_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reunion_actions_assignees",
    )
    responsable_nom = models.CharField(max_length=180, blank=True, default="")

    echeance = models.DateField(null=True, blank=True)
    date_cloture = models.DateTimeField(null=True, blank=True)

    ordre = models.PositiveIntegerField(default=100)

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reunion_actions_created",
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reunion_actions_updated",
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Action de réunion / rencontre"
        verbose_name_plural = "Actions de réunions / rencontres"
        ordering = ["ordre", "echeance", "id"]
        indexes = [
            models.Index(fields=["reunion", "statut"]),
            models.Index(fields=["reunion", "priorite"]),
            models.Index(fields=["echeance"]),
            models.Index(fields=["created_at"]),
        ]

    def save(self, *args, **kwargs):
        if self.statut == self.Statut.TERMINEE and self.date_cloture is None:
            self.date_cloture = timezone.now()

        if self.statut != self.Statut.TERMINEE:
            self.date_cloture = None

        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return self.titre
