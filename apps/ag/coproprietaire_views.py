from __future__ import annotations

from typing import Any

from django.db.models import Q
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.serializers import Serializer, IntegerField, SerializerMethodField
from rest_framework.views import APIView

from apps.ag.models import AssembleeGenerale, PresenceLot, Resolution, Vote
from apps.owners.models import Coproprietaire, ProprietaireLot


VISIBLE_STATUSES = {
    "CONVOQUEE",
    "CONVOQUÉE",
    "OUVERTE",
    "CLOTUREE",
    "CLÔTURÉE",
    "ARCHIVEE",
    "ARCHIVÉE",
    "ANNULEE",
    "ANNULÉE",
}

STATUS_LABELS = {
    "BROUILLON": "Brouillon",
    "CONVOQUEE": "Convoquée",
    "CONVOQUÉE": "Convoquée",
    "OUVERTE": "Ouverte",
    "CLOTUREE": "Clôturée",
    "CLÔTURÉE": "Clôturée",
    "ARCHIVEE": "Archivée",
    "ARCHIVÉE": "Archivée",
    "ANNULEE": "Annulée",
    "ANNULÉE": "Annulée",
}


def _model_has_field(model: type, field_name: str) -> bool:
    try:
        model._meta.get_field(field_name)
        return True
    except Exception:
        return False


def _first_existing_field(model: type, candidates: list[str]) -> str | None:
    for field_name in candidates:
        if _model_has_field(model, field_name):
            return field_name
    return None


def _value(obj: Any, *field_names: str) -> Any:
    for field_name in field_names:
        if not hasattr(obj, field_name):
            continue

        raw = getattr(obj, field_name)

        if callable(raw):
            try:
                return raw()
            except TypeError:
                continue

        return raw

    return None


