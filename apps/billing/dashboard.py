# apps/billing/dashboard.py
from datetime import datetime, time
from decimal import Decimal

from django.db import models
from django.utils import timezone
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import LigneAppelDeFonds, PaiementAppel, RelanceLot


def _parse_date_param(request, key: str):
    """
    Parse ?from=YYYY-MM-DD / ?to=YYYY-MM-DD en datetime aware.
    Retourne None si absent.
    Lève ValueError si format invalide.
    """
    value = request.query_params.get(key)
    if not value:
        return None

    d = datetime.strptime(value, "%Y-%m-%d").date()
    if key == "from":
        return timezone.make_aware(datetime.combine(d, time.min))
    return timezone.make_aware(datetime.combine(d, time.max))


class BillingDashboardAPIView(APIView):
    """
    GET /api/billing/dashboard/?from=YYYY-MM-DD&to=YYYY-MM-DD
    Dashboard global billing pour la copropriété courante (X-Copropriete-Id).
    """

    def get(self, request, *args, **kwargs):
        copro_id = request.headers.get("X-Copropriete-Id")
        if not copro_id:
            return Response(
                {"detail": "En-tête X-Copropriete-Id requis."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Période optionnelle
        try:
            dt_from = _parse_date_param(request, "from")
            dt_to = _parse_date_param(request, "to")
        except ValueError:
            return Response(
                {"detail": "Paramètres de dates invalides. Format attendu: YYYY-MM-DD."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # --- Lignes d'appel de fonds ---
        lignes = (
            LigneAppelDeFonds.objects
            .filter(lot__copropriete_id=copro_id)
            .select_related("lot", "appel")
        )

        # --- Paiements (sur période optionnelle, basé sur date_paiement) ---
        paiements = PaiementAppel.objects.filter(ligne__lot__copropriete_id=copro_id)
        if dt_from:
            paiements = paiements.filter(date_paiement__gte=dt_from.date())
        if dt_to:
            paiements = paiements.filter(date_paiement__lte=dt_to.date())

        # --- Relances (sur période optionnelle, basé sur created_at) ---
        relances = RelanceLot.objects.filter(lot__copropriete_id=copro_id)
        if dt_from:
            relances = relances.filter(created_at__gte=dt_from)
        if dt_to:
            relances = relances.filter(created_at__lte=dt_to)

        # Agrégats lignes
        agg_lignes = lignes.aggregate(
            total_du=models.Sum("montant_du"),
            total_paye=models.Sum("montant_paye"),
            nb=models.Count("id"),
        )
        total_du = agg_lignes["total_du"] or Decimal("0.00")
        total_paye = agg_lignes["total_paye"] or Decimal("0.00")
        restant = total_du - total_paye

        # Comptage statuts lignes
        statuts_lignes = dict(
            lignes.values("statut")
            .annotate(n=models.Count("id"))
            .values_list("statut", "n")
        )

        # Impayés par lot (restant > 0)
        impayes_par_lot = list(
            lignes.values("lot_id", "lot__reference")
            .annotate(
                total_du=models.Sum("montant_du"),
                total_paye=models.Sum("montant_paye"),
            )
        )
        for row in impayes_par_lot:
            row["restant"] = (row["total_du"] or Decimal("0.00")) - (row["total_paye"] or Decimal("0.00"))
        impayes_par_lot = [r for r in impayes_par_lot if r["restant"] > 0]
        impayes_par_lot.sort(key=lambda x: x["restant"], reverse=True)
        impayes_top10 = impayes_par_lot[:10]

        # Agrégats paiements
        agg_paiements = paiements.aggregate(
            total=models.Sum("montant"),
            nb=models.Count("id"),
        )
        paiements_total = agg_paiements["total"] or Decimal("0.00")
        paiements_nb = agg_paiements["nb"] or 0

        paiements_par_mode = dict(
            paiements.values("mode")
            .annotate(n=models.Count("id"))
            .values_list("mode", "n")
        )

        # Stats relances
        relances_total = relances.count()
        relances_par_statut = dict(
            relances.values("statut")
            .annotate(n=models.Count("id"))
            .values_list("statut", "n")
        )
        relances_par_canal = dict(
            relances.values("canal")
            .annotate(n=models.Count("id"))
            .values_list("canal", "n")
        )
        relances_top_lots = list(
            relances.values("lot_id", "lot__reference")
            .annotate(n=models.Count("id"))
            .order_by("-n", "lot_id")[:10]
        )

        return Response(
            {
                "copropriete_id": int(copro_id),
                "periode": {"from": request.query_params.get("from"), "to": request.query_params.get("to")},
                "lignes": {
                    "nb": agg_lignes["nb"] or 0,
                    "total_du": str(total_du),
                    "total_paye": str(total_paye),
                    "restant": str(restant),
                    "par_statut": statuts_lignes,
                    "impayes_top10": [
                        {
                            "lot_id": r["lot_id"],
                            "lot__reference": r["lot__reference"],
                            "total_du": str(r["total_du"] or Decimal("0.00")),
                            "total_paye": str(r["total_paye"] or Decimal("0.00")),
                            "restant": str(r["restant"]),
                        }
                        for r in impayes_top10
                    ],
                },
                "paiements": {
                    "nb": paiements_nb,
                    "total": str(paiements_total),
                    "par_mode": paiements_par_mode,
                },
                "relances": {
                    "total": relances_total,
                    "par_statut": relances_par_statut,
                    "par_canal": relances_par_canal,
                    "top_lots": relances_top_lots,
                },
            },
            status=status.HTTP_200_OK,
        )