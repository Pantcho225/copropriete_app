from __future__ import annotations

from decimal import Decimal

from rest_framework import serializers

from .models import AssembleeGenerale, PresenceLot, Resolution, Vote


DEC0 = Decimal("0.00")


def _is_ag_closed(ag) -> bool:
    return bool(ag) and getattr(ag, "statut", None) == "CLOTUREE"


def _is_ag_locked(ag) -> bool:
    return bool(ag) and bool(getattr(ag, "pv_locked", False))


def _assert_ag_writable(ag, *, what: str):
    if _is_ag_closed(ag):
        raise serializers.ValidationError(f"AG clôturée : {what} interdit.")
    if _is_ag_locked(ag):
        raise serializers.ValidationError(f"PV verrouillé : {what} interdit.")


class AssembleeGeneraleSerializer(serializers.ModelSerializer):
    pv_pdf_url = serializers.SerializerMethodField(read_only=True)
    pv_signed_pdf_url = serializers.SerializerMethodField(read_only=True)

    signature_president_url = serializers.SerializerMethodField(read_only=True)
    signature_secretaire_url = serializers.SerializerMethodField(read_only=True)
    cachet_image_url = serializers.SerializerMethodField(read_only=True)

    quorum_atteint = serializers.SerializerMethodField(read_only=True)
    total_tantiemes_copro = serializers.SerializerMethodField(read_only=True)
    total_tantiemes_presents = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = AssembleeGenerale
        fields = [
            "id",
            "copropriete",
            "exercice",
            "titre",
            "date_ag",
            "lieu",
            "tantieme_categorie",
            "statut",
            "created_at",
            "updated_at",
            "quorum_atteint",
            "total_tantiemes_copro",
            "total_tantiemes_presents",
            "pv_pdf",
            "pv_pdf_url",
            "pv_pdf_hash",
            "pv_generated_at",
            "pv_locked",
            "pv_signed_pdf",
            "pv_signed_pdf_url",
            "pv_signed_hash",
            "pv_signed_at",
            "pv_signer_subject",
            "president_nom",
            "secretaire_nom",
            "signature_president",
            "signature_president_url",
            "signature_secretaire",
            "signature_secretaire_url",
            "cachet_image",
            "cachet_image_url",
        ]
        read_only_fields = [
            "id",
            "created_at",
            "updated_at",
            "quorum_atteint",
            "total_tantiemes_copro",
            "total_tantiemes_presents",
            "pv_pdf_hash",
            "pv_generated_at",
            "pv_locked",
            "pv_signed_pdf",
            "pv_signed_hash",
            "pv_signed_at",
            "pv_signer_subject",
        ]

    def get_fields(self):
        fields = super().get_fields()

        if hasattr(AssembleeGenerale, "closed_at"):
            fields["closed_at"] = serializers.DateTimeField(read_only=True)
        if hasattr(AssembleeGenerale, "closed_by"):
            fields["closed_by"] = serializers.PrimaryKeyRelatedField(read_only=True)

        return fields

    def get_quorum_atteint(self, obj):
        try:
            return bool(obj.quorum_atteint())
        except Exception:
            return False

    def get_total_tantiemes_copro(self, obj):
        try:
            return float(obj.total_tantiemes_copro())
        except Exception:
            return 0.0

    def get_total_tantiemes_presents(self, obj):
        try:
            return float(obj.total_tantiemes_presents())
        except Exception:
            return 0.0

    def get_pv_pdf_url(self, obj):
        if obj.pv_pdf:
            try:
                return obj.pv_pdf.url
            except Exception:
                return None
        return None

    def get_pv_signed_pdf_url(self, obj):
        if getattr(obj, "pv_signed_pdf", None):
            try:
                return obj.pv_signed_pdf.url
            except Exception:
                return None
        return None

    def get_signature_president_url(self, obj):
        if obj.signature_president:
            try:
                return obj.signature_president.url
            except Exception:
                return None
        return None

    def get_signature_secretaire_url(self, obj):
        if obj.signature_secretaire:
            try:
                return obj.signature_secretaire.url
            except Exception:
                return None
        return None

    def get_cachet_image_url(self, obj):
        if obj.cachet_image:
            try:
                return obj.cachet_image.url
            except Exception:
                return None
        return None

    def validate(self, attrs):
        instance = getattr(self, "instance", None)

        copropriete = attrs.get("copropriete") or (instance.copropriete if instance else None)
        exercice = attrs.get("exercice") or (instance.exercice if instance else None)
        tantieme_categorie = attrs.get("tantieme_categorie")
        if tantieme_categorie is None and instance is not None:
            tantieme_categorie = getattr(instance, "tantieme_categorie", None)

        if instance:
            if _is_ag_closed(instance) and attrs:
                raise serializers.ValidationError("AG clôturée : modification interdite.")
            if _is_ag_locked(instance) and attrs:
                raise serializers.ValidationError("PV verrouillé : modification interdite.")

        if exercice is not None and copropriete is not None:
            if str(getattr(exercice, "copropriete_id", "")) != str(getattr(copropriete, "id", "")):
                raise serializers.ValidationError(
                    {"exercice": "L'exercice doit appartenir à la même copropriété que l'AG."}
                )

        if tantieme_categorie is not None and copropriete is not None:
            if str(getattr(tantieme_categorie, "copropriete_id", "")) != str(getattr(copropriete, "id", "")):
                raise serializers.ValidationError(
                    {"tantieme_categorie": "La catégorie de tantièmes doit appartenir à la même copropriété."}
                )

        return attrs


