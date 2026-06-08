# apps/billing_app/views.py

from datetime import date, datetime, time
from decimal import Decimal, ROUND_HALF_UP

from django.apps import apps
from django.db import models, transaction, IntegrityError
from django.shortcuts import get_object_or_404
from django.utils import timezone

from rest_framework import status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.compta.permissions import IsAdminOrSyndicWriteReadOnly
from apps.core.models import CoproMembre
from apps.lots.models import Lot, LotTantieme

from .models import (
    AppelDeFonds,
    Exercice,
    LigneAppelDeFonds,
    PaiementAppel,
    RelanceLot,
)
from .serializers import (
    PaiementAppelSerializer,
    RelanceLotSerializer,
    SituationFinanciereCoproprietaireSerializer,
)
from .services.pdf import generate_relance_pdf


# =========================================================
# HELPERS
# =========================================================

DEC_0 = Decimal("0.00")
DEC_2 = Decimal("0.01")


def _money(value) -> Decimal:
    if value is None:
        return DEC_0

    if not isinstance(value, Decimal):
        value = Decimal(str(value))

    return value.quantize(DEC_2, rounding=ROUND_HALF_UP)


def _require_copro_id(request) -> int:
    copro_id = getattr(request, "copropriete_id", None)
    if not copro_id:
        copro_id = request.headers.get("X-Copropriete-Id")

    if not copro_id:
        raise ValidationError({"detail": "En-tête X-Copropriete-Id requis."})

    try:
        return int(str(copro_id))
    except ValueError:
        raise ValidationError({"detail": "X-Copropriete-Id invalide (entier requis)."})


def _parse_date_param(request, key: str):
    value = request.query_params.get(key)
    if not value:
        return None

    try:
        d = datetime.strptime(value, "%Y-%m-%d").date()
    except ValueError:
        raise ValidationError({key: "Format invalide. Attendu: YYYY-MM-DD"})

    if key == "from":
        return timezone.make_aware(datetime.combine(d, time.min))
    return timezone.make_aware(datetime.combine(d, time.max))


def _get_coproprietaire_membership(request):
    """
    Retourne la copropriété active du copropriétaire connecté.

    Si l’utilisateur est rattaché à plusieurs copropriétés, on peut préciser :
    ?copropriete_id=11
    ou
    ?copropriete=11
    """

    user = request.user

    if not user or not user.is_authenticated:
        raise PermissionDenied("Authentification requise.")

    memberships = (
        CoproMembre.objects.select_related("copropriete")
        .filter(
            user=user,
            is_active=True,
            role=CoproMembre.Role.COPROPRIETAIRE,
        )
        .order_by("copropriete_id")
    )

    if not memberships.exists():
        raise PermissionDenied(
            "Aucun accès copropriétaire actif n’est rattaché à ce compte."
        )

    requested_copro_id = (
        request.query_params.get("copropriete_id")
        or request.query_params.get("copropriete")
    )

    if requested_copro_id:
        try:
            requested_copro_id_int = int(str(requested_copro_id))
        except ValueError:
            raise ValidationError(
                {"copropriete_id": "La copropriété demandée doit être un entier."}
            )

        membership = memberships.filter(copropriete_id=requested_copro_id_int).first()

        if not membership:
            raise PermissionDenied(
                "Vous n’avez pas accès à la situation financière de cette copropriété."
            )

        return membership

    return memberships.first()


def _month_key(value) -> str:
    if not value:
        return ""

    if isinstance(value, datetime):
        value = value.date()

    return f"{value.year:04d}-{value.month:02d}"


def _month_label(key: str) -> str:
    month_names = {
        "01": "janvier",
        "02": "février",
        "03": "mars",
        "04": "avril",
        "05": "mai",
        "06": "juin",
        "07": "juillet",
        "08": "août",
        "09": "septembre",
        "10": "octobre",
        "11": "novembre",
        "12": "décembre",
    }

    if not key or "-" not in key:
        return key

    year, month = key.split("-", 1)
    return f"{month_names.get(month, month)} {year}"


def _iter_month_keys(start_date: date, end_date: date) -> list[str]:
    if start_date > end_date:
        start_date, end_date = end_date, start_date

    current = date(start_date.year, start_date.month, 1)
    end = date(end_date.year, end_date.month, 1)

    keys: list[str] = []

    while current <= end:
        keys.append(_month_key(current))

        if current.month == 12:
            current = date(current.year + 1, 1, 1)
        else:
            current = date(current.year, current.month + 1, 1)

    return keys


def _empty_month_bucket() -> dict:
    return {
        "total_appels": DEC_0,
        "total_paye": DEC_0,
        "credits": DEC_0,
        "debits": DEC_0,
    }


