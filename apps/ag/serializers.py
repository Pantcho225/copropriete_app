from __future__ import annotations

from decimal import Decimal

from rest_framework import serializers

from .models import AGProcuration, AgConvocation, AssembleeGenerale, PresenceLot, Resolution, Vote
from .services.results import compute_resolution_result


DEC0 = Decimal("0.00")


def _is_ag_closed(ag) -> bool:
    return bool(ag) and getattr(ag, "statut", None) == "CLOTUREE"


def _is_ag_locked(ag) -> bool:
    return bool(ag) and bool(getattr(ag, "pv_locked", False))


def _is_ag_open(ag) -> bool:
    return bool(ag) and getattr(ag, "statut", None) == "OUVERTE"


def _ag_status_label(ag) -> str:
    statut = str(getattr(ag, "statut", "") or "").strip().upper()

    labels = {
        "BROUILLON": "brouillon",
        "CONVOQUEE": "convoquée",
        "CONVOQUÉE": "convoquée",
        "OUVERTE": "ouverte",
        "CLOTUREE": "clôturée",
        "CLÔTUREE": "clôturée",
        "ARCHIVEE": "archivée",
        "ANNULÉE": "annulée",
        "ANNULEE": "annulée",
    }

    return labels.get(statut, statut.lower() or "non défini")


def _ag_not_open_message(ag, *, what: str) -> str:
    statut_label = _ag_status_label(ag)
    what_lower = what.lower()

    if "résolution" in what_lower or "resolution" in what_lower:
        return (
            f"Cette assemblée est en statut {statut_label} : {what} interdit. "
            "Les résolutions doivent normalement être préparées avant l’envoi de la convocation. "
            "Une fois l’AG convoquée, l’ordre du jour doit rester figé ; si une résolution manque, "
            "repassez l’AG en brouillon ou créez une nouvelle convocation selon votre procédure interne."
        )

    return (
        f"Cette assemblée est en statut {statut_label} : {what} interdit. "
        "Cette action est disponible uniquement lorsque l’assemblée est officiellement ouverte "
        "par le syndic et non verrouillée."
    )


def _assert_resolution_writable(ag, *, what: str):
    if not ag:
        raise serializers.ValidationError(f"AG invalide : {what} interdit.")

    if _is_ag_closed(ag):
        raise serializers.ValidationError(f"AG clôturée : {what} interdit.")

    if _is_ag_locked(ag):
        raise serializers.ValidationError(f"PV verrouillé : {what} interdit.")

    statut = str(getattr(ag, "statut", "") or "").strip().upper()

    if statut not in {"BROUILLON", "OUVERTE"}:
        raise serializers.ValidationError(_ag_not_open_message(ag, what=what))


def _assert_ag_writable(ag, *, what: str):
    if _is_ag_closed(ag):
        raise serializers.ValidationError(f"AG clôturée : {what} interdit.")
    if _is_ag_locked(ag):
        raise serializers.ValidationError(f"PV verrouillé : {what} interdit.")


