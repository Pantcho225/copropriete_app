from rest_framework import viewsets
from rest_framework.exceptions import ValidationError


class CoproScopedModelViewSet(viewsets.ModelViewSet):
    """
    - Filtre automatiquement les objets par request.copropriete_id
    - Force copropriete à la création
    - Empêche de changer copropriete lors d'un update
    """

    copro_field = "copropriete"  # nom du FK sur les modèles (copropriete)

    def get_copro_id(self) -> int:
        copro_id = getattr(self.request, "copropriete_id", None)
        if not copro_id:
            raise ValidationError({"detail": "En-tête X-Copropriete-Id requis."})

        try:
            return int(copro_id)
        except (TypeError, ValueError):
            raise ValidationError({"detail": "X-Copropriete-Id doit être un entier."})

    def get_queryset(self):
        qs = super().get_queryset()

        # Si le modèle n'a pas de champ copropriete, on bloque explicitement
        # (évite des bugs silencieux)
        model_fields = {f.name for f in qs.model._meta.get_fields()}
        if self.copro_field not in model_fields:
            raise ValidationError(
                {"detail": f"Le modèle {qs.model.__name__} n'est pas scoppé par copropriété."}
            )

        return qs.filter(**{f"{self.copro_field}_id": self.get_copro_id()})

    def perform_create(self, serializer):
        serializer.save(**{f"{self.copro_field}_id": self.get_copro_id()})

    def perform_update(self, serializer):
        # Empêche qu'on change la copropriété d'un objet existant
        serializer.save(**{f"{self.copro_field}_id": self.get_copro_id()})