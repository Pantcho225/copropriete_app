# apps/travaux/serializers.py
from __future__ import annotations

from datetime import date
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP

from django.db import transaction
from django.db.models import Sum
from rest_framework import serializers

from .models import Fournisseur, DossierTravaux, PaiementTravaux


DEC_0 = Decimal("0.00")
DEC_2 = Decimal("0.01")


def _to_decimal(value, field_name: str) -> Decimal:
    """
    Convertit value en Decimal de manière robuste (str, int, float, Decimal).
    """
    if value is None or value == "":
        raise serializers.ValidationError({field_name: "Champ requis."})
    try:
        return Decimal(str(value))
    except (InvalidOperation, TypeError):
        raise serializers.ValidationError({field_name: "Format invalide. Exemple: 1400000.00"})


def _money2(d: Decimal) -> Decimal:
    """
    Arrondi monétaire 2 décimales (ROUND_HALF_UP).
    """
    return d.quantize(DEC_2, rounding=ROUND_HALF_UP)


def _require_copro_id_from_request(request) -> int:
    if request is None:
        raise serializers.ValidationError({"detail": "Contexte request manquant."})
    copro_id = request.headers.get("X-Copropriete-Id")
    if not copro_id:
        raise serializers.ValidationError({"detail": "En-tête X-Copropriete-Id requis."})
    try:
        return int(str(copro_id))
    except ValueError:
        raise serializers.ValidationError({"detail": "X-Copropriete-Id invalide (entier requis)."})


def _budget_reference_decimal(dossier: DossierTravaux) -> Decimal:
    """
    Budget plafond utilisé par les paiements : dossier.budget_reference() si dispo,
    sinon budget_vote, sinon budget_estime, sinon 0.
    """
    try:
        b = dossier.budget_reference()
        return _money2(Decimal(str(b)))
    except Exception:
        fallback = dossier.budget_vote if dossier.budget_vote is not None else (dossier.budget_estime or DEC_0)
        return _money2(Decimal(str(fallback)))


# =========================================================
# Fournisseur
# =========================================================
class FournisseurSerializer(serializers.ModelSerializer):
    # ✅ affichage en lecture, alimentation via perform_create côté viewset
    copropriete = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = Fournisseur
        fields = [
            "id",
            "copropriete",
            "nom",
            "email",
            "telephone",
            "adresse",
            "identifiant",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "copropriete", "created_at", "updated_at"]

    def validate_nom(self, value: str) -> str:
        value = (value or "").strip()
        if not value:
            raise serializers.ValidationError("Le nom est requis.")
        return value

    def validate_email(self, value: str) -> str:
        return (value or "").strip()

    def validate_telephone(self, value: str) -> str:
        return (value or "").strip()

    def validate_adresse(self, value: str) -> str:
        return (value or "").strip()

    def validate_identifiant(self, value: str) -> str:
        return (value or "").strip()