def _assert_ag_open_and_writable(ag, *, what: str):
    if not ag:
        raise serializers.ValidationError(f"AG invalide : {what} interdit.")
    if getattr(ag, "statut", None) != "OUVERTE":
        raise serializers.ValidationError(_ag_not_open_message(ag, what=what))
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
    has_zero_tantieme_lots = serializers.SerializerMethodField(read_only=True)
    pv_status = serializers.SerializerMethodField(read_only=True)

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
            "has_zero_tantieme_lots",
            "pv_status",
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
            "has_zero_tantieme_lots",
            "pv_status",
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

    def get_has_zero_tantieme_lots(self, obj):
        try:
            return obj.presences.filter(tantiemes__lte=0).exists()
        except Exception:
            return False

    def get_pv_status(self, obj):
        try:
            if getattr(obj, "statut", None) == "CLOTUREE" and getattr(obj, "pv_locked", False):
                return "VERROUILLE"
            if getattr(obj, "pv_locked", False) and getattr(obj, "pv_signed_pdf", None):
                return "VERROUILLE"
            if getattr(obj, "pv_signed_pdf", None):
                return "SIGNE"
            if getattr(obj, "pv_pdf", None):
                return "ARCHIVE"
            return "NON_GENERE"
        except Exception:
            return "NON_GENERE"

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
    is_zero_tantieme = serializers.SerializerMethodField(read_only=True)

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
            "is_zero_tantieme",
            "present_ou_represente",
            "representant_nom",
            "commentaire",
        ]
        read_only_fields = ["tantiemes", "tantiemes_recalcules", "is_zero_tantieme"]

    def get_tantiemes_recalcules(self, obj):
        try:
            if obj.ag_id and obj.lot_id:
                return float(obj.ag.get_lot_tantiemes(obj.lot_id))
        except Exception:
            pass
        return 0.0

    def get_is_zero_tantieme(self, obj):
        try:
            return Decimal(str(obj.tantiemes or 0)) <= 0
        except Exception:
            return True

    def validate(self, attrs):
        instance = getattr(self, "instance", None)

        ag = attrs.get("ag") or (instance.ag if instance else None)
        lot = attrs.get("lot") or (instance.lot if instance else None)

        if ag:
            _assert_ag_open_and_writable(ag, what="création/modification des présences")

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
        instance.save()
        return instance


