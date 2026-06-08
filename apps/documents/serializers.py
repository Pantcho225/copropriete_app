# apps/documents/serializers.py
from __future__ import annotations

from rest_framework import serializers

from .models import GeneratedDocument, ReglementTexteApplicable


class GeneratedDocumentSerializer(serializers.ModelSerializer):
    file_url = serializers.SerializerMethodField()
    filename = serializers.CharField(read_only=True)
    document_type_label = serializers.CharField(
        source="get_document_type_display",
        read_only=True,
    )
    status_label = serializers.CharField(
        source="get_status_display",
        read_only=True,
    )

    related_owner_label = serializers.SerializerMethodField()
    related_lot_label = serializers.SerializerMethodField()
    related_ag_label = serializers.SerializerMethodField()

    class Meta:
        model = GeneratedDocument
        fields = [
            "id",
            "copropriete",
            "document_type",
            "document_type_label",
            "title",
            "reference",
            "file",
            "file_url",
            "filename",
            "file_hash",
            "related_owner",
            "related_owner_label",
            "related_lot",
            "related_lot_label",
            "related_ag",
            "related_ag_label",
            "related_dossier_impaye",
            "related_relance",
            "is_visible_to_owner",
            "status",
            "status_label",
            "metadata",
            "created_by",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields

    def get_file_url(self, obj: GeneratedDocument) -> str:
        if not obj.file:
            return ""

        request = self.context.get("request")

        try:
            url = obj.file.url
        except Exception:
            return ""

        return request.build_absolute_uri(url) if request else url

    def get_related_owner_label(self, obj: GeneratedDocument) -> str:
        owner = obj.related_owner

        if not owner:
            return ""

        parts = [
            getattr(owner, "prenom", "") or "",
            getattr(owner, "nom", "") or "",
        ]
        label = " ".join(part for part in parts if part).strip()

        return label or str(owner)

    def get_related_lot_label(self, obj: GeneratedDocument) -> str:
        lot = obj.related_lot

        if not lot:
            return ""

        return (
            getattr(lot, "numero", None)
            or getattr(lot, "reference", None)
            or f"Lot #{lot.id}"
        )

    def get_related_ag_label(self, obj: GeneratedDocument) -> str:
        ag = obj.related_ag

        if not ag:
            return ""

        return getattr(ag, "titre", "") or f"AG #{ag.id}"


class ReglementTexteApplicableSerializer(serializers.ModelSerializer):
    """
    Serializer admin/syndic.

    Permet de créer, modifier, publier, archiver et rendre visible un texte
    ou règlement applicable à la copropriété.
    """

    categorie_label = serializers.CharField(
        source="get_categorie_display",
        read_only=True,
    )
    statut_label = serializers.CharField(
        source="get_statut_display",
        read_only=True,
    )

    fichier_url = serializers.SerializerMethodField()
    filename = serializers.CharField(read_only=True)

    copropriete_label = serializers.SerializerMethodField()
    publie_par_label = serializers.SerializerMethodField()
    created_by_label = serializers.SerializerMethodField()
    updated_by_label = serializers.SerializerMethodField()

    is_published_for_owner = serializers.BooleanField(read_only=True)

    class Meta:
        model = ReglementTexteApplicable
        fields = [
            "id",
            "copropriete",
            "copropriete_label",
            "titre",
            "categorie",
            "categorie_label",
            "resume",
            "contenu",
            "fichier",
            "fichier_url",
            "filename",
            "statut",
            "statut_label",
            "visible_coproprietaire",
            "is_published_for_owner",
            "ordre_affichage",
            "publie_par",
            "publie_par_label",
            "date_publication",
            "created_by",
            "created_by_label",
            "updated_by",
            "updated_by_label",
            "metadata",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "copropriete_label",
            "categorie_label",
            "statut_label",
            "fichier_url",
            "filename",
            "is_published_for_owner",
            "publie_par",
            "publie_par_label",
            "date_publication",
            "created_by",
            "created_by_label",
            "updated_by",
            "updated_by_label",
            "created_at",
            "updated_at",
        ]

    def validate_titre(self, value: str) -> str:
        value = (value or "").strip()

        if not value:
            raise serializers.ValidationError("Le titre est obligatoire.")

        if len(value) < 3:
            raise serializers.ValidationError(
                "Le titre doit contenir au moins 3 caractères."
            )

        return value

    def validate(self, attrs: dict) -> dict:
        statut = attrs.get("statut", getattr(self.instance, "statut", None))
        contenu = attrs.get("contenu", getattr(self.instance, "contenu", "") or "")
        resume = attrs.get("resume", getattr(self.instance, "resume", "") or "")
        fichier = attrs.get("fichier", getattr(self.instance, "fichier", None))

        if statut == ReglementTexteApplicable.Statut.PUBLIE:
            has_text = bool(str(contenu).strip()) or bool(str(resume).strip())
            has_file = bool(fichier)

            if not has_text and not has_file:
                raise serializers.ValidationError(
                    "Un texte publié doit contenir un résumé, un contenu ou un fichier."
                )

        return attrs

    def get_fichier_url(self, obj: ReglementTexteApplicable) -> str:
        if not obj.fichier:
            return ""

        request = self.context.get("request")

        try:
            url = obj.fichier.url
        except Exception:
            return ""

        return request.build_absolute_uri(url) if request else url

    def get_copropriete_label(self, obj: ReglementTexteApplicable) -> str:
        copropriete = obj.copropriete

        if not copropriete:
            return ""

        return getattr(copropriete, "nom", "") or str(copropriete)

    def get_publie_par_label(self, obj: ReglementTexteApplicable) -> str:
        return get_user_label(obj.publie_par)

    def get_created_by_label(self, obj: ReglementTexteApplicable) -> str:
        return get_user_label(obj.created_by)

    def get_updated_by_label(self, obj: ReglementTexteApplicable) -> str:
        return get_user_label(obj.updated_by)


class CoproprietaireReglementTexteApplicableSerializer(serializers.ModelSerializer):
    """
    Serializer lecture seule côté copropriétaire.

    N'expose que les champs nécessaires à la consultation :
    - pas de champs internes de gestion ;
    - pas de possibilité de modification ;
    - uniquement les textes publiés et visibles seront filtrés dans la view.
    """

    categorie_label = serializers.CharField(
        source="get_categorie_display",
        read_only=True,
    )
    statut_label = serializers.CharField(
        source="get_statut_display",
        read_only=True,
    )
    fichier_url = serializers.SerializerMethodField()
    filename = serializers.CharField(read_only=True)
    publie_par_label = serializers.SerializerMethodField()

    class Meta:
        model = ReglementTexteApplicable
        fields = [
            "id",
            "titre",
            "categorie",
            "categorie_label",
            "resume",
            "contenu",
            "fichier_url",
            "filename",
            "statut",
            "statut_label",
            "date_publication",
            "publie_par_label",
            "ordre_affichage",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields

    def get_fichier_url(self, obj: ReglementTexteApplicable) -> str:
        if not obj.fichier:
            return ""

        request = self.context.get("request")

        try:
            url = obj.fichier.url
        except Exception:
            return ""

        return request.build_absolute_uri(url) if request else url

    def get_publie_par_label(self, obj: ReglementTexteApplicable) -> str:
        return get_user_label(obj.publie_par)


def get_user_label(user) -> str:
    if not user:
        return ""

    full_name = ""

    try:
        full_name = user.get_full_name()
    except Exception:
        full_name = ""

    if full_name:
        return full_name

    username = getattr(user, "username", "") or ""
    email = getattr(user, "email", "") or ""

    return username or email or str(user)