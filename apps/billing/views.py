# apps/billing/views.py
from datetime import datetime, time, timedelta
from decimal import Decimal

from django.db import models, transaction
from django.shortcuts import get_object_or_404
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response

from apps.lots.models import Lot, LotTantieme
from .models import AppelDeFonds, LigneAppelDeFonds, RelanceLot, PaiementAppel
from .serializers import RelanceLotSerializer, PaiementAppelSerializer
from .services.pdf import generate_relance_pdf  # PDF + QR


def _parse_date_param(request, key: str):
    """
    Parse ?from=YYYY-MM-DD / ?to=YYYY-MM-DD en datetime aware.
    Retourne None si absent.
    Lève ValueError si format invalide.
    """
    from django.utils import timezone

    value = request.query_params.get(key)
    if not value:
        return None

    d = datetime.strptime(value, "%Y-%m-%d").date()
    if key == "from":
        return timezone.make_aware(datetime.combine(d, time.min))
    return timezone.make_aware(datetime.combine(d, time.max))


def _require_copro_id(request) -> str:
    copro_id = request.headers.get("X-Copropriete-Id")
    if not copro_id:
        raise ValidationError({"detail": "En-tête X-Copropriete-Id requis."})
    return copro_id


# =========================
# RELANCES
# =========================
class RelanceLotViewSet(viewsets.ModelViewSet):
    serializer_class = RelanceLotSerializer

    def get_queryset(self):
        copro_id = self.request.headers.get("X-Copropriete-Id")
        qs = (
            RelanceLot.objects
            .select_related("lot", "appel", "appel__exercice")
            .order_by("-created_at", "-id")
        )

        # Scoping copro si header présent
        if copro_id:
            qs = qs.filter(lot__copropriete_id=copro_id)

        # Filtres optionnels
        lot_id = self.request.query_params.get("lot")
        appel_id = self.request.query_params.get("appel")
        statut_ = self.request.query_params.get("statut")
        canal_ = self.request.query_params.get("canal")

        if lot_id:
            qs = qs.filter(lot_id=lot_id)
        if appel_id:
            qs = qs.filter(appel_id=appel_id)
        if statut_:
            qs = qs.filter(statut=statut_)
        if canal_:
            qs = qs.filter(canal=canal_)

        return qs

    @action(detail=False, methods=["post"], url_path="generer")
    def generer_relances(self, request):
        """
        POST /api/billing/relances/generer/?days=7

        Génère des relances pour toutes les lignes IMPAYE/PARTIEL
        de la copropriété courante, avec anti-doublon sur fenêtre (days).

        Concurrence-safe: transaction + verrous sur lignes.
        """
        from django.utils import timezone

        copro_id = _require_copro_id(request)

        try:
            days = int(request.query_params.get("days", 7))
        except (TypeError, ValueError):
            days = 7
        days = max(days, 0)

        since = timezone.now() - timedelta(days=days)

        # Lock lignes pour éviter 2 générateurs simultanés qui créent double relances
        lignes = (
            LigneAppelDeFonds.objects
            .select_for_update()
            .select_related("lot", "appel")
            .filter(lot__copropriete_id=copro_id, statut__in=["IMPAYE", "PARTIEL"])
        )

        created = 0
        skipped = 0
        created_ids = []

        with transaction.atomic():
            for ligne in lignes:
                if not ligne.appel_id:
                    skipped += 1
                    continue

                # Anti-doublon fenêtre
                exists = RelanceLot.objects.filter(
                    lot_id=ligne.lot_id,
                    appel_id=ligne.appel_id,
                    created_at__gte=since,
                ).exists()
                if exists:
                    skipped += 1
                    continue

                msg = (
                    f"Bonjour, nous constatons un impayé/solde restant pour le lot {ligne.lot.reference} "
                    f"concernant l'appel \"{ligne.appel.libelle}\". "
                    f"Montant dû: {ligne.montant_du}. Montant payé: {ligne.montant_paye}. "
                    f"Merci de régulariser dans les meilleurs délais."
                )

                relance = RelanceLot.objects.create(
                    lot_id=ligne.lot_id,
                    appel_id=ligne.appel_id,
                    canal="WHATSAPP",
                    statut="ENVOYEE",
                    message=msg,
                )
                created += 1
                created_ids.append(relance.id)

        return Response(
            {
                "copropriete_id": int(copro_id),
                "days_window": days,
                "lignes_ciblees": lignes.count(),
                "created": created,
                "skipped_existing_or_invalid": skipped,
                "created_ids": created_ids,
            },
            status=status.HTTP_201_CREATED,
        )

    @action(detail=False, methods=["get"], url_path="stats")
    def stats(self, request):
        copro_id = _require_copro_id(request)

        qs = RelanceLot.objects.filter(lot__copropriete_id=copro_id)

        try:
            dt_from = _parse_date_param(request, "from")
            dt_to = _parse_date_param(request, "to")
        except ValueError:
            return Response(
                {"detail": "Paramètres de dates invalides. Format attendu: YYYY-MM-DD."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if dt_from:
            qs = qs.filter(created_at__gte=dt_from)
        if dt_to:
            qs = qs.filter(created_at__lte=dt_to)

        total = qs.count()

        par_statut = dict(
            qs.values("statut").annotate(n=models.Count("id")).values_list("statut", "n")
        )
        par_canal = dict(
            qs.values("canal").annotate(n=models.Count("id")).values_list("canal", "n")
        )
        top_lots = list(
            qs.values("lot_id", "lot__reference")
            .annotate(n=models.Count("id"))
            .order_by("-n", "lot_id")[:10]
        )

        return Response(
            {
                "copropriete_id": int(copro_id),
                "periode": {"from": request.query_params.get("from"), "to": request.query_params.get("to")},
                "total": total,
                "par_statut": par_statut,
                "par_canal": par_canal,
                "top_lots": top_lots,
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=["post"], url_path="marquer-regle")
    def marquer_regle(self, request, pk=None):
        """
        Marque une relance comme réglée.
        Sécurise le scope copro via get_queryset() (header).
        """
        copro_id = _require_copro_id(request)

        relance = self.get_object()
        if str(relance.lot.copropriete_id) != str(copro_id):
            # Normalement déjà filtré par get_queryset, mais on garde une défense en profondeur
            raise PermissionDenied("Accès interdit à cette relance pour la copropriété courante.")

        relance.statut = "REGLE"
        relance.save(update_fields=["statut", "updated_at"])
        return Response(self.get_serializer(relance).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["get"], url_path="pdf")
    def pdf(self, request, pk=None):
        """
        GET /api/billing/relances/{id}/pdf/
        Retourne un PDF de relance (inline).
        """
        _require_copro_id(request)
        relance = self.get_object()
        return generate_relance_pdf(relance, request=request)


# =========================
# APPELS DE FONDS
# =========================
class AppelDeFondsViewSet(viewsets.GenericViewSet):
    queryset = AppelDeFonds.objects.select_related("exercice").all().order_by("-date_emission")

    def get_queryset(self):
        copro_id = self.request.headers.get("X-Copropriete-Id")
        qs = super().get_queryset()
        if copro_id:
            qs = qs.filter(exercice__copropriete_id=copro_id)
        return qs

    @action(detail=True, methods=["post"], url_path="generer-lignes")
    def generer_lignes(self, request, pk=None):
        copro_id = _require_copro_id(request)

        # ✅ Vérifie que l'appel appartient à la copro courant (sinon 404)
        appel = get_object_or_404(self.get_queryset(), pk=pk)

        lots = Lot.objects.filter(copropriete_id=copro_id).order_by("id")
        if not lots.exists():
            return Response(
                {"detail": "Aucun lot pour cette copropriété."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        cat = appel.tantieme_categorie  # peut être None
        lt_qs = LotTantieme.objects.filter(lot__in=lots)
        if cat:
            lt_qs = lt_qs.filter(categorie=cat)

        tantiemes_map = {
            row["lot_id"]: (row["total"] or Decimal("0"))
            for row in lt_qs.values("lot_id").annotate(total=models.Sum("valeur"))
        }

        total_tantiemes = sum(
            (Decimal(tantiemes_map.get(l.id, Decimal("0"))) for l in lots),
            Decimal("0"),
        )
        if total_tantiemes <= 0:
            return Response(
                {"detail": "Impossible de générer: tantièmes manquants ou total tantièmes = 0."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        created = 0
        updated = 0
        skipped_no_tantieme = 0

        with transaction.atomic():
            for lot in lots:
                t = Decimal(tantiemes_map.get(lot.id, Decimal("0")))
                if t <= 0:
                    skipped_no_tantieme += 1
                    continue

                montant_du = (Decimal(appel.montant_total) * t) / Decimal(total_tantiemes)
                montant_du = montant_du.quantize(Decimal("0.01"))

                _, was_created = LigneAppelDeFonds.objects.update_or_create(
                    appel=appel,
                    lot=lot,
                    defaults={"tantiemes": t, "montant_du": montant_du},
                )
                if was_created:
                    created += 1
                else:
                    updated += 1

            appel.genere = True
            appel.save(update_fields=["genere"])

        return Response(
            {
                "appel_id": appel.id,
                "copropriete_id": int(copro_id),
                "lots_total": lots.count(),
                "total_tantiemes": str(total_tantiemes),
                "created": created,
                "updated": updated,
                "skipped_no_tantieme": skipped_no_tantieme,
                "genere": True,
            },
            status=status.HTTP_200_OK,
        )


# =========================
# PAIEMENTS
# =========================
class PaiementAppelViewSet(viewsets.ModelViewSet):
    serializer_class = PaiementAppelSerializer
    queryset = (
        PaiementAppel.objects
        .select_related("ligne", "ligne__lot", "ligne__appel", "ligne__appel__exercice")
        .order_by("-date_paiement", "-id")
    )

    def get_queryset(self):
        copro_id = self.request.headers.get("X-Copropriete-Id")
        qs = super().get_queryset()
        if copro_id:
            qs = qs.filter(ligne__lot__copropriete_id=copro_id)
        return qs

    def perform_create(self, serializer):
        _require_copro_id(self.request)
        serializer.save()

    def perform_update(self, serializer):
        """
        Durcissement: on évite de modifier des paiements existants
        (sinon recalculs difficiles et risques d'incohérence).
        Si tu veux autoriser, on peut le faire mais il faut gérer proprement.
        """
        raise ValidationError({"detail": "La modification d’un paiement est désactivée. Créez un nouveau paiement."})

    def perform_destroy(self, instance):
        """
        Même logique: suppression dangereuse.
        (Si tu veux l'autoriser, il faut recalculer la ligne + statut dans une transaction.)
        """
        raise ValidationError({"detail": "La suppression d’un paiement est désactivée. Contactez un administrateur."})