class AGProcurationSerializer(serializers.ModelSerializer):
    ag_titre = serializers.CharField(source="ag.titre", read_only=True)
    ag_date_ag = serializers.DateTimeField(source="ag.date_ag", read_only=True)
    coproprietaire_label = serializers.SerializerMethodField(read_only=True)
    lot_reference = serializers.CharField(source="lot.reference", read_only=True)
    lot_numero = serializers.CharField(source="lot.numero", read_only=True)
    lot_label = serializers.SerializerMethodField(read_only=True)
    document_url = serializers.SerializerMethodField(read_only=True)
    document_reference = serializers.CharField(source="document.reference", read_only=True)
    document_title = serializers.CharField(source="document.title", read_only=True)
    statut_label = serializers.CharField(source="get_statut_display", read_only=True)
    created_by_label = serializers.SerializerMethodField(read_only=True)
    validated_by_label = serializers.SerializerMethodField(read_only=True)
    rejected_by_label = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = AGProcuration
        fields = [
            "id",
            "ag",
            "ag_titre",
            "ag_date_ag",
            "coproprietaire",
            "coproprietaire_label",
            "lot",
            "lot_reference",
            "lot_numero",
            "lot_label",
            "mandataire_nom",
            "mandataire_telephone",
            "mandataire_email",
            "document",
            "document_url",
            "document_reference",
            "document_title",
            "statut",
            "statut_label",
            "motif_rejet",
            "created_by",
            "created_by_label",
            "validated_by",
            "validated_by_label",
            "validated_at",
            "rejected_by",
            "rejected_by_label",
            "rejected_at",
            "ip_address",
            "user_agent",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "ag_titre",
            "ag_date_ag",
            "coproprietaire_label",
            "lot_reference",
            "lot_numero",
            "lot_label",
            "document",
            "document_url",
            "document_reference",
            "document_title",
            "statut",
            "statut_label",
            "motif_rejet",
            "created_by",
            "created_by_label",
            "validated_by",
            "validated_by_label",
            "validated_at",
            "rejected_by",
            "rejected_by_label",
            "rejected_at",
            "ip_address",
            "user_agent",
            "created_at",
            "updated_at",
        ]

    def get_coproprietaire_label(self, obj):
        owner = getattr(obj, "coproprietaire", None)
        if not owner:
            return ""
        return getattr(owner, "display_name", "") or str(owner)

    def get_lot_label(self, obj):
        lot = getattr(obj, "lot", None)
        if not lot:
            return ""

        return (
            getattr(lot, "reference", "")
            or getattr(lot, "numero", "")
            or f"Lot #{getattr(lot, 'id', '')}"
        )

    def get_document_url(self, obj):
        document = getattr(obj, "document", None)
        if not document:
            return None

        file_obj = getattr(document, "file", None)
        if not file_obj:
            return None

        try:
            url = file_obj.url
        except Exception:
            return None

        request = self.context.get("request")
        if request is not None and isinstance(url, str) and url.startswith("/"):
            return request.build_absolute_uri(url)

        return url

    def _user_label(self, user):
        if not user:
            return ""

        full_name = ""
        try:
            full_name = user.get_full_name()
        except Exception:
            full_name = ""

        return full_name or getattr(user, "username", "") or getattr(user, "email", "") or str(user)

    def get_created_by_label(self, obj):
        return self._user_label(getattr(obj, "created_by", None))

    def get_validated_by_label(self, obj):
        return self._user_label(getattr(obj, "validated_by", None))

    def get_rejected_by_label(self, obj):
        return self._user_label(getattr(obj, "rejected_by", None))

    def validate(self, attrs):
        instance = getattr(self, "instance", None)

        if instance and getattr(instance, "statut", None) != AGProcuration.Statut.EN_ATTENTE:
            raise serializers.ValidationError(
                "Seule une procuration en attente peut être modifiée."
            )

        ag = attrs.get("ag") or (instance.ag if instance else None)
        lot = attrs.get("lot") or (instance.lot if instance else None)
        coproprietaire = attrs.get("coproprietaire") or (
            instance.coproprietaire if instance else None
        )

        if not ag:
            raise serializers.ValidationError({"ag": "L’assemblée générale est obligatoire."})

        if not lot:
            raise serializers.ValidationError({"lot": "Le lot est obligatoire."})

        if not coproprietaire:
            raise serializers.ValidationError(
                {"coproprietaire": "Le copropriétaire est obligatoire."}
            )

        if getattr(ag, "statut", None) not in {"CONVOQUEE", "OUVERTE"}:
            raise serializers.ValidationError(
                {
                    "ag": (
                        "Une procuration ne peut être créée ou modifiée que pour "
                        "une AG convoquée ou ouverte."
                    )
                }
            )

        if _is_ag_closed(ag) or _is_ag_locked(ag):
            raise serializers.ValidationError(
                {"ag": "AG clôturée ou PV verrouillé : procuration interdite."}
            )

        if str(getattr(lot, "copropriete_id", "")) != str(getattr(ag, "copropriete_id", "")):
            raise serializers.ValidationError(
                {"lot": "Le lot doit appartenir à la même copropriété que l’AG."}
            )

        if str(getattr(coproprietaire, "copropriete_id", "")) != str(getattr(ag, "copropriete_id", "")):
            raise serializers.ValidationError(
                {
                    "coproprietaire": (
                        "Le copropriétaire doit appartenir à la même copropriété "
                        "que l’AG."
                    )
                }
            )

        try:
            from apps.owners.models import ProprietaireLot

            has_active_link = ProprietaireLot.objects.filter(
                copropriete_id=ag.copropriete_id,
                coproprietaire=coproprietaire,
                lot=lot,
                date_fin__isnull=True,
            ).exists()
        except Exception:
            has_active_link = True

        if not has_active_link:
            raise serializers.ValidationError(
                {
                    "lot": (
                        "Ce lot n’est pas rattaché activement au copropriétaire "
                        "sélectionné."
                    )
                }
            )

        mandataire_nom = str(attrs.get("mandataire_nom") or "").strip()
        if not mandataire_nom and instance is not None:
            mandataire_nom = str(getattr(instance, "mandataire_nom", "") or "").strip()

        if not mandataire_nom:
            raise serializers.ValidationError(
                {"mandataire_nom": "Le nom du mandataire est obligatoire."}
            )

        return attrs

    def create(self, validated_data):
        obj = AGProcuration(**validated_data)
        obj.save()
        return obj

    def update(self, instance, validated_data):
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        return instance


