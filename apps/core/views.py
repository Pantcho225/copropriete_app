from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from .models import CoproMembre, Copropriete
from .serializers import CoproprieteSerializer


class MesCoproprietesAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        copro_ids = CoproMembre.objects.filter(
            user=request.user,
            is_active=True
        ).values_list("copropriete_id", flat=True)

        qs = Copropriete.objects.filter(id__in=copro_ids).order_by("nom")
        data = CoproprieteSerializer(qs, many=True).data
        return Response(data)