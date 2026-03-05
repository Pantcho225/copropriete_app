# apps/compta/serializers.py
from __future__ import annotations

from datetime import date
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP

from django.apps import apps
from django.core.exceptions import FieldError
from django.db.models import ForeignKey, OneToOneField

from rest_framework import serializers

from .models import (
    CompteBancaire,
    MouvementBancaire,
    ReleveImport,
    ReleveLigne,
    RapprochementBancaire,
)

DEC_0 = Decimal("0.00")
DEC_2 = Decimal("0.01")


def _money2(d: Decimal) -> Decimal:
    return d.quantize(DEC_2, rounding=ROUND_HALF_UP)


def _require_copro_id(request) -> int:
    copro_id = request.headers.get("X-Copropriete-Id") if request else None
    if not copro_id:
        raise serializers.ValidationError({"detail": "En-tête X-Copropriete-Id requis."})
    try:
        return int(str(copro_id))
    except ValueError:
        raise serializers.ValidationError({"detail": "X-Copropriete-Id invalide (entier requis)."})


def _get_first_attr(obj, names: tuple[str, ...]):
    """
    Retourne la première valeur non-None parmi plusieurs attributs.
    Tolérant aux exceptions (RelatedObjectDoesNotExist, etc.).
    """
    if obj is None:
        return None
    for n in names:
        if not hasattr(obj, n):
            continue
        try:
            v = getattr(obj, n)
        except Exception:
            continue
        if v is not None:
            return v
    return None


# =========================================================
# ✅ PATCH: refuser rapprochement sur paiements annulés
# (PaiementAppel / PaiementTravaux) + robustesse conventions
# =========================================================
def _is_soft_cancelled_payment(obj) -> bool:
    """
    Détecte de façon robuste l'annulation soft-cancel, même si les champs diffèrent
    entre PaiementAppel / PaiementTravaux / futures évolutions.
    """
    if obj is None:
        return False

    # Convention probable (déjà présente côté rapprochement, et souvent sur paiements)
    v = getattr(obj, "is_cancelled", None)
    if v is True:
        return True

    # Champs timestamp d'annulation
    for attr in ("cancelled_at", "annule_at", "annulation_at", "date_annulation"):
        if getattr(obj, attr, None):
            return True

    # Booléens alternatifs
    for attr in ("annule", "is_annule", "cancelled"):
        if getattr(obj, attr, None) is True:
            return True

    # Statut
    statut = getattr(obj, "statut", None)
    if statut and str(statut).upper() in ("ANNULE", "ANNULÉ", "CANCELLED", "CANCELED"):
        return True

    return False


# =========================================================
# ✅ PATCH (HELPER AJOUTÉ) : mapping type_cible -> modèle + validations
# Objectif: faire des rapprochements "possibles" (robustes) sans imports fragiles
# =========================================================
def _normalize_type_cible(value) -> str:
    return (str(value) if value is not None else "").strip().upper()


def _resolve_target_model(type_cible: str):
    """
    Retourne (ModelClass, kind) ou (None, None) si inconnu.
    kind ∈ {"PAIEMENT_APPEL","PAIEMENT_TRAVAUX","MOUVEMENT"}
    """
    t = _normalize_type_cible(type_cible)

    # ⚠️ selon enum, tes valeurs peuvent être "MOUVEMENT_BANCAIRE" ou "MOUVEMENT"
    if t in ("MOUVEMENT", "MOUVEMENT_BANCAIRE"):
        return MouvementBancaire, "MOUVEMENT"

    if t == "PAIEMENT_APPEL":
        return _get_paiement_appel_model(), "PAIEMENT_APPEL"

    if t == "PAIEMENT_TRAVAUX":
        return _get_paiement_travaux_model(), "PAIEMENT_TRAVAUX"

    return None, None


