# apps/compta/serializers.py
from __future__ import annotations

from datetime import date
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP

from django.db import transaction
from rest_framework import serializers

from .models import CompteBancaire, MouvementBancaire


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


# =========================================================
# CompteBancaire
# =========================================================
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
            "is_default",  # ✅ AJOUT: compte par défaut
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
        # champ bool, DRF gère déjà mais on standardise
        return bool(value)

    def validate(self, attrs):
        """
        MVP+:
        - si is_default=True, vérifier qu'il n'existe pas déjà un autre compte default dans la copro
          (on fait une validation API propre avant la contrainte DB)
        """
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
        """
        Force copropriete depuis header.
        """
        request = self.context.get("request")
        copro_id = _require_copro_id(request)
        validated_data["copropriete_id"] = int(copro_id)
        return super().create(validated_data)

    def update(self, instance, validated_data):
        """
        Sécurité périmètre: ne pas permettre de changer de copropriete via API.
        """
        validated_data.pop("copropriete", None)
        validated_data.pop("copropriete_id", None)
        return super().update(instance, validated_data)


# =========================================================
# MouvementBancaire
# =========================================================
class MouvementBancaireSerializer(serializers.ModelSerializer):
    copropriete = serializers.PrimaryKeyRelatedField(read_only=True)
    created_by = serializers.PrimaryKeyRelatedField(read_only=True)
    is_rapproche = serializers.BooleanField(read_only=True)

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
        ]
        read_only_fields = ["id", "copropriete", "is_rapproche", "created_by", "created_at"]

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

        # Sécurité périmètre (si rapproché)
        if pt and int(getattr(pt, "copropriete_id", 0)) != int(copro_id):
            raise serializers.ValidationError({"paiement_travaux": "PaiementTravaux hors copropriété."})
        if pa and int(getattr(pa, "copropriete_id", 0)) != int(copro_id):
            raise serializers.ValidationError({"paiement_appel": "PaiementAppel hors copropriété."})

        return attrs

    def create(self, validated_data):
        """
        ✅ Production-grade:
        - force copropriete depuis header X-Copropriete-Id
        - set created_by depuis request.user
        """
        request = self.context.get("request")
        copro_id = _require_copro_id(request)

        validated_data["copropriete_id"] = int(copro_id)
        if getattr(request.user, "is_authenticated", False):
            validated_data["created_by"] = request.user

        return super().create(validated_data)

    def update(self, instance, validated_data):
        """
        Sécurité: ne pas permettre de changer de copropriete via API.
        """
        validated_data.pop("copropriete", None)
        validated_data.pop("copropriete_id", None)
        return super().update(instance, validated_data)