# =========================================================
# DossierTravaux
# =========================================================
class DossierTravauxSerializer(serializers.ModelSerializer):
    copropriete = serializers.PrimaryKeyRelatedField(read_only=True)
    locked_by = serializers.PrimaryKeyRelatedField(read_only=True)
    is_locked = serializers.BooleanField(read_only=True)

    # ✅ Django crée automatiquement l’attribut *_id sur les relations
    resolution_validation_id = serializers.IntegerField(read_only=True)

    # ✅ Optionnel (lecture seulement) : pratique pour debug/admin
    resolution_validation = serializers.PrimaryKeyRelatedField(read_only=True)

    # ✅ Phase 3 (lecture): agrégats paiements + budget référence
    budget_reference = serializers.SerializerMethodField(read_only=True)
    total_paye = serializers.SerializerMethodField(read_only=True)
    reste_a_payer = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = DossierTravaux
        fields = [
            "id",
            "copropriete",
            "titre",
            "description",
            "statut",
            "budget_estime",
            "budget_vote",
            "budget_reference",
            "total_paye",
            "reste_a_payer",
            "resolution_validation",
            "resolution_validation_id",
            "locked_at",
            "locked_by",
            "is_locked",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "copropriete",
            "budget_vote",              # ✅ voté via AG (validate-ag)
            "budget_reference",
            "total_paye",
            "reste_a_payer",
            "resolution_validation",
            "resolution_validation_id",
            "locked_at",
            "locked_by",
            "is_locked",
            "created_at",
            "updated_at",
        ]

    # ---------- computed fields ----------
    def get_budget_reference(self, obj: DossierTravaux):
        try:
            return str(obj.budget_reference())
        except Exception:
            return str(obj.budget_vote if obj.budget_vote is not None else obj.budget_estime or DEC_0)

    def get_total_paye(self, obj: DossierTravaux):
        try:
            return str(obj.total_paye())
        except Exception:
            return str(DEC_0)

    def get_reste_a_payer(self, obj: DossierTravaux):
        try:
            return str(obj.reste_a_payer())
        except Exception:
            return str(DEC_0)

    # ---------- field validations ----------
    def validate_titre(self, value: str) -> str:
        value = (value or "").strip()
        if not value:
            raise serializers.ValidationError("Le titre est requis.")
        return value

    def validate_description(self, value: str) -> str:
        return (value or "").strip()

    def validate_budget_estime(self, value):
        # ✅ important : accepte None (si modèle nullable)
        if value is None or value == "":
            return None
        d = _to_decimal(value, "budget_estime")
        if d < DEC_0:
            raise serializers.ValidationError("Doit être >= 0.")
        return _money2(d)

    def validate_budget_vote(self, value):
        # Normalement read-only, mais on garde une validation si jamais le champ arrive.
        if value is None or value == "":
            return None
        d = _to_decimal(value, "budget_vote")
        if d < DEC_0:
            raise serializers.ValidationError("Doit être >= 0.")
        return _money2(d)

    def validate(self, attrs):
        """
        Politique:
        - si dossier verrouillé => aucune modification
        - statut ne se change pas via PUT/PATCH (submit-ag / validate-ag uniquement)
        - budget_vote ne se set pas via update standard
        - budget_vote <= budget_estime (cohérence globale)
        - budget_estime ne se modifie plus après SOUMIS_AG/VALIDE
        """
        instance: DossierTravaux | None = getattr(self, "instance", None)

        # ✅ blocage total si verrouillé
        if instance and instance.is_locked and attrs:
            raise serializers.ValidationError("Dossier verrouillé : modification interdite.")

        # ✅ statut contrôlé par endpoints dédiés
        if instance and "statut" in attrs and attrs["statut"] != instance.statut:
            raise serializers.ValidationError(
                {"statut": "Modification du statut via endpoint dédié uniquement (submit-ag/validate-ag)."}
            )
        if not instance and "statut" in attrs and attrs["statut"] != DossierTravaux.Statut.BROUILLON:
            raise serializers.ValidationError({"statut": "À la création, le statut doit être BROUILLON."})

        # ✅ option prod-safe : ne plus toucher budget_estime après soumission
        if instance and "budget_estime" in attrs and attrs["budget_estime"] != instance.budget_estime:
            if instance.statut in (DossierTravaux.Statut.SOUMIS_AG, DossierTravaux.Statut.VALIDE):
                raise serializers.ValidationError(
                    {"budget_estime": "Modification interdite après soumission à l’AG (SOUMIS_AG/VALIDE)."}
                )

        # ✅ empêcher budget_vote “manuellement”
        if "budget_vote" in attrs:
            if not instance:
                raise serializers.ValidationError({"budget_vote": "Budget voté uniquement via validation AG."})
            if instance.statut in (DossierTravaux.Statut.BROUILLON, DossierTravaux.Statut.SOUMIS_AG):
                raise serializers.ValidationError({"budget_vote": "Budget voté uniquement via validation AG."})

        # ✅ règle budget_vote <= budget_estime (sur valeurs finales)
        budget_estime = attrs.get("budget_estime", getattr(instance, "budget_estime", None))
        budget_vote = attrs.get("budget_vote", getattr(instance, "budget_vote", None))

        if budget_estime is not None and budget_vote is not None:
            try:
                be = Decimal(str(budget_estime))
                bv = Decimal(str(budget_vote))
            except (InvalidOperation, TypeError):
                raise serializers.ValidationError({"budget_vote": "Format invalide."})
            if bv > be:
                raise serializers.ValidationError({"budget_vote": "Ne peut pas dépasser budget_estime."})

        return attrs


# =========================================================
# Unlock payload (pour POST /dossiers/<id>/unlock/)
# =========================================================
class DossierUnlockSerializer(serializers.Serializer):
    raison = serializers.CharField(min_length=10, max_length=2000)