def _validate_target_for_copro_and_cancel(*, kind: str, obj, copro_id: int):
    """
    ✅ Centralise les validations:
    - existence obj (déjà check ailleurs)
    - appartenance copro
    - non annulé (soft-cancel)
    """
    if obj is None:
        raise serializers.ValidationError({"cible_id": "Cible introuvable."})

    if kind == "PAIEMENT_APPEL":
        pa_cid = _paiement_appel_copro_id(obj, copro_hint=int(copro_id))
        if pa_cid is None:
            raise serializers.ValidationError(
                {"cible_id": "Impossible de vérifier la copropriété sur PaiementAppel (schema billing)."}
            )
        if int(pa_cid) != int(copro_id):
            raise serializers.ValidationError({"cible_id": "PaiementAppel hors copropriété."})
        if _is_soft_cancelled_payment(obj):
            raise serializers.ValidationError({"detail": "Rapprochement refusé : PaiementAppel annulé (soft-cancel)."})
        return

    if kind == "PAIEMENT_TRAVAUX":
        pt_cid = _paiement_travaux_copro_id(obj)
        if pt_cid is None:
            raise serializers.ValidationError({"cible_id": "Impossible de vérifier la copropriété sur PaiementTravaux."})
        if int(pt_cid) != int(copro_id):
            raise serializers.ValidationError({"cible_id": "PaiementTravaux hors copropriété."})
        if _is_soft_cancelled_payment(obj):
            raise serializers.ValidationError({"detail": "Rapprochement refusé : PaiementTravaux annulé (soft-cancel)."})
        return

    if kind == "MOUVEMENT":
        # scoping copro strict
        if int(getattr(obj, "copropriete_id", 0) or 0) != int(copro_id):
            raise serializers.ValidationError({"cible_id": "MouvementBancaire hors copropriété."})
        return

    raise serializers.ValidationError({"type_cible": "Type de cible non supporté."})


# =========================
# Résolution des modèles (évite imports fragiles)
# =========================
try:
    PaiementAppel = apps.get_model("billing_app", "PaiementAppel")
except Exception:
    PaiementAppel = None

try:
    PaiementTravaux = apps.get_model("travaux", "PaiementTravaux")
except Exception:
    PaiementTravaux = None


def _resolve_model(app_label: str, model_name: str):
    try:
        return apps.get_model(app_label, model_name)
    except Exception:
        return None


def _get_paiement_appel_model():
    global PaiementAppel
    if PaiementAppel is None:
        PaiementAppel = _resolve_model("billing_app", "PaiementAppel")
    return PaiementAppel


def _get_paiement_travaux_model():
    global PaiementTravaux
    if PaiementTravaux is None:
        PaiementTravaux = _resolve_model("travaux", "PaiementTravaux")
    return PaiementTravaux


# =========================
# Helpers robustes copro
# =========================
def _direct_copro_id(obj) -> int | None:
    """Tente de lire un copro_id direct sur un objet."""
    if obj is None:
        return None

    cid = getattr(obj, "copropriete_id", None)
    if cid is not None:
        try:
            return int(cid)
        except Exception:
            pass

    copro = getattr(obj, "copropriete", None)
    if copro is not None and getattr(copro, "id", None) is not None:
        try:
            return int(copro.id)
        except Exception:
            pass

    return None


def _paiement_travaux_copro_id(pt) -> int | None:
    """
    Copropriété PaiementTravaux robuste:
    - pt.copropriete_id si existe
    - sinon pt.dossier.copropriete_id (le plus fréquent)
    - sinon pt.dossier.copropriete.id
    """
    if pt is None:
        return None

    cid = getattr(pt, "copropriete_id", None)
    if cid is not None:
        try:
            return int(cid)
        except Exception:
            pass

    try:
        dossier = getattr(pt, "dossier", None)
    except Exception:
        dossier = None
    if dossier is None:
        return None

    cid = getattr(dossier, "copropriete_id", None)
    if cid is not None:
        try:
            return int(cid)
        except Exception:
            pass

    copro = getattr(dossier, "copropriete", None)
    if copro is not None and getattr(copro, "id", None) is not None:
        try:
            return int(copro.id)
        except Exception:
            pass

    return None


