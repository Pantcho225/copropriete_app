from rest_framework.permissions import IsAuthenticated

from apps.core.api import CoproScopedModelViewSet
from apps.core.permissions.copro import IsCoproAdminOrSyndic, IsCoproMember

from .models import Coproprietaire, ProprietaireLot
from .serializers import CoproprietaireSerializer, ProprietaireLotSerializer


class CoproprietaireViewSet(CoproScopedModelViewSet):
    queryset = Coproprietaire.objects.all().order_by("nom")
    serializer_class = CoproprietaireSerializer

    def get_permissions(self):
        if self.action in ["create", "update", "partial_update", "destroy"]:
            permission_classes = [IsAuthenticated, IsCoproAdminOrSyndic]
        else:
            permission_classes = [IsAuthenticated, IsCoproMember]
        return [p() for p in permission_classes]


class ProprietaireLotViewSet(CoproScopedModelViewSet):
    queryset = ProprietaireLot.objects.all()
    serializer_class = ProprietaireLotSerializer

    def get_permissions(self):
        if self.action in ["create", "update", "partial_update", "destroy"]:
            permission_classes = [IsAuthenticated, IsCoproAdminOrSyndic]
        else:
            permission_classes = [IsAuthenticated, IsCoproMember]
        return [p() for p in permission_classes]