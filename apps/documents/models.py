# apps/documents/models.py
from __future__ import annotations

from django.conf import settings
from django.db import models
from django.utils import timezone


def generated_document_upload_to(instance, filename: str) -> str:
    copro_id = instance.copropriete_id or "global"
    doc_type = (instance.document_type or "document").lower()
    return f"documents/generated/{copro_id}/{doc_type}/{filename}"


def reglement_texte_upload_to(instance, filename: str) -> str:
    copro_id = instance.copropriete_id or "global"
    categorie = (instance.categorie or "texte").lower()
    return f"documents/reglement-textes/{copro_id}/{categorie}/{filename}"


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


class ReglementTexteApplicable(models.Model):
    """
    Texte, règlement ou document de référence publié par l'admin/syndic.

    Objectif métier :
    - permettre au syndic/admin d'ajouter des règles, textes ou documents utiles ;
    - contrôler leur statut : brouillon, publié, archivé ;
    - choisir s'ils sont visibles ou non dans l'espace copropriétaire ;
    - afficher côté copropriétaire uniquement les contenus publiés et visibles.
    """

    class Categorie(models.TextChoices):
        REGLEMENT_COPROPRIETE = (
            "REGLEMENT_COPROPRIETE",
            "Règlement de copropriété",
        )
        REGLEMENT_INTERIEUR = "REGLEMENT_INTERIEUR", "Règlement intérieur"
        TEXTE_LOI = "TEXTE_LOI", "Texte de loi"
        NOTE_SYNDIC = "NOTE_SYNDIC", "Note du syndic"
        VIE_COMMUNE = "VIE_COMMUNE", "Vie commune"
        CHARGES_COTISATIONS = "CHARGES_COTISATIONS", "Charges et cotisations"
        ASSEMBLEES_GENERALES = "ASSEMBLEES_GENERALES", "Assemblées générales"
        TRAVAUX_ENTRETIEN = "TRAVAUX_ENTRETIEN", "Travaux et entretien"
        DOCUMENT_ADMINISTRATIF = (
            "DOCUMENT_ADMINISTRATIF",
            "Document administratif",
        )
        AUTRE = "AUTRE", "Autre"

    class Statut(models.TextChoices):
        BROUILLON = "BROUILLON", "Brouillon"
        PUBLIE = "PUBLIE", "Publié"
        ARCHIVE = "ARCHIVE", "Archivé"

    copropriete = models.ForeignKey(
        "core.Copropriete",
        on_delete=models.CASCADE,
        related_name="reglement_textes_applicables",
    )

    titre = models.CharField(max_length=255)
    categorie = models.CharField(
        max_length=50,
        choices=Categorie.choices,
        default=Categorie.AUTRE,
        db_index=True,
    )

    resume = models.TextField(
        blank=True,
        default="",
        help_text="Résumé court affichable dans les listes.",
    )
    contenu = models.TextField(
        blank=True,
        default="",
        help_text="Contenu textuel du règlement, texte ou document.",
    )

    fichier = models.FileField(
        upload_to=reglement_texte_upload_to,
        null=True,
        blank=True,
        help_text="PDF ou document attaché optionnel.",
    )

    statut = models.CharField(
        max_length=30,
        choices=Statut.choices,
        default=Statut.BROUILLON,
        db_index=True,
    )
    visible_coproprietaire = models.BooleanField(
        default=False,
        db_index=True,
        help_text="Si coché, le texte publié est visible côté copropriétaire.",
    )

    ordre_affichage = models.PositiveIntegerField(
        default=100,
        help_text="Permet de prioriser l'ordre d'affichage.",
    )

    publie_par = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reglement_textes_publies",
    )
    date_publication = models.DateTimeField(null=True, blank=True)

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reglement_textes_created",
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reglement_textes_updated",
    )

    metadata = models.JSONField(default=dict, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Règlement ou texte applicable"
        verbose_name_plural = "Règlements et textes applicables"
        ordering = ["ordre_affichage", "categorie", "-date_publication", "-created_at"]
        indexes = [
            models.Index(fields=["copropriete", "categorie"]),
            models.Index(fields=["copropriete", "statut"]),
            models.Index(fields=["copropriete", "visible_coproprietaire"]),
            models.Index(fields=["statut", "visible_coproprietaire"]),
            models.Index(fields=["ordre_affichage"]),
            models.Index(fields=["date_publication"]),
            models.Index(fields=["created_at"]),
        ]

    def __str__(self) -> str:
        return f"{self.titre} - {self.get_categorie_display()}"

    @property
    def is_published_for_owner(self) -> bool:
        return (
            self.statut == self.Statut.PUBLIE
            and self.visible_coproprietaire is True
        )

    @property
    def filename(self) -> str:
        if not self.fichier:
            return ""
        try:
            return self.fichier.name.split("/")[-1]
        except Exception:
            return ""

    def publier(self, user=None, visible_coproprietaire: bool | None = None) -> None:
        """
        Publie le texte et renseigne la date de publication.

        Si visible_coproprietaire est fourni, on met aussi à jour la visibilité.
        """
        self.statut = self.Statut.PUBLIE
        self.date_publication = timezone.now()
        if user is not None:
            self.publie_par = user
            self.updated_by = user
        if visible_coproprietaire is not None:
            self.visible_coproprietaire = visible_coproprietaire
        self.save(
            update_fields=[
                "statut",
                "date_publication",
                "publie_par",
                "updated_by",
                "visible_coproprietaire",
                "updated_at",
            ]
        )

    def archiver(self, user=None) -> None:
        self.statut = self.Statut.ARCHIVE
        if user is not None:
            self.updated_by = user
        self.save(update_fields=["statut", "updated_by", "updated_at"])


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

def administrative_document_upload_to(instance, filename: str) -> str:
    copro_id = instance.copropriete_id or "global"
    category = getattr(instance, "category", None)
    category_code = getattr(category, "code", "") or "administratif"
    return f"documents/administratifs/{copro_id}/{category_code}/{filename}"


class AdministrativeDocumentCategory(models.Model):
    """
    Catégorie libre de documents administratifs uploadés par l'admin/syndic.

    Exemples :
    - Contrats ;
    - Assurances ;
    - Courriers ;
    - Plans ;
    - Factures fournisseurs ;
    - Documents juridiques ;
    - Divers.
    """

    copropriete = models.ForeignKey(
        "core.Copropriete",
        on_delete=models.CASCADE,
        related_name="administrative_document_categories",
    )
    name = models.CharField(max_length=160)
    code = models.SlugField(max_length=100, blank=True)
    description = models.TextField(blank=True, default="")
    is_active = models.BooleanField(default=True, db_index=True)
    order = models.PositiveIntegerField(default=100)

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="administrative_document_categories_created",
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="administrative_document_categories_updated",
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Catégorie de document administratif"
        verbose_name_plural = "Catégories de documents administratifs"
        ordering = ["order", "name", "id"]
        constraints = [
            models.UniqueConstraint(
                fields=["copropriete", "code"],
                name="uniq_admin_doc_category_code_per_copropriete",
            )
        ]
        indexes = [
            models.Index(fields=["copropriete", "is_active"]),
            models.Index(fields=["order"]),
            models.Index(fields=["created_at"]),
        ]

    def save(self, *args, **kwargs):
        if not self.code:
            from django.utils.text import slugify

            self.code = slugify(self.name)[:100] or "categorie"
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return self.name


class AdministrativeDocument(models.Model):
    """
    Document administratif uploadé manuellement par l'admin/syndic.

    Ce modèle est distinct de GeneratedDocument :
    - GeneratedDocument = PDF produit automatiquement par le système ;
    - AdministrativeDocument = fichier déposé par le syndic/admin.
    """

    copropriete = models.ForeignKey(
        "core.Copropriete",
        on_delete=models.CASCADE,
        related_name="administrative_documents",
    )
    category = models.ForeignKey(
        AdministrativeDocumentCategory,
        on_delete=models.PROTECT,
        related_name="documents",
    )

    title = models.CharField(max_length=220)
    reference = models.CharField(max_length=120, blank=True, default="")
    description = models.TextField(blank=True, default="")

    file = models.FileField(upload_to=administrative_document_upload_to)
    original_filename = models.CharField(max_length=255, blank=True, default="")
    mime_type = models.CharField(max_length=120, blank=True, default="")
    size_bytes = models.PositiveBigIntegerField(default=0)

    visible_to_coproprietaires = models.BooleanField(default=False, db_index=True)
    published_at = models.DateTimeField(null=True, blank=True)

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="administrative_documents_created",
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="administrative_documents_updated",
    )

    metadata = models.JSONField(default=dict, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Document administratif"
        verbose_name_plural = "Documents administratifs"
        ordering = ["-created_at", "-id"]
        indexes = [
            models.Index(fields=["copropriete", "visible_to_coproprietaires"]),
            models.Index(fields=["copropriete", "category"]),
            models.Index(fields=["published_at"]),
            models.Index(fields=["created_at"]),
        ]

    def save(self, *args, **kwargs):
        if self.visible_to_coproprietaires and self.published_at is None:
            self.published_at = timezone.now()

        if not self.visible_to_coproprietaires:
            self.published_at = None

        super().save(*args, **kwargs)

    @property
    def filename(self) -> str:
        if self.original_filename:
            return self.original_filename

        if not self.file:
            return ""

        try:
            return self.file.name.split("/")[-1]
        except Exception:
            return ""

    @property
    def is_published_for_owner(self) -> bool:
        return bool(self.visible_to_coproprietaires and self.file)

    def __str__(self) -> str:
        return self.title