def _paiement_appel_copro_id(pa, *, copro_hint: int | None = None) -> int | None:
    """
    Diagnostic confirmé :
        PaiementAppel -> ligne (LigneAppelDeFonds) -> lot (Lot) -> copropriete_id
    """
    if pa is None:
        return None

    # 1) direct (si un jour tu ajoutes copropriete_id sur PaiementAppel)
    cid = _direct_copro_id(pa)
    if cid is not None:
        return cid

    # 2) récupérer la ligne
    try:
        ligne = getattr(pa, "ligne", None)
    except Exception:
        ligne = None
    if ligne is None:
        return None

    # 3) ✅ chemin confirmé : ligne.lot.copropriete_id
    try:
        lot = getattr(ligne, "lot", None)
        if lot is not None:
            cid = _direct_copro_id(lot)
            if cid is not None:
                return cid
    except Exception:
        pass

    # 4) fallback: si la ligne a copropriete direct
    cid = _direct_copro_id(ligne)
    if cid is not None:
        return cid

    # 5) fallback générique: scanner FK/OneToOne de la ligne
    try:
        fields = list(getattr(ligne._meta, "fields", []))
    except Exception:
        fields = []

    for f in fields:
        try:
            if not isinstance(f, (ForeignKey, OneToOneField)):
                continue
        except Exception:
            continue

        fname = getattr(f, "name", None)
        if not fname or fname in ("id",):
            continue

        try:
            parent = getattr(ligne, fname)
        except Exception:
            continue

        if parent is None:
            continue

        cid = _direct_copro_id(parent)
        if cid is not None:
            return cid

    # 6) fallback DB "exists" si on a un hint (optionnel)
    if copro_hint is None:
        return None

    pid = getattr(pa, "id", None) or getattr(pa, "pk", None)
    if not pid:
        return None

    PAModel = _get_paiement_appel_model()
    if PAModel is None:
        return None

    candidates = [
        {"id": pid, "copropriete_id": copro_hint},
        {"id": pid, "ligne__copropriete_id": copro_hint},
        {"id": pid, "ligne__lot__copropriete_id": copro_hint},  # ✅ chemin confirmé
        {"id": pid, "ligne__appel__copropriete_id": copro_hint},  # fallback historique
    ]

    for filt in candidates:
        try:
            if PAModel.objects.filter(**filt).exists():
                return int(copro_hint)
        except FieldError:
            continue
        except Exception:
            continue

    return None


def _paiement_montant(obj) -> Decimal:
    """
    Rend robuste la lecture du montant sur différentes structures de modèles.
    On essaie plusieurs noms courants, sinon 0.
    """
    v = _get_first_attr(
        obj,
        (
            "montant",
            "amount",
            "montant_paye",
            "montant_total",
            "montant_regle",
            "total",
        ),
    )
    if v is None:
        return DEC_0
    try:
        return _money2(Decimal(str(v)))
    except Exception:
        return DEC_0


# =========================================================
# ✅ HELPERS UX/API : exposer la source de rapprochement d’un Mouvement
# Objectif frontend : pouvoir afficher un bouton "Annuler" seulement si rapproché
# et afficher (releve_ligne_id / rapprochement_id) pour aller annuler côté /releves/lignes/<id>/annuler/
# Sans changer les modèles.
# =========================================================
def _get_active_rapprochement_for_mouvement(obj: MouvementBancaire) -> RapprochementBancaire | None:
    """
    Cherche un rapprochement actif (non annulé) dont la cible est ce mouvement bancaire.
    ⚠️ Si tu optimises plus tard, tu peux annoter/prefetch en viewset et attacher
    un attribut _active_rapprochement au mouvement.
    """
    if obj is None or getattr(obj, "id", None) is None:
        return None

    # optimisation: si la view a déjà attaché la donnée
    cached = getattr(obj, "_active_rapprochement", None)
    if cached is not None:
        return cached

    try:
        qs = RapprochementBancaire.objects.filter(
            copropriete_id=getattr(obj, "copropriete_id", None),
            is_cancelled=False,
            cible_id=int(obj.id),
        )
        # type_cible peut être "MOUVEMENT" ou "MOUVEMENT_BANCAIRE" selon l’enum
        try:
            qs = qs.filter(type_cible__in=("MOUVEMENT", "MOUVEMENT_BANCAIRE"))
        except Exception:
            # si l’enum ne supporte pas une des valeurs
            qs = qs.filter(type_cible="MOUVEMENT")
        return qs.select_related("releve_ligne").order_by("-rapproche_at", "-id").first()
    except Exception:
        return None


