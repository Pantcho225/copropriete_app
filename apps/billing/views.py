# apps/billing/views.py

from datetime import datetime, time
from decimal import Decimal

from django.apps import apps
from django.db import models, transaction, IntegrityError
from django.shortcuts import get_object_or_404
from django.utils import timezone

from rest_framework import status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from apps.compta.permissions import IsAdminOrSyndicWriteReadOnly
from apps.lots.models import Lot, LotTantieme
from .models import AppelDeFonds, LigneAppelDeFonds, RelanceLot, PaiementAppel
from .serializers import RelanceLotSerializer, PaiementAppelSerializer
from .services.pdf import generate_relance_pdf


# =========================================================
# HELPERS
# =========================================================

def _require_copro_id(request) -> str:
    copro_id = request.headers.get("X-Copropriete-Id")
    if not copro_id:
        raise ValidationError({"detail": "En-tête X-Copropriete-Id requis."})
    return copro_id


def _parse_date_param(request, key: str):
    value = request.query_params.get(key)
    if not value:
        return None

    d = datetime.strptime(value, "%Y-%m-%d").date()
    if key == "from":
        return timezone.make_aware(datetime.combine(d, time.min))
    return timezone.make_aware(datetime.combine(d, time.max))


# =========================================================
# PAIEMENT — CANCEL HELPERS
# =========================================================

def _paiement_appel_is_cancelled(paiement: PaiementAppel) -> bool:
    for field in ("cancelled_at", "annule_at", "canceled_at"):
        if hasattr(paiement, field) and getattr(paiement, field):
            return True

    for field in ("is_cancelled", "annule", "canceled"):
        if hasattr(paiement, field) and bool(getattr(paiement, field)):
            return True

    return False


def _paiement_appel_is_rapproche(paiement: PaiementAppel) -> bool:
    """
    Bloque annulation si:
    - MouvementBancaire lié
    - OU RapprochementBancaire actif vers ce paiement
    """

    # 1) FK MouvementBancaire
    try:
        MouvementBancaire = apps.get_model("compta", "MouvementBancaire")
        if MouvementBancaire.objects.filter(paiement_appel_id=paiement.id).exists():
            return True
    except Exception:
        pass

    # 2) Audit RapprochementBancaire
    try:
        RapprochementBancaire = apps.get_model("compta", "RapprochementBancaire")
        qs = RapprochementBancaire.objects.filter(
            type_cible="PAIEMENT_APPEL",
            cible_id=paiement.id,
        )
        if hasattr(RapprochementBancaire, "is_cancelled"):
            qs = qs.filter(is_cancelled=False)

        if qs.exists():
            return True
    except Exception:
        pass

    return False


def _set_paiement_appel_cancel(paiement: PaiementAppel, *, user, reason: str):
    now = timezone.now()
    updated_fields = []

    # date cancel
    for f in ("cancelled_at", "annule_at", "canceled_at"):
        if hasattr(paiement, f):
            setattr(paiement, f, now)
            updated_fields.append(f)
            break
    else:
        raise ValidationError(
            {
                "detail": (
                    "Le modèle PaiementAppel doit contenir un champ "
                    "cancelled_at / annule_at / canceled_at pour activer le soft-cancel."
                )
            }
        )

    # bool flag si existe
    for f in ("is_cancelled", "annule", "canceled"):
        if hasattr(paiement, f):
            setattr(paiement, f, True)
            updated_fields.append(f)
            break

    # reason
    for f in ("cancel_reason", "cancelled_reason", "annule_reason", "canceled_reason"):
        if hasattr(paiement, f):
            setattr(paiement, f, (reason or "")[:255])
            updated_fields.append(f)
            break

    # cancelled_by
    if hasattr(paiement, "cancelled_by"):
        paiement.cancelled_by = user
        updated_fields.append("cancelled_by")
    elif hasattr(paiement, "cancelled_by_id"):
        paiement.cancelled_by_id = user.id
        updated_fields.append("cancelled_by_id")

    paiement.save(update_fields=list(dict.fromkeys(updated_fields)))


# =========================================================
# PUBLIC QR VERIFY
# =========================================================

@api_view(["GET"])
@permission_classes([AllowAny])
def public_qr_verify(request, token):
    relance = get_object_or_404(
        RelanceLot.objects.select_related("lot", "appel", "appel__exercice"),
        qr_token=token,
    )

    return Response(
        {
            "relance_id": relance.id,
            "numero": relance.numero,
            "statut": relance.statut,
            "lot": {
                "id": relance.lot_id,
                "reference": getattr(relance.lot, "reference", None),
            },
            "appel": {
                "id": relance.appel_id,
                "libelle": getattr(relance.appel, "libelle", None),
                "date_echeance": getattr(relance.appel, "date_echeance", None),
            },
        }
    )


# =========================================================
# RELANCES
# =========================================================

class RelanceLotViewSet(viewsets.ModelViewSet):
    serializer_class = RelanceLotSerializer
    permission_classes = [IsAdminOrSyndicWriteReadOnly]

    def get_queryset(self):
        copro_id = self.request.headers.get("X-Copropriete-Id")
        qs = RelanceLot.objects.select_related("lot", "appel").order_by("-created_at", "-id")

        if copro_id:
            qs = qs.filter(lot__copropriete_id=copro_id)

        return qs


# =========================================================
# APPELS DE FONDS
# =========================================================

class AppelDeFondsViewSet(viewsets.GenericViewSet):
    permission_classes = [IsAdminOrSyndicWriteReadOnly]
    queryset = AppelDeFonds.objects.select_related("exercice").all()


# =========================================================
# PAIEMENTS APPEL
# =========================================================

class PaiementAppelViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAdminOrSyndicWriteReadOnly]
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

    def perform_update(self, serializer):
        raise ValidationError(
            {"detail": "Modification d’un paiement interdite. Créez un nouveau paiement."}
        )

    def perform_destroy(self, instance):
        raise ValidationError(
            {"detail": "Suppression interdite. Utilisez l’endpoint cancel/."}
        )

    # =========================================================
    # CANCEL (SOFT)
    # =========================================================
    @action(detail=True, methods=["post"], url_path="cancel")
    def cancel(self, request, pk=None):
        """
        POST /api/billing/paiement-appels/<id>/cancel/
        Body: { "reason": "..." }

        - Idempotent
        - Bloque si déjà rapproché
        - Soft-cancel traçable
        """

        copro_id = _require_copro_id(request)
        paiement = self.get_object()

        # Scope copro strict
        if str(paiement.ligne.lot.copropriete_id) != str(copro_id):
            raise PermissionDenied("Accès interdit à ce paiement.")

        reason = (request.data.get("reason") or "").strip()

        with transaction.atomic():
            paiement = PaiementAppel.objects.select_for_update().get(pk=paiement.pk)

            # idempotent
            if _paiement_appel_is_cancelled(paiement):
                return Response(
                    {"detail": "Paiement déjà annulé (soft-cancel)."},
                    status=status.HTTP_200_OK,
                )

            # blocage si rapprochement
            if _paiement_appel_is_rapproche(paiement):
                raise ValidationError(
                    {
                        "detail": (
                            "Impossible d’annuler : paiement déjà rapproché. "
                            "Annulez/détachez le rapprochement bancaire avant."
                        )
                    }
                )

            _set_paiement_appel_cancel(
                paiement,
                user=request.user,
                reason=reason,
            )

        return Response(
            {"detail": "Paiement annulé (soft-cancel)."},
            status=status.HTTP_200_OK,
        )