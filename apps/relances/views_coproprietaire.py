# apps/relances/views_coproprietaire.py
from __future__ import annotations

from decimal import Decimal
from typing import Any

from django.db.models import Q
from django.utils import timezone
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.models import CoproMembre
from apps.owners.models import ProprietaireLot

from .models import DossierImpaye, Relance


def _decimal(value: Any) -> Decimal:
    if value in (None, ""):
        return Decimal("0")

    try:
        return Decimal(str(value))
    except Exception:
        return Decimal("0")


def _money(value: Any) -> str:
    return str(_decimal(value))


def _serialize_date(value):
    if value is None:
        return None

    if hasattr(value, "date"):
        try:
            return value.date().isoformat()
        except Exception:
            return value.isoformat()

    if hasattr(value, "isoformat"):
        return value.isoformat()

    return str(value)


def _lot_label(lot) -> str:
    if not lot:
        return "Lot"

    numero = getattr(lot, "numero", None)
    reference = getattr(lot, "reference", None)

    if numero:
        return str(numero)

    if reference:
        return str(reference)

    return f"Lot #{getattr(lot, 'id', '')}"


def _dossier_statut_label(statut: str) -> str:
    labels = {
        "A_PAYER": "À payer",
        "EN_RETARD": "En retard",
        "PARTIELLEMENT_PAYE": "Partiellement payé",
        "PAYE": "Payé",
        "REGULARISE": "Régularisé",
        "FERME": "Fermé",
    }

    return labels.get((statut or "").upper(), statut or "À suivre")


def _relance_statut_label(statut: str) -> str:
    labels = {
        "ENVOYEE": "Envoyée",
        "ECHEC": "Échec",
        "ANNULEE": "Annulée",
    }

    return labels.get((statut or "").upper(), statut or "Envoyée")


def _get_document_url(request, relance: Relance) -> str:
    document = getattr(relance, "document_pdf", None)

    if not document:
        return ""

    try:
        if not document.name:
            return ""

        return request.build_absolute_uri(document.url)
    except Exception:
        return ""


def _get_coproprietaire_scope(user):
    """
    Retourne le périmètre strict du copropriétaire connecté.

    Sécurité :
    - on part du user connecté ;
    - on récupère uniquement ses memberships actifs avec rôle COPROPRIETAIRE ;
    - on récupère uniquement les lots actifs rattachés à son compte copropriétaire ;
    - les vues doivent ensuite filtrer strictement par lot_id__in=lot_ids.
    """

    copro_ids = list(
        CoproMembre.objects.filter(
            user=user,
            is_active=True,
            role=CoproMembre.Role.COPROPRIETAIRE,
        ).values_list("copropriete_id", flat=True)
    )

    if not copro_ids:
        return [], []

    liens_lots = (
        ProprietaireLot.objects.filter(
            coproprietaire__user_account=user,
            copropriete_id__in=copro_ids,
            date_fin__isnull=True,
        )
        .select_related("copropriete", "coproprietaire", "lot")
        .order_by("lot_id", "-date_debut", "-id")
    )

    lot_ids = list(liens_lots.values_list("lot_id", flat=True).distinct())

    return copro_ids, lot_ids