# =========================
# Serializers
# =========================
class CompteBancaireSerializer(serializers.ModelSerializer):
    copropriete = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = CompteBancaire
        fields = [
            "id",
            "copropriete",
            "nom",
            "banque",
            "iban",
            "rib",
            "devise",
            "solde_initial",
            "is_active",
            "is_default",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "copropriete", "created_at", "updated_at"]

    def validate_nom(self, value: str) -> str:
        value = (value or "").strip()
        if not value:
            raise serializers.ValidationError("Le nom est requis.")
        return value

    def validate_banque(self, value: str) -> str:
        return (value or "").strip()

    def validate_iban(self, value: str) -> str:
        return (value or "").strip()

    def validate_rib(self, value: str) -> str:
        return (value or "").strip()

    def validate_solde_initial(self, value):
        if value is None:
            return DEC_0
        try:
            d = Decimal(str(value))
        except (InvalidOperation, TypeError):
            raise serializers.ValidationError("Format invalide.")
        if d < DEC_0:
            raise serializers.ValidationError("Doit être >= 0.")
        return _money2(d)

    def validate_is_default(self, value):
        return bool(value)

    def validate(self, attrs):
        request = self.context.get("request")
        copro_id = _require_copro_id(request)

        instance: CompteBancaire | None = getattr(self, "instance", None)
        is_default = attrs.get("is_default", getattr(instance, "is_default", False))

        if is_default:
            qs = CompteBancaire.objects.filter(copropriete_id=copro_id, is_default=True)
            if instance and instance.pk:
                qs = qs.exclude(pk=instance.pk)
            if qs.exists():
                raise serializers.ValidationError(
                    {"is_default": "Un compte bancaire par défaut existe déjà pour cette copropriété."}
                )
        return attrs

    def create(self, validated_data):
        request = self.context.get("request")
        copro_id = _require_copro_id(request)
        validated_data["copropriete_id"] = int(copro_id)
        return super().create(validated_data)

    def update(self, instance, validated_data):
        validated_data.pop("copropriete", None)
        validated_data.pop("copropriete_id", None)
        return super().update(instance, validated_data)


