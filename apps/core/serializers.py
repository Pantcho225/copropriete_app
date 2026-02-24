from rest_framework import serializers
from .models import Copropriete


class CoproprieteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Copropriete
        fields = ("id", "nom", "adresse", "ville", "pays")