class CoproprietaireRelancesAPIView(APIView):
    """
    GET /api/relances/coproprietaire/relances/

    Retourne uniquement les dossiers impayés et relances liés aux lots
    actifs du copropriétaire connecté.

    Important :
    Le filtre de sécurité principal est strictement :
    lot_id__in=lot_ids

    On n'utilise pas de OR avec coproprietaire_id, car cela pourrait exposer
    un dossier mal rattaché à un autre lot.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        copro_ids, lot_ids = _get_coproprietaire_scope(request.user)

        if not copro_ids or not lot_ids:
            return Response(
                {
                    "count": 0,
                    "stats": {
                        "nb_dossiers": 0,
                        "nb_relances": 0,
                        "nb_en_retard": 0,
                        "nb_regularises": 0,
                        "total_initial": "0",
                        "total_reste_a_payer": "0",
                        "nb_envoyees": 0,
                        "nb_echecs": 0,
                        "nb_annulees": 0,
                    },
                    "dossiers": [],
                    "relances": [],
                }
            )

        dossiers_qs = (
            DossierImpaye.objects.filter(
                copropriete_id__in=copro_ids,
                lot_id__in=lot_ids,
            )
            .select_related("copropriete", "lot", "coproprietaire", "appel")
            .order_by("-updated_at", "-created_at")
        )

        relances_qs = (
            Relance.objects.filter(
                copropriete_id__in=copro_ids,
                lot_id__in=lot_ids,
            )
            .select_related(
                "copropriete",
                "dossier",
                "appel",
                "lot",
                "coproprietaire",
            )
            .order_by("-created_at", "-id")
        )

        q = request.query_params.get("q")
        if q:
            q = q.strip()

            dossiers_qs = dossiers_qs.filter(
                Q(reference_appel__icontains=q)
                | Q(statut__icontains=q)
                | Q(lot__reference__icontains=q)
                | Q(lot__numero__icontains=q)
                | Q(appel__libelle__icontains=q)
            )

            relances_qs = relances_qs.filter(
                Q(objet__icontains=q)
                | Q(message__icontains=q)
                | Q(canal__icontains=q)
                | Q(statut__icontains=q)
                | Q(lot__reference__icontains=q)
                | Q(lot__numero__icontains=q)
                | Q(appel__libelle__icontains=q)
            )

        today = timezone.localdate()

        dossiers_payload = []
        total_initial = Decimal("0")
        total_reste = Decimal("0")
        nb_en_retard = 0
        nb_regularises = 0

        for dossier in dossiers_qs:
            lot = dossier.lot
            appel = dossier.appel

            montant_initial = _decimal(dossier.montant_initial)
            montant_paye = _decimal(dossier.montant_paye)
            reste_a_payer = _decimal(dossier.reste_a_payer)

            total_initial += montant_initial
            total_reste += reste_a_payer

            is_regularise = bool(
                dossier.est_regularise
                or dossier.statut in {"PAYE", "REGULARISE", "FERME"}
                or reste_a_payer <= 0
            )

            is_overdue = bool(
                not is_regularise
                and reste_a_payer > 0
                and dossier.date_echeance
                and dossier.date_echeance < today
            )

            if is_overdue:
                nb_en_retard += 1

            if is_regularise:
                nb_regularises += 1

            dossiers_payload.append(
                {
                    "id": dossier.id,
                    "appel_id": appel.id if appel else None,
                    "appel_libelle": getattr(appel, "libelle", "")
                    or dossier.reference_appel
                    or f"Appel #{getattr(appel, 'id', '')}",
                    "reference_appel": dossier.reference_appel,
                    "date_echeance": _serialize_date(dossier.date_echeance),
                    "montant_initial": _money(montant_initial),
                    "montant_paye": _money(montant_paye),
                    "reste_a_payer": _money(reste_a_payer),
                    "statut": dossier.statut,
                    "statut_label": _dossier_statut_label(dossier.statut),
                    "niveau_relance": dossier.niveau_relance,
                    "relances_count": dossier.relances_count,
                    "derniere_relance_at": _serialize_date(
                        dossier.derniere_relance_at
                    ),
                    "date_dernier_paiement": _serialize_date(
                        dossier.date_dernier_paiement
                    ),
                    "est_regularise": is_regularise,
                    "is_overdue": is_overdue,
                    "lot": {
                        "id": lot.id if lot else None,
                        "label": _lot_label(lot),
                        "reference": getattr(lot, "reference", "") if lot else "",
                        "numero": getattr(lot, "numero", "") if lot else "",
                        "type_lot": getattr(lot, "type_lot", "") if lot else "",
                        "etage": getattr(lot, "etage", "") if lot else "",
                    },
                }
            )

        relances_payload = []
        nb_envoyees = 0
        nb_echecs = 0
        nb_annulees = 0

        for relance in relances_qs:
            lot = relance.lot
            appel = relance.appel
            dossier = relance.dossier
            statut = (relance.statut or "").upper()

            if statut == "ENVOYEE":
                nb_envoyees += 1
            elif statut == "ECHEC":
                nb_echecs += 1
            elif statut == "ANNULEE":
                nb_annulees += 1

            relances_payload.append(
                {
                    "id": relance.id,
                    "dossier_id": dossier.id if dossier else None,
                    "appel_id": appel.id if appel else None,
                    "appel_libelle": getattr(appel, "libelle", "")
                    or f"Appel #{getattr(appel, 'id', '')}",
                    "lot": {
                        "id": lot.id if lot else None,
                        "label": _lot_label(lot),
                        "reference": getattr(lot, "reference", "") if lot else "",
                        "numero": getattr(lot, "numero", "") if lot else "",
                        "type_lot": getattr(lot, "type_lot", "") if lot else "",
                        "etage": getattr(lot, "etage", "") if lot else "",
                    },
                    "niveau": relance.niveau,
                    "canal": relance.canal,
                    "statut": relance.statut,
                    "statut_label": _relance_statut_label(relance.statut),
                    "objet": relance.objet,
                    "message": relance.message,
                    "montant_du_message": _money(relance.montant_du_message),
                    "reste_a_payer_au_moment_envoi": _money(
                        relance.reste_a_payer_au_moment_envoi
                    ),
                    "created_at": _serialize_date(relance.created_at),
                    "updated_at": _serialize_date(relance.updated_at),
                    "document_pdf_url": _get_document_url(request, relance),
                }
            )

        return Response(
            {
                "count": len(relances_payload),
                "stats": {
                    "nb_dossiers": len(dossiers_payload),
                    "nb_relances": len(relances_payload),
                    "nb_en_retard": nb_en_retard,
                    "nb_regularises": nb_regularises,
                    "total_initial": _money(total_initial),
                    "total_reste_a_payer": _money(total_reste),
                    "nb_envoyees": nb_envoyees,
                    "nb_echecs": nb_echecs,
                    "nb_annulees": nb_annulees,
                },
                "dossiers": dossiers_payload,
                "relances": relances_payload,
            }
        )