def _get_exercice_for_scope(copro_id: int, request):
    """
    Choisit l’exercice financier.

    Priorité :
    1. ?exercice_id=
    2. ?annee=
    3. exercice actif
    4. dernier exercice connu
    """

    exercice_id = request.query_params.get("exercice_id")
    annee = request.query_params.get("annee")

    base_qs = Exercice.objects.filter(copropriete_id=copro_id).order_by("-annee", "-id")

    if exercice_id:
        try:
            exercice_id_int = int(str(exercice_id))
        except ValueError:
            raise ValidationError({"exercice_id": "L’exercice doit être un entier."})

        exercice = base_qs.filter(id=exercice_id_int).first()

        if not exercice:
            raise ValidationError(
                {"exercice_id": "Exercice introuvable pour cette copropriété."}
            )

        return exercice

    if annee:
        try:
            annee_int = int(str(annee))
        except ValueError:
            raise ValidationError({"annee": "L’année doit être un entier."})

        exercice = base_qs.filter(annee=annee_int).first()

        if not exercice:
            raise ValidationError(
                {"annee": "Aucun exercice trouvé pour cette année."}
            )

        return exercice

    exercice = base_qs.filter(actif=True).first()

    if exercice:
        return exercice

    return base_qs.first()


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

    statut = getattr(paiement, "statut", None)
    if statut and str(statut).upper() in ("ANNULE", "ANNULÉ", "CANCELLED", "CANCELED"):
        return True

    return False


def _paiement_appel_is_rapproche(paiement: PaiementAppel) -> bool:
    """
    Bloque annulation si :
    - MouvementBancaire lié
    - OU RapprochementBancaire actif vers ce paiement
    """

    copro_id = getattr(
        getattr(getattr(paiement, "ligne", None), "lot", None),
        "copropriete_id",
        None,
    )

    # 1) FK MouvementBancaire
    try:
        MouvementBancaire = apps.get_model("compta", "MouvementBancaire")
        qs = MouvementBancaire.objects.filter(paiement_appel_id=paiement.id)

        if copro_id is not None:
            try:
                qs = qs.filter(copropriete_id=copro_id)
            except Exception:
                pass

        if qs.exists():
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

        if copro_id is not None:
            try:
                qs = qs.filter(copropriete_id=copro_id)
            except Exception:
                pass

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
        copro_id = _require_copro_id(self.request)

        return (
            RelanceLot.objects.select_related("lot", "appel")
            .filter(lot__copropriete_id=copro_id)
            .order_by("-created_at", "-id")
        )


# =========================================================
# APPELS DE FONDS
# =========================================================

class AppelDeFondsViewSet(viewsets.GenericViewSet):
    permission_classes = [IsAdminOrSyndicWriteReadOnly]
    queryset = AppelDeFonds.objects.select_related("exercice").all()

    def get_queryset(self):
        copro_id = _require_copro_id(self.request)
        qs = super().get_queryset()

        # robustesse selon schéma
        try:
            return qs.filter(copropriete_id=copro_id)
        except Exception:
            pass

        try:
            return qs.filter(exercice__copropriete_id=copro_id)
        except Exception:
            pass

        return qs.none()


# =========================================================
# PAIEMENTS APPEL
# =========================================================

class PaiementAppelViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAdminOrSyndicWriteReadOnly]
    serializer_class = PaiementAppelSerializer
    queryset = (
        PaiementAppel.objects.select_related(
            "ligne",
            "ligne__lot",
            "ligne__appel",
            "ligne__appel__exercice",
        )
        .order_by("-date_paiement", "-id")
    )

    def get_queryset(self):
        copro_id = _require_copro_id(self.request)

        return super().get_queryset().filter(ligne__lot__copropriete_id=copro_id)

    def perform_update(self, serializer):
        raise ValidationError(
            {"detail": "Modification d’un paiement interdite. Créez un nouveau paiement."}
        )

    def perform_destroy(self, instance):
        raise ValidationError(
            {"detail": "Suppression interdite. Utilisez l’endpoint cancel/."}
        )

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
        reason = (request.data.get("reason") or "").strip()

        with transaction.atomic():
            paiement = (
                PaiementAppel.objects.select_for_update()
                .select_related(
                    "ligne",
                    "ligne__lot",
                    "ligne__appel",
                    "ligne__appel__exercice",
                )
                .filter(pk=pk, ligne__lot__copropriete_id=copro_id)
                .first()
            )

            if not paiement:
                raise PermissionDenied("Accès interdit à ce paiement.")

            if _paiement_appel_is_cancelled(paiement):
                return Response(
                    {"detail": "Paiement déjà annulé (soft-cancel)."},
                    status=status.HTTP_200_OK,
                )

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


# =========================================================
# ESPACE COPROPRIÉTAIRE — SITUATION FINANCIÈRE GLOBALE
# =========================================================

