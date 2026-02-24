# apps/billing/views.py
from datetime import datetime, time, timedelta
from decimal import Decimal

from django.db import models, transaction, IntegrityError
from django.shortcuts import get_object_or_404
from rest_framework import status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import AllowAny
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


# =========================================================
# PUBLIC (QR VERIFY) — PAS DE HEADER, AllowAny
# =========================================================
@api_view(["GET"])
@permission_classes([AllowAny])
def public_qr_verify(request, token):
    """
    GET /api/billing/public/qr/<uuid:token>/

    Endpoint public pour vérifier une relance via QR token.
    AUCUN header X-Copropriete-Id requis (middleware doit exempter /api/billing/public/).
    """
    relance = get_object_or_404(
        RelanceLot.objects.select_related("lot", "appel", "appel__exercice"),
        qr_token=token,
    )

    # On renvoie un payload "safe" (tu peux enrichir au besoin)
    return Response(
        {
            "relance_id": relance.id,
            "numero": relance.numero,
            "statut": relance.statut,
            "canal": relance.canal,
            "created_at": relance.created_at,
            "updated_at": relance.updated_at,
            "lot": {
                "id": relance.lot_id,
                "reference": getattr(relance.lot, "reference", None),
            },
            "appel": {
                "id": relance.appel_id,
                "libelle": getattr(relance.appel, "libelle", None),
                "date_echeance": getattr(relance.appel, "date_echeance", None),
            },
        },
        status=status.HTTP_200_OK,
    )


# =========================
# RELANCES (privé)
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
        POST /api/billing/relances/generer/?appel=<appel_id>

        Génère des relances pour toutes les lignes IMPAYE/PARTIEL
        de la copropriété courante.
        ✅ Idempotent: si la relance existe déjà pour (lot, appel), on la réutilise.
        ✅ Concurrency-safe: transaction + gestion IntegrityError (unique lot+appel).
        """
        copro_id = _require_copro_id(request)

        appel_id = request.query_params.get("appel")
        if appel_id:
            # Vérifie que l'appel appartient à la copro (sinon 404)
            _ = get_object_or_404(
                AppelDeFonds.objects.select_related("exercice").filter(exercice__copropriete_id=copro_id),
                pk=appel_id,
            )

        with transaction.atomic():
            # On verrouille les lignes cibles pour éviter 2 générateurs simultanés
            lignes_qs = (
                LigneAppelDeFonds.objects
                .select_for_update()
                .select_related("lot", "appel")
                .filter(lot__copropriete_id=copro_id, statut__in=["IMPAYE", "PARTIEL"])
            )
            if appel_id:
                lignes_qs = lignes_qs.filter(appel_id=appel_id)

            lignes = list(lignes_qs)

            created_ids = []
            existing_ids = []
            skipped = 0

            for ligne in lignes:
                if not ligne.appel_id:
                    skipped += 1
                    continue

                # Message généré (tu peux le rendre plus "template")
                msg = (
                    f"Bonjour, nous constatons un impayé/solde restant pour le lot {ligne.lot.reference} "
                    f"concernant l'appel \"{ligne.appel.libelle}\". "
                    f"Montant dû: {ligne.montant_du}. Montant payé: {ligne.montant_paye}. "
                    f"Merci de régulariser dans les meilleurs délais."
                )

                defaults = {
                    "canal": "WHATSAPP",
                    "statut": "ENVOYEE",
                    "message": msg,
                }

                # ✅ Avec ta contrainte unique (lot, appel), on fait get_or_create
                # et on gère une course possible via IntegrityError.
                try:
                    relance, was_created = RelanceLot.objects.get_or_create(
                        lot_id=ligne.lot_id,
                        appel_id=ligne.appel_id,
                        defaults=defaults,
                    )
                except IntegrityError:
                    # Une autre transaction l'a créée entre-temps
                    relance = RelanceLot.objects.get(lot_id=ligne.lot_id, appel_id=ligne.appel_id)
                    was_created = False

                if was_created:
                    created_ids.append(relance.id)
                else:
                    # Option: mettre à jour le message si tu veux “rafraîchir”
                    # (sinon, laisse tel quel)
                    if relance.statut != "REGLE":
                        RelanceLot.objects.filter(pk=relance.pk).update(message=msg)
                    existing_ids.append(relance.id)

            return Response(
                {
                    "copropriete_id": int(copro_id),
                    "appel_id": int(appel_id) if appel_id else None,
                    "lignes_ciblees": len(lignes),
                    "created": len(created_ids),
                    "existing": len(existing_ids),
                    "skipped_invalid": skipped,
                    "created_ids": created_ids,
                    "existing_ids": existing_ids,
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
        raise ValidationError({"detail": "La modification d’un paiement est désactivée. Créez un nouveau paiement."})

    def perform_destroy(self, instance):
        raise ValidationError({"detail": "La suppression d’un paiement est désactivée. Contactez un administrateur."})