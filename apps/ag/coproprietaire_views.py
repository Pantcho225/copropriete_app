from __future__ import annotations

from typing import Any

from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import IntegrityError, transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework import status
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.serializers import IntegerField, Serializer, SerializerMethodField
from rest_framework.views import APIView

from apps.ag.models import (
    AGProcuration,
    AgConvocation,
    AgConvocationPreuve,
    AssembleeGenerale,
    PresenceLot,
    Resolution,
    Vote,
)
from apps.ag.serializers import AGProcurationSerializer
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

PRESENCE_MODES = {
    "PRESENT_PHYSIQUE": "Présent physiquement",
    "PRESENT_EN_LIGNE": "Présent en ligne",
    "REPRESENTE": "Représenté par procuration",
    "ABSENT": "Absent",
}

PRESENCE_WRITABLE_STATUSES = {
    "CONVOQUEE",
    "CONVOQUÉE",
    "OUVERTE",
}

VOTE_WRITABLE_STATUSES = {
    "OUVERTE",
}

VOTE_CHOICES = {
    "POUR": "Pour",
    "CONTRE": "Contre",
    "ABSTENTION": "Abstention",
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


def _raise_drf_validation(error):
    if hasattr(error, "message_dict"):
        raise ValidationError(error.message_dict)

    if hasattr(error, "messages"):
        raise ValidationError({"detail": error.messages})

    raise ValidationError({"detail": str(error)})


def _get_current_coproprietaire(
    user,
    copropriete_id: int | None = None,
) -> Coproprietaire | None:
    for field_name in ["user_account", "user", "compte_utilisateur"]:
        if not _model_has_field(Coproprietaire, field_name):
            continue

        filters = {field_name: user}

        if copropriete_id and _model_has_field(Coproprietaire, "copropriete"):
            filters["copropriete_id"] = copropriete_id

        coproprietaire = Coproprietaire.objects.filter(**filters).first()

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


def _presence_mode_from_comment(commentaire: str | None) -> str:
    value = _as_upper(commentaire)

    if "PRESENT_EN_LIGNE" in value:
        return "PRESENT_EN_LIGNE"

    if "PRESENT_PHYSIQUE" in value:
        return "PRESENT_PHYSIQUE"

    if "REPRESENTE" in value or "REPRÉSENTÉ" in value:
        return "REPRESENTE"

    if "ABSENT" in value:
        return "ABSENT"

    return ""


def _lot_label(lot) -> str:
    if not lot:
        return ""

    return (
        getattr(lot, "label", None)
        or getattr(lot, "reference", None)
        or getattr(lot, "numero", None)
        or f"Lot #{getattr(lot, 'id', '')}"
    )


def _presence_payload(presence: PresenceLot) -> dict[str, Any]:
    lot = getattr(presence, "lot", None)
    commentaire = getattr(presence, "commentaire", "") or ""
    representant_nom = getattr(presence, "representant_nom", "") or ""
    present_ou_represente = bool(getattr(presence, "present_ou_represente", False))

    mode = _presence_mode_from_comment(commentaire)

    if present_ou_represente:
        if representant_nom:
            status_value = "REPRESENTE"
            label = "Représenté par procuration"
        elif mode == "PRESENT_EN_LIGNE":
            status_value = "PRESENT_EN_LIGNE"
            label = "Présent en ligne"
        else:
            status_value = "PRESENT"
            label = "Présent"
    else:
        status_value = "ABSENT"
        label = "Absent / non marqué présent"

    return {
        "id": presence.id,
        "status": status_value,
        "mode_presence": mode or status_value,
        "label": label,
        "present_ou_represente": present_ou_represente,
        "representant_nom": representant_nom,
        "commentaire": commentaire,
        "tantiemes": str(getattr(presence, "tantiemes", "0")),
        "lot": {
            "id": getattr(lot, "id", None),
            "label": _lot_label(lot),
            "reference": getattr(lot, "reference", "") if lot else "",
            "numero": getattr(lot, "numero", "") if lot else "",
            "type_lot": getattr(lot, "type_lot", "") if lot else "",
            "etage": getattr(lot, "etage", "") if lot else "",
        },
    }


def _presence_summary(qs) -> dict[str, Any]:
    presences = list(qs.select_related("lot").order_by("lot__reference", "lot_id"))

    if not presences:
        return {
            "status": "NON_INITIALISEE",
            "label": "Non initialisée",
            "count": 0,
            "items": [],
        }

    items = [_presence_payload(presence) for presence in presences]

    represented_count = sum(1 for item in items if item["status"] == "REPRESENTE")
    online_count = sum(1 for item in items if item["status"] == "PRESENT_EN_LIGNE")
    present_count = sum(1 for item in items if item["status"] == "PRESENT")
    active_count = sum(1 for item in items if item["present_ou_represente"])

    if represented_count > 0:
        return {
            "status": "REPRESENTE",
            "label": "Représenté par procuration",
            "count": active_count,
            "items": items,
        }

    if online_count > 0:
        return {
            "status": "PRESENT_EN_LIGNE",
            "label": "Présent en ligne",
            "count": active_count,
            "items": items,
        }

    if present_count > 0:
        return {
            "status": "PRESENT",
            "label": "Présent",
            "count": active_count,
            "items": items,
        }

    return {
        "status": "ABSENT",
        "label": "Absent / non marqué présent",
        "count": len(items),
        "items": items,
    }


def _assert_ag_presence_writable(ag: AssembleeGenerale) -> None:
    statut = _as_upper(getattr(ag, "statut", None))

    if statut not in PRESENCE_WRITABLE_STATUSES:
        raise ValidationError(
            {
                "detail": (
                    "La confirmation de présence est disponible uniquement "
                    "pour une assemblée convoquée ou ouverte."
                )
            }
        )

    if getattr(ag, "pv_locked", False):
        raise ValidationError(
            {"detail": "PV verrouillé : confirmation de présence interdite."}
        )


def _build_presence_comment(
    *,
    mode_presence: str,
    commentaire: str,
    source: str,
) -> str:
    mode_label = PRESENCE_MODES.get(mode_presence, mode_presence)

    parts = [
        "Confirmation copropriétaire depuis l’espace en ligne.",
        f"MODE_PRESENCE={mode_presence}",
        f"Mode lisible : {mode_label}",
        f"Source : {source}",
    ]

    if commentaire:
        parts.append(f"Commentaire : {commentaire}")

    return "\n".join(parts)


def _get_client_ip(request) -> str | None:
    forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR")

    if forwarded_for:
        return forwarded_for.split(",")[0].strip()

    return request.META.get("REMOTE_ADDR")


def _assert_resolution_vote_writable(resolution: Resolution) -> None:
    ag = resolution.ag
    statut = _as_upper(getattr(ag, "statut", None))

    if statut not in VOTE_WRITABLE_STATUSES:
        raise ValidationError(
            {
                "detail": (
                    "Le vote en ligne est disponible uniquement lorsque "
                    "l’assemblée générale est ouverte."
                )
            }
        )

    if resolution.cloturee:
        raise ValidationError(
            {"detail": "Cette résolution est clôturée : aucun vote n’est accepté."}
        )

    if ag.is_closed():
        raise ValidationError(
            {"detail": "Assemblée générale clôturée : aucun vote n’est accepté."}
        )

    if getattr(ag, "pv_locked", False):
        raise ValidationError(
            {"detail": "PV verrouillé : aucun vote n’est accepté."}
        )


def _vote_payload(vote: Vote) -> dict[str, Any]:
    lot = getattr(vote, "lot", None)
    resolution = getattr(vote, "resolution", None)

    return {
        "id": vote.id,
        "resolution_id": getattr(resolution, "id", None),
        "lot": {
            "id": getattr(lot, "id", None),
            "label": _lot_label(lot),
            "reference": getattr(lot, "reference", "") if lot else "",
            "numero": getattr(lot, "numero", "") if lot else "",
        },
        "choix": vote.choix,
        "choix_label": VOTE_CHOICES.get(vote.choix, vote.choix),
        "tantiemes": str(vote.tantiemes),
        "source": getattr(vote, "source", ""),
        "locked": bool(getattr(vote, "locked", False)),
        "locked_at": vote.locked_at.isoformat() if getattr(vote, "locked_at", None) else None,
        "created_at": vote.created_at.isoformat() if getattr(vote, "created_at", None) else None,
    }



def _normalise_lookup_value(value: Any) -> str:
    return str(value or "").strip()


def _current_user_emails(user, coproprietaire) -> set[str]:
    values: set[str] = set()

    for value in [
        getattr(user, "email", ""),
        getattr(coproprietaire, "email", ""),
    ]:
        value = _normalise_lookup_value(value).lower()
        if value:
            values.add(value)

    return values


def _current_user_names(user, coproprietaire) -> set[str]:
    values: set[str] = set()

    candidates = [
        getattr(user, "username", ""),
        getattr(user, "get_full_name", lambda: "")(),
        _coproprietaire_label(coproprietaire),
        " ".join(
            part
            for part in [
                getattr(coproprietaire, "prenom", ""),
                getattr(coproprietaire, "nom", ""),
            ]
            if part
        ),
        " ".join(
            part
            for part in [
                getattr(coproprietaire, "prenoms", ""),
                getattr(coproprietaire, "nom", ""),
            ]
            if part
        ),
        " ".join(
            part
            for part in [
                getattr(coproprietaire, "nom", ""),
                getattr(coproprietaire, "prenom", ""),
            ]
            if part
        ),
        " ".join(
            part
            for part in [
                getattr(coproprietaire, "nom", ""),
                getattr(coproprietaire, "prenoms", ""),
            ]
            if part
        ),
    ]

    for value in candidates:
        value = _normalise_lookup_value(value)
        if value:
            values.add(value)

    return values


def _lot_ids_from_voting_rights(voting_rights: list[dict[str, Any]]) -> list[int]:
    ids: list[int] = []

    for right in voting_rights or []:
        lot = right.get("lot")

        if lot and getattr(lot, "id", None):
            ids.append(lot.id)

    return ids


def _voting_rights_for_ag(coproprietaire, user, ag: AssembleeGenerale) -> list[dict[str, Any]]:
    """
    Retourne les droits de vote du copropriétaire connecté pour une AG :
    - ses lots propres présents/représentés ;
    - les lots qu'il représente via mandat validé.

    Le vote reste toujours enregistré par couple résolution + lot.
    """
    if not coproprietaire or not ag:
        return []

    presences = {
        presence.lot_id: presence
        for presence in PresenceLot.objects.filter(
            ag=ag,
            present_ou_represente=True,
        ).select_related("lot")
        if presence.lot_id
    }

    rights_by_lot: dict[int, dict[str, Any]] = {}

    owner_lots = _get_active_owner_lots(coproprietaire)

    if _model_has_field(ProprietaireLot, "lot"):
        owner_lots = owner_lots.filter(lot__copropriete_id=ag.copropriete_id)

    owner_lots = owner_lots.select_related("lot").order_by(
        "-principal",
        "lot__reference",
        "lot_id",
        "-date_debut",
        "-id",
    )

    for owner_lot in owner_lots:
        lot = getattr(owner_lot, "lot", None)

        if not lot or not getattr(lot, "id", None):
            continue

        presence = presences.get(lot.id)

        if not presence:
            continue

        rights_by_lot[lot.id] = {
            "kind": "PROPRIETAIRE",
            "source": "PROPRIETAIRE",
            "source_label": "Propriétaire",
            "lot": lot,
            "presence": presence,
            "coproprietaire": coproprietaire,
            "mandant": None,
            "procuration": None,
        }

    emails = _current_user_emails(user, coproprietaire)
    names = _current_user_names(user, coproprietaire)

    lookup = Q()

    for email in emails:
        lookup |= Q(mandataire_email__iexact=email)

    for name in names:
        lookup |= Q(mandataire_nom__iexact=name)

    if lookup:
        validated_status = getattr(AGProcuration.Statut, "VALIDEE", "VALIDEE")

        procurations = (
            AGProcuration.objects.filter(
                ag=ag,
                statut=validated_status,
            )
            .filter(lookup)
            .select_related("lot", "coproprietaire")
            .order_by("lot__reference", "lot_id", "-validated_at", "-id")
        )

        for procuration in procurations:
            lot = getattr(procuration, "lot", None)

            if not lot or not getattr(lot, "id", None):
                continue

            presence = presences.get(lot.id)

            if not presence:
                continue

            # Si la personne est propriétaire ET mandataire du même lot, on conserve
            # la source propriétaire pour éviter un doublon de droit de vote.
            if lot.id in rights_by_lot:
                continue

            mandant = getattr(procuration, "coproprietaire", None)
            mandant_label = _coproprietaire_label(mandant) or "mandant"

            rights_by_lot[lot.id] = {
                "kind": "MANDAT",
                "source": "MANDAT",
                "source_label": f"Mandat {mandant_label}",
                "lot": lot,
                "presence": presence,
                "coproprietaire": mandant or coproprietaire,
                "mandant": mandant,
                "procuration": procuration,
            }

    return list(rights_by_lot.values())


def _voting_right_payload(
    right: dict[str, Any],
    resolution: Resolution | None = None,
) -> dict[str, Any]:
    lot = right.get("lot")
    presence = right.get("presence")
    mandant = right.get("mandant")
    procuration = right.get("procuration")
    existing_vote = None

    if resolution is not None and lot is not None:
        vote = (
            Vote.objects.filter(
                resolution=resolution,
                lot=lot,
            )
            .select_related("lot", "resolution")
            .first()
        )

        if vote:
            existing_vote = _vote_payload(vote)

    return {
        "lot_id": getattr(lot, "id", None),
        "lot": {
            "id": getattr(lot, "id", None),
            "label": _lot_label(lot),
            "reference": getattr(lot, "reference", "") if lot else "",
            "numero": getattr(lot, "numero", "") if lot else "",
        },
        "source": right.get("source") or right.get("kind") or "",
        "source_label": right.get("source_label") or "",
        "tantiemes": str(getattr(presence, "tantiemes", "0") or "0"),
        "present_ou_represente": bool(getattr(presence, "present_ou_represente", False)),
        "representant_nom": getattr(presence, "representant_nom", "") or "",
        "mandant": (
            {
                "id": getattr(mandant, "id", None),
                "label": _coproprietaire_label(mandant),
            }
            if mandant
            else None
        ),
        "procuration_id": getattr(procuration, "id", None) if procuration else None,
        "existing_vote": existing_vote,
    }



def _resolution_vote_summary(resolution: Resolution, lot_ids: list[int]) -> dict[str, Any]:
    qs = Vote.objects.filter(resolution=resolution)

    if lot_ids:
        qs = qs.filter(lot_id__in=lot_ids)

    counts: dict[str, int] = {}

    for vote in qs:
        choix = _as_upper(getattr(vote, "choix", ""))
        choix = choix or "NON_DEFINI"
        counts[choix] = counts.get(choix, 0) + 1

    return {
        "total": qs.count(),
        "par_choix": counts,
        "votes": [_vote_payload(vote) for vote in qs.select_related("lot", "resolution")],
    }


def _resolution_payload(
    resolution: Resolution,
    lot_ids: list[int],
    voting_rights: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    voting_rights = voting_rights or []

    return {
        "id": resolution.id,
        "ordre": getattr(resolution, "ordre", None),
        "titre": getattr(resolution, "titre", "") or f"Résolution #{resolution.id}",
        "texte": getattr(resolution, "texte", "") or "",
        "cloturee": bool(getattr(resolution, "cloturee", False)),
        "type_majorite": getattr(resolution, "type_majorite", "") or "",
        "budget_vote": (
            str(resolution.budget_vote)
            if getattr(resolution, "budget_vote", None) is not None
            else None
        ),
        "vote_summary": _resolution_vote_summary(resolution, lot_ids),
        "voting_rights": [
            _voting_right_payload(right, resolution=resolution)
            for right in voting_rights
        ],
    }

def _coproprietaire_label(coproprietaire) -> str:
    if not coproprietaire:
        return ""

    parts = []

    for field_name in ["nom", "last_name", "name"]:
        value = getattr(coproprietaire, field_name, None)
        if value:
            parts.append(str(value).strip())
            break

    for field_name in ["prenoms", "prenom", "first_name"]:
        value = getattr(coproprietaire, field_name, None)
        if value:
            parts.append(str(value).strip())
            break

    label = " ".join(part for part in parts if part).strip()

    if label:
        return label

    user = getattr(coproprietaire, "user_account", None) or getattr(
        coproprietaire,
        "user",
        None,
    )

    if user:
        user_label = (
            getattr(user, "get_full_name", lambda: "")()
            or getattr(user, "username", "")
            or getattr(user, "email", "")
        )
        if user_label:
            return str(user_label).strip()

    return str(coproprietaire)



def _preuve_user_label(user) -> str:
    if not user:
        return ""

    full_name = ""
    try:
        full_name = user.get_full_name()
    except Exception:
        full_name = ""

    return (
        full_name
        or getattr(user, "username", "")
        or getattr(user, "email", "")
        or str(user)
    )


def _preuve_summary(preuve) -> dict[str, Any] | None:
    if not preuve:
        return None

    created_at = getattr(preuve, "created_at", None)

    return {
        "id": getattr(preuve, "pk", None),
        "reference": getattr(preuve, "reference", "") or "",
        "type_evenement": getattr(preuve, "type_evenement", "") or "",
        "type_evenement_label": (
            preuve.get_type_evenement_display()
            if hasattr(preuve, "get_type_evenement_display")
            else getattr(preuve, "type_evenement", "") or ""
        ),
        "canal": getattr(preuve, "canal", "") or "",
        "canal_label": (
            preuve.get_canal_display()
            if hasattr(preuve, "get_canal_display")
            else getattr(preuve, "canal", "") or ""
        ),
        "statut": getattr(preuve, "statut", "") or "",
        "statut_label": (
            preuve.get_statut_display()
            if hasattr(preuve, "get_statut_display")
            else getattr(preuve, "statut", "") or ""
        ),
        "created_at": created_at.isoformat() if created_at else None,
        "utilisateur_label": _preuve_user_label(getattr(preuve, "utilisateur", None)),
        "commentaire": getattr(preuve, "commentaire", "") or "",
    }


def _convocation_preuves_by_type(convocation: AgConvocation, type_evenement: str):
    try:
        return convocation.preuves.filter(type_evenement=type_evenement)
    except Exception:
        return AgConvocationPreuve.objects.none()

def _convocation_payload(convocation: AgConvocation, request) -> dict[str, Any]:
    ag = getattr(convocation, "ag", None)
    lot = getattr(convocation, "lot", None)
    coproprietaire = getattr(convocation, "coproprietaire", None)
    document = getattr(convocation, "document", None)

    document_url = None

    if document:
        file_value = (
            getattr(document, "file", None)
            or getattr(document, "fichier", None)
            or getattr(document, "document", None)
        )
        document_url = _absolute_file_url(request, file_value)

    ag_date = _value(
        ag,
        "date_ag",
        "date_assemblee",
        "date_reunion",
        "scheduled_at",
        "date",
    )

    notification_preuves = _convocation_preuves_by_type(
        convocation,
        AgConvocationPreuve.TYPE_NOTIFICATION,
    )
    consultation_preuves = _convocation_preuves_by_type(
        convocation,
        AgConvocationPreuve.TYPE_CONSULTATION,
    )
    last_notification_proof = (
        notification_preuves.order_by("-created_at", "-id").first()
    )
    last_consultation_proof = (
        consultation_preuves.order_by("-created_at", "-id").first()
    )
    preuve_notification_count = notification_preuves.count()
    preuve_consultation_count = consultation_preuves.count()

    return {
        "id": convocation.id,
        "reference": convocation.reference,
        "parent_convocation": getattr(convocation, "parent_convocation_id", None),
        "parent_reference": (
            getattr(getattr(convocation, "parent_convocation", None), "reference", "")
            or ""
        ),
        "parent_convocation_reference": (
            getattr(getattr(convocation, "parent_convocation", None), "reference", "")
            or ""
        ),
        "version": getattr(convocation, "version", 1) or 1,
        "is_rectificative": bool(getattr(convocation, "is_rectificative", False)),
        "motif_rectification": getattr(convocation, "motif_rectification", "") or "",
        "is_active_version": bool(getattr(convocation, "is_active_version", False)),
        "is_replaced_version": bool(getattr(convocation, "is_replaced_version", False)),
        "replaced_by": getattr(getattr(convocation, "replaced_by", None), "pk", None),
        "replaced_by_reference": getattr(convocation, "replaced_by_reference", "") or "",
        "official_version_label": getattr(convocation, "official_version_label", "") or "",
        "preuve_notification_count": preuve_notification_count,
        "preuve_consultation_count": preuve_consultation_count,
        "last_notification_proof": _preuve_summary(last_notification_proof),
        "last_consultation_proof": _preuve_summary(last_consultation_proof),
        "notification_traced": preuve_notification_count > 0,
        "consultation_acknowledged": preuve_consultation_count > 0,
        "ag": getattr(ag, "id", None),
        "ag_titre": _value(ag, "titre", "title", "objet", "libelle") if ag else "",
        "ag_date_ag": ag_date.isoformat() if hasattr(ag_date, "isoformat") else ag_date,
        "copropriete": getattr(convocation, "copropriete_id", None),
        "copropriete_label": str(getattr(convocation, "copropriete", "") or ""),
        "coproprietaire": getattr(coproprietaire, "id", None),
        "coproprietaire_label": _coproprietaire_label(coproprietaire),
        "lot": getattr(lot, "id", None),
        "lot_label": _lot_label(lot),
        "lot_reference": getattr(lot, "reference", "") if lot else "",
        "lot_numero": getattr(lot, "numero", "") if lot else "",
        "document": getattr(document, "id", None) if document else None,
        "document_url": document_url,
        "statut": convocation.statut,
        "statut_label": (
            convocation.get_statut_display()
            if hasattr(convocation, "get_statut_display")
            else convocation.statut
        ),
        "canal": convocation.canal,
        "canal_label": (
            convocation.get_canal_display()
            if hasattr(convocation, "get_canal_display")
            else convocation.canal
        ),
        "objet": convocation.objet,
        "message": convocation.message,
        "generated_at": (
            convocation.generated_at.isoformat()
            if convocation.generated_at
            else None
        ),
        "sent_at": convocation.sent_at.isoformat() if convocation.sent_at else None,
        "consulted_at": (
            convocation.consulted_at.isoformat()
            if convocation.consulted_at
            else None
        ),
        "cancelled_at": (
            convocation.cancelled_at.isoformat()
            if convocation.cancelled_at
            else None
        ),
        "created_at": (
            convocation.created_at.isoformat()
            if convocation.created_at
            else None
        ),
        "updated_at": (
            convocation.updated_at.isoformat()
            if convocation.updated_at
            else None
        ),
    }

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
    resolutions = SerializerMethodField()

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
        return _presence_summary(qs)

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

    def get_resolutions(self, obj):
        lot_ids = self.context.get("lot_ids", [])
        qs = _resolution_qs_for_ag(obj).order_by("ordre", "id")

        request = self.context.get("request")
        coproprietaire = self.context.get("coproprietaire")
        voting_rights = self.context.get("voting_rights")

        if voting_rights is None and request is not None and coproprietaire is not None:
            voting_rights = _voting_rights_for_ag(coproprietaire, request.user, obj)

        if voting_rights:
            lot_ids = _lot_ids_from_voting_rights(voting_rights)

        return [
            _resolution_payload(resolution, lot_ids, voting_rights or [])
            for resolution in qs
        ]


def _request_ip_address(request):
    forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR", "")

    if forwarded_for:
        return forwarded_for.split(",")[0].strip() or None

    return request.META.get("REMOTE_ADDR") or None


def _request_user_agent(request):
    return request.META.get("HTTP_USER_AGENT", "") or ""


def _convocation_destinataire_email(convocation):
    owner = getattr(convocation, "coproprietaire", None)

    if not owner:
        return ""

    return (
        getattr(owner, "email", "")
        or getattr(owner, "email_address", "")
        or ""
    )


def _convocation_destinataire_telephone(convocation):
    owner = getattr(convocation, "coproprietaire", None)

    if not owner:
        return ""

    return (
        getattr(owner, "telephone", "")
        or getattr(owner, "phone", "")
        or getattr(owner, "mobile", "")
        or ""
    )


class CoproprietaireConvocationsAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        coproprietaire = _get_current_coproprietaire(request.user)

        if not coproprietaire:
            return Response(
                {
                    "count": 0,
                    "convocations": [],
                },
                status=status.HTTP_200_OK,
            )

        owner_lots = _get_active_owner_lots(coproprietaire)
        lot_ids = _get_lot_ids(owner_lots)

        if not lot_ids:
            return Response(
                {
                    "count": 0,
                    "convocations": [],
                },
                status=status.HTTP_200_OK,
            )

        qs = (
            AgConvocation.objects.select_related(
                "ag",
                "copropriete",
                "coproprietaire",
                "lot",
                "document",
                "parent_convocation",
            )
            .filter(
                coproprietaire=coproprietaire,
                lot_id__in=lot_ids,
            )
            .exclude(ag__titre__startswith="[ARCHIVE TEST]")
            .order_by("-generated_at", "-created_at", "-id")
        )

        ag_id = request.query_params.get("ag")
        if ag_id:
            qs = qs.filter(ag_id=ag_id)

        statut = request.query_params.get("statut")
        if statut:
            qs = qs.filter(statut=str(statut).strip().upper())

        return Response(
            {
                "count": qs.count(),
                "convocations": [
                    _convocation_payload(convocation, request)
                    for convocation in qs
                ],
            },
            status=status.HTTP_200_OK,
        )


class CoproprietaireConvocationConsulterAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, convocation_id: int):
        coproprietaire = _get_current_coproprietaire(request.user)

        if not coproprietaire:
            raise PermissionDenied(
                "Aucun profil copropriétaire actif ne correspond à cette convocation."
            )

        owner_lots = _get_active_owner_lots(coproprietaire)
        lot_ids = _get_lot_ids(owner_lots)

        convocation = (
            AgConvocation.objects.select_related(
                "ag",
                "copropriete",
                "coproprietaire",
                "lot",
                "document",
                "parent_convocation",
            )
            .filter(
                pk=convocation_id,
                coproprietaire=coproprietaire,
                lot_id__in=lot_ids,
            )
            .exclude(ag__titre__startswith="[ARCHIVE TEST]")
            .first()
        )

        if not convocation:
            raise ValidationError({"detail": "Convocation introuvable."})

        if convocation.statut == "ANNULEE":
            raise ValidationError(
                {
                    "detail": (
                        "Cette convocation est annulée et ne peut plus être consultée."
                    )
                }
            )

        if not convocation.is_active_version:
            raise ValidationError(
                {
                    "detail": (
                        "Seule la version officielle actuelle peut être consultée. "
                        "Cette convocation est une ancienne version."
                    )
                }
            )

        statut_initial = convocation.statut
        already_consulted = convocation.statut == "CONSULTEE"

        if not already_consulted:
            try:
                convocation.mark_consulted()
            except DjangoValidationError as exc:
                raise ValidationError({"detail": str(exc)})

            convocation.refresh_from_db()

        consultation_proof = (
            AgConvocationPreuve.objects.filter(
                convocation=convocation,
                type_evenement=AgConvocationPreuve.TYPE_CONSULTATION,
                statut=AgConvocationPreuve.STATUT_SUCCES,
                metadata__source="espace_coproprietaire",
            )
            .order_by("-created_at", "-id")
            .first()
        )

        if consultation_proof is None:
            consultation_proof = AgConvocationPreuve.objects.create(
                convocation=convocation,
                ag=convocation.ag,
                copropriete=convocation.copropriete,
                coproprietaire=convocation.coproprietaire,
                lot=convocation.lot,
                utilisateur=request.user if request.user.is_authenticated else None,
                type_evenement=AgConvocationPreuve.TYPE_CONSULTATION,
                canal="PLATEFORME",
                statut=AgConvocationPreuve.STATUT_SUCCES,
                destinataire_email=_convocation_destinataire_email(convocation),
                destinataire_telephone=_convocation_destinataire_telephone(convocation),
                objet=convocation.objet or f"Convocation - {convocation.ag.titre}",
                commentaire=(
                    "Accusé de consultation de la convocation officielle actuelle "
                    "depuis l’espace copropriétaire."
                ),
                ip_address=_request_ip_address(request),
                user_agent=_request_user_agent(request),
                metadata={
                    "source": "espace_coproprietaire",
                    "convocation_reference": convocation.reference,
                    "ag_id": convocation.ag_id,
                    "lot_id": convocation.lot_id,
                    "coproprietaire_id": convocation.coproprietaire_id,
                    "version": convocation.version,
                    "is_rectificative": bool(convocation.is_rectificative),
                    "statut_initial": statut_initial,
                    "statut_final": convocation.statut,
                    "already_consulted": already_consulted,
                },
            )

        return Response(
            {
                "detail": (
                    "Convocation déjà consultée ; accusé existant conservé."
                    if already_consulted
                    else "Convocation consultée avec succès."
                ),
                "already_consulted": already_consulted,
                "proof_reference": consultation_proof.reference,
                "convocation": _convocation_payload(convocation, request),
            },
            status=status.HTTP_200_OK,
        )


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
        ).exclude(
            titre__startswith="[ARCHIVE TEST]"
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
                "request": request,
                "coproprietaire": coproprietaire,
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


class CoproprietaireProcurationsAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        owner_ids = list(
            Coproprietaire.objects.filter(
                user_account=request.user,
                actif=True,
            ).values_list("id", flat=True)
        )

        if not owner_ids:
            return Response({"count": 0, "procurations": []}, status=status.HTTP_200_OK)

        qs = (
            AGProcuration.objects.select_related(
                "ag",
                "coproprietaire",
                "lot",
                "document",
                "created_by",
                "validated_by",
                "rejected_by",
            )
            .filter(coproprietaire_id__in=owner_ids)
            .exclude(ag__titre__startswith="[ARCHIVE TEST]")
            .order_by("-created_at", "-id")
        )

        ag_id = request.query_params.get("ag")
        if ag_id:
            qs = qs.filter(ag_id=ag_id)

        statut = request.query_params.get("statut")
        if statut:
            qs = qs.filter(statut=str(statut).strip().upper())

        serializer = AGProcurationSerializer(
            qs,
            many=True,
            context={"request": request},
        )

        return Response(
            {
                "count": qs.count(),
                "procurations": serializer.data,
            },
            status=status.HTTP_200_OK,
        )

    def post(self, request):
        ag_id = request.data.get("ag") or request.data.get("ag_id")
        lot_id = request.data.get("lot") or request.data.get("lot_id")

        if not ag_id:
            raise ValidationError({"ag": "L’assemblée générale est obligatoire."})

        ag = (
            AssembleeGenerale.objects.select_related("copropriete")
            .filter(pk=ag_id)
            .exclude(titre__startswith="[ARCHIVE TEST]")
            .first()
        )

        if not ag:
            raise ValidationError({"ag": "Assemblée générale introuvable."})

        if ag.statut not in {"CONVOQUEE", "CONVOQUÉE", "OUVERTE"}:
            raise ValidationError(
                {
                    "ag": (
                        "Une procuration ne peut être créée que pour une AG "
                        "convoquée ou ouverte."
                    )
                }
            )

        if ag.is_closed() or ag.pv_locked:
            raise ValidationError(
                {"ag": "AG clôturée ou PV verrouillé : procuration interdite."}
            )

        coproprietaire = _get_current_coproprietaire(
            request.user,
            copropriete_id=ag.copropriete_id,
        )

        if not coproprietaire:
            raise PermissionDenied(
                "Aucun profil copropriétaire actif ne correspond à cette assemblée générale."
            )

        owner_lots = _get_active_owner_lots(coproprietaire)

        if _model_has_field(ProprietaireLot, "lot"):
            owner_lots = owner_lots.filter(lot__copropriete_id=ag.copropriete_id)

        if lot_id:
            owner_lots = owner_lots.filter(lot_id=lot_id)

        owner_lots = owner_lots.select_related("lot").order_by(
            "-principal",
            "lot__reference",
            "lot_id",
            "-date_debut",
            "-id",
        )

        if not owner_lots.exists():
            raise ValidationError(
                {
                    "detail": (
                        "Aucun lot actif rattaché à votre compte ne permet "
                        "de créer une procuration pour cette assemblée."
                    )
                }
            )

        if not lot_id and owner_lots.count() > 1:
            raise ValidationError(
                {
                    "lot_id": (
                        "Vous possédez plusieurs lots. Veuillez préciser le lot "
                        "concerné par cette procuration."
                    )
                }
            )

        owner_lot = owner_lots.first()
        lot = getattr(owner_lot, "lot", None)

        if not lot:
            raise ValidationError({"lot": "Lot introuvable pour cette procuration."})

        payload = {
            "ag": ag.id,
            "coproprietaire": coproprietaire.id,
            "lot": lot.id,
            "mandataire_nom": str(request.data.get("mandataire_nom") or "").strip(),
            "mandataire_telephone": str(
                request.data.get("mandataire_telephone") or ""
            ).strip(),
            "mandataire_email": str(
                request.data.get("mandataire_email") or ""
            ).strip(),
        }

        serializer = AGProcurationSerializer(
            data=payload,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)

        try:
            procuration = serializer.save(
                created_by=request.user,
                ip_address=_get_client_ip(request),
                user_agent=str(request.META.get("HTTP_USER_AGENT") or "")[:255],
            )
        except IntegrityError:
            raise ValidationError(
                {
                    "detail": (
                        "Une procuration active existe déjà pour ce lot et cette AG. "
                        "Annulez-la ou attendez son traitement avant d’en créer une nouvelle."
                    )
                }
            )
        except DjangoValidationError as exc:
            _raise_drf_validation(exc)

        return Response(
            {
                "detail": "Votre demande de procuration a été enregistrée.",
                "procuration": AGProcurationSerializer(
                    procuration,
                    context={"request": request},
                ).data,
            },
            status=status.HTTP_201_CREATED,
        )


class CoproprietaireProcurationAnnulerAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, procuration_id: int):
        procuration = (
            AGProcuration.objects.select_related(
                "ag",
                "coproprietaire",
                "lot",
                "document",
                "created_by",
                "validated_by",
                "rejected_by",
            )
            .filter(
                pk=procuration_id,
                coproprietaire__user_account=request.user,
            )
            .first()
        )

        if not procuration:
            raise ValidationError({"detail": "Procuration introuvable."})

        try:
            procuration = procuration.annuler(user=request.user)
        except DjangoValidationError as exc:
            _raise_drf_validation(exc)

        return Response(
            {
                "detail": "Procuration annulée avec succès.",
                "procuration": AGProcurationSerializer(
                    procuration,
                    context={"request": request},
                ).data,
            },
            status=status.HTTP_200_OK,
        )


class CoproprietairePresenceAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, ag_id: int):
        ag = (
            AssembleeGenerale.objects.select_related("copropriete")
            .filter(pk=ag_id)
            .first()
        )

        if not ag:
            raise ValidationError({"detail": "Assemblée générale introuvable."})

        _assert_ag_presence_writable(ag)

        coproprietaire = _get_current_coproprietaire(
            request.user,
            copropriete_id=ag.copropriete_id,
        )

        if not coproprietaire:
            raise PermissionDenied(
                "Aucun profil copropriétaire actif ne correspond à cette assemblée générale."
            )

        mode_presence = _as_upper(request.data.get("mode_presence"))

        if mode_presence not in PRESENCE_MODES:
            raise ValidationError(
                {
                    "mode_presence": (
                        "Mode de présence invalide. Valeurs attendues : "
                        "PRESENT_PHYSIQUE, PRESENT_EN_LIGNE, REPRESENTE ou ABSENT."
                    )
                }
            )

        representant_nom = str(request.data.get("representant_nom") or "").strip()
        commentaire = str(request.data.get("commentaire") or "").strip()
        lot_id = request.data.get("lot_id") or request.data.get("lot")

        if mode_presence == "REPRESENTE" and not representant_nom:
            raise ValidationError(
                {
                    "representant_nom": (
                        "Le nom du mandataire est obligatoire lorsque vous choisissez "
                        "le mode représenté par procuration."
                    )
                }
            )

        owner_lots = _get_active_owner_lots(coproprietaire)

        if _model_has_field(ProprietaireLot, "lot"):
            owner_lots = owner_lots.filter(lot__copropriete_id=ag.copropriete_id)

        if lot_id:
            owner_lots = owner_lots.filter(lot_id=lot_id)

        owner_lots = owner_lots.select_related("lot", "coproprietaire").order_by(
            "-principal",
            "lot__reference",
            "lot_id",
            "-date_debut",
            "-id",
        )

        if not owner_lots.exists():
            raise ValidationError(
                {
                    "detail": (
                        "Aucun lot actif rattaché à votre compte ne permet "
                        "de confirmer votre présence pour cette assemblée."
                    )
                }
            )

        present_ou_represente = mode_presence != "ABSENT"
        final_representant = representant_nom if mode_presence == "REPRESENTE" else ""

        comment = _build_presence_comment(
            mode_presence=mode_presence,
            commentaire=commentaire,
            source="coproprietaire",
        )

        updated_presences: list[PresenceLot] = []

        with transaction.atomic():
            for owner_lot in owner_lots:
                lot = getattr(owner_lot, "lot", None)

                if not lot:
                    continue

                presence, _ = PresenceLot.objects.get_or_create(
                    ag=ag,
                    lot=lot,
                    defaults={
                        "present_ou_represente": present_ou_represente,
                        "representant_nom": final_representant,
                        "commentaire": comment,
                    },
                )

                presence.present_ou_represente = present_ou_represente
                presence.representant_nom = final_representant
                presence.commentaire = comment
                presence.refresh_tantiemes()
                presence.save()

                updated_presences.append(presence)

        if not updated_presences:
            raise ValidationError(
                {
                    "detail": (
                        "Aucun lot valide n’a pu être mis à jour pour cette assemblée."
                    )
                }
            )

        lot_ids = [presence.lot_id for presence in updated_presences if presence.lot_id]
        presence_qs = _presence_qs_for_ag(ag, lot_ids)

        return Response(
            {
                "detail": "Votre présence a été confirmée avec succès.",
                "ag_id": ag.id,
                "mode_presence": mode_presence,
                "mode_presence_label": PRESENCE_MODES[mode_presence],
                "updated_count": len(updated_presences),
                "presence_coproprietaire": _presence_summary(presence_qs),
                "quorum": {
                    "total_tantiemes_copro": str(ag.total_tantiemes_copro()),
                    "total_tantiemes_presents": str(ag.total_tantiemes_presents()),
                    "quorum_atteint": bool(ag.quorum_atteint()),
                },
            },
            status=status.HTTP_200_OK,
        )


class CoproprietaireVoteAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, resolution_id: int):
        resolution = (
            Resolution.objects.select_related("ag", "ag__copropriete")
            .filter(pk=resolution_id)
            .first()
        )

        if not resolution:
            raise ValidationError({"detail": "Résolution introuvable."})

        _assert_resolution_vote_writable(resolution)

        ag = resolution.ag

        coproprietaire = _get_current_coproprietaire(
            request.user,
            copropriete_id=ag.copropriete_id,
        )

        if not coproprietaire:
            raise PermissionDenied(
                "Aucun profil copropriétaire actif ne correspond à cette assemblée générale."
            )

        choix = _as_upper(request.data.get("choix"))

        if choix not in VOTE_CHOICES:
            raise ValidationError(
                {
                    "choix": (
                        "Choix de vote invalide. Valeurs attendues : "
                        "POUR, CONTRE ou ABSTENTION."
                    )
                }
            )

        lot_id = request.data.get("lot_id") or request.data.get("lot")

        voting_rights = _voting_rights_for_ag(coproprietaire, request.user, ag)

        if not voting_rights:
            raise ValidationError(
                {
                    "detail": (
                        "Aucun lot présent ou représenté ne vous donne un droit "
                        "de vote sur cette résolution."
                    )
                }
            )

        if lot_id:
            matching_rights = [
                right
                for right in voting_rights
                if right.get("lot") and str(right["lot"].id) == str(lot_id)
            ]
        else:
            matching_rights = voting_rights

        if not matching_rights:
            raise ValidationError(
                {
                    "lot_id": (
                        "Ce lot n’est pas disponible dans vos droits de vote "
                        "pour cette assemblée."
                    )
                }
            )

        if not lot_id and len(matching_rights) > 1:
            raise ValidationError(
                {
                    "lot_id": (
                        "Plusieurs lots ou mandats sont disponibles. Veuillez préciser "
                        "le lot concerné par ce vote."
                    )
                }
            )

        voting_right = matching_rights[0]
        lot = voting_right.get("lot")
        presence = voting_right.get("presence")
        vote_coproprietaire = voting_right.get("coproprietaire") or coproprietaire

        if not lot:
            raise ValidationError({"detail": "Lot introuvable pour ce vote."})

        if not presence:
            raise ValidationError(
                {
                    "detail": (
                        "Votre lot doit être marqué présent ou représenté "
                        "avant de pouvoir voter."
                    )
                }
            )

        client_ip = _get_client_ip(request)
        user_agent = str(request.META.get("HTTP_USER_AGENT") or "")[:2000]

        try:
            with transaction.atomic():
                locked_resolution = (
                    Resolution.objects.select_for_update()
                    .select_related("ag", "ag__copropriete")
                    .get(pk=resolution.pk)
                )

                _assert_resolution_vote_writable(locked_resolution)

                existing_vote = (
                    Vote.objects.select_for_update()
                    .filter(
                        resolution=locked_resolution,
                        lot=lot,
                    )
                    .first()
                )

                if existing_vote:
                    raise ValidationError(
                        {
                            "detail": (
                                "Un vote a déjà été enregistré pour ce lot "
                                "sur cette résolution. Le vote est unique et verrouillé."
                            ),
                            "vote": _vote_payload(existing_vote),
                        }
                    )

                vote = Vote(
                    resolution=locked_resolution,
                    lot=lot,
                    choix=choix,
                    coproprietaire=vote_coproprietaire,
                    created_by=request.user,
                    source="ESPACE_COPROPRIETAIRE",
                    ip_address=client_ip,
                    user_agent=user_agent,
                    locked=True,
                    locked_at=timezone.now(),
                    locked_by=request.user,
                )
                vote.refresh_tantiemes()
                vote.save()

        except IntegrityError:
            raise ValidationError(
                {
                    "detail": (
                        "Un vote existe déjà pour ce lot sur cette résolution. "
                        "Le vote est unique par lot et par résolution."
                    )
                }
            )

        lot_ids = _lot_ids_from_voting_rights(_voting_rights_for_ag(coproprietaire, request.user, ag))

        return Response(
            {
                "detail": "Votre vote a été enregistré et verrouillé avec succès.",
                "ag_id": ag.id,
                "resolution_id": resolution.id,
                "vote": _vote_payload(vote),
                "vote_summary": _resolution_vote_summary(resolution, lot_ids),
            },
            status=status.HTTP_201_CREATED,
        )