# apps/billing/views_coproprietaire.py
from __future__ import annotations

from decimal import Decimal
from typing import Any

from django.apps import apps
from django.db.models import Q
from django.utils import timezone
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.models import CoproMembre
from apps.owners.models import ProprietaireLot


def _decimal(value: Any) -> Decimal:
    if value in (None, ""):
        return Decimal("0")

    try:
        return Decimal(str(value))
    except Exception:
        return Decimal("0")


def _money(value: Any) -> str:
    return str(_decimal(value))


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


def _statut_label(statut: str, reste_a_payer: Decimal) -> str:
    statut_normalise = (statut or "").strip().upper()

    if reste_a_payer <= 0:
        return "Payé"

    if statut_normalise in {"PAYE", "PAYÉ", "REGLE", "RÉGLÉ"}:
        return "Payé"

    if statut_normalise in {"PARTIEL", "PARTIELLEMENT_PAYE", "PARTIELLEMENT_PAYÉ"}:
        return "Partiellement payé"

    if statut_normalise in {"IMPAYE", "IMPAYÉ", "EN_RETARD"}:
        return "Impayé"

    return "À payer"


def _get_model(model_name: str):
    """
    Récupération robuste des modèles Billing.
    Selon le nom exact de l'application, l'app_label peut varier.
    """

    candidates = ("billing_app", "billing", "apps.billing")

    for app_label in candidates:
        try:
            return apps.get_model(app_label, model_name)
        except LookupError:
            continue

    raise LookupError(f"Modèle introuvable : {model_name}")


def _has_model_field(model, field_name: str) -> bool:
    return any(field.name == field_name for field in model._meta.get_fields())


def _first_model_field(model, candidates: list[str]) -> str | None:
    for field_name in candidates:
        if _has_model_field(model, field_name):
            return field_name

    return None


def _first_attr(obj, names: list[str], default=None):
    for name in names:
        if hasattr(obj, name):
            value = getattr(obj, name)
            if value is not None:
                return value

    return default


def _find_fk_field_name(model, target_model) -> str | None:
    """
    Trouve automatiquement le champ ForeignKey reliant PaiementAppel
    à LigneAppelDeFonds.
    """

    for field in model._meta.get_fields():
        if (
            getattr(field, "many_to_one", False)
            and getattr(field, "related_model", None) == target_model
        ):
            return field.name

    return None


def _paiement_is_cancelled(paiement) -> bool:
    for field_name in ["is_cancelled", "is_canceled", "annule", "cancelled"]:
        if hasattr(paiement, field_name):
            return bool(getattr(paiement, field_name))

    statut = str(
        _first_attr(paiement, ["statut", "status", "etat"], default="") or ""
    ).upper()

    return statut in {"ANNULE", "ANNULÉ", "CANCELLED", "CANCELED"}


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


def _get_coproprietaire_lot_ids(user):
    copro_ids = list(
        CoproMembre.objects.filter(
            user=user,
            is_active=True,
            role=CoproMembre.Role.COPROPRIETAIRE,
        ).values_list("copropriete_id", flat=True)
    )

    if not copro_ids:
        return [], [], []

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

    lots_payload = [
        {
            "id": lien.lot_id,
            "label": _lot_label(lien.lot),
            "copropriete": {
                "id": lien.copropriete_id,
                "nom": getattr(lien.copropriete, "nom", ""),
            },
            "type_droit": getattr(lien, "type_droit", ""),
            "quote_part": _money(getattr(lien, "quote_part", 0)),
        }
        for lien in liens_lots
    ]

    return copro_ids, lot_ids, lots_payload