class MouvementBancaireSerializer(serializers.ModelSerializer):
    copropriete = serializers.PrimaryKeyRelatedField(read_only=True)
    created_by = serializers.PrimaryKeyRelatedField(read_only=True)
    is_rapproche = serializers.BooleanField(read_only=True)

    # ✅ nouveaux champs utiles frontend (annulation / debug)
    rapprochement_id = serializers.SerializerMethodField()
    releve_ligne_id = serializers.SerializerMethodField()
    releve_import_id = serializers.SerializerMethodField()

    class Meta:
        model = MouvementBancaire
        fields = [
            "id",
            "copropriete",
            "compte",
            "sens",
            "montant",
            "date_operation",
            "reference",
            "libelle",
            "note",
            "paiement_travaux",
            "paiement_appel",
            "is_rapproche",
            "created_by",
            "created_at",
            # ✅ extras
            "rapprochement_id",
            "releve_ligne_id",
            "releve_import_id",
        ]
        read_only_fields = [
            "id",
            "copropriete",
            "is_rapproche",
            "created_by",
            "created_at",
            "rapprochement_id",
            "releve_ligne_id",
            "releve_import_id",
        ]

    def get_rapprochement_id(self, obj: MouvementBancaire):
        rap = _get_active_rapprochement_for_mouvement(obj)
        return getattr(rap, "id", None) if rap else None

    def get_releve_ligne_id(self, obj: MouvementBancaire):
        rap = _get_active_rapprochement_for_mouvement(obj)
        return getattr(getattr(rap, "releve_ligne", None), "id", None) if rap else None

    def get_releve_import_id(self, obj: MouvementBancaire):
        rap = _get_active_rapprochement_for_mouvement(obj)
        if not rap:
            return None
        rl = getattr(rap, "releve_ligne", None)
        ri = getattr(rl, "releve_import", None) if rl else None
        return getattr(ri, "id", None) if ri else None

    def validate_montant(self, value):
        try:
            d = Decimal(str(value))
        except (InvalidOperation, TypeError):
            raise serializers.ValidationError("Format invalide.")
        d = _money2(d)
        if d <= DEC_0:
            raise serializers.ValidationError("Doit être > 0.")
        return d

    def validate_reference(self, value: str) -> str:
        return (value or "").strip()

    def validate_libelle(self, value: str) -> str:
        value = (value or "").strip()
        if not value:
            raise serializers.ValidationError("Le libellé est requis.")
        return value

    def validate_note(self, value: str) -> str:
        return (value or "").strip()

    def validate_date_operation(self, value: date):
        if value and value > date.today():
            raise serializers.ValidationError("La date d'opération ne peut pas être dans le futur.")
        return value

    def validate(self, attrs):
        request = self.context.get("request")
        copro_id = _require_copro_id(request)

        instance: MouvementBancaire | None = getattr(self, "instance", None)
        compte = attrs.get("compte") or getattr(instance, "compte", None)

        if compte and int(compte.copropriete_id) != int(copro_id):
            raise serializers.ValidationError({"compte": "Compte hors copropriété."})

        pt = (
            attrs.get("paiement_travaux")
            if "paiement_travaux" in attrs
            else getattr(instance, "paiement_travaux", None)
        )
        pa = (
            attrs.get("paiement_appel")
            if "paiement_appel" in attrs
            else getattr(instance, "paiement_appel", None)
        )

        if pt and pa:
            raise serializers.ValidationError({"detail": "Rapprochement exclusif : travaux OU appel, pas les deux."})

        if pt:
            pt_cid = _paiement_travaux_copro_id(pt)
            if pt_cid is None:
                raise serializers.ValidationError(
                    {"paiement_travaux": "Impossible de vérifier la copropriété sur PaiementTravaux."}
                )
            if int(pt_cid) != int(copro_id):
                raise serializers.ValidationError({"paiement_travaux": "PaiementTravaux hors copropriété."})

            # ✅ PATCH: refuser usage d'un paiement annulé
            if _is_soft_cancelled_payment(pt):
                raise serializers.ValidationError({"paiement_travaux": "PaiementTravaux annulé (soft-cancel)."})

        if pa:
            pa_cid = _paiement_appel_copro_id(pa, copro_hint=int(copro_id))
            if pa_cid is None:
                raise serializers.ValidationError(
                    {"paiement_appel": "Impossible de vérifier la copropriété sur PaiementAppel (schema billing)."}
                )
            if int(pa_cid) != int(copro_id):
                raise serializers.ValidationError({"paiement_appel": "PaiementAppel hors copropriété."})

            # ✅ PATCH: refuser usage d'un paiement annulé
            if _is_soft_cancelled_payment(pa):
                raise serializers.ValidationError({"paiement_appel": "PaiementAppel annulé (soft-cancel)."})

        return attrs

    def create(self, validated_data):
        request = self.context.get("request")
        copro_id = _require_copro_id(request)

        validated_data["copropriete_id"] = int(copro_id)
        if getattr(request.user, "is_authenticated", False):
            validated_data["created_by"] = request.user

        return super().create(validated_data)

    def update(self, instance, validated_data):
        validated_data.pop("copropriete", None)
        validated_data.pop("copropriete_id", None)
        return super().update(instance, validated_data)


