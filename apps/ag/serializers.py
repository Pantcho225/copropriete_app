# apps/ag/serializers.py
from rest_framework import serializers

from .models import AssembleeGenerale, PresenceLot, Resolution, Vote


def _is_ag_closed(ag) -> bool:
    return bool(ag) and getattr(ag, "statut", None) == "CLOTUREE"


def _is_ag_locked(ag) -> bool:
    return bool(ag) and bool(getattr(ag, "pv_locked", False))


def _assert_ag_writable(ag, *, what: str):
    """
    Défense Phase 2.4 + 2.2/2.3 côté serializers (en plus des models + views).
    """
    if _is_ag_closed(ag):
        raise serializers.ValidationError(f"AG clôturée : {what} interdit.")
    if _is_ag_locked(ag):
        raise serializers.ValidationError(f"PV verrouillé : {what} interdit.")


class AssembleeGeneraleSerializer(serializers.ModelSerializer):
    # ✅ URLs (pratique pour afficher le lien du PDF en front)
    pv_pdf_url = serializers.SerializerMethodField(read_only=True)
    pv_signed_pdf_url = serializers.SerializerMethodField(read_only=True)

    signature_president_url = serializers.SerializerMethodField(read_only=True)
    signature_secretaire_url = serializers.SerializerMethodField(read_only=True)
    cachet_image_url = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = AssembleeGenerale
        fields = [
            "id",
            "copropriete",
            "exercice",
            "titre",
            "date_ag",
            "lieu",
            "statut",
            "created_at",
            "updated_at",

            # ✅ PV (archivage/immutabilité)
            "pv_pdf",
            "pv_pdf_url",
            "pv_pdf_hash",
            "pv_generated_at",
            "pv_locked",

            # ✅ PAdES (signature réelle)
            "pv_signed_pdf",
            "pv_signed_pdf_url",
            "pv_signed_hash",
            "pv_signed_at",
            "pv_signer_subject",

            # ✅ Signatures visuelles (images)
            "president_nom",
            "secretaire_nom",
            "signature_president",
            "signature_president_url",
            "signature_secretaire",
            "signature_secretaire_url",
            "cachet_image",
            "cachet_image_url",
        ]

        # ✅ Le client ne doit jamais écrire ces champs “preuve”
        read_only_fields = [
            "id",
            "created_at",
            "updated_at",

            "pv_pdf_hash",
            "pv_generated_at",
            "pv_locked",

            "pv_signed_pdf",
            "pv_signed_hash",
            "pv_signed_at",
            "pv_signer_subject",
        ]

    def get_fields(self):
        """
        Permet d’ajouter proprement closed_at/closed_by si tu as ajouté ces champs
        dans AssembleeGenerale (Phase 2.4) sans casser si pas encore migré.
        """
        fields = super().get_fields()

        if hasattr(AssembleeGenerale, "closed_at"):
            fields["closed_at"] = serializers.DateTimeField(read_only=True)
        if hasattr(AssembleeGenerale, "closed_by"):
            fields["closed_by"] = serializers.PrimaryKeyRelatedField(read_only=True)

        return fields

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
        """
        Défense API :
        - si AG clôturée => aucune modification
        - si PV verrouillé => aucune modification “métier”
        (la signature/lock est faite par endpoints dédiés, pas par serializer)
        """
        instance = getattr(self, "instance", None)
        if instance:
            if _is_ag_closed(instance) and attrs:
                raise serializers.ValidationError("AG clôturée : modification interdite.")
            if _is_ag_locked(instance) and attrs:
                raise serializers.ValidationError("PV verrouillé : modification interdite.")
        return attrs


class PresenceLotSerializer(serializers.ModelSerializer):
    lot_reference = serializers.CharField(source="lot.reference", read_only=True)

    class Meta:
        model = PresenceLot
        fields = [
            "id",
            "ag",
            "lot",
            "lot_reference",
            "tantiemes",
            "present_ou_represente",
            "representant_nom",
            "commentaire",
        ]
        read_only_fields = ["tantiemes"]

    def validate(self, attrs):
        instance = getattr(self, "instance", None)

        ag = None
        if instance and getattr(instance, "ag", None):
            ag = instance.ag
        else:
            ag = attrs.get("ag")

        if ag:
            _assert_ag_writable(ag, what="création/modification des présences")

        return attrs


