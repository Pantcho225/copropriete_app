from rest_framework import serializers
from .models import Coproprietaire, ProprietaireLot


class CoproprietaireSerializer(serializers.ModelSerializer):
    class Meta:
        model = Coproprietaire
        fields = "__all__"
        read_only_fields = ("copropriete",)


class ProprietaireLotSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProprietaireLot
        fields = "__all__"
        read_only_fields = ("copropriete",)