class PresenceLotSerializer(serializers.ModelSerializer):
    lot_reference = serializers.CharField(source="lot.reference", read_only=True)
    lot_type_lot = serializers.CharField(source="lot.type_lot", read_only=True)
    tantiemes_recalcules = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = PresenceLot
        fields = [
            "id",
            "ag",
            "lot",
            "lot_reference",
            "lot_type_lot",
            "tantiemes",
            "tantiemes_recalcules",
            "present_ou_represente",
            "representant_nom",
            "commentaire",
        ]
        read_only_fields = ["tantiemes", "tantiemes_recalcules"]

    def get_tantiemes_recalcules(self, obj):
        try:
            if obj.ag_id and obj.lot_id:
                return float(obj.ag.get_lot_tantiemes(obj.lot_id))
        except Exception:
            pass
        return 0.0

    def validate(self, attrs):
        instance = getattr(self, "instance", None)

        ag = attrs.get("ag") or (instance.ag if instance else None)
        lot = attrs.get("lot") or (instance.lot if instance else None)

        if ag:
            _assert_ag_writable(ag, what="création/modification des présences")

        if ag and lot:
            if str(getattr(lot, "copropriete_id", "")) != str(getattr(ag, "copropriete_id", "")):
                raise serializers.ValidationError(
                    {"lot": "Le lot doit appartenir à la même copropriété que l'AG."}
                )

        return attrs

    def create(self, validated_data):
        obj = PresenceLot(**validated_data)
        obj.refresh_tantiemes()
        obj.save()
        return obj

    def update(self, instance, validated_data):
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.refresh_tantiemes()
        instance.save()
        return instance


class ResolutionSerializer(serializers.ModelSerializer):
    travaux_dossier_id = serializers.IntegerField(source="travaux_dossier.id", read_only=True)
    travaux_dossier_titre = serializers.CharField(source="travaux_dossier.titre", read_only=True)
    tantieme_categorie_effective = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Resolution
        fields = [
            "id",
            "ag",
            "ordre",
            "titre",
            "texte",
            "type_majorite",
            "tantieme_categorie",
            "tantieme_categorie_effective",
            "cloturee",
            "travaux_dossier",
            "travaux_dossier_id",
            "travaux_dossier_titre",
            "budget_vote",
        ]
        read_only_fields = ["id"]

    def get_fields(self):
        fields = super().get_fields()

        if not hasattr(Resolution, "travaux_dossier"):
            fields.pop("travaux_dossier", None)
            fields.pop("travaux_dossier_id", None)
            fields.pop("travaux_dossier_titre", None)
        if not hasattr(Resolution, "budget_vote"):
            fields.pop("budget_vote", None)

        return fields

    def get_tantieme_categorie_effective(self, obj):
        try:
            return obj.get_reference_tantieme_categorie_id()
        except Exception:
            return None

    def validate(self, attrs):
        instance = getattr(self, "instance", None)

        ag = attrs.get("ag") or (instance.ag if instance else None)
        if ag:
            _assert_ag_writable(ag, what="création/modification des résolutions")

        tantieme_categorie = attrs.get("tantieme_categorie")
        if tantieme_categorie is None and instance is not None:
            tantieme_categorie = getattr(instance, "tantieme_categorie", None)

        if tantieme_categorie is not None and ag is not None:
            if str(getattr(tantieme_categorie, "copropriete_id", "")) != str(getattr(ag, "copropriete_id", "")):
                raise serializers.ValidationError(
                    {"tantieme_categorie": "La catégorie de tantièmes doit appartenir à la même copropriété que l'AG."}
                )

        if hasattr(Resolution, "travaux_dossier"):
            travaux_dossier = attrs.get("travaux_dossier")
            if travaux_dossier is None and instance is not None:
                travaux_dossier = getattr(instance, "travaux_dossier", None)

            if travaux_dossier is not None:
                if ag and str(getattr(travaux_dossier, "copropriete_id", "")) != str(getattr(ag, "copropriete_id", "")):
                    raise serializers.ValidationError(
                        {"travaux_dossier": "Le dossier travaux doit appartenir à la même copropriété que l'AG."}
                    )

                statut = getattr(travaux_dossier, "statut", None)
                if statut != "SOUMIS_AG":
                    raise serializers.ValidationError(
                        {"travaux_dossier": "Le dossier travaux doit être SOUMIS_AG avant d’être lié à une résolution."}
                    )

        return attrs