class AgConvocationSerializer(serializers.ModelSerializer):
    ag_titre = serializers.CharField(source="ag.titre", read_only=True)
    ag_date_ag = serializers.DateTimeField(source="ag.date_ag", read_only=True)
    copropriete_label = serializers.SerializerMethodField(read_only=True)
    coproprietaire_label = serializers.SerializerMethodField(read_only=True)
    lot_reference = serializers.CharField(source="lot.reference", read_only=True)
    lot_numero = serializers.CharField(source="lot.numero", read_only=True)
    lot_label = serializers.SerializerMethodField(read_only=True)
    document_url = serializers.SerializerMethodField(read_only=True)
    document_reference = serializers.CharField(source="document.reference", read_only=True)
    document_title = serializers.CharField(source="document.title", read_only=True)
    statut_label = serializers.CharField(source="get_statut_display", read_only=True)
    canal_label = serializers.CharField(source="get_canal_display", read_only=True)
    generated_by_label = serializers.SerializerMethodField(read_only=True)
    sent_by_label = serializers.SerializerMethodField(read_only=True)
    cancelled_by_label = serializers.SerializerMethodField(read_only=True)
    parent_reference = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = AgConvocation
        fields = [
            "id",
            "reference",
            "parent_convocation",
            "parent_reference",
            "version",
            "is_rectificative",
            "motif_rectification",
            "ag",
            "ag_titre",
            "ag_date_ag",
            "copropriete",
            "copropriete_label",
            "coproprietaire",
            "coproprietaire_label",
            "lot",
            "lot_reference",
            "lot_numero",
            "lot_label",
            "document",
            "document_url",
            "document_reference",
            "document_title",
            "statut",
            "statut_label",
            "canal",
            "canal_label",
            "objet",
            "message",
            "generated_at",
            "generated_by",
            "generated_by_label",
            "sent_at",
            "sent_by",
            "sent_by_label",
            "consulted_at",
            "cancelled_at",
            "cancelled_by",
            "cancelled_by_label",
            "cancellation_reason",
            "metadata",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "reference",
            "ag_titre",
            "ag_date_ag",
            "copropriete",
            "copropriete_label",
            "coproprietaire_label",
            "lot_reference",
            "lot_numero",
            "lot_label",
            "document_url",
            "document_reference",
            "document_title",
            "statut_label",
            "canal_label",
            "generated_at",
            "generated_by",
            "generated_by_label",
            "sent_at",
            "sent_by",
            "sent_by_label",
            "consulted_at",
            "cancelled_at",
            "cancelled_by",
            "cancelled_by_label",
            "created_at",
            "updated_at",
        ]

    def get_copropriete_label(self, obj):
        copropriete = getattr(obj, "copropriete", None)
        if not copropriete:
            return ""

        return (
            getattr(copropriete, "nom", "")
            or getattr(copropriete, "name", "")
            or getattr(copropriete, "libelle", "")
            or str(copropriete)
        )

    def get_coproprietaire_label(self, obj):
        owner = getattr(obj, "coproprietaire", None)
        if not owner:
            return ""
        return getattr(owner, "display_name", "") or str(owner)

    def get_lot_label(self, obj):
        lot = getattr(obj, "lot", None)
        if not lot:
            return ""

        return (
            getattr(lot, "reference", "")
            or getattr(lot, "numero", "")
            or f"Lot #{getattr(lot, 'id', '')}"
        )

    def get_document_url(self, obj):
        document = getattr(obj, "document", None)
        if not document:
            return None

        for field_name in ("file", "fichier", "document_pdf", "pdf", "pdf_file"):
            file_obj = getattr(document, field_name, None)
            if not file_obj:
                continue

            try:
                url = file_obj.url
            except Exception:
                continue

            request = self.context.get("request")
            if request is not None and isinstance(url, str) and url.startswith("/"):
                return request.build_absolute_uri(url)

            return url

        return None

    def _user_label(self, user):
        if not user:
            return ""

        full_name = ""
        try:
            full_name = user.get_full_name()
        except Exception:
            full_name = ""

        return full_name or getattr(user, "username", "") or getattr(user, "email", "") or str(user)

    def get_generated_by_label(self, obj):
        return self._user_label(getattr(obj, "generated_by", None))

    def get_sent_by_label(self, obj):
        return self._user_label(getattr(obj, "sent_by", None))

    def get_cancelled_by_label(self, obj):
        return self._user_label(getattr(obj, "cancelled_by", None))

    def get_parent_reference(self, obj):
        parent = getattr(obj, "parent_convocation", None)

        if not parent:
            return ""

        return getattr(parent, "reference", "") or f"Convocation #{getattr(parent, 'id', '')}"

    def validate(self, attrs):
        instance = getattr(self, "instance", None)

        if instance and getattr(instance, "statut", None) in {"ENVOYEE", "CONSULTEE", "ANNULEE"}:
            raise serializers.ValidationError(
                "Une convocation envoyée, consultée ou annulée ne peut plus être modifiée."
            )

        ag = attrs.get("ag") or (instance.ag if instance else None)
        lot = attrs.get("lot") or (instance.lot if instance else None)
        coproprietaire = attrs.get("coproprietaire") or (
            instance.coproprietaire if instance else None
        )

        if not ag:
            raise serializers.ValidationError({"ag": "L’assemblée générale est obligatoire."})

        if not lot:
            raise serializers.ValidationError({"lot": "Le lot est obligatoire."})

        if not coproprietaire:
            raise serializers.ValidationError(
                {"coproprietaire": "Le copropriétaire est obligatoire."}
            )

        if _is_ag_closed(ag) or _is_ag_locked(ag):
            raise serializers.ValidationError(
                {"ag": "AG clôturée ou PV verrouillé : convocation interdite."}
            )

        if str(getattr(lot, "copropriete_id", "")) != str(getattr(ag, "copropriete_id", "")):
            raise serializers.ValidationError(
                {"lot": "Le lot convoqué doit appartenir à la même copropriété que l’AG."}
            )

        if str(getattr(coproprietaire, "copropriete_id", "")) != str(getattr(ag, "copropriete_id", "")):
            raise serializers.ValidationError(
                {
                    "coproprietaire": (
                        "Le copropriétaire convoqué doit appartenir à la même copropriété "
                        "que l’AG."
                    )
                }
            )

        try:
            from apps.owners.models import ProprietaireLot

            has_active_link = ProprietaireLot.objects.filter(
                copropriete_id=ag.copropriete_id,
                coproprietaire=coproprietaire,
                lot=lot,
                date_fin__isnull=True,
            ).exists()
        except Exception:
            has_active_link = True

        if not has_active_link:
            raise serializers.ValidationError(
                {
                    "lot": (
                        "Ce lot n’est pas rattaché activement au copropriétaire "
                        "sélectionné."
                    )
                }
            )

        existing = AgConvocation.objects.filter(ag=ag, lot=lot)
        if instance and instance.pk:
            existing = existing.exclude(pk=instance.pk)

        if existing.exists():
            raise serializers.ValidationError(
                {"lot": "Une convocation existe déjà pour ce lot et cette AG."}
            )

        return attrs

    def create(self, validated_data):
        obj = AgConvocation(**validated_data)
        obj.save()
        return obj

    def update(self, instance, validated_data):
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        return instance


