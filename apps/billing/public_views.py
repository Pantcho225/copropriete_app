# apps/billing/public_views.py

from decimal import Decimal

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny

from .models import RelanceLot, LigneAppelDeFonds


DEC0 = Decimal("0.00")


class PublicRelanceVerifyAPIView(APIView):
    """
    GET /api/billing/public/relances/<id>/verify/?token=<uuid>
    """
    authentication_classes = []
    permission_classes = [AllowAny]

    def get(self, request, pk: int):
        token = request.query_params.get("token")
        if not token:
            return Response({"detail": "Token manquant."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            relance = (
                RelanceLot.objects
                .select_related("lot", "lot__copropriete", "appel")
                .get(pk=pk, qr_token=token)
            )
        except RelanceLot.DoesNotExist:
            return Response(
                {"detail": "Relance introuvable ou token invalide."},
                status=status.HTTP_404_NOT_FOUND,
            )

        ligne = (
            LigneAppelDeFonds.objects
            .filter(appel_id=relance.appel_id, lot_id=relance.lot_id)
            .first()
        )

        montant_du = ligne.montant_du if ligne else None
        montant_paye_brut = ligne.montant_paye if ligne else None

        restant = None
        trop_percu = None
        montant_paye = None  # ✅ montant payé "corrigé" (capé)

        if ligne:
            du = Decimal(str(montant_du or DEC0))
            paye = Decimal(str(montant_paye_brut or DEC0))

            # ✅ cap affichage
            montant_paye = min(paye, du)

            restant = du - montant_paye  # jamais négatif
            trop_percu = max(paye - du, DEC0)

        created_at = relance.created_at.isoformat() if relance.created_at else None

        def to_float(x):
            return float(x) if x is not None else None

        return Response(
            {
                "id": relance.id,
                "numero": relance.numero,
                "copropriete": relance.lot.copropriete.nom,
                "lot": relance.lot.reference,
                "appel": relance.appel.libelle,
                "statut": relance.get_statut_display(),
                "created_at": created_at,
                "montant_du": to_float(montant_du),
                "montant_paye": to_float(montant_paye),                 # ✅ jamais > dû
                "montant_paye_brut": to_float(montant_paye_brut),       # ✅ valeur réelle DB (debug/traçabilité)
                "restant": to_float(restant),
                "trop_percu": to_float(trop_percu),
            },
            status=status.HTTP_200_OK,
        )