class VoteSerializer(serializers.ModelSerializer):
    lot_reference = serializers.CharField(source="lot.reference", read_only=True)
    tantiemes_recalcules = serializers.SerializerMethodField(read_only=True)
    tantieme_categorie_effective = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Vote
        fields = [
            "id",
            "resolution",
            "lot",
            "lot_reference",
            "choix",
            "tantiemes",
            "tantiemes_recalcules",
            "tantieme_categorie_effective",
            "created_at",
        ]
        read_only_fields = ["tantiemes", "tantiemes_recalcules", "tantieme_categorie_effective", "created_at"]

    def get_tantiemes_recalcules(self, obj):
        try:
            if obj.resolution_id and obj.lot_id:
                ref_cat_id = obj.resolution.get_reference_tantieme_categorie_id()
                return float(
                    obj.resolution.ag.get_lot_tantiemes(
                        obj.lot_id,
                        categorie_id=ref_cat_id,
                    )
                )
        except Exception:
            pass
        return 0.0

    def get_tantieme_categorie_effective(self, obj):
        try:
            return obj.resolution.get_reference_tantieme_categorie_id()
        except Exception:
            return None

    def validate(self, attrs):
        instance = getattr(self, "instance", None)

        resolution = attrs.get("resolution") or (instance.resolution if instance else None)
        lot = attrs.get("lot") or (instance.lot if instance else None)

        if resolution:
            if getattr(resolution, "cloturee", False):
                raise serializers.ValidationError({"resolution": "Cette résolution est clôturée. Aucun vote accepté."})

            ag = getattr(resolution, "ag", None)
            if ag:
                if _is_ag_closed(ag):
                    raise serializers.ValidationError({"resolution": "AG clôturée : aucun vote accepté."})
                if _is_ag_locked(ag):
                    raise serializers.ValidationError({"resolution": "PV verrouillé : aucun vote accepté."})

        if resolution and lot:
            ag = getattr(resolution, "ag", None)

            if ag and str(getattr(lot, "copropriete_id", "")) != str(getattr(ag, "copropriete_id", "")):
                raise serializers.ValidationError({"lot": "Le lot doit appartenir à la copropriété de l'AG."})

            has_presences = PresenceLot.objects.filter(ag_id=resolution.ag_id).exists()
            if has_presences:
                ok = PresenceLot.objects.filter(
                    ag_id=resolution.ag_id,
                    lot_id=lot.id,
                    present_ou_represente=True,
                ).exists()
                if not ok:
                    raise serializers.ValidationError({"lot": "Ce lot n'est pas présent/représenté pour cette AG."})

            # Empêche un second vote du même lot sur la même résolution
            existing = Vote.objects.filter(resolution=resolution, lot=lot)
            if instance and instance.pk:
                existing = existing.exclude(pk=instance.pk)
            if existing.exists():
                raise serializers.ValidationError(
                    {"lot": "Ce lot a déjà voté pour cette résolution."}
                )

        return attrs

    def create(self, validated_data):
        obj = Vote(**validated_data)
        obj.refresh_tantiemes()
        obj.save()
        return obj

    def update(self, instance, validated_data):
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.refresh_tantiemes()
        instance.save()
        return instance