def _as_upper(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip().upper()


def _absolute_file_url(request, value: Any) -> str | None:
    if not value:
        return None

    url = getattr(value, "url", value)

    if not isinstance(url, str) or not url:
        return None

    if request is not None and url.startswith("/"):
        return request.build_absolute_uri(url)

    return url


def _get_current_coproprietaire(user) -> Coproprietaire | None:
    for field_name in ["user_account", "user", "compte_utilisateur"]:
        if _model_has_field(Coproprietaire, field_name):
            coproprietaire = Coproprietaire.objects.filter(**{field_name: user}).first()
            if coproprietaire:
                return coproprietaire

    return None


def _get_active_owner_lots(coproprietaire: Coproprietaire):
    owner_field = _first_existing_field(
        ProprietaireLot,
        ["coproprietaire", "proprietaire", "owner"],
    )

    if not owner_field:
        return ProprietaireLot.objects.none()

    qs = ProprietaireLot.objects.filter(**{owner_field: coproprietaire})

    if _model_has_field(ProprietaireLot, "is_active"):
        qs = qs.filter(is_active=True)

    if _model_has_field(ProprietaireLot, "actif"):
        qs = qs.filter(actif=True)

    if _model_has_field(ProprietaireLot, "date_fin"):
        qs = qs.filter(Q(date_fin__isnull=True))

    return qs


def _safe_values_list(qs, lookup: str) -> list[int]:
    try:
        return list(qs.values_list(lookup, flat=True).distinct())
    except Exception:
        return []


def _get_lot_ids(owner_lots) -> list[int]:
    if not _model_has_field(ProprietaireLot, "lot"):
        return []

    return [value for value in _safe_values_list(owner_lots, "lot_id") if value]


def _get_copropriete_ids(owner_lots, coproprietaire: Coproprietaire) -> list[int]:
    copro_ids = []

    if _model_has_field(ProprietaireLot, "lot"):
        copro_ids = [
            value
            for value in _safe_values_list(owner_lots, "lot__copropriete_id")
            if value
        ]

    if copro_ids:
        return copro_ids

    copropriete_id = _value(coproprietaire, "copropriete_id")
    if copropriete_id:
        return [copropriete_id]

    return []


def _resolution_qs_for_ag(ag: AssembleeGenerale):
    ag_field = _first_existing_field(
        Resolution,
        ["assemblee_generale", "assemblee", "ag"],
    )

    if not ag_field:
        return Resolution.objects.none()

    return Resolution.objects.filter(**{ag_field: ag})


def _presence_qs_for_ag(ag: AssembleeGenerale, lot_ids: list[int]):
    ag_field = _first_existing_field(
        PresenceLot,
        ["assemblee_generale", "assemblee", "ag"],
    )

    if not ag_field:
        return PresenceLot.objects.none()

    qs = PresenceLot.objects.filter(**{ag_field: ag})

    if lot_ids and _model_has_field(PresenceLot, "lot"):
        qs = qs.filter(lot_id__in=lot_ids)

    return qs


def _vote_qs_for_ag(ag: AssembleeGenerale, lot_ids: list[int]):
    resolutions = _resolution_qs_for_ag(ag)
    if not resolutions.exists():
        return Vote.objects.none()

    resolution_field = _first_existing_field(Vote, ["resolution"])
    if not resolution_field:
        return Vote.objects.none()

    qs = Vote.objects.filter(**{f"{resolution_field}__in": resolutions})

    if lot_ids and _model_has_field(Vote, "lot"):
        qs = qs.filter(lot_id__in=lot_ids)

    return qs


class CoproprietaireAGSerializer(Serializer):
    id = IntegerField(read_only=True)

    titre = SerializerMethodField()
    description = SerializerMethodField()
    statut = SerializerMethodField()
    statut_label = SerializerMethodField()
    date_ag = SerializerMethodField()
    lieu = SerializerMethodField()

    quorum_atteint = SerializerMethodField()
    pv_locked = SerializerMethodField()
    pv_url = SerializerMethodField()
    pv_signed_url = SerializerMethodField()
    has_pv = SerializerMethodField()

    total_resolutions = SerializerMethodField()
    presence_coproprietaire = SerializerMethodField()
    vote_summary = SerializerMethodField()

    def get_titre(self, obj):
        return _value(obj, "titre", "title", "objet", "libelle") or f"Assemblée générale #{obj.id}"

    def get_description(self, obj):
        return _value(obj, "description", "ordre_du_jour", "notes") or ""

    def get_statut(self, obj):
        return _as_upper(_value(obj, "statut", "status"))

    def get_statut_label(self, obj):
        statut = self.get_statut(obj)
        return STATUS_LABELS.get(statut, statut.title() if statut else "Non défini")

    def get_date_ag(self, obj):
        value = _value(
            obj,
            "date_assemblee",
            "date_reunion",
            "date_ag",
            "scheduled_at",
            "date",
            "created_at",
        )

        if hasattr(value, "isoformat"):
            return value.isoformat()

        return value

    def get_lieu(self, obj):
        return _value(obj, "lieu", "location", "adresse") or ""

    def get_quorum_atteint(self, obj):
        value = _value(obj, "quorum_atteint", "quorum_reached", "is_quorum_reached")
        if value is None:
            return None
        return bool(value)

    def get_pv_locked(self, obj):
        return bool(_value(obj, "pv_locked", "is_pv_locked", "locked", "is_locked"))

    def get_pv_url(self, obj):
        request = self.context.get("request")
        value = _value(obj, "pv_pdf", "pv_file", "pv_document")
        return _absolute_file_url(request, value)

    def get_pv_signed_url(self, obj):
        request = self.context.get("request")
        value = _value(obj, "pv_signed_pdf", "pv_signe_pdf", "signed_pv_pdf")
        return _absolute_file_url(request, value)

    def get_has_pv(self, obj):
        return bool(self.get_pv_signed_url(obj) or self.get_pv_url(obj))

    def get_total_resolutions(self, obj):
        return _resolution_qs_for_ag(obj).count()

    def get_presence_coproprietaire(self, obj):
        lot_ids = self.context.get("lot_ids", [])
        qs = _presence_qs_for_ag(obj, lot_ids)

        if not qs.exists():
            return {
                "status": "NON_INITIALISEE",
                "label": "Non initialisée",
                "count": 0,
            }

        present_count = 0

        for presence in qs:
            is_present = _value(
                presence,
                "present",
                "is_present",
                "est_present",
                "present_physiquement",
            )
            if bool(is_present):
                present_count += 1

        if present_count > 0:
            return {
                "status": "PRESENT",
                "label": "Présent",
                "count": present_count,
            }

        return {
            "status": "ABSENT",
            "label": "Absent / non marqué présent",
            "count": qs.count(),
        }

    def get_vote_summary(self, obj):
        lot_ids = self.context.get("lot_ids", [])
        qs = _vote_qs_for_ag(obj, lot_ids)

        counts: dict[str, int] = {}

        for vote in qs:
            choice = _as_upper(_value(vote, "choix", "vote", "valeur", "decision"))
            choice = choice or "NON_DEFINI"
            counts[choice] = counts.get(choice, 0) + 1

        return {
            "total": qs.count(),
            "par_choix": counts,
        }


class CoproprietaireAssembleesAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        coproprietaire = _get_current_coproprietaire(request.user)

        if not coproprietaire:
            return Response(
                {
                    "count": 0,
                    "stats": {
                        "total": 0,
                        "a_venir": 0,
                        "ouvertes": 0,
                        "cloturees": 0,
                        "pv_disponibles": 0,
                    },
                    "assemblees": [],
                }
            )

        owner_lots = _get_active_owner_lots(coproprietaire)
        lot_ids = _get_lot_ids(owner_lots)
        copropriete_ids = _get_copropriete_ids(owner_lots, coproprietaire)

        if not copropriete_ids:
            return Response(
                {
                    "count": 0,
                    "stats": {
                        "total": 0,
                        "a_venir": 0,
                        "ouvertes": 0,
                        "cloturees": 0,
                        "pv_disponibles": 0,
                    },
                    "assemblees": [],
                }
            )

        copro_field = _first_existing_field(AssembleeGenerale, ["copropriete"])
        if not copro_field:
            return Response(
                {
                    "count": 0,
                    "stats": {
                        "total": 0,
                        "a_venir": 0,
                        "ouvertes": 0,
                        "cloturees": 0,
                        "pv_disponibles": 0,
                    },
                    "assemblees": [],
                }
            )

        qs = AssembleeGenerale.objects.filter(
            **{f"{copro_field}_id__in": copropriete_ids}
        )

        status_field = _first_existing_field(AssembleeGenerale, ["statut", "status"])
        requested_status = request.query_params.get("statut")

        if status_field:
            if requested_status:
                qs = qs.filter(**{f"{status_field}__iexact": requested_status})
            else:
                qs = qs.exclude(**{f"{status_field}__iexact": "BROUILLON"})

        search = request.query_params.get("search")
        if search:
            search_query = Q()

            for field_name in ["titre", "title", "objet", "lieu", "location"]:
                if _model_has_field(AssembleeGenerale, field_name):
                    search_query |= Q(**{f"{field_name}__icontains": search})

            if search_query:
                qs = qs.filter(search_query)

        ordering_field = _first_existing_field(
            AssembleeGenerale,
            ["date_assemblee", "date_reunion", "date_ag", "scheduled_at", "date", "created_at"],
        )

        if ordering_field:
            qs = qs.order_by(f"-{ordering_field}", "-id")
        else:
            qs = qs.order_by("-id")

        serializer = CoproprietaireAGSerializer(
            qs,
            many=True,
            context={
                "request": request,
                "lot_ids": lot_ids,
            },
        )

        assemblees = list(serializer.data)

        stats = {
            "total": len(assemblees),
            "a_venir": 0,
            "ouvertes": 0,
            "cloturees": 0,
            "pv_disponibles": 0,
        }

        for ag in assemblees:
            statut = _as_upper(ag.get("statut"))

            if statut in {"CONVOQUEE", "CONVOQUÉE"}:
                stats["a_venir"] += 1

            if statut == "OUVERTE":
                stats["ouvertes"] += 1

            if statut in {"CLOTUREE", "CLÔTURÉE", "ARCHIVEE", "ARCHIVÉE"}:
                stats["cloturees"] += 1

            if ag.get("has_pv"):
                stats["pv_disponibles"] += 1

        return Response(
            {
                "count": len(assemblees),
                "stats": stats,
                "assemblees": assemblees,
            }
        )