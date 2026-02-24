from rest_framework import serializers
from .models import Lot, TantiemeCategorie, LotTantieme


class LotSerializer(serializers.ModelSerializer):
    class Meta:
        model = Lot
        fields = ("id", "reference", "type_lot", "description", "surface", "etage")


class TantiemeCategorieSerializer(serializers.ModelSerializer):
    class Meta:
        model = TantiemeCategorie
        fields = ("id", "code", "libelle", "actif")


class LotTantiemeSerializer(serializers.ModelSerializer):
    class Meta:
        model = LotTantieme
        fields = ("id", "lot", "categorie", "valeur")