from __future__ import annotations

from django.utils import timezone
from rest_framework import serializers
from rest_framework.reverse import reverse

from .models import (
    ReunionAction,
    ReunionDocument,
    ReunionParticipant,
    ReunionRencontre,
)


def _request_copro_id(serializer) -> str:
    request = serializer.context.get("request") if serializer else None
    if not request:
        return ""

    copro_id = getattr(request, "copropriete_id", None)
    if not copro_id:
        copro_id = request.headers.get("X-Copropriete-Id")

    return str(copro_id or "")


def _safe_reverse(view_name: str, request, pk: int) -> str:
    for candidate in (f"reunions:{view_name}", view_name):
        try:
            return reverse(candidate, kwargs={"pk": pk}, request=request)
        except Exception:
            continue
    return ""


class ReunionParticipantSerializer(serializers.ModelSerializer):
    type_label = serializers.CharField(source="get_type_display", read_only=True)
    user_label = serializers.SerializerMethodField()
    coproprietaire_label = serializers.SerializerMethodField()

    class Meta:
        model = ReunionParticipant
        fields = [
            "id",
            "reunion",
            "type",
            "type_label",
            "user",
            "user_label",
            "coproprietaire",
            "coproprietaire_label",
            "nom_complet",
            "organisation",
            "fonction",
            "email",
            "telephone",
            "present",
            "ordre",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "type_label",
            "user_label",
            "coproprietaire_label",
            "created_at",
            "updated_at",
        ]

    def validate_nom_complet(self, value: str) -> str:
        value = (value or "").strip()
        if len(value) < 2:
            raise serializers.ValidationError(
                "Le nom du participant doit contenir au moins 2 caractères."
            )
        return value

    def validate(self, attrs: dict) -> dict:
        copro_id = _request_copro_id(self)
        reunion = attrs.get("reunion", getattr(self.instance, "reunion", None))

        if not reunion:
            raise serializers.ValidationError({"reunion": "La réunion est obligatoire."})

        if copro_id and str(reunion.copropriete_id) != str(copro_id):
            raise serializers.ValidationError(
                {"reunion": "La réunion n’appartient pas à la copropriété courante."}
            )

        coproprietaire = attrs.get(
            "coproprietaire",
            getattr(self.instance, "coproprietaire", None),
        )
        if coproprietaire and str(coproprietaire.copropriete_id) != str(reunion.copropriete_id):
            raise serializers.ValidationError(
                {"coproprietaire": "Ce copropriétaire n’appartient pas à la copropriété de la réunion."}
            )

        return attrs

    def get_user_label(self, obj: ReunionParticipant) -> str:
        return str(obj.user) if obj.user else ""

    def get_coproprietaire_label(self, obj: ReunionParticipant) -> str:
        copro = obj.coproprietaire
        if not copro:
            return ""

        parts = [
            getattr(copro, "prenom", "") or "",
            getattr(copro, "nom", "") or "",
        ]
        label = " ".join(part for part in parts if part).strip()
        return label or str(copro)