class CoproprietaireAppelsAPIView(APIView):
    """
    GET /api/billing/coproprietaire/appels/

    Retourne uniquement les appels de charges liés aux lots
    du copropriétaire connecté.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        _, lot_ids, lots_payload = _get_coproprietaire_lot_ids(request.user)

        if not lot_ids:
            return Response(
                {
                    "count": 0,
                    "stats": {
                        "total_du": "0",
                        "total_paye": "0",
                        "reste_a_payer": "0",
                        "nb_appels": 0,
                        "nb_en_retard": 0,
                    },
                    "lots": lots_payload,
                    "appels": [],
                }
            )

        LigneAppelDeFonds = _get_model("LigneAppelDeFonds")

        qs = (
            LigneAppelDeFonds.objects.filter(
                lot_id__in=lot_ids,
                appel__genere=True,
            )
            .select_related(
                "appel",
                "lot",
                "appel__exercice",
                "appel__tantieme_categorie",
            )
            .order_by("-appel__date_emission", "-appel__date_echeance", "-id")
        )

        statut = request.query_params.get("statut")
        if statut:
            qs = qs.filter(statut__iexact=statut.strip())

        q = request.query_params.get("q")
        if q:
            q = q.strip()
            qs = qs.filter(
                Q(appel__libelle__icontains=q)
                | Q(appel__type_appel__icontains=q)
                | Q(lot__reference__icontains=q)
                | Q(lot__numero__icontains=q)
            )

        today = timezone.localdate()

        appels_payload = []
        total_du = Decimal("0")
        total_paye = Decimal("0")
        total_reste = Decimal("0")
        nb_en_retard = 0

        for ligne in qs:
            appel = ligne.appel
            lot = ligne.lot

            montant_du = _decimal(getattr(ligne, "montant_du", 0))
            montant_paye = _decimal(getattr(ligne, "montant_paye", 0))
            reste_a_payer = montant_du - montant_paye

            if reste_a_payer < 0:
                reste_a_payer = Decimal("0")

            date_echeance = getattr(appel, "date_echeance", None)

            is_overdue = bool(
                reste_a_payer > 0
                and date_echeance
                and date_echeance < today
            )

            if is_overdue:
                nb_en_retard += 1

            total_du += montant_du
            total_paye += montant_paye
            total_reste += reste_a_payer

            statut_brut = getattr(ligne, "statut", "") or ""

            appels_payload.append(
                {
                    "id": ligne.id,
                    "ligne_id": ligne.id,
                    "appel_id": appel.id,
                    "libelle": getattr(appel, "libelle", "") or f"Appel #{appel.id}",
                    "type_appel": getattr(appel, "type_appel", ""),
                    "date_emission": getattr(appel, "date_emission", None),
                    "date_echeance": date_echeance,
                    "montant_du": _money(montant_du),
                    "montant_paye": _money(montant_paye),
                    "reste_a_payer": _money(reste_a_payer),
                    "statut": statut_brut,
                    "statut_label": _statut_label(statut_brut, reste_a_payer),
                    "is_overdue": is_overdue,
                    "lot": {
                        "id": lot.id,
                        "label": _lot_label(lot),
                        "reference": getattr(lot, "reference", ""),
                        "numero": getattr(lot, "numero", ""),
                        "type_lot": getattr(lot, "type_lot", ""),
                        "etage": getattr(lot, "etage", ""),
                    },
                    "exercice": {
                        "id": getattr(getattr(appel, "exercice", None), "id", None),
                        "nom": getattr(getattr(appel, "exercice", None), "nom", ""),
                    },
                    "tantieme_categorie": {
                        "id": getattr(
                            getattr(appel, "tantieme_categorie", None),
                            "id",
                            None,
                        ),
                        "nom": getattr(
                            getattr(appel, "tantieme_categorie", None),
                            "nom",
                            "",
                        ),
                        "code": getattr(
                            getattr(appel, "tantieme_categorie", None),
                            "code",
                            "",
                        ),
                    },
                }
            )

        return Response(
            {
                "count": len(appels_payload),
                "stats": {
                    "total_du": _money(total_du),
                    "total_paye": _money(total_paye),
                    "reste_a_payer": _money(total_reste),
                    "nb_appels": len(appels_payload),
                    "nb_en_retard": nb_en_retard,
                },
                "lots": lots_payload,
                "appels": appels_payload,
            }
        )


class CoproprietairePaiementsAPIView(APIView):
    """
    GET /api/billing/coproprietaire/paiements/

    Retourne uniquement les paiements liés aux lots
    du copropriétaire connecté.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        _, lot_ids, _ = _get_coproprietaire_lot_ids(request.user)

        if not lot_ids:
            return Response(
                {
                    "count": 0,
                    "stats": {
                        "total_paye": "0",
                        "nb_paiements": 0,
                        "nb_annules": 0,
                    },
                    "paiements": [],
                }
            )

        try:
            LigneAppelDeFonds = _get_model("LigneAppelDeFonds")
            PaiementAppel = _get_model("PaiementAppel")
        except LookupError as exc:
            return Response({"detail": str(exc)}, status=500)

        ligne_field_name = _find_fk_field_name(PaiementAppel, LigneAppelDeFonds)

        if not ligne_field_name:
            return Response(
                {
                    "detail": (
                        "Impossible d'identifier le champ de liaison entre "
                        "PaiementAppel et LigneAppelDeFonds."
                    )
                },
                status=500,
            )

        qs = PaiementAppel.objects.filter(
            **{f"{ligne_field_name}__lot_id__in": lot_ids}
        )

        try:
            qs = qs.select_related(
                ligne_field_name,
                f"{ligne_field_name}__lot",
                f"{ligne_field_name}__appel",
            )
        except Exception:
            pass

        order_field = _first_model_field(
            PaiementAppel,
            ["date_paiement", "date", "created_at", "created", "id"],
        )

        if order_field and order_field != "id":
            qs = qs.order_by(f"-{order_field}", "-id")
        else:
            qs = qs.order_by("-id")

        q = request.query_params.get("q")
        if q:
            q = q.strip()

            searchable_filters = Q()

            if _has_model_field(PaiementAppel, "reference"):
                searchable_filters |= Q(reference__icontains=q)

            if _has_model_field(PaiementAppel, "reference_paiement"):
                searchable_filters |= Q(reference_paiement__icontains=q)

            if _has_model_field(PaiementAppel, "numero_recu"):
                searchable_filters |= Q(numero_recu__icontains=q)

            if _has_model_field(PaiementAppel, "mode_paiement"):
                searchable_filters |= Q(mode_paiement__icontains=q)

            searchable_filters |= Q(
                **{f"{ligne_field_name}__appel__libelle__icontains": q}
            )
            searchable_filters |= Q(
                **{f"{ligne_field_name}__lot__reference__icontains": q}
            )
            searchable_filters |= Q(
                **{f"{ligne_field_name}__lot__numero__icontains": q}
            )

            qs = qs.filter(searchable_filters)

        paiements_payload = []
        total_paye = Decimal("0")
        nb_annules = 0

        for paiement in qs:
            ligne = getattr(paiement, ligne_field_name, None)
            appel = getattr(ligne, "appel", None) if ligne else None
            lot = getattr(ligne, "lot", None) if ligne else None

            montant = _decimal(
                _first_attr(
                    paiement,
                    ["montant", "amount", "montant_paye", "valeur"],
                    default=0,
                )
            )

            is_cancelled = _paiement_is_cancelled(paiement)

            if is_cancelled:
                nb_annules += 1
            else:
                total_paye += montant

            paiement_date = _first_attr(
                paiement,
                ["date_paiement", "date", "created_at", "created"],
                default=None,
            )

            mode_paiement = _first_attr(
                paiement,
                ["mode_paiement", "mode", "type_paiement"],
                default="",
            )

            reference = _first_attr(
                paiement,
                ["reference", "reference_paiement", "numero_recu"],
                default="",
            )

            paiements_payload.append(
                {
                    "id": paiement.id,
                    "ligne_id": getattr(ligne, "id", None),
                    "appel_id": getattr(appel, "id", None),
                    "appel_libelle": getattr(appel, "libelle", "") or (
                        f"Appel #{getattr(appel, 'id', '')}" if appel else ""
                    ),
                    "lot": {
                        "id": getattr(lot, "id", None),
                        "label": _lot_label(lot) if lot else "Lot",
                        "reference": getattr(lot, "reference", "") if lot else "",
                        "numero": getattr(lot, "numero", "") if lot else "",
                        "type_lot": getattr(lot, "type_lot", "") if lot else "",
                        "etage": getattr(lot, "etage", "") if lot else "",
                    },
                    "montant": _money(montant),
                    "date_paiement": _serialize_date(paiement_date),
                    "mode_paiement": str(mode_paiement or ""),
                    "reference": str(reference or ""),
                    "statut": "ANNULE" if is_cancelled else "VALIDE",
                    "statut_label": "Annulé" if is_cancelled else "Validé",
                    "is_cancelled": is_cancelled,
                }
            )

        return Response(
            {
                "count": len(paiements_payload),
                "stats": {
                    "total_paye": _money(total_paye),
                    "nb_paiements": len(paiements_payload),
                    "nb_annules": nb_annules,
                },
                "paiements": paiements_payload,
            }
        )