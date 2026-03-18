from django.db import IntegrityError
from rest_framework import serializers
from rest_framework.permissions import IsAuthenticated

from apps.core.api import CoproScopedModelViewSet
from apps.core.permissions.copro import IsCoproAdminOrSyndic, IsCoproMember

from .models import Lot, TantiemeCategorie, LotTantieme
from .serializers import (
    LotSerializer,
    TantiemeCategorieSerializer,
    LotTantiemeSerializer,
)


class LotViewSet(CoproScopedModelViewSet):
    queryset = Lot.objects.all().order_by("reference")
    serializer_class = LotSerializer

    def get_permissions(self):
        if self.action in ["create", "update", "partial_update", "destroy"]:
            permission_classes = [IsAuthenticated, IsCoproAdminOrSyndic]
        else:
            permission_classes = [IsAuthenticated, IsCoproMember]
        return [p() for p in permission_classes]

    def perform_create(self, serializer):
        try:
            serializer.save()
        except IntegrityError:
            raise serializers.ValidationError(
                {
                    "reference": "Un lot avec cette référence existe déjà dans cette copropriété."
                }
            )

    def perform_update(self, serializer):
        try:
            serializer.save()
        except IntegrityError:
            raise serializers.ValidationError(
                {
                    "reference": "Un lot avec cette référence existe déjà dans cette copropriété."
                }
            )


class TantiemeCategorieViewSet(CoproScopedModelViewSet):
    queryset = TantiemeCategorie.objects.all().order_by("code")
    serializer_class = TantiemeCategorieSerializer

    def get_permissions(self):
        if self.action in ["create", "update", "partial_update", "destroy"]:
            permission_classes = [IsAuthenticated, IsCoproAdminOrSyndic]
        else:
            permission_classes = [IsAuthenticated, IsCoproMember]
        return [p() for p in permission_classes]


class LotTantiemeViewSet(CoproScopedModelViewSet):
    queryset = LotTantieme.objects.all()
    serializer_class = LotTantiemeSerializer

    def get_permissions(self):
        if self.action in ["create", "update", "partial_update", "destroy"]:
            permission_classes = [IsAuthenticated, IsCoproAdminOrSyndic]
        else:
            permission_classes = [IsAuthenticated, IsCoproMember]
        return [p() for p in permission_classes]