class ResolutionSerializer(serializers.ModelSerializer):
    travaux_dossier_id = serializers.IntegerField(source="travaux_dossier.id", read_only=True)
    travaux_dossier_titre = serializers.CharField(source="travaux_dossier.titre", read_only=True)
    tantieme_categorie_effective = serializers.SerializerMethodField(read_only=True)

    decision = serializers.SerializerMethodField(read_only=True)
    statut_resolution = serializers.SerializerMethodField(read_only=True)
    resultat_detail = serializers.SerializerMethodField(read_only=True)

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
            "decision",
            "statut_resolution",
            "resultat_detail",
        ]
        read_only_fields = [
            "id",
            "decision",
            "statut_resolution",
            "resultat_detail",
        ]

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

    def _build_resolution_result(self, obj):
        try:
            return compute_resolution_result(obj)
        except Exception:
            return None

    def get_decision(self, obj):
        result = self._build_resolution_result(obj)

        if isinstance(result, dict):
            decision = str(result.get("decision", "")).strip().upper()
            if decision in {"ADOPTEE", "REJETEE"}:
                return decision

        return "EN_ATTENTE"

    def get_statut_resolution(self, obj):
        return self.get_decision(obj)

    def get_resultat_detail(self, obj):
        result = self._build_resolution_result(obj)

        if not isinstance(result, dict):
            return {
                "decision": "EN_ATTENTE",
                "type_majorite": getattr(obj, "type_majorite", None),
                "tantiemes": {
                    "pour": 0.0,
                    "contre": 0.0,
                    "abstention": 0.0,
                    "exprimes": 0.0,
                    "ratio_pour_exprimes": 0.0,
                },
            }

        tantiemes = result.get("tantiemes") if isinstance(result.get("tantiemes"), dict) else {}

        return {
            "decision": str(result.get("decision", "EN_ATTENTE")).strip().upper() or "EN_ATTENTE",
            "type_majorite": result.get("type_majorite") or getattr(obj, "type_majorite", None),
            "tantiemes": {
                "pour": float(tantiemes.get("pour", 0.0) or 0.0),
                "contre": float(tantiemes.get("contre", 0.0) or 0.0),
                "abstention": float(tantiemes.get("abstention", 0.0) or 0.0),
                "exprimes": float(tantiemes.get("exprimes", 0.0) or 0.0),
                "ratio_pour_exprimes": float(tantiemes.get("ratio_pour_exprimes", 0.0) or 0.0),
            },
        }

    def validate(self, attrs):
        instance = getattr(self, "instance", None)

        ag = attrs.get("ag") or (instance.ag if instance else None)
        if ag:
            _assert_resolution_writable(ag, what="création/modification des résolutions")

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
    is_zero_tantieme = serializers.SerializerMethodField(read_only=True)

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
            "is_zero_tantieme",
            "created_at",
        ]
        read_only_fields = [
            "tantiemes",
            "tantiemes_recalcules",
            "tantieme_categorie_effective",
            "is_zero_tantieme",
            "created_at",
        ]

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

    def get_is_zero_tantieme(self, obj):
        try:
            return Decimal(str(obj.tantiemes or 0)) <= 0
        except Exception:
            return True

    def validate(self, attrs):
        instance = getattr(self, "instance", None)

        resolution = attrs.get("resolution") or (instance.resolution if instance else None)
        lot = attrs.get("lot") or (instance.lot if instance else None)

        if resolution:
            if getattr(resolution, "cloturee", False):
                raise serializers.ValidationError({"resolution": "Cette résolution est clôturée. Aucun vote accepté."})

            ag = getattr(resolution, "ag", None)
            if ag:
                _assert_ag_open_and_writable(ag, what="création d’un vote")

        if resolution and lot:
            ag = getattr(resolution, "ag", None)

            if ag and str(getattr(lot, "copropriete_id", "")) != str(getattr(ag, "copropriete_id", "")):
                raise serializers.ValidationError({"lot": "Le lot doit appartenir à la copropriété de l'AG."})

            presence_ok = PresenceLot.objects.filter(
                ag_id=resolution.ag_id,
                lot_id=lot.id,
                present_ou_represente=True,
            ).exists()
            if not presence_ok:
                raise serializers.ValidationError(
                    {"lot": "Ce lot doit être présent ou représenté pour voter à cette AG."}
                )

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
        instance.save()
        return instance