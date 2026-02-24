from decimal import Decimal

from rest_framework import serializers

from .models import PaiementAppel, RelanceLot


class RelanceLotSerializer(serializers.ModelSerializer):
    class Meta:
        model = RelanceLot
        fields = (
            "id",
            "numero",
            "lot",
            "appel",
            "canal",
            "statut",
            "message",
            "reference_externe",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "numero",
            "created_at",
            "updated_at",
            # ✅ Recommandé: éviter que n'importe qui change le statut via API
            # Si tu veux autoriser la modification, enlève "statut" de read_only_fields.
            "statut",
        )

    def validate(self, attrs):
        """
        Règles:
        - X-Copropriete-Id (si présent) doit correspondre à la copro du lot
        - appel doit appartenir à la même copro (via exercice)
        - lot et appel doivent être cohérents (même copropriété)
        - compatible PATCH/PUT (partial update)
        """
        request = self.context.get("request")
        copro_id = request.headers.get("X-Copropriete-Id") if request else None

        instance = getattr(self, "instance", None)

        # PATCH/PUT support: si pas fourni, on prend la valeur existante
        lot = attrs.get("lot") if "lot" in attrs else getattr(instance, "lot", None)
        appel = attrs.get("appel") if "appel" in attrs else getattr(instance, "appel", None)

        # En création, appel et lot doivent être présents
        if instance is None:
            if lot is None:
                raise serializers.ValidationError({"lot": "Le champ 'lot' est obligatoire."})
            if appel is None:
                raise serializers.ValidationError({"appel": "Le champ 'appel' est obligatoire."})

        # Vérifs de cohérence lot/appel
        if lot and appel and lot.copropriete_id != appel.exercice.copropriete_id:
            raise serializers.ValidationError(
                {"appel": "Cet appel ne correspond pas à la copropriété du lot sélectionné."}
            )

        # Header scope (si présent)
        if copro_id:
            if lot and str(lot.copropriete_id) != str(copro_id):
                raise serializers.ValidationError(
                    {"lot": "Ce lot n'appartient pas à la copropriété courante."}
                )
            if appel and str(appel.exercice.copropriete_id) != str(copro_id):
                raise serializers.ValidationError(
                    {"appel": "Cet appel n'appartient pas à la copropriété courante."}
                )

        return attrs


class PaiementAppelSerializer(serializers.ModelSerializer):
    """
    Serializer API pour créer/voir les paiements.
    La logique métier (anti-dépassement, recalcul statut, relances => REGLE) est dans PaiementAppel.save().
    """

    # ✅ Optionnel côté API (le modèle a un default=timezone.now)
    date_paiement = serializers.DateTimeField(required=False, allow_null=True)

    class Meta:
        model = PaiementAppel
        fields = (
            "id",
            "ligne",
            "date_paiement",
            "montant",
            "mode",
            "reference",
            "commentaire",
            "created_at",
        )
        read_only_fields = ("id", "created_at")

    def validate(self, attrs):
        request = self.context.get("request")
        copro_id = request.headers.get("X-Copropriete-Id") if request else None

        instance = getattr(self, "instance", None)

        # PATCH/PUT support
        ligne = attrs.get("ligne") if "ligne" in attrs else getattr(instance, "ligne", None)

        if ligne is None:
            # En création, ligne obligatoire
            if instance is None:
                raise serializers.ValidationError({"ligne": "Le champ 'ligne' est obligatoire."})
            return attrs

        # Vérif header copro
        if copro_id and str(ligne.lot.copropriete_id) != str(copro_id):
            raise serializers.ValidationError(
                {"ligne": "Cette ligne n'appartient pas à la copropriété courante."}
            )

        # Montant > 0 (Decimal safe)
        montant = attrs.get("montant") if "montant" in attrs else getattr(instance, "montant", None)
        if montant is not None:
            try:
                montant_dec = Decimal(str(montant))
            except Exception:
                raise serializers.ValidationError({"montant": "Montant invalide."})

            if montant_dec <= Decimal("0"):
                raise serializers.ValidationError({"montant": "Le montant doit être strictement positif."})

        return attrs