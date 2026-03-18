from rest_framework import serializers
from .models import Lot, TantiemeCategorie, LotTantieme


class LotSerializer(serializers.ModelSerializer):
    class Meta:
        model = Lot
        fields = ("id", "reference", "type_lot", "description", "surface", "etage")

    def validate_reference(self, value):
        reference = (value or "").strip()
        if not reference:
            raise serializers.ValidationError("La référence du lot est obligatoire.")
        return reference

    def validate(self, attrs):
        request = self.context.get("request")
        reference = attrs.get("reference")

        if not request or not reference:
            return attrs

        # On essaie plusieurs noms possibles pour la copropriété active
        copropriete = (
            getattr(request, "copropriete", None)
            or getattr(request, "copropriete_active", None)
            or getattr(request, "current_copropriete", None)
        )

        # Si la copropriété active n’est pas injectée ici,
        # on laisse passer et la contrainte DB jouera son rôle.
        if copropriete is None:
            return attrs

        qs = Lot.objects.filter(copropriete=copropriete, reference=reference)

        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)

        if qs.exists():
            raise serializers.ValidationError(
                {
                    "reference": "Un lot avec cette référence existe déjà dans cette copropriété."
                }
            )

        return attrs


class TantiemeCategorieSerializer(serializers.ModelSerializer):
    class Meta:
        model = TantiemeCategorie
        fields = ("id", "code", "libelle", "actif")


class LotTantiemeSerializer(serializers.ModelSerializer):
    class Meta:
        model = LotTantieme
        fields = ("id", "lot", "categorie", "valeur")