class ResolutionSerializer(serializers.ModelSerializer):
    # ✅ champs pratiques (front) — n’explose pas si travaux_dossier n’existe pas encore
    travaux_dossier_id = serializers.IntegerField(source="travaux_dossier.id", read_only=True)
    travaux_dossier_titre = serializers.CharField(source="travaux_dossier.titre", read_only=True)

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
            "cloturee",

            # ✅ Phase 3.2 (si présent dans ton model)
            "travaux_dossier",
            "travaux_dossier_id",
            "travaux_dossier_titre",
            "budget_vote",
        ]
        read_only_fields = ["id"]

    def get_fields(self):
        """
        Si le modèle Resolution n’a pas encore les champs Phase 3.2 (avant migration),
        on les retire dynamiquement pour éviter les erreurs.
        """
        fields = super().get_fields()

        # Si travaux_dossier / budget_vote n'existent pas encore, on enlève
        if not hasattr(Resolution, "travaux_dossier"):
            fields.pop("travaux_dossier", None)
            fields.pop("travaux_dossier_id", None)
            fields.pop("travaux_dossier_titre", None)
        if not hasattr(Resolution, "budget_vote"):
            fields.pop("budget_vote", None)

        return fields

    def validate(self, attrs):
        instance = getattr(self, "instance", None)

        ag = None
        if instance and getattr(instance, "ag", None):
            ag = instance.ag
        else:
            ag = attrs.get("ag")

        if ag:
            _assert_ag_writable(ag, what="création/modification des résolutions")

        # ✅ Phase 3.2 : contrôles si résolution liée à un dossier travaux
        # (uniquement si le champ existe)
        if hasattr(Resolution, "travaux_dossier"):
            travaux_dossier = attrs.get("travaux_dossier")
            # en update, si non fourni, on garde l’existant
            if travaux_dossier is None and instance is not None:
                travaux_dossier = getattr(instance, "travaux_dossier", None)

            if travaux_dossier is not None:
                # 1) cohérence copropriété
                if ag and str(getattr(travaux_dossier, "copropriete_id", "")) != str(getattr(ag, "copropriete_id", "")):
                    raise serializers.ValidationError(
                        {"travaux_dossier": "Le dossier travaux doit appartenir à la même copropriété que l'AG."}
                    )

                # 2) workflow : doit être SOUMIS_AG
                statut = getattr(travaux_dossier, "statut", None)
                if statut != "SOUMIS_AG":
                    raise serializers.ValidationError(
                        {"travaux_dossier": "Le dossier travaux doit être SOUMIS_AG avant d’être lié à une résolution."}
                    )

        return attrs


class VoteSerializer(serializers.ModelSerializer):
    lot_reference = serializers.CharField(source="lot.reference", read_only=True)

    class Meta:
        model = Vote
        fields = [
            "id",
            "resolution",
            "lot",
            "lot_reference",
            "choix",
            "tantiemes",
            "created_at",
        ]
        read_only_fields = ["tantiemes", "created_at"]

    def validate(self, attrs):
        instance = getattr(self, "instance", None)

        resolution = attrs.get("resolution") or (instance.resolution if instance else None)
        if resolution:
            if getattr(resolution, "cloturee", False):
                raise serializers.ValidationError({"resolution": "Cette résolution est clôturée. Aucun vote accepté."})

            ag = getattr(resolution, "ag", None)
            if ag:
                if _is_ag_closed(ag):
                    raise serializers.ValidationError({"resolution": "AG clôturée : aucun vote accepté."})
                if _is_ag_locked(ag):
                    raise serializers.ValidationError({"resolution": "PV verrouillé : aucun vote accepté."})

        return attrs