class RapprochementBancaireSerializer(serializers.ModelSerializer):
    class Meta:
        model = RapprochementBancaire
        fields = [
            "id",
            "copropriete",
            "releve_ligne",
            "type_cible",
            "cible_id",
            "montant",
            "date_operation",
            "note",
            "rapproche_par",
            "rapproche_at",
            "is_cancelled",
            "cancelled_at",
            "cancelled_by",
            "cancelled_reason",
            # ✅ audit retarget
            "retarget_count",
            "previous_type_cible",
            "previous_cible_id",
            "retargeted_at",
            "retargeted_by",
            "retarget_reason",
        ]
        read_only_fields = fields


class ReleveLigneSerializer(serializers.ModelSerializer):
    rapprochement = serializers.SerializerMethodField()

    class Meta:
        model = ReleveLigne
        fields = [
            "id",
            "releve_import",
            "copropriete",
            "statut",
            "date_operation",
            "date_valeur",
            "libelle",
            "reference",
            "sens",
            "montant",
            "solde",
            "hash_unique",
            "raw",
            "rapprochement",
            "created_at",
        ]
        read_only_fields = fields

    def get_rapprochement(self, obj: ReleveLigne):
        rap = getattr(obj, "rapprochement", None)
        if not rap:
            return None
        if getattr(rap, "is_cancelled", False):
            return None
        return RapprochementBancaireSerializer(rap).data


class ReleveImportListSerializer(serializers.ModelSerializer):
    copropriete = serializers.PrimaryKeyRelatedField(read_only=True)
    created_by = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = ReleveImport
        fields = [
            "id",
            "copropriete",
            "fichier",
            "fichier_nom",
            "hash_unique",
            "encoding",
            "delimiter",
            "nb_lignes",
            "nb_crees",
            "nb_ignores",
            "created_by",
            "created_at",
        ]
        read_only_fields = fields


class ReleveImportDetailSerializer(ReleveImportListSerializer):
    lignes = ReleveLigneSerializer(many=True, read_only=True)

    class Meta(ReleveImportListSerializer.Meta):
        fields = ReleveImportListSerializer.Meta.fields + ["lignes"]
        read_only_fields = fields