# =========================================================
# PaiementTravaux
# =========================================================
class PaiementTravauxSerializer(serializers.ModelSerializer):
    copropriete = serializers.PrimaryKeyRelatedField(read_only=True)
    created_by = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = PaiementTravaux
        fields = [
            "id",
            "copropriete",
            "dossier",
            "fournisseur",
            "montant",
            "date_paiement",
            "reference",
            "note",
            "created_by",
            "created_at",
        ]
        read_only_fields = ["id", "copropriete", "created_by", "created_at"]

    def validate_montant(self, value):
        d = _to_decimal(value, "montant")
        d = _money2(d)
        if d <= DEC_0:
            raise serializers.ValidationError("Doit être > 0.")
        return d

    def validate_reference(self, value: str) -> str:
        return (value or "").strip()

    def validate_note(self, value: str) -> str:
        return (value or "").strip()

    def validate_date_paiement(self, value):
        if value and value > date.today():
            raise serializers.ValidationError("La date de paiement ne peut pas être dans le futur.")
        return value

    def validate(self, attrs):
        """
        Règles:
        - dossier/fournisseur doivent être dans la même copropriete (X-Copropriete-Id)
        - dossier doit être verrouillé
        - statut dossier doit être VALIDE/EN_COURS/TERMINE/ARCHIVE
        - plafond budget: somme paiements <= budget_reference
        """
        request = self.context.get("request")
        instance: PaiementTravaux | None = getattr(self, "instance", None)

        dossier = attrs.get("dossier") or getattr(instance, "dossier", None)
        fournisseur = attrs.get("fournisseur") or getattr(instance, "fournisseur", None)
        montant = attrs.get("montant") if "montant" in attrs else getattr(instance, "montant", None)

        copro_id = _require_copro_id_from_request(request)

        # --- cohérence copro dossier/fournisseur ---
        if dossier and int(dossier.copropriete_id) != int(copro_id):
            raise serializers.ValidationError({"dossier": "Dossier hors périmètre de la copropriété courante."})

        if fournisseur and int(fournisseur.copropriete_id) != int(copro_id):
            raise serializers.ValidationError({"fournisseur": "Fournisseur hors périmètre de la copropriété courante."})

        # --- dossier doit être prêt (statut + lock) ---
        if dossier:
            allowed = {
                DossierTravaux.Statut.VALIDE,
                DossierTravaux.Statut.EN_COURS,
                DossierTravaux.Statut.TERMINE,
                DossierTravaux.Statut.ARCHIVE,
            }
            if dossier.statut not in allowed:
                raise serializers.ValidationError({"dossier": f"Paiement interdit tant que le dossier est {dossier.statut}."})

            if not dossier.is_locked:
                raise serializers.ValidationError({"dossier": "Paiement interdit : le dossier doit être verrouillé."})

        # --- plafond budget (pré-check, utile mais pas suffisant en concurrence) ---
        if dossier and montant is not None:
            budget = _budget_reference_decimal(dossier)

            qs = PaiementTravaux.objects.filter(dossier_id=dossier.id)
            if instance and instance.pk:
                qs = qs.exclude(pk=instance.pk)

            total_existant = Decimal(str(qs.aggregate(t=Sum("montant")).get("t") or DEC_0))
            futur_total = _money2(total_existant + Decimal(str(montant)))

            if futur_total > budget:
                raise serializers.ValidationError(
                    {"montant": f"Plafond budget dépassé. Total futur={futur_total} > budget={budget}."}
                )

        return attrs

    def _recheck_budget_under_lock(self, *, dossier_id: int, instance_pk: int | None, montant: Decimal):
        """
        Re-vérifie le plafond budget sous transaction + lock du dossier (anti-race condition).
        """
        d = DossierTravaux.objects.select_for_update().get(pk=dossier_id)
        budget = _budget_reference_decimal(d)

        qs = PaiementTravaux.objects.filter(dossier_id=dossier_id)
        if instance_pk:
            qs = qs.exclude(pk=instance_pk)

        total_existant = Decimal(str(qs.aggregate(t=Sum("montant")).get("t") or DEC_0))
        futur_total = _money2(total_existant + Decimal(str(montant)))

        if futur_total > budget:
            raise serializers.ValidationError(
                {"montant": f"Plafond budget dépassé. Total futur={futur_total} > budget={budget}."}
            )

    def create(self, validated_data):
        """
        ✅ Production-grade:
        - force copropriete depuis header X-Copropriete-Id
        - set created_by depuis request.user
        - recheck plafond budget sous lock (anti concurrence)
        """
        request = self.context.get("request")
        copro_id = _require_copro_id_from_request(request)

        validated_data["copropriete_id"] = int(copro_id)
        if getattr(request.user, "is_authenticated", False):
            validated_data["created_by"] = request.user

        dossier = validated_data.get("dossier")
        montant = validated_data.get("montant")

        # Anti-race condition: lock dossier + recheck plafond
        if dossier and montant is not None:
            with transaction.atomic():
                self._recheck_budget_under_lock(dossier_id=dossier.id, instance_pk=None, montant=montant)
                return super().create(validated_data)

        return super().create(validated_data)

    def update(self, instance, validated_data):
        """
        Même logique que create pour éviter qu'un PATCH/PUT fasse dépasser le plafond en concurrence.
        """
        dossier = validated_data.get("dossier", instance.dossier)
        montant = validated_data.get("montant", instance.montant)

        if dossier and montant is not None:
            with transaction.atomic():
                self._recheck_budget_under_lock(dossier_id=dossier.id, instance_pk=instance.pk, montant=montant)
                return super().update(instance, validated_data)

        return super().update(instance, validated_data)