class CoproprietaireSituationFinanciereAPIView(APIView):
    """
    GET /api/billing/coproprietaire/situation-financiere/

    Vue lecture seule pour le copropriétaire.

    Objectif métier :
    - afficher une synthèse globale de la copropriété ;
    - montrer les appels, encaissements, restes à recouvrer ;
    - afficher crédits / débits bancaires ;
    - préparer les courbes mensuelles côté React ;
    - ne pas exposer les données sensibles détaillées d'administration.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        membership = _get_coproprietaire_membership(request)

        copropriete = membership.copropriete
        copro_id = int(membership.copropriete_id)

        exercice = _get_exercice_for_scope(copro_id, request)

        today = timezone.localdate()

        if exercice:
            periode_debut = exercice.date_debut
            periode_fin = exercice.date_fin
        else:
            periode_debut = date(today.year, 1, 1)
            periode_fin = today

        lignes_qs = (
            LigneAppelDeFonds.objects.select_related(
                "appel",
                "appel__exercice",
                "lot",
            )
            .filter(
                appel__exercice__copropriete_id=copro_id,
            )
            .order_by("appel__date_emission", "id")
        )

        appels_qs = (
            AppelDeFonds.objects.select_related("exercice")
            .filter(
                exercice__copropriete_id=copro_id,
            )
            .order_by("-date_emission", "-id")
        )

        paiements_qs = (
            PaiementAppel.objects.select_related(
                "ligne",
                "ligne__appel",
                "ligne__appel__exercice",
                "ligne__lot",
            )
            .filter(
                ligne__appel__exercice__copropriete_id=copro_id,
                is_cancelled=False,
            )
            .order_by("-date_paiement", "-id")
        )

        if exercice:
            lignes_qs = lignes_qs.filter(appel__exercice_id=exercice.id)
            appels_qs = appels_qs.filter(exercice_id=exercice.id)
            paiements_qs = paiements_qs.filter(ligne__appel__exercice_id=exercice.id)

        lignes_aggregate = lignes_qs.aggregate(
            total_appels=models.Sum("montant_du"),
            total_encaisse=models.Sum("montant_paye"),
            nb_lignes=models.Count("id"),
            nb_impayees=models.Count("id", filter=models.Q(statut="IMPAYE")),
            nb_partielles=models.Count("id", filter=models.Q(statut="PARTIEL")),
            nb_payees=models.Count("id", filter=models.Q(statut="PAYE")),
        )

        total_appels = _money(lignes_aggregate.get("total_appels"))
        total_encaisse = _money(lignes_aggregate.get("total_encaisse"))
        reste_a_recouvrer = _money(total_appels - total_encaisse)

        if total_appels > DEC_0:
            taux_encaissement = _money((total_encaisse / total_appels) * Decimal("100"))
        else:
            taux_encaissement = DEC_0

        nb_appels = appels_qs.count()
        nb_lignes_appel = int(lignes_aggregate.get("nb_lignes") or 0)
        nb_lignes_impayees = int(lignes_aggregate.get("nb_impayees") or 0)
        nb_lignes_partielles = int(lignes_aggregate.get("nb_partielles") or 0)
        nb_lignes_payees = int(lignes_aggregate.get("nb_payees") or 0)

        CompteBancaire = apps.get_model("compta", "CompteBancaire")
        MouvementBancaire = apps.get_model("compta", "MouvementBancaire")

        comptes_qs = CompteBancaire.objects.filter(
            copropriete_id=copro_id,
            is_active=True,
        )

        solde_initial_total = _money(
            comptes_qs.aggregate(total=models.Sum("solde_initial")).get("total")
        )

        mouvements_qs = (
            MouvementBancaire.objects.select_related("compte")
            .filter(copropriete_id=copro_id)
            .exclude(
                is_cancelled=True,
                cancel_kind=MouvementBancaire.CancelKind.ERROR,
            )
            .order_by("-date_operation", "-id")
        )

        # On limite les mouvements bancaires à la période de l'exercice affiché.
        if periode_debut and periode_fin:
            mouvements_qs = mouvements_qs.filter(
                date_operation__gte=periode_debut,
                date_operation__lte=periode_fin,
            )

        mouvements_aggregate = mouvements_qs.aggregate(
            credits=models.Sum(
                "montant",
                filter=models.Q(sens=MouvementBancaire.Sens.CREDIT),
            ),
            debits=models.Sum(
                "montant",
                filter=models.Q(sens=MouvementBancaire.Sens.DEBIT),
            ),
            count_credits=models.Count(
                "id",
                filter=models.Q(sens=MouvementBancaire.Sens.CREDIT),
            ),
            count_debits=models.Count(
                "id",
                filter=models.Q(sens=MouvementBancaire.Sens.DEBIT),
            ),
        )

        total_credits_bancaires = _money(mouvements_aggregate.get("credits"))
        total_debits_bancaires = _money(mouvements_aggregate.get("debits"))
        solde_bancaire_estime = _money(
            solde_initial_total + total_credits_bancaires - total_debits_bancaires
        )

        month_keys = _iter_month_keys(periode_debut, periode_fin)
        monthly: dict[str, dict] = {
            key: _empty_month_bucket()
            for key in month_keys
        }

        # Appels par mois d'émission.
        # Important : pas de .only(...) ici, car la queryset utilise déjà des select_related.
        for ligne in lignes_qs.iterator():
            key = _month_key(ligne.appel.date_emission)

            if key not in monthly:
                monthly[key] = _empty_month_bucket()

            monthly[key]["total_appels"] += _money(ligne.montant_du)

        # Paiements par mois de paiement.
        # Important : pas de .only(...) ici, pour éviter les conflits avec select_related.
        for paiement in paiements_qs.iterator():
            key = _month_key(paiement.date_paiement)

            if key not in monthly:
                monthly[key] = _empty_month_bucket()

            monthly[key]["total_paye"] += _money(paiement.montant)

        # Mouvements bancaires par mois.
        # Important : pas de .only(...) ici, car mouvements_qs utilise select_related("compte").
        for mouvement in mouvements_qs.iterator():
            key = _month_key(mouvement.date_operation)

            if key not in monthly:
                monthly[key] = _empty_month_bucket()

            if mouvement.sens == MouvementBancaire.Sens.CREDIT:
                monthly[key]["credits"] += _money(mouvement.montant)
            elif mouvement.sens == MouvementBancaire.Sens.DEBIT:
                monthly[key]["debits"] += _money(mouvement.montant)

        courbe_mensuelle = []

        for key in sorted(monthly.keys()):
            bucket = monthly[key]
            credits = _money(bucket["credits"])
            debits = _money(bucket["debits"])

            courbe_mensuelle.append(
                {
                    "mois": key,
                    "mois_label": _month_label(key),
                    "total_appels": _money(bucket["total_appels"]),
                    "total_paye": _money(bucket["total_paye"]),
                    "credits": credits,
                    "debits": debits,
                    "solde_mensuel": _money(credits - debits),
                }
            )

        repartition_mouvements = [
            {
                "type": "CREDIT",
                "label": "Crédits bancaires",
                "montant": total_credits_bancaires,
                "count": int(mouvements_aggregate.get("count_credits") or 0),
            },
            {
                "type": "DEBIT",
                "label": "Débits bancaires",
                "montant": total_debits_bancaires,
                "count": int(mouvements_aggregate.get("count_debits") or 0),
            },
        ]

        derniers_mouvements = []

        for mouvement in mouvements_qs[:8]:
            derniers_mouvements.append(
                {
                    "id": mouvement.id,
                    "date_operation": mouvement.date_operation,
                    "sens": mouvement.sens,
                    "sens_label": mouvement.get_sens_display(),
                    "montant": _money(mouvement.montant),
                    "libelle": mouvement.libelle,
                    "reference": mouvement.reference or "",
                    "compte_label": getattr(mouvement.compte, "nom", "") or "",
                    "rapproche": bool(getattr(mouvement, "is_rapproche", False)),
                    "cancelled": bool(mouvement.is_cancelled),
                    "cancel_kind": mouvement.cancel_kind or "",
                }
            )

        payload = {
            "copropriete_id": copro_id,
            "copropriete_label": getattr(copropriete, "nom", "") or str(copropriete),
            "devise": "FCFA",
            "exercice_id": exercice.id if exercice else None,
            "exercice_annee": exercice.annee if exercice else None,
            "periode_debut": periode_debut,
            "periode_fin": periode_fin,
            "total_appels": total_appels,
            "total_encaisse": total_encaisse,
            "reste_a_recouvrer": reste_a_recouvrer,
            "taux_encaissement": taux_encaissement,
            "total_credits_bancaires": total_credits_bancaires,
            "total_debits_bancaires": total_debits_bancaires,
            "solde_bancaire_estime": solde_bancaire_estime,
            "nb_appels": nb_appels,
            "nb_lignes_appel": nb_lignes_appel,
            "nb_lignes_impayees": nb_lignes_impayees,
            "nb_lignes_partielles": nb_lignes_partielles,
            "nb_lignes_payees": nb_lignes_payees,
            "courbe_mensuelle": courbe_mensuelle,
            "repartition_mouvements": repartition_mouvements,
            "derniers_mouvements": derniers_mouvements,
            "message_transparence": (
                "Cette synthèse présente une vision globale de la copropriété. "
                "Elle est fournie en lecture seule afin de renforcer la transparence "
                "financière auprès des copropriétaires."
            ),
        }

        serializer = SituationFinanciereCoproprietaireSerializer(instance=payload)

        return Response(serializer.data)