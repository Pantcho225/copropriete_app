# apps/travaux/serializers.py
from __future__ import annotations

from decimal import Decimal, InvalidOperation, ROUND_HALF_UP

from rest_framework import serializers

from .models import Fournisseur, DossierTravaux


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


class DossierTravauxSerializer(serializers.ModelSerializer):
    copropriete = serializers.PrimaryKeyRelatedField(read_only=True)
    locked_by = serializers.PrimaryKeyRelatedField(read_only=True)
    is_locked = serializers.BooleanField(read_only=True)

    # ✅ Django crée automatiquement l’attribut *_id sur les relations
    resolution_validation_id = serializers.IntegerField(read_only=True)

    # ✅ Optionnel (lecture seulement) : pratique pour debug/admin
    resolution_validation = serializers.PrimaryKeyRelatedField(read_only=True)

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
            "resolution_validation",     # ✅ read-only debug
            "resolution_validation_id",  # ✅ read-only API stable
            "locked_at",
            "locked_by",
            "is_locked",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "copropriete",
            "budget_vote",              # ✅ voté via AG (clôture / validate-ag)
            "resolution_validation",    # ✅ modifié via link/relink/unlink/validate
            "resolution_validation_id", # ✅ modifié via link/relink/unlink/validate
            "locked_at",
            "locked_by",
            "is_locked",
            "created_at",
            "updated_at",
        ]

    def validate_titre(self, value: str) -> str:
        value = (value or "").strip()
        if not value:
            raise serializers.ValidationError("Le titre est requis.")
        return value

    def validate_budget_estime(self, value):
        d = _to_decimal(value, "budget_estime")
        if d < DEC_0:
            raise serializers.ValidationError("Doit être >= 0.")
        return _money2(d)

    def validate_budget_vote(self, value):
        """
        Normalement read-only, mais on garde une validation si jamais le champ arrive.
        """
        if value is None:
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
        - (option prod-safe) budget_estime ne se modifie plus après SOUMIS_AG
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