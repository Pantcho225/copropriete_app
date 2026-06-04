# apps/documents/serializers.py
from __future__ import annotations

from rest_framework import serializers

from .models import GeneratedDocument


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