class RapprochementCreateSerializer(serializers.Serializer):
    type_cible = serializers.ChoiceField(choices=RapprochementBancaire.TypeCible.choices)
    cible_id = serializers.IntegerField(min_value=1)
    note = serializers.CharField(required=False, allow_blank=True, max_length=300)
    strict_amount = serializers.BooleanField(required=False, default=True)

    # ✅ retarget
    allow_retarget = serializers.BooleanField(required=False, default=False)
    retarget_reason = serializers.CharField(required=False, allow_blank=True, max_length=300, default="")

    def validate(self, attrs):
        request = self.context.get("request")
        copro_id = _require_copro_id(request)

        releve_ligne: ReleveLigne = self.context.get("releve_ligne")
        if releve_ligne is None:
            raise serializers.ValidationError({"detail": "Contexte releve_ligne manquant."})

        rl_copro = getattr(releve_ligne, "copropriete_id", None) or releve_ligne.releve_import.copropriete_id
        if int(rl_copro) != int(copro_id):
            raise serializers.ValidationError({"detail": "Ligne de relevé hors copropriété."})

        if releve_ligne.statut == ReleveLigne.Statut.IGNORE:
            raise serializers.ValidationError({"detail": "Cette ligne est ignorée. Impossible de rapprocher."})

        rap = getattr(releve_ligne, "rapprochement", None)
        allow_retarget = bool(attrs.get("allow_retarget", False))

        # si déjà rapprochée et allow_retarget=False => refuse
        if rap and not getattr(rap, "is_cancelled", False) and not allow_retarget:
            raise serializers.ValidationError({"detail": "Cette ligne est déjà rapprochée."})

        strict_amount = bool(attrs.get("strict_amount", True))

        # normalisation textes
        attrs["note"] = (attrs.get("note") or "").strip()
        attrs["retarget_reason"] = (attrs.get("retarget_reason") or "").strip()

        if releve_ligne.montant is None:
            raise serializers.ValidationError({"detail": "Montant de la ligne de relevé manquant."})

        try:
            montant_ligne = _money2(Decimal(str(releve_ligne.montant)))
        except Exception:
            raise serializers.ValidationError({"detail": "Montant de la ligne de relevé invalide."})

        # =========================================================
        # ✅ résolution cible + validations communes
        # =========================================================
        t_raw = attrs["type_cible"]
        cible_id = int(attrs["cible_id"])
        Model, kind = _resolve_target_model(t_raw)
        if Model is None:
            raise serializers.ValidationError({"type_cible": "Type de cible non supporté par ce serializer."})

        # MOUVEMENT: scoping copro direct; Paiements: scoping via helpers robustes
        if kind == "MOUVEMENT":
            cible = Model.objects.filter(id=cible_id, copropriete_id=copro_id).first()
        else:
            cible = Model.objects.filter(id=cible_id).first()

        _validate_target_for_copro_and_cancel(kind=kind, obj=cible, copro_id=int(copro_id))

        # montant cible
        if kind == "MOUVEMENT":
            try:
                montant_cible = _money2(Decimal(str(getattr(cible, "montant", 0))))
            except Exception:
                raise serializers.ValidationError({"detail": "Montant du mouvement bancaire invalide."})
        else:
            montant_cible = _paiement_montant(cible)

        if strict_amount and (montant_cible != montant_ligne):
            raise serializers.ValidationError(
                {"detail": f"Montant différent. Relevé={montant_ligne} vs Cible={montant_cible}."}
            )

        # reason requis si retarget
        if rap and not getattr(rap, "is_cancelled", False) and allow_retarget:
            reason = (attrs.get("retarget_reason") or attrs.get("note") or "").strip()
            if not reason:
                raise serializers.ValidationError(
                    {"retarget_reason": "Raison obligatoire pour corriger un rapprochement existant (allow_retarget=true)."}
                )

        return attrs

    def create(self, validated_data):
        request = self.context.get("request")
        releve_ligne: ReleveLigne = self.context["releve_ligne"]

        allow_retarget = bool(validated_data.get("allow_retarget", False))
        retarget_reason = (validated_data.get("retarget_reason") or "").strip()
        note = (validated_data.get("note") or "").strip()

        # ✅ si rapprochement actif existe et allow_retarget => retarget_to
        rap_exist = getattr(releve_ligne, "rapprochement", None)
        if rap_exist and not getattr(rap_exist, "is_cancelled", False) and allow_retarget:
            reason = (retarget_reason or note).strip()

            # ✅ refuse retarget vers une cible soft-cancelled
            Model, kind = _resolve_target_model(validated_data["type_cible"])
            if Model is not None and kind in ("PAIEMENT_APPEL", "PAIEMENT_TRAVAUX"):
                cible = Model.objects.filter(id=int(validated_data["cible_id"])).first()
                if _is_soft_cancelled_payment(cible):
                    raise serializers.ValidationError({"detail": "Retarget refusé : cible annulée (soft-cancel)."})

            rap = rap_exist.retarget_to(
                type_cible=validated_data["type_cible"],
                cible_id=int(validated_data["cible_id"]),
                user=request.user,
                reason=reason,
                note=note,
            )
            return rap

        rap = RapprochementBancaire.create_from_line(
            releve_ligne=releve_ligne,
            type_cible=validated_data["type_cible"],
            cible_id=int(validated_data["cible_id"]),
            user=request.user,
            note=note,
            strict_amount=bool(validated_data.get("strict_amount", True)),
            allow_retarget=allow_retarget,
            retarget_reason=retarget_reason,
        )
        return rap

    def to_representation(self, instance: RapprochementBancaire):
        return RapprochementBancaireSerializer(instance).data