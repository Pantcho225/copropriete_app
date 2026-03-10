# apps/rh/serializers.py
from __future__ import annotations

from rest_framework import serializers

from .models import ContratEmploye, Employe


def _require_copro_id(request) -> int:
    copro_id = request.headers.get("X-Copropriete-Id") if request else None
    if not copro_id:
        raise serializers.ValidationError({"detail": "En-tête X-Copropriete-Id requis."})
    try:
        return int(str(copro_id))
    except ValueError:
        raise serializers.ValidationError({"detail": "X-Copropriete-Id invalide."})


class EmployeSerializer(serializers.ModelSerializer):
    nom_complet = serializers.CharField(read_only=True)

    class Meta:
        model = Employe
        fields = [
            "id",
            "copropriete",
            "nom",
            "prenoms",
            "nom_complet",
            "role",
            "role_libre",
            "telephone",
            "email",
            "date_embauche",
            "salaire_base",
            "statut",
            "notes",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ("id", "copropriete", "created_at", "updated_at", "nom_complet")

    def validate(self, attrs):
        request = self.context.get("request")
        copro_id = _require_copro_id(request)

        instance = getattr(self, "instance", None)

        if instance and instance.copropriete_id != copro_id:
            raise serializers.ValidationError(
                {"detail": "Cet employé n'appartient pas à la copropriété active."}
            )

        role = attrs.get("role", getattr(instance, "role", None))
        role_libre = attrs.get("role_libre", getattr(instance, "role_libre", ""))

        if role == "AUTRE" and not str(role_libre or "").strip():
            raise serializers.ValidationError(
                {"role_libre": "Précisez le rôle si le rôle vaut AUTRE."}
            )

        return attrs

    def create(self, validated_data):
        request = self.context.get("request")
        copro_id = _require_copro_id(request)
        validated_data["copropriete_id"] = copro_id
        return super().create(validated_data)


class EmployeMiniSerializer(serializers.ModelSerializer):
    nom_complet = serializers.CharField(read_only=True)

    class Meta:
        model = Employe
        fields = ["id", "nom", "prenoms", "nom_complet", "role", "statut"]


class ContratEmployeSerializer(serializers.ModelSerializer):
    employe_detail = EmployeMiniSerializer(source="employe", read_only=True)

    class Meta:
        model = ContratEmploye
        fields = [
            "id",
            "employe",
            "employe_detail",
            "type_contrat",
            "type_contrat_libre",
            "date_debut",
            "date_fin",
            "salaire_mensuel",
            "statut",
            "notes",
            "fichier_contrat",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ("id", "created_at", "updated_at", "employe_detail")

    def validate(self, attrs):
        request = self.context.get("request")
        copro_id = _require_copro_id(request)

        instance = getattr(self, "instance", None)
        employe = attrs.get("employe", getattr(instance, "employe", None))

        if not employe:
            raise serializers.ValidationError({"employe": "Employé requis."})

        if employe.copropriete_id != copro_id:
            raise serializers.ValidationError(
                {"employe": "L'employé doit appartenir à la copropriété active."}
            )

        type_contrat = attrs.get("type_contrat", getattr(instance, "type_contrat", None))
        type_contrat_libre = attrs.get(
            "type_contrat_libre",
            getattr(instance, "type_contrat_libre", ""),
        )

        if type_contrat == "AUTRE" and not str(type_contrat_libre or "").strip():
            raise serializers.ValidationError(
                {"type_contrat_libre": "Précisez le type de contrat si la valeur est AUTRE."}
            )

        date_debut = attrs.get("date_debut", getattr(instance, "date_debut", None))
        date_fin = attrs.get("date_fin", getattr(instance, "date_fin", None))

        if date_debut and date_fin and date_fin < date_debut:
            raise serializers.ValidationError(
                {"date_fin": "La date de fin ne peut pas être antérieure à la date de début."}
            )

        salaire_mensuel = attrs.get(
            "salaire_mensuel",
            getattr(instance, "salaire_mensuel", None),
        )
        if salaire_mensuel is not None and salaire_mensuel < 0:
            raise serializers.ValidationError(
                {"salaire_mensuel": "Le salaire mensuel ne peut pas être négatif."}
            )

        if instance and instance.employe and instance.employe.copropriete_id != copro_id:
            raise serializers.ValidationError(
                {"detail": "Ce contrat n'appartient pas à la copropriété active."}
            )

        return attrs

    def to_representation(self, instance):
        data = super().to_representation(instance)

        # Sécurise toujours la présence de employe_detail
        employe = getattr(instance, "employe", None)
        if employe is not None:
            data["employe_detail"] = EmployeMiniSerializer(employe, context=self.context).data
        else:
            data["employe_detail"] = None

        return data