class ReunionDocumentSerializer(serializers.ModelSerializer):
    type_label = serializers.CharField(source="get_type_display", read_only=True)
    fichier_url = serializers.SerializerMethodField()
    download_url = serializers.SerializerMethodField()
    filename = serializers.CharField(read_only=True)
    created_by_label = serializers.SerializerMethodField()

    class Meta:
        model = ReunionDocument
        fields = [
            "id",
            "reunion",
            "type",
            "type_label",
            "titre",
            "description",
            "fichier",
            "fichier_url",
            "download_url",
            "filename",
            "document_administratif",
            "nom_fichier_original",
            "mime_type",
            "taille_octets",
            "visible_coproprietaire",
            "ordre",
            "created_by",
            "created_by_label",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "type_label",
            "fichier_url",
            "download_url",
            "filename",
            "nom_fichier_original",
            "mime_type",
            "taille_octets",
            "created_by",
            "created_by_label",
            "created_at",
            "updated_at",
        ]

    def validate_titre(self, value: str) -> str:
        value = (value or "").strip()
        if len(value) < 2:
            raise serializers.ValidationError(
                "Le titre du document doit contenir au moins 2 caractères."
            )
        return value

    def validate_fichier(self, value):
        if not value:
            return value

        allowed_extensions = (".pdf", ".jpg", ".jpeg", ".png", ".webp", ".doc", ".docx")
        allowed_mime_types = {
            "application/pdf",
            "image/jpeg",
            "image/png",
            "image/webp",
            "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        }

        filename = str(getattr(value, "name", "") or "").lower()
        content_type = str(getattr(value, "content_type", "") or "").lower()

        if not filename.endswith(allowed_extensions) and content_type not in allowed_mime_types:
            raise serializers.ValidationError(
                "Format non autorisé. Utilisez PDF, image JPG/PNG/WEBP ou document Word."
            )

        max_size = 20 * 1024 * 1024
        if int(getattr(value, "size", 0) or 0) > max_size:
            raise serializers.ValidationError("Le fichier ne doit pas dépasser 20 Mo.")

        return value

    def validate(self, attrs: dict) -> dict:
        copro_id = _request_copro_id(self)
        reunion = attrs.get("reunion", getattr(self.instance, "reunion", None))
        fichier = attrs.get("fichier", getattr(self.instance, "fichier", None))
        document_admin = attrs.get(
            "document_administratif",
            getattr(self.instance, "document_administratif", None),
        )

        if not reunion:
            raise serializers.ValidationError({"reunion": "La réunion est obligatoire."})

        if copro_id and str(reunion.copropriete_id) != str(copro_id):
            raise serializers.ValidationError(
                {"reunion": "La réunion n’appartient pas à la copropriété courante."}
            )

        if document_admin and str(document_admin.copropriete_id) != str(reunion.copropriete_id):
            raise serializers.ValidationError(
                {
                    "document_administratif": (
                        "Le document administratif lié n’appartient pas "
                        "à la copropriété de la réunion."
                    )
                }
            )

        if not fichier and not document_admin:
            raise serializers.ValidationError(
                "Ajoutez un fichier ou liez un document administratif existant."
            )

        return attrs

    def get_fichier_url(self, obj: ReunionDocument) -> str:
        file_obj = obj.effective_file
        if not file_obj:
            return ""

        request = self.context.get("request")

        try:
            url = file_obj.url
        except Exception:
            return ""

        return request.build_absolute_uri(url) if request else url

    def get_download_url(self, obj: ReunionDocument) -> str:
        request = self.context.get("request")
        if not request:
            return ""

        return _safe_reverse("reunion-document-download", request, obj.pk)

    def get_created_by_label(self, obj: ReunionDocument) -> str:
        return str(obj.created_by) if obj.created_by else ""


class ReunionActionSerializer(serializers.ModelSerializer):
    statut_label = serializers.CharField(source="get_statut_display", read_only=True)
    priorite_label = serializers.CharField(source="get_priorite_display", read_only=True)
    responsable_user_label = serializers.SerializerMethodField()
    created_by_label = serializers.SerializerMethodField()
    updated_by_label = serializers.SerializerMethodField()

    class Meta:
        model = ReunionAction
        fields = [
            "id",
            "reunion",
            "titre",
            "description",
            "statut",
            "statut_label",
            "priorite",
            "priorite_label",
            "responsable_user",
            "responsable_user_label",
            "responsable_nom",
            "echeance",
            "date_cloture",
            "ordre",
            "created_by",
            "created_by_label",
            "updated_by",
            "updated_by_label",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "statut_label",
            "priorite_label",
            "responsable_user_label",
            "date_cloture",
            "created_by",
            "created_by_label",
            "updated_by",
            "updated_by_label",
            "created_at",
            "updated_at",
        ]

    def validate_titre(self, value: str) -> str:
        value = (value or "").strip()
        if len(value) < 2:
            raise serializers.ValidationError(
                "Le titre de l’action doit contenir au moins 2 caractères."
            )
        return value

    def validate(self, attrs: dict) -> dict:
        copro_id = _request_copro_id(self)
        reunion = attrs.get("reunion", getattr(self.instance, "reunion", None))

        if not reunion:
            raise serializers.ValidationError({"reunion": "La réunion est obligatoire."})

        if copro_id and str(reunion.copropriete_id) != str(copro_id):
            raise serializers.ValidationError(
                {"reunion": "La réunion n’appartient pas à la copropriété courante."}
            )

        return attrs

    def get_responsable_user_label(self, obj: ReunionAction) -> str:
        return str(obj.responsable_user) if obj.responsable_user else ""

    def get_created_by_label(self, obj: ReunionAction) -> str:
        return str(obj.created_by) if obj.created_by else ""

    def get_updated_by_label(self, obj: ReunionAction) -> str:
        return str(obj.updated_by) if obj.updated_by else ""


class ReunionRencontreSerializer(serializers.ModelSerializer):
    type_label = serializers.CharField(source="get_type_display", read_only=True)
    statut_label = serializers.CharField(source="get_statut_display", read_only=True)
    copropriete_label = serializers.SerializerMethodField()
    is_published_for_owner = serializers.BooleanField(read_only=True)

    participants = ReunionParticipantSerializer(many=True, read_only=True)
    documents = ReunionDocumentSerializer(many=True, read_only=True)
    actions = ReunionActionSerializer(many=True, read_only=True)

    participants_count = serializers.SerializerMethodField()
    documents_count = serializers.SerializerMethodField()
    actions_count = serializers.SerializerMethodField()

    created_by_label = serializers.SerializerMethodField()
    updated_by_label = serializers.SerializerMethodField()

    class Meta:
        model = ReunionRencontre
        fields = [
            "id",
            "copropriete",
            "copropriete_label",
            "type",
            "type_label",
            "statut",
            "statut_label",
            "titre",
            "reference",
            "objet",
            "description",
            "date_debut",
            "date_fin",
            "lieu",
            "compte_rendu",
            "decisions",
            "visible_coproprietaire",
            "date_publication",
            "is_published_for_owner",
            "participants_count",
            "documents_count",
            "actions_count",
            "participants",
            "documents",
            "actions",
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
            "copropriete",
            "copropriete_label",
            "type_label",
            "statut_label",
            "date_publication",
            "is_published_for_owner",
            "participants_count",
            "documents_count",
            "actions_count",
            "participants",
            "documents",
            "actions",
            "created_by",
            "created_by_label",
            "updated_by",
            "updated_by_label",
            "created_at",
            "updated_at",
        ]

    def validate_titre(self, value: str) -> str:
        value = (value or "").strip()
        if len(value) < 3:
            raise serializers.ValidationError(
                "Le titre doit contenir au moins 3 caractères."
            )
        return value

    def validate(self, attrs: dict) -> dict:
        date_debut = attrs.get("date_debut", getattr(self.instance, "date_debut", None))
        date_fin = attrs.get("date_fin", getattr(self.instance, "date_fin", None))

        if date_debut and date_fin and date_fin < date_debut:
            raise serializers.ValidationError(
                {"date_fin": "La date de fin ne peut pas être antérieure à la date de début."}
            )

        return attrs

    def get_copropriete_label(self, obj: ReunionRencontre) -> str:
        copro = obj.copropriete
        return getattr(copro, "nom", "") or str(copro)

    def get_participants_count(self, obj: ReunionRencontre) -> int:
        return obj.participants.count()

    def get_documents_count(self, obj: ReunionRencontre) -> int:
        return obj.documents.count()

    def get_actions_count(self, obj: ReunionRencontre) -> int:
        return obj.actions.count()

    def get_created_by_label(self, obj: ReunionRencontre) -> str:
        return str(obj.created_by) if obj.created_by else ""

    def get_updated_by_label(self, obj: ReunionRencontre) -> str:
        return str(obj.updated_by) if obj.updated_by else ""


class CoproprietaireReunionDocumentSerializer(ReunionDocumentSerializer):
    def get_download_url(self, obj: ReunionDocument) -> str:
        request = self.context.get("request")
        if not request:
            return ""

        return _safe_reverse("coproprietaire-reunion-document-download", request, obj.pk)


class CoproprietaireReunionRencontreSerializer(serializers.ModelSerializer):
    type_label = serializers.CharField(source="get_type_display", read_only=True)
    statut_label = serializers.CharField(source="get_statut_display", read_only=True)

    participants = serializers.SerializerMethodField()
    documents = serializers.SerializerMethodField()
    actions = serializers.SerializerMethodField()

    class Meta:
        model = ReunionRencontre
        fields = [
            "id",
            "type",
            "type_label",
            "statut",
            "statut_label",
            "titre",
            "reference",
            "objet",
            "description",
            "date_debut",
            "date_fin",
            "lieu",
            "compte_rendu",
            "decisions",
            "date_publication",
            "participants",
            "documents",
            "actions",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields

    def get_participants(self, obj: ReunionRencontre) -> list[dict]:
        participants = obj.participants.all().order_by("ordre", "nom_complet", "id")
        return [
            {
                "id": item.id,
                "type": item.type,
                "type_label": item.get_type_display(),
                "nom_complet": item.nom_complet,
                "organisation": item.organisation,
                "fonction": item.fonction,
                "present": item.present,
                "ordre": item.ordre,
            }
            for item in participants
        ]

    def get_documents(self, obj: ReunionRencontre) -> list[dict]:
        documents = obj.documents.filter(visible_coproprietaire=True).order_by(
            "ordre",
            "-created_at",
            "-id",
        )
        return CoproprietaireReunionDocumentSerializer(
            documents,
            many=True,
            context=self.context,
        ).data

    def get_actions(self, obj: ReunionRencontre) -> list[dict]:
        actions = obj.actions.exclude(
            statut=ReunionAction.Statut.ANNULEE,
        ).order_by("ordre", "echeance", "id")

        return [
            {
                "id": item.id,
                "titre": item.titre,
                "description": item.description,
                "statut": item.statut,
                "statut_label": item.get_statut_display(),
                "priorite": item.priorite,
                "priorite_label": item.get_priorite_display(),
                "responsable_nom": item.responsable_nom,
                "echeance": item.echeance,
                "date_cloture": item.date_cloture,
                "ordre": item.ordre,
            }
            for item in actions
        ]
