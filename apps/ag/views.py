from __future__ import annotations

from decimal import Decimal, InvalidOperation
import hashlib
import json
import os
import tempfile
from typing import Any, Optional, Iterable, List

from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.files.base import ContentFile
from apps.documents.models import GeneratedDocument
from django.db import transaction
from django.db.models import Max
from django.utils import timezone

from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.lots.models import Lot

from .models import (
    AGProcuration,
    AgConvocation,
    AgConvocationPreuve,
    AssembleeGenerale,
    PresenceLot,
    Resolution,
    Vote,
)
from .permissions import IsSyndicOrAdmin
from apps.documents.services.pdf import (
    generate_convocation_ag_pdf_bytes,
    save_generated_pdf_document,
)
from .serializers import (
    AGProcurationSerializer,
    AgConvocationSerializer,
    AssembleeGeneraleSerializer,
    PresenceLotSerializer,
    ResolutionSerializer,
    VoteSerializer,
)
from .services.results import compute_resolution_result


def generate_ag_pv_pdf_bytes(ag: AssembleeGenerale, *, request) -> bytes:
    from .services.pdf import generate_ag_pv_pdf_bytes as _impl

    return _impl(ag, request=request)


def sign_pdf_pades(
    *,
    pdf_bytes: bytes,
    pfx_path: str,
    pfx_password: str,
    reason: str,
    location: str,
):
    from .services.pades import sign_pdf_pades as _impl

    return _impl(
        pdf_bytes=pdf_bytes,
        pfx_path=pfx_path,
        pfx_password=pfx_password,
        reason=reason,
        location=location,
    )


def _require_copro_id(request) -> str:
    copro_id = getattr(request, "copropriete_id", None)

    if not copro_id:
        copro_id = request.headers.get("X-Copropriete-Id")

    if not copro_id:
        raise ValidationError({"detail": "En-tête X-Copropriete-Id requis."})

    return str(copro_id)


def _assert_same_copro(request, ag: AssembleeGenerale):
    copro_id = _require_copro_id(request)

    if str(ag.copropriete_id) != str(copro_id):
        raise ValidationError(
            {"detail": "AG hors périmètre de la copropriété courante."}
        )


def _assert_ag_writable(ag: AssembleeGenerale):
    if getattr(ag, "statut", None) == "CLOTUREE":
        raise ValidationError({"detail": "AG clôturée : modification interdite."})

    if getattr(ag, "pv_locked", False):
        raise ValidationError({"detail": "PV verrouillé : modification interdite."})



def _assert_ag_has_ordre_du_jour(ag: AssembleeGenerale):
    if not ag.resolutions.exists():
        raise ValidationError(
            {
                "detail": (
                    "Impossible de générer les convocations : l’ordre du jour de cette AG est vide. "
                    "Ajoutez au moins une résolution avant de générer les convocations."
                )
            }
        )


def _ag_status_label(ag: AssembleeGenerale) -> str:
    statut = str(getattr(ag, "statut", "") or "").strip().upper()

    labels = {
        "BROUILLON": "brouillon",
        "CONVOQUEE": "convoquée",
        "CONVOQUÉE": "convoquée",
        "OUVERTE": "ouverte",
        "CLOTUREE": "clôturée",
        "CLÔTUREE": "clôturée",
        "ARCHIVEE": "archivée",
        "ANNULÉE": "annulée",
        "ANNULEE": "annulée",
    }

    return labels.get(statut, statut.lower() or "non défini")


def _ag_not_open_message(ag: AssembleeGenerale, *, what: str) -> str:
    statut_label = _ag_status_label(ag)
    what_lower = what.lower()

    if "résolution" in what_lower or "resolution" in what_lower:
        return (
            f"Cette assemblée est en statut {statut_label} : {what} interdit. "
            "Les résolutions doivent normalement être préparées avant l’envoi de la convocation. "
            "Une fois l’AG convoquée, l’ordre du jour doit rester figé ; si une résolution manque, "
            "repassez l’AG en brouillon ou créez une nouvelle convocation selon votre procédure interne."
        )

    return (
        f"Cette assemblée est en statut {statut_label} : {what} interdit. "
        "Cette action est disponible uniquement lorsque l’assemblée est officiellement ouverte "
        "par le syndic et non verrouillée."
    )


def _assert_ag_open_and_writable(ag: AssembleeGenerale, *, what: str):
    statut = getattr(ag, "statut", None)

    if statut != "OUVERTE":
        raise ValidationError({"detail": _ag_not_open_message(ag, what=what)})

    if statut == "CLOTUREE":
        raise ValidationError({"detail": f"AG clôturée : {what} interdit."})

    if getattr(ag, "pv_locked", False):
        raise ValidationError({"detail": f"PV verrouillé : {what} interdit."})


def _assert_resolution_writable(ag: AssembleeGenerale, *, what: str):
    statut = str(getattr(ag, "statut", "") or "").strip().upper()

    if statut == "CLOTUREE":
        raise ValidationError({"detail": f"AG clôturée : {what} interdit."})

    if getattr(ag, "pv_locked", False):
        raise ValidationError({"detail": f"PV verrouillé : {what} interdit."})

    if statut not in {"BROUILLON", "OUVERTE"}:
        raise ValidationError({"detail": _ag_not_open_message(ag, what=what)})


def _raise_drf_validation(error):
    if hasattr(error, "message_dict"):
        raise ValidationError(error.message_dict)

    if hasattr(error, "messages"):
        raise ValidationError({"detail": error.messages})

    raise ValidationError({"detail": str(error)})


def _get_ag_closing_blockers(ag: AssembleeGenerale) -> list[str]:
    blockers: list[str] = []

    if getattr(ag, "statut", None) == "ANNULEE":
        blockers.append("AG annulée : clôture interdite.")

    if (
        not getattr(ag, "pv_signed_pdf", None)
        or not getattr(ag, "pv_signed_hash", "")
        or not getattr(ag, "pv_signed_at", None)
    ):
        blockers.append("PV signé obligatoire avant clôture.")

    if not getattr(ag, "pv_locked", False):
        blockers.append("PV doit être verrouillé avant clôture.")

    if not ag.presences.exists():
        blockers.append("Aucune présence enregistrée.")

    if not ag.presences.filter(present_ou_represente=True).exists():
        blockers.append("Aucun lot présent ou représenté.")

    if not ag.resolutions.exists():
        blockers.append("Aucune résolution enregistrée.")

    for res in ag.resolutions.all().order_by("ordre", "id"):
        if not res.votes.exists():
            blockers.append(f"Aucun vote enregistré pour la résolution #{res.ordre}.")

    if not ag.quorum_atteint():
        blockers.append("Quorum non atteint.")

    return blockers


def _assert_ag_closable(ag: AssembleeGenerale):
    blockers = _get_ag_closing_blockers(ag)

    if blockers:
        raise ValidationError(
            {"detail": "Clôture impossible.", "blocking_reasons": blockers}
        )


def _sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _parse_decimal(value: Any, field_name: str) -> Decimal:
    try:
        d = Decimal(str(value))
    except (InvalidOperation, TypeError):
        raise ValidationError({field_name: "Format invalide. Exemple: 1400000.00"})

    return d


def _safe_uploaded_filename(name: str) -> str:
    if not name:
        return ""

    return os.path.basename(name)


def _model_field_names(obj) -> set[str]:
    try:
        return {f.name for f in obj._meta.get_fields()}
    except Exception:
        return set()


def _has_model_field(obj, field_name: str) -> bool:
    return field_name in _model_field_names(obj)


def _safe_save(obj, update_fields: Iterable[str] | None = None):
    if not update_fields:
        obj.save()
        return

    names = _model_field_names(obj)
    filtered = [f for f in update_fields if f in names]

    if filtered:
        obj.save(update_fields=filtered)
    else:
        obj.save()


def _getattr_any(obj, candidates: List[str], default=None):
    for name in candidates:
        if hasattr(obj, name):
            return getattr(obj, name)

    return default


def _fetch_dossier_travaux_for_resolution(*, res: Resolution):
    try:
        from apps.travaux.models import DossierTravaux
    except Exception:
        return None, None

    dossier = (
        DossierTravaux.objects.select_for_update()
        .filter(copropriete_id=res.ag.copropriete_id, resolution_validation_id=res.id)
        .first()
    )

    if (
        dossier is None
        and _has_model_field(res, "travaux_dossier")
        and getattr(res, "travaux_dossier_id", None)
    ):
        dossier = (
            DossierTravaux.objects.select_for_update()
            .filter(pk=res.travaux_dossier_id, copropriete_id=res.ag.copropriete_id)
            .first()
        )

    return dossier, DossierTravaux


def _sync_resolution_dossier_links(*, res: Resolution, dossier):
    if getattr(dossier, "resolution_validation_id", None) not in (None, res.id):
        raise ValidationError(
            {
                "detail": (
                    "Incohérence: le dossier est déjà lié "
                    "(resolution_validation) à une autre résolution."
                )
            }
        )

    if getattr(dossier, "resolution_validation_id", None) != res.id:
        dossier.resolution_validation_id = res.id
        _safe_save(dossier, update_fields=["resolution_validation"])

    if not _has_model_field(res, "travaux_dossier"):
        return

    if getattr(res, "travaux_dossier_id", None) not in (None, dossier.id):
        raise ValidationError(
            {
                "detail": (
                    "Incohérence: cette résolution est déjà liée à un autre "
                    "dossier (travaux_dossier)."
                )
            }
        )

    if getattr(res, "travaux_dossier_id", None) != dossier.id:
        res.travaux_dossier_id = dossier.id
        _safe_save(res, update_fields=["travaux_dossier"])


def _validate_and_lock_dossier_if_adoptee(
    *,
    request,
    res: Resolution,
    dossier,
    DossierTravaux,
    decision: str,
    budget_vote: Optional[Decimal],
) -> Optional[dict]:
    dossier_statut = _getattr_any(dossier, ["statut", "status"], default=None)
    locked_flag = bool(getattr(dossier, "is_locked", False))

    if decision != "ADOPTEE":
        return {
            "dossier_id": dossier.id,
            "statut": dossier_statut,
            "detail": "Résolution rejetée : dossier non validé.",
        }

    if locked_flag:
        return {
            "dossier_id": dossier.id,
            "statut": dossier_statut,
            "detail": "Dossier déjà verrouillé : aucune modification.",
            "budget_vote": (
                str(getattr(dossier, "budget_vote", None))
                if getattr(dossier, "budget_vote", None) is not None
                else None
            ),
            "locked_at": (
                dossier.locked_at.isoformat()
                if getattr(dossier, "locked_at", None)
                else None
            ),
            "locked_by": getattr(dossier, "locked_by_id", None),
        }

    if hasattr(DossierTravaux, "Statut"):
        SOUMIS_AG = getattr(DossierTravaux.Statut, "SOUMIS_AG", "SOUMIS_AG")
        VALIDE = getattr(DossierTravaux.Statut, "VALIDE", "VALIDE")
    else:
        SOUMIS_AG = "SOUMIS_AG"
        VALIDE = "VALIDE"

    if dossier_statut != SOUMIS_AG:
        return {
            "dossier_id": dossier.id,
            "statut": dossier_statut,
            "detail": (
                "Décision ADOPTEE mais dossier non en statut SOUMIS_AG : "
                "non validé (politique production)."
            ),
        }

    if hasattr(dossier, "statut"):
        dossier.statut = VALIDE
    elif hasattr(dossier, "status"):
        dossier.status = VALIDE

    if hasattr(dossier, "budget_vote"):
        if budget_vote is not None:
            dossier.budget_vote = budget_vote
        elif getattr(dossier, "budget_vote", None) is None and hasattr(
            dossier,
            "budget_estime",
        ):
            dossier.budget_vote = getattr(dossier, "budget_estime", None)

    user = request.user if getattr(request.user, "is_authenticated", False) else None

    if hasattr(dossier, "lock") and callable(getattr(dossier, "lock")):
        try:
            dossier.lock(user=user, save=False)
        except TypeError:
            dossier.lock(user=user)
    else:
        if hasattr(dossier, "locked_at") and not getattr(dossier, "locked_at", None):
            dossier.locked_at = timezone.now()

        if hasattr(dossier, "locked_by") and user and not getattr(
            dossier,
            "locked_by_id",
            None,
        ):
            dossier.locked_by = user

    _safe_save(
        dossier,
        update_fields=[
            "statut",
            "status",
            "budget_vote",
            "locked_at",
            "locked_by",
            "resolution_validation",
        ],
    )

    if hasattr(res, "budget_vote"):
        if budget_vote is not None:
            res.budget_vote = budget_vote
        elif getattr(res, "budget_vote", None) is None:
            res.budget_vote = getattr(dossier, "budget_vote", None)

        _safe_save(res, update_fields=["budget_vote"])

    return {
        "dossier_id": dossier.id,
        "statut": _getattr_any(dossier, ["statut", "status"], default=None),
        "budget_vote": (
            str(getattr(dossier, "budget_vote", None))
            if getattr(dossier, "budget_vote", None) is not None
            else None
        ),
        "locked_at": (
            dossier.locked_at.isoformat()
            if getattr(dossier, "locked_at", None)
            else None
        ),
        "locked_by": getattr(dossier, "locked_by_id", None),
    }


def _close_resolution_and_apply_travaux(
    *,
    request,
    res: Resolution,
    budget_vote: Optional[Decimal],
) -> tuple[dict, Optional[dict]]:
    result = compute_resolution_result(res)
    decision = result["decision"]

    if not res.cloturee:
        Resolution.objects.filter(pk=res.pk).update(cloturee=True)
        res.cloturee = True

    dossier_payload = None
    dossier, DossierTravaux = _fetch_dossier_travaux_for_resolution(res=res)

    if dossier and DossierTravaux:
        _sync_resolution_dossier_links(res=res, dossier=dossier)

        dossier_payload = _validate_and_lock_dossier_if_adoptee(
            request=request,
            res=res,
            dossier=dossier,
            DossierTravaux=DossierTravaux,
            decision=decision,
            budget_vote=budget_vote,
        )

    return result, dossier_payload


try:
    from .models_audit import AGAuditLog  # type: ignore
except Exception:
    AGAuditLog = None


def _client_ip(request) -> str | None:
    xff = request.META.get("HTTP_X_FORWARDED_FOR")

    if xff:
        return xff.split(",")[0].strip()

    return request.META.get("REMOTE_ADDR")


def _log_ag_event(
    request,
    ag: AssembleeGenerale,
    event: str,
    meta: dict | None = None,
):
    if not AGAuditLog:
        return

    user = getattr(request, "user", None)
    actor = user if (user and getattr(user, "is_authenticated", False)) else None

    AGAuditLog.objects.create(
        ag=ag,
        actor=actor,
        event=event,
        ip_address=_client_ip(request),
        user_agent=(request.META.get("HTTP_USER_AGENT") or "")[:255],
        meta=meta or {},
    )


def _build_absolute_file_url(request, file_or_url) -> str | None:
    if not file_or_url:
        return None

    url = None

    if isinstance(file_or_url, str):
        url = file_or_url
    else:
        try:
            url = file_or_url.url
        except (AttributeError, ValueError):
            url = None

    if not url:
        return None

    try:
        return request.build_absolute_uri(url)
    except Exception:
        return url


def _generated_document_url(document, request) -> str | None:
    if not document:
        return None

    for attr in (
        "file",
        "fichier",
        "fichier_pdf",
        "pdf",
        "pdf_file",
        "document",
        "document_file",
    ):
        file_obj = getattr(document, attr, None)
        url = _build_absolute_file_url(request, file_obj)

        if url:
            return url

    for attr in ("url", "file_url", "document_url"):
        value = getattr(document, attr, None)

        if callable(value):
            try:
                value = value()
            except TypeError:
                value = None

        url = _build_absolute_file_url(request, value)

        if url:
            return url

    return None


def _convocation_pdf_payload(convocation: AgConvocation, request) -> dict:
    document = getattr(convocation, "document", None)

    return {
        "id": convocation.id,
        "reference": getattr(convocation, "reference", ""),
        "lot_id": getattr(convocation, "lot_id", None),
        "coproprietaire_id": getattr(convocation, "coproprietaire_id", None),
        "document_id": getattr(convocation, "document_id", None),
        "document_url": _generated_document_url(document, request),
        "parent_convocation_id": getattr(convocation, "parent_convocation_id", None),
        "version": getattr(convocation, "version", 1),
        "is_rectificative": getattr(convocation, "is_rectificative", False),
    }


def _ordre_du_jour_payload(ag: AssembleeGenerale) -> list[dict]:
    resolutions = (
        ag.resolutions.all()
        .order_by("ordre", "id")
        .values(
            "id",
            "ordre",
            "titre",
            "texte",
            "type_majorite",
            "budget_vote",
        )
    )

    payload: list[dict] = []

    for item in resolutions:
        payload.append(
            {
                "id": item.get("id"),
                "ordre": item.get("ordre"),
                "titre": item.get("titre") or "",
                "texte": item.get("texte") or "",
                "type_majorite": item.get("type_majorite") or "",
                "budget_vote": (
                    str(item.get("budget_vote"))
                    if item.get("budget_vote") is not None
                    else ""
                ),
            }
        )

    return payload


def _ordre_du_jour_hash(ag: AssembleeGenerale) -> tuple[str, list[dict]]:
    payload = _ordre_du_jour_payload(ag)
    raw = json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(raw.encode("utf-8")).hexdigest(), payload


def _convocation_document_ordre_du_jour_hash(convocation: AgConvocation) -> str:
    document = getattr(convocation, "document", None)

    if not document:
        return ""

    metadata = getattr(document, "metadata", None) or {}

    if not isinstance(metadata, dict):
        return ""

    return str(metadata.get("ordre_du_jour_hash") or "")


def _convocation_is_traced(convocation: AgConvocation) -> bool:
    statut = str(getattr(convocation, "statut", "") or "").strip().upper()

    return (
        statut in {"ENVOYEE", "CONSULTEE"}
        or getattr(convocation, "sent_at", None) is not None
        or getattr(convocation, "consulted_at", None) is not None
    )


def _assert_can_replace_convocation_pdf(convocation: AgConvocation):
    if _convocation_is_traced(convocation):
        raise ValidationError(
            {
                "detail": (
                    "Impossible de régénérer cette convocation : elle a déjà été envoyée ou consultée. "
                    "L’ordre du jour a changé depuis la génération du PDF. "
                    "Créez une convocation rectificative pour conserver la traçabilité."
                )
            }
        )


def _generated_document_pdf_field_name(document) -> str:
    """
    Retourne le nom du champ fichier PDF du modèle GeneratedDocument.

    Le projet a évolué sur plusieurs sprints ; cette fonction reste volontairement
    tolérante pour fonctionner avec file, fichier_pdf, pdf_file, etc.
    """
    for field_name in (
        "file",
        "fichier",
        "fichier_pdf",
        "pdf",
        "pdf_file",
        "document",
        "document_file",
    ):
        if hasattr(document, field_name):
            return field_name

    for field in getattr(document, "_meta", []).fields:
        field_class = field.__class__.__name__.lower()

        if "file" in field_class:
            return field.name

    return ""


def _replace_generated_document_pdf(
    *,
    document: GeneratedDocument,
    pdf_bytes: bytes,
    title: str,
    metadata: dict,
):
    """
    Remplace le fichier PDF d'un GeneratedDocument existant.

    Important :
    - on ne crée pas un nouveau document ;
    - on conserve la même référence documentaire ;
    - on met à jour le fichier et les métadonnées ;
    - cela évite l'erreur d'unicité sur GeneratedDocument.reference.
    """
    field_name = _generated_document_pdf_field_name(document)

    if not field_name:
        raise ValidationError(
            {
                "detail": (
                    "Impossible de remplacer le PDF : aucun champ fichier trouvé "
                    "sur GeneratedDocument."
                )
            }
        )

    current_file = getattr(document, field_name, None)
    current_name = ""

    if current_file:
        current_name = getattr(current_file, "name", "") or ""

    filename = os.path.basename(current_name) or f"{document.reference}.pdf"

    getattr(document, field_name).save(
        filename,
        ContentFile(pdf_bytes),
        save=False,
    )

    update_fields = [field_name]

    if hasattr(document, "title"):
        document.title = title
        update_fields.append("title")

    if hasattr(document, "metadata"):
        previous_metadata = getattr(document, "metadata", None) or {}

        if not isinstance(previous_metadata, dict):
            previous_metadata = {}

        previous_metadata.update(metadata)
        previous_metadata["pdf_refreshed_at"] = timezone.now().isoformat()
        previous_metadata["pdf_refreshed_reason"] = "convocation_trace_sync"

        document.metadata = previous_metadata
        update_fields.append("metadata")

    if hasattr(document, "updated_at"):
        update_fields.append("updated_at")

    _safe_save(document, update_fields=update_fields)

    return document




def _generate_convocation_pdf_document(
    *,
    convocation: AgConvocation,
    request,
    force: bool = False,
):
    """
    Génère ou régénère le PDF d'une convocation AG.

    Règles métier :
    - Si aucun PDF n'existe encore, le PDF est généré.
    - Si un PDF existe déjà et que l'ordre du jour n'a pas changé :
        - force=False : on conserve le PDF existant ;
        - force=True : on remplace le fichier PDF du document existant pour
          synchroniser les données de traçabilité, notamment sent_at et consulted_at.
    - Si l'ordre du jour a changé :
        - une convocation non tracée peut être régénérée ;
        - une convocation déjà envoyée ou consultée ne peut pas être remplacée :
          il faut créer une rectificative.
    """
    current_hash, ordre_du_jour_payload = _ordre_du_jour_hash(convocation.ag)
    existing_hash = _convocation_document_ordre_du_jour_hash(convocation)

    if getattr(convocation, "document_id", None):
        if existing_hash != current_hash:
            _assert_can_replace_convocation_pdf(convocation)

        if existing_hash == current_hash and not force:
            return convocation.document, False

    pdf_bytes = generate_convocation_ag_pdf_bytes(
        convocation=convocation,
        request=request,
    )

    if not pdf_bytes:
        raise ValidationError({"detail": "Impossible de générer le PDF (bytes vides)."})

    sent_at = getattr(convocation, "sent_at", None)
    consulted_at = getattr(convocation, "consulted_at", None)

    metadata = {
        "source": "ag_convocation",
        "convocation_id": convocation.id,
        "ag_id": convocation.ag_id,
        "copropriete_id": convocation.copropriete_id,
        "lot_id": convocation.lot_id,
        "coproprietaire_id": convocation.coproprietaire_id,
        "canal": convocation.canal,
        "statut": convocation.statut,
        "sent_at": sent_at.isoformat() if sent_at else None,
        "consulted_at": consulted_at.isoformat() if consulted_at else None,
        "ordre_du_jour_hash": current_hash,
        "ordre_du_jour_count": len(ordre_du_jour_payload),
        "resolution_ids": [item["id"] for item in ordre_du_jour_payload],
        "ordre_du_jour_payload": ordre_du_jour_payload,
    }

    title = f"Convocation AG — {convocation.reference}"

    existing_document = getattr(convocation, "document", None)

    if getattr(convocation, "document_id", None) and existing_document:
        document = _replace_generated_document_pdf(
            document=existing_document,
            pdf_bytes=pdf_bytes,
            title=title,
            metadata=metadata,
        )

        convocation.document = document
        convocation.save(update_fields=["document", "updated_at"])

        return document, True

    document = save_generated_pdf_document(
        copropriete=convocation.copropriete,
        document_type=GeneratedDocument.Type.CONVOCATION_AG,
        title=title,
        reference=convocation.reference,
        pdf_bytes=pdf_bytes,
        created_by=request.user,
        related_owner=convocation.coproprietaire,
        related_lot=convocation.lot,
        related_ag=convocation.ag,
        is_visible_to_owner=True,
        metadata=metadata,
    )

    convocation.document = document
    convocation.save(update_fields=["document", "updated_at"])

    return document, True


def _refresh_convocation_pdf_after_trace(*, convocation: AgConvocation, request) -> bool:
    """
    Régénère le PDF d'une convocation après mise à jour de la traçabilité.

    Cette fonction est volontairement limitée aux cas où l'ordre du jour n'a pas
    changé. Si l'ordre du jour a changé après envoi ou consultation, la fonction
    de génération lèvera une ValidationError et imposera une rectificative.
    """
    _assert_ag_has_ordre_du_jour(convocation.ag)

    _, refreshed = _generate_convocation_pdf_document(
        convocation=convocation,
        request=request,
        force=True,
    )

    convocation.refresh_from_db()
    return bool(refreshed)


class AssembleeGeneraleViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, IsSyndicOrAdmin]
    serializer_class = AssembleeGeneraleSerializer
    queryset = AssembleeGenerale.objects.all().order_by("-date_ag", "-id")

    def get_queryset(self):
        copro_id = _require_copro_id(self.request)

        qs = super().get_queryset().filter(copropriete_id=copro_id)

        include_archives = str(
            self.request.query_params.get("include_archives", "")
        ).lower() in {"1", "true", "yes", "on"}

        if not include_archives:
            qs = qs.exclude(titre__startswith="[ARCHIVE TEST]")

        return qs

    def perform_create(self, serializer):
        copro_id = _require_copro_id(self.request)
        serializer.save(copropriete_id=copro_id)

    def perform_update(self, serializer):
        ag = self.get_object()
        _assert_same_copro(self.request, ag)
        _assert_ag_writable(ag)
        serializer.save()

    def perform_destroy(self, instance):
        _assert_same_copro(self.request, instance)
        _assert_ag_writable(instance)
        super().perform_destroy(instance)

    @action(detail=True, methods=["get"], url_path="quorum")
    def quorum(self, request, pk=None):
        ag = self.get_object()
        _assert_same_copro(request, ag)

        total = ag.total_tantiemes_copro()
        presents = Decimal(str(ag.total_tantiemes_presents()))
        atteint = ag.quorum_atteint()

        return Response(
            {
                "ag_id": ag.id,
                "total_tantiemes_copro": float(total),
                "tantiemes_presents": float(presents),
                "quorum_atteint": bool(atteint),
                "seuil": 0.50,
                "has_zero_tantieme_lots": ag.presences.filter(
                    tantiemes__lte=0
                ).exists(),
            },
            status=status.HTTP_200_OK,
        )


    @action(detail=True, methods=["post"], url_path="convoquer")
    def convoquer(self, request, pk=None):
        """
        Convoque officiellement une AG.

        Transition métier :
        - BROUILLON -> CONVOQUEE

        Garde-fous :
        - l'AG doit appartenir à la copropriété active ;
        - l'AG doit être en brouillon ;
        - l'ordre du jour doit contenir au moins une résolution ;
        - au moins une convocation non annulée doit exister ;
        - au moins une convocation doit être envoyée ou consultée.
        """
        ag = self.get_object()
        _assert_same_copro(request, ag)

        if ag.statut == "CONVOQUEE":
            return Response(
                {
                    "ag_id": ag.id,
                    "statut": ag.statut,
                    "detail": "AG déjà officiellement convoquée.",
                },
                status=status.HTTP_200_OK,
            )

        if ag.statut == "OUVERTE":
            return Response(
                {
                    "ag_id": ag.id,
                    "statut": ag.statut,
                    "detail": "AG déjà ouverte.",
                },
                status=status.HTTP_200_OK,
            )

        if ag.statut == "CLOTUREE":
            raise ValidationError({"detail": "AG clôturée : convocation officielle interdite."})

        if ag.statut == "ANNULEE":
            raise ValidationError({"detail": "AG annulée : convocation officielle interdite."})

        if ag.statut != "BROUILLON":
            raise ValidationError(
                {
                    "detail": (
                        "Seule une AG en brouillon peut être convoquée officiellement. "
                        f"Statut actuel : {ag.statut}."
                    )
                }
            )

        resolutions_count = Resolution.objects.filter(ag=ag).count()
        if resolutions_count <= 0:
            raise ValidationError(
                {
                    "detail": (
                        "Impossible de convoquer l’AG : ajoutez au moins une résolution "
                        "à l’ordre du jour."
                    )
                }
            )

        convocations_qs = AgConvocation.objects.filter(ag=ag).exclude(statut="ANNULEE")
        convocations_count = convocations_qs.count()

        if convocations_count <= 0:
            raise ValidationError(
                {
                    "detail": (
                        "Impossible de convoquer l’AG : générez d’abord les convocations."
                    )
                }
            )

        sent_count = convocations_qs.filter(
            statut__in=["ENVOYEE", "ENVOYÉE", "CONSULTEE", "CONSULTÉE"]
        ).count()

        if sent_count <= 0:
            raise ValidationError(
                {
                    "detail": (
                        "Impossible de convoquer officiellement l’AG : marquez au moins "
                        "une convocation comme envoyée ou notifiée."
                    )
                }
            )

        ag.statut = "CONVOQUEE"
        ag.save(update_fields=["statut", "updated_at"])

        _log_ag_event(
            request,
            ag,
            event="AG_CONVOQUEE",
            meta={
                "statut": ag.statut,
                "resolutions_count": resolutions_count,
                "convocations_count": convocations_count,
                "sent_count": sent_count,
            },
        )

        output = self.get_serializer(ag)

        return Response(
            {
                "ag_id": ag.id,
                "statut": ag.statut,
                "detail": "AG officiellement convoquée.",
                "resolutions_count": resolutions_count,
                "convocations_count": convocations_count,
                "sent_count": sent_count,
                "assemblee": output.data,
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=["post"], url_path="ouvrir")
    def ouvrir(self, request, pk=None):
        """
        Ouvre officiellement une AG pour permettre les votes.

        Transition métier :
        - CONVOQUEE -> OUVERTE

        Garde-fous :
        - l'AG doit être convoquée ;
        - le quorum doit être atteint.
        """
        ag = self.get_object()
        _assert_same_copro(request, ag)

        if ag.statut == "OUVERTE":
            return Response(
                {
                    "ag_id": ag.id,
                    "statut": ag.statut,
                    "detail": "AG déjà ouverte.",
                    "quorum_atteint": bool(ag.quorum_atteint()),
                    "total_tantiemes_copro": float(ag.total_tantiemes_copro()),
                    "tantiemes_presents": float(ag.total_tantiemes_presents()),
                },
                status=status.HTTP_200_OK,
            )

        if ag.statut == "BROUILLON":
            raise ValidationError(
                {
                    "detail": (
                        "Impossible d’ouvrir l’AG : elle doit d’abord être officiellement convoquée."
                    )
                }
            )

        if ag.statut == "CLOTUREE":
            raise ValidationError({"detail": "AG clôturée : ouverture interdite."})

        if ag.statut == "ANNULEE":
            raise ValidationError({"detail": "AG annulée : ouverture interdite."})

        if ag.statut != "CONVOQUEE":
            raise ValidationError(
                {
                    "detail": (
                        "Seule une AG convoquée peut être ouverte. "
                        f"Statut actuel : {ag.statut}."
                    )
                }
            )

        total = ag.total_tantiemes_copro()
        presents = ag.total_tantiemes_presents()
        quorum_ok = ag.quorum_atteint()

        if not quorum_ok:
            raise ValidationError(
                {
                    "detail": (
                        "Impossible d’ouvrir l’AG : quorum non atteint."
                    ),
                    "total_tantiemes_copro": float(total),
                    "tantiemes_presents": float(presents),
                    "quorum_atteint": False,
                }
            )

        ag.statut = "OUVERTE"
        ag.save(update_fields=["statut", "updated_at"])

        _log_ag_event(
            request,
            ag,
            event="AG_OUVERTE",
            meta={
                "statut": ag.statut,
                "total_tantiemes_copro": str(total),
                "tantiemes_presents": str(presents),
                "quorum_atteint": bool(quorum_ok),
            },
        )

        output = self.get_serializer(ag)

        return Response(
            {
                "ag_id": ag.id,
                "statut": ag.statut,
                "detail": "AG officiellement ouverte.",
                "quorum_atteint": bool(quorum_ok),
                "total_tantiemes_copro": float(total),
                "tantiemes_presents": float(presents),
                "assemblee": output.data,
            },
            status=status.HTTP_200_OK,
        )


    @action(detail=True, methods=["post"], url_path="generer-convocations")
    def generer_convocations(self, request, pk=None):
        ag = self.get_object()
        _assert_same_copro(request, ag)
        _assert_ag_writable(ag)
        _assert_ag_has_ordre_du_jour(ag)

        if getattr(ag, "statut", None) == "ANNULEE":
            raise ValidationError(
                {"detail": "AG annulée : génération des convocations interdite."}
            )

        canal = "PLATEFORME"

        if request.data and request.data.get("canal"):
            canal = str(request.data.get("canal") or "").strip().upper()

        allowed_canaux = {choice[0] for choice in AgConvocation.CANAL_CHOICES}

        if canal not in allowed_canaux:
            raise ValidationError(
                {
                    "canal": (
                        "Canal invalide. Valeurs autorisées : "
                        f"{', '.join(sorted(allowed_canaux))}."
                    )
                }
            )

        objet = ""
        message = ""

        if request.data:
            objet = str(request.data.get("objet") or "").strip()
            message = str(request.data.get("message") or "").strip()

        created_convocations = []
        created_count = 0
        skipped_existing = 0
        skipped_duplicate_link = 0
        skipped_inactive_owner = 0
        skipped_without_owner = 0

        try:
            from apps.owners.models import ProprietaireLot
        except Exception as exc:
            raise ValidationError(
                {"detail": f"Impossible de charger ProprietaireLot : {str(exc)}"}
            )

        with transaction.atomic():
            ag = AssembleeGenerale.objects.select_for_update().get(
                pk=ag.pk,
                copropriete_id=ag.copropriete_id,
            )

            _assert_ag_writable(ag)
            _assert_ag_has_ordre_du_jour(ag)

            active_links = (
                ProprietaireLot.objects.select_related("lot", "coproprietaire")
                .filter(
                    copropriete_id=ag.copropriete_id,
                    date_fin__isnull=True,
                )
                .order_by("lot_id", "-principal", "id")
            )

            processed_lot_ids = set()

            for link in active_links:
                lot = getattr(link, "lot", None)
                coproprietaire = getattr(link, "coproprietaire", None)

                if not lot:
                    skipped_duplicate_link += 1
                    continue

                if link.lot_id in processed_lot_ids:
                    skipped_duplicate_link += 1
                    continue

                processed_lot_ids.add(link.lot_id)

                if not coproprietaire:
                    skipped_without_owner += 1
                    continue

                owner_is_active = getattr(coproprietaire, "actif", True)

                if owner_is_active is False:
                    skipped_inactive_owner += 1
                    continue

                convocation, was_created = AgConvocation.objects.get_or_create(
                    ag=ag,
                    lot=lot,
                    version=1,
                    defaults={
                        "copropriete": ag.copropriete,
                        "coproprietaire": coproprietaire,
                        "canal": canal,
                        "objet": objet or f"Convocation - {ag.titre}",
                        "message": message,
                        "is_rectificative": False,
                        "metadata": {
                            "source": "generer-convocations",
                            "proprietaire_lot_id": link.id,
                            "principal": bool(getattr(link, "principal", False)),
                            "quote_part": str(getattr(link, "quote_part", "")),
                        },
                    },
                )

                if not was_created:
                    skipped_existing += 1
                    continue

                convocation.mark_generated(user=request.user)
                created_convocations.append(convocation)
                created_count += 1

        _log_ag_event(
            request,
            ag,
            event="AG_CONVOCATIONS_GENERATED",
            meta={
                "created": created_count,
                "skipped_existing": skipped_existing,
                "skipped_duplicate_link": skipped_duplicate_link,
                "skipped_inactive_owner": skipped_inactive_owner,
                "skipped_without_owner": skipped_without_owner,
                "canal": canal,
            },
        )

        serializer = AgConvocationSerializer(
            created_convocations,
            many=True,
            context={"request": request},
        )

        return Response(
            {
                "ag_id": ag.id,
                "created": created_count,
                "skipped_existing": skipped_existing,
                "skipped_duplicate_link": skipped_duplicate_link,
                "skipped_inactive_owner": skipped_inactive_owner,
                "skipped_without_owner": skipped_without_owner,
                "convocations": serializer.data,
            },
            status=status.HTTP_201_CREATED if created_count else status.HTTP_200_OK,
        )

    @action(detail=True, methods=["post"], url_path="generer-pdfs-convocations")
    def generer_pdfs_convocations(self, request, pk=None):
        ag = self.get_object()
        _assert_same_copro(request, ag)
        _assert_ag_has_ordre_du_jour(ag)

        if getattr(ag, "statut", None) == "ANNULEE":
            raise ValidationError(
                {"detail": "AG annulée : génération des PDF de convocations interdite."}
            )

        convocation_ids = list(
            AgConvocation.objects.filter(
                ag_id=ag.id,
                copropriete_id=ag.copropriete_id,
            )
            .order_by("id")
            .values_list("id", flat=True)
        )

        total = len(convocation_ids)

        if total == 0:
            return Response(
                {
                    "detail": (
                        "Aucune convocation n'existe encore pour cette assemblée générale. "
                        "Générez d'abord les convocations."
                    ),
                    "ag_id": ag.id,
                    "total": 0,
                    "generated": 0,
                    "skipped": 0,
                    "errors_count": 0,
                    "generated_items": [],
                    "skipped_items": [],
                    "errors": [],
                    "convocations": [],
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        generated_items = []
        skipped_items = []
        errors = []

        for convocation_id in convocation_ids:
            try:
                with transaction.atomic():
                    convocation = (
                        AgConvocation.objects.select_for_update()
                        .select_related(
                            "ag",
                            "copropriete",
                            "coproprietaire",
                            "lot",
                        )
                        .get(
                            pk=convocation_id,
                            ag_id=ag.id,
                            copropriete_id=ag.copropriete_id,
                        )
                    )

                    if convocation.statut == "ANNULEE":
                        skipped_items.append(
                            {
                                **_convocation_pdf_payload(convocation, request),
                                "reason": "Convocation annulée",
                            }
                        )
                        continue

                    _, was_generated = _generate_convocation_pdf_document(
                        convocation=convocation,
                        request=request,
                        force=False,
                    )

                    convocation.refresh_from_db()

                    if was_generated:
                        generated_items.append(
                            _convocation_pdf_payload(convocation, request)
                        )
                    else:
                        skipped_items.append(
                            {
                                **_convocation_pdf_payload(convocation, request),
                                "reason": "PDF déjà à jour",
                            }
                        )

            except AgConvocation.DoesNotExist:
                errors.append(
                    {
                        "id": convocation_id,
                        "error": "Convocation introuvable ou hors périmètre.",
                    }
                )
            except ValidationError as exc:
                errors.append(
                    {
                        "id": convocation_id,
                        "error": exc.detail,
                    }
                )
            except Exception as exc:
                errors.append(
                    {
                        "id": convocation_id,
                        "error": str(exc),
                    }
                )

        convocations = (
            AgConvocation.objects.select_related(
                "ag",
                "copropriete",
                "coproprietaire",
                "lot",
                "document",
                "generated_by",
                "sent_by",
                "cancelled_by",
            )
            .filter(ag_id=ag.id, copropriete_id=ag.copropriete_id)
            .order_by("-created_at", "-id")
        )

        serializer = AgConvocationSerializer(
            convocations,
            many=True,
            context={"request": request},
        )

        _log_ag_event(
            request,
            ag,
            event="AG_CONVOCATION_PDFS_BATCH_GENERATED",
            meta={
                "total": total,
                "generated": len(generated_items),
                "skipped": len(skipped_items),
                "errors_count": len(errors),
            },
        )

        return Response(
            {
                "detail": "Génération PDF des convocations terminée.",
                "ag_id": ag.id,
                "total": total,
                "generated": len(generated_items),
                "skipped": len(skipped_items),
                "errors_count": len(errors),
                "generated_items": generated_items,
                "skipped_items": skipped_items,
                "errors": errors,
                "convocations": serializer.data,
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=["post"], url_path="init-presences")
    def init_presences(self, request, pk=None):
        ag = self.get_object()
        _assert_same_copro(request, ag)
        _assert_ag_open_and_writable(ag, what="initialisation des présences")

        lots = Lot.objects.filter(copropriete_id=ag.copropriete_id).order_by("id")

        if not lots.exists():
            return Response(
                {"detail": "Aucun lot dans cette copropriété."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        created = 0
        skipped = 0

        with transaction.atomic():
            for lot in lots:
                _, was_created = PresenceLot.objects.get_or_create(
                    ag_id=ag.id,
                    lot_id=lot.id,
                    defaults={"present_ou_represente": False},
                )

                if was_created:
                    created += 1
                else:
                    skipped += 1

        _log_ag_event(
            request,
            ag,
            event="INIT_PRESENCES",
            meta={"created": created, "skipped": skipped, "lots_total": lots.count()},
        )

        return Response(
            {
                "ag_id": ag.id,
                "lots_total": lots.count(),
                "created": created,
                "skipped_existing": skipped,
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=["get"], url_path="pv/pdf")
    def pv_pdf(self, request, pk=None):
        ag = self.get_object()
        _assert_same_copro(request, ag)

        from .services.pdf import generate_ag_pv_pdf

        return generate_ag_pv_pdf(ag, request=request)

    @action(detail=True, methods=["post"], url_path="pv/archive")
    def pv_archive(self, request, pk=None):
        ag = self.get_object()
        _assert_same_copro(request, ag)

        if ag.statut == "CLOTUREE":
            raise ValidationError({"detail": "AG clôturée : archivage interdit."})

        if ag.pv_locked:
            raise ValidationError({"detail": "PV verrouillé : génération du PV interdite."})

        total_resolutions = Resolution.objects.filter(ag=ag).count()
        pending_resolutions = Resolution.objects.filter(ag=ag, cloturee=False).count()

        if total_resolutions <= 0:
            raise ValidationError(
                {"detail": "Impossible de générer le PV : aucune résolution n’est rattachée à cette AG."}
            )

        if pending_resolutions > 0:
            raise ValidationError(
                {
                    "detail": (
                        "Impossible de générer le PV : "
                        f"{pending_resolutions} résolution(s) doivent d’abord être clôturée(s)."
                    )
                }
            )

        with transaction.atomic():
            ag = AssembleeGenerale.objects.select_for_update().get(
                pk=ag.pk,
                copropriete_id=ag.copropriete_id,
            )

            pdf_bytes = generate_ag_pv_pdf_bytes(ag, request=request)

            if not pdf_bytes:
                raise ValidationError(
                    {"detail": "Impossible de générer le PV PDF (bytes vides)."}
                )

            sha = _sha256_bytes(pdf_bytes)

            filename = f"PV-AG-{ag.id:05d}.pdf"
            ag.pv_pdf.save(filename, ContentFile(pdf_bytes), save=False)

            ag.pv_pdf_hash = sha
            ag.pv_generated_at = timezone.now()

            if _has_model_field(ag, "pv_signed_pdf"):
                ag.pv_signed_pdf = None

            if _has_model_field(ag, "pv_signed_hash"):
                ag.pv_signed_hash = ""

            if _has_model_field(ag, "pv_signed_at"):
                ag.pv_signed_at = None

            if _has_model_field(ag, "pv_signer_subject"):
                ag.pv_signer_subject = ""

            if _has_model_field(ag, "pv_locked"):
                ag.pv_locked = False

            _safe_save(
                ag,
                update_fields=[
                    "pv_pdf",
                    "pv_pdf_hash",
                    "pv_generated_at",
                    "pv_signed_pdf",
                    "pv_signed_hash",
                    "pv_signed_at",
                    "pv_signer_subject",
                    "pv_locked",
                ],
            )

        _log_ag_event(
            request,
            ag,
            event="PV_ARCHIVED",
            meta={
                "pv_pdf": getattr(ag.pv_pdf, "name", ""),
                "pv_pdf_hash": ag.pv_pdf_hash,
            },
        )

        return Response(
            {
                "ag_id": ag.id,
                "archived": True,
                "pv_pdf": getattr(ag.pv_pdf, "name", None),
                "pv_pdf_hash": ag.pv_pdf_hash,
                "pv_generated_at": (
                    ag.pv_generated_at.isoformat() if ag.pv_generated_at else None
                ),
                "pv_signed_pdf": getattr(
                    getattr(ag, "pv_signed_pdf", None),
                    "name",
                    None,
                ),
                "pv_signed_hash": getattr(ag, "pv_signed_hash", ""),
                "pv_signed_at": (
                    ag.pv_signed_at.isoformat()
                    if getattr(ag, "pv_signed_at", None)
                    else None
                ),
                "pv_signer_subject": getattr(ag, "pv_signer_subject", ""),
                "pv_locked": getattr(ag, "pv_locked", False),
                "pv_status": "ARCHIVE",
            },
            status=status.HTTP_200_OK,
        )

    @action(
        detail=True,
        methods=["post"],
        url_path="pv/sign",
        permission_classes=[IsAuthenticated, IsSyndicOrAdmin],
    )
    def pv_sign(self, request, pk=None):
        ag = self.get_object()
        _assert_same_copro(request, ag)

        if ag.statut == "CLOTUREE":
            raise ValidationError({"detail": "AG clôturée : signature refusée."})

        if ag.pv_locked:
            raise ValidationError({"detail": "PV déjà verrouillé. Signature refusée."})

        if getattr(ag, "pv_signed_pdf", None):
            raise ValidationError({"detail": "PV déjà signé. Re-signature refusée."})

        if not ag.pv_pdf:
            raise ValidationError({"detail": "PV non généré. Générez d’abord le PV."})

        pfx_file = request.FILES.get("pfx")
        pfx_password = request.data.get("password") or ""

        if not pfx_file or not pfx_password:
            raise ValidationError(
                {"detail": "Fournir pfx (.p12/.pfx) et password (form-data)."}
            )

        pfx_password = str(pfx_password).strip().replace("\x00", "")

        if not pfx_password:
            raise ValidationError(
                {"detail": "Mot de passe PKCS#12 invalide (vide après nettoyage)."}
            )

        original_pdf_bytes = ag.pv_pdf.read()

        if not original_pdf_bytes:
            raise ValidationError({"detail": "PV archivé illisible (bytes vides)."})

        original_hash = _sha256_bytes(original_pdf_bytes)

        if ag.pv_pdf_hash and ag.pv_pdf_hash != original_hash:
            raise ValidationError(
                {"detail": "Incohérence hash PV. Réarchivez le PV (pv/archive)."}
            )

        pfx_bytes = pfx_file.read()

        if not pfx_bytes:
            raise ValidationError({"detail": "Fichier PKCS#12 vide ou illisible."})

        suffix = ".p12"
        upname = (getattr(pfx_file, "name", "") or "").lower()

        if upname.endswith(".pfx"):
            suffix = ".pfx"

        with tempfile.NamedTemporaryFile(suffix=suffix, delete=True) as tmp:
            tmp.write(pfx_bytes)
            tmp.flush()

            try:
                sign_result = sign_pdf_pades(
                    pdf_bytes=original_pdf_bytes,
                    pfx_path=tmp.name,
                    pfx_password=pfx_password,
                    reason=f"Signature PV AG #{ag.id}",
                    location="Syndic",
                )
            except Exception as e:
                raise ValidationError({"detail": f"Erreur signature PAdES: {str(e)}"})

        signed_bytes = sign_result.signed_pdf_bytes

        if not signed_bytes:
            raise ValidationError(
                {"detail": "Signature PAdES impossible (bytes signés vides)."}
            )

        signed_hash = _sha256_bytes(signed_bytes)

        with transaction.atomic():
            ag = AssembleeGenerale.objects.select_for_update().get(
                pk=ag.pk,
                copropriete_id=ag.copropriete_id,
            )

            if ag.pv_locked:
                raise ValidationError(
                    {"detail": "PV déjà verrouillé (concurrence). Signature refusée."}
                )

            if getattr(ag, "pv_signed_pdf", None):
                raise ValidationError(
                    {"detail": "PV déjà signé (concurrence). Signature refusée."}
                )

            if ag.statut == "CLOTUREE":
                raise ValidationError(
                    {"detail": "AG clôturée (concurrence). Signature refusée."}
                )

            if not ag.pv_pdf_hash:
                ag.pv_pdf_hash = original_hash

            filename = f"PV-AG-{ag.id:05d}-SIGNE.pdf"
            ag.pv_signed_pdf.save(filename, ContentFile(signed_bytes), save=False)

            ag.pv_signed_hash = signed_hash
            ag.pv_signed_at = timezone.now()
            ag.pv_signer_subject = sign_result.signer_subject or ""
            ag.pv_locked = True

            _safe_save(
                ag,
                update_fields=[
                    "pv_pdf_hash",
                    "pv_signed_pdf",
                    "pv_signed_hash",
                    "pv_signed_at",
                    "pv_signer_subject",
                    "pv_locked",
                ],
            )

        _log_ag_event(
            request,
            ag,
            event="PV_SIGNED",
            meta={
                "pv_pdf_hash": ag.pv_pdf_hash,
                "pv_signed_hash": ag.pv_signed_hash,
                "pv_signed_pdf": getattr(ag.pv_signed_pdf, "name", ""),
                "pv_signer_subject": ag.pv_signer_subject,
                "pfx_uploaded_name": _safe_uploaded_filename(
                    getattr(pfx_file, "name", "")
                ),
            },
        )

        return Response(
            {
                "ag_id": ag.id,
                "signed": True,
                "pv_pdf_hash": ag.pv_pdf_hash,
                "pv_signed_pdf": getattr(ag.pv_signed_pdf, "name", None),
                "pv_signed_hash": ag.pv_signed_hash,
                "pv_signed_at": (
                    ag.pv_signed_at.isoformat() if ag.pv_signed_at else None
                ),
                "pv_signer_subject": ag.pv_signer_subject,
                "pv_locked": ag.pv_locked,
                "pv_status": "VERROUILLE",
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=["get"], url_path="pv/signed")
    def pv_signed_download(self, request, pk=None):
        ag = self.get_object()
        _assert_same_copro(request, ag)

        if not getattr(ag, "pv_signed_pdf", None):
            raise ValidationError({"detail": "PV signé non disponible. Faites pv/sign."})

        from django.http import HttpResponse

        pdf_bytes = ag.pv_signed_pdf.read()
        filename = f"PV-AG-{ag.id:05d}-SIGNE.pdf"

        resp = HttpResponse(pdf_bytes, content_type="application/pdf")
        resp["Content-Disposition"] = f'inline; filename="{filename}"'
        return resp

    @action(detail=True, methods=["post"], url_path="pv/lock")
    def pv_lock(self, request, pk=None):
        ag = self.get_object()
        _assert_same_copro(request, ag)

        if ag.statut == "CLOTUREE":
            return Response(
                {
                    "ag_id": ag.id,
                    "pv_locked": True,
                    "detail": "AG clôturée : PV déjà gelé.",
                },
                status=status.HTTP_200_OK,
            )

        if ag.pv_locked:
            return Response(
                {
                    "ag_id": ag.id,
                    "pv_locked": True,
                    "detail": "Déjà verrouillé.",
                },
                status=status.HTTP_200_OK,
            )

        if not ag.pv_pdf:
            raise ValidationError(
                {"detail": "Impossible de verrouiller : PV non généré."}
            )

        if not getattr(ag, "pv_signed_pdf", None):
            raise ValidationError(
                {"detail": "Impossible de verrouiller: PV non signé (faites pv/sign)."}
            )

        ag.pv_locked = True
        _safe_save(ag, update_fields=["pv_locked"])

        _log_ag_event(request, ag, event="PV_LOCKED", meta={"pv_locked": True})

        return Response(
            {"ag_id": ag.id, "pv_locked": True, "pv_status": "VERROUILLE"},
            status=status.HTTP_200_OK,
        )

    @action(
        detail=True,
        methods=["post"],
        url_path="close",
        permission_classes=[IsAuthenticated, IsSyndicOrAdmin],
    )
    def close_ag(self, request, pk=None):
        ag = self.get_object()
        _assert_same_copro(request, ag)

        if ag.statut == "CLOTUREE":
            return Response(
                {
                    "ag_id": ag.id,
                    "statut": ag.statut,
                    "detail": "AG déjà clôturée.",
                },
                status=status.HTTP_200_OK,
            )

        _assert_ag_closable(ag)

        closed_resolutions = 0
        dossiers_valides = 0
        dossiers = []

        with transaction.atomic():
            ag = AssembleeGenerale.objects.select_for_update().get(
                pk=ag.pk,
                copropriete_id=ag.copropriete_id,
            )

            if ag.statut == "CLOTUREE":
                return Response(
                    {
                        "ag_id": ag.id,
                        "statut": ag.statut,
                        "detail": "AG déjà clôturée.",
                    },
                    status=status.HTTP_200_OK,
                )

            _assert_ag_closable(ag)

            qs = (
                Resolution.objects.select_for_update()
                .filter(ag_id=ag.id, cloturee=False)
                .order_by("ordre", "id")
            )

            for res in qs:
                result, dossier_payload = _close_resolution_and_apply_travaux(
                    request=request,
                    res=res,
                    budget_vote=None,
                )
                closed_resolutions += 1

                if dossier_payload:
                    dossiers.append(dossier_payload)

                    if dossier_payload.get("statut") == "VALIDE":
                        dossiers_valides += 1

            ag.statut = "CLOTUREE"
            ag.closed_at = timezone.now()
            ag.closed_by = (
                request.user if getattr(request.user, "is_authenticated", False) else None
            )
            ag.pv_locked = True
            _safe_save(
                ag,
                update_fields=["statut", "closed_at", "closed_by", "pv_locked"],
            )

        _log_ag_event(
            request,
            ag,
            event="AG_CLOSED",
            meta={
                "statut": ag.statut,
                "closed_resolutions": closed_resolutions,
                "dossiers_count": len(dossiers),
            },
        )

        return Response(
            {
                "ag_id": ag.id,
                "statut": ag.statut,
                "detail": "AG clôturée.",
                "blocking_reasons": [],
                "resolutions_cloturees": closed_resolutions,
                "dossiers_travaux": dossiers,
                "dossiers_travaux_valides": dossiers_valides,
                "pv_status": "VERROUILLE",
            },
            status=status.HTTP_200_OK,
        )


class PresenceLotViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, IsSyndicOrAdmin]
    serializer_class = PresenceLotSerializer
    queryset = PresenceLot.objects.select_related("ag", "lot").all()

    def get_queryset(self):
        copro_id = _require_copro_id(self.request)
        qs = super().get_queryset().filter(ag__copropriete_id=copro_id)

        ag_id = self.request.query_params.get("ag")

        if ag_id:
            qs = qs.filter(ag_id=ag_id)

        return qs

    def perform_create(self, serializer):
        _require_copro_id(self.request)
        ag = serializer.validated_data.get("ag")

        if ag:
            _assert_same_copro(self.request, ag)
            _assert_ag_open_and_writable(ag, what="création des présences")

        serializer.save()

    def perform_update(self, serializer):
        _require_copro_id(self.request)
        instance = self.get_object()
        _assert_same_copro(self.request, instance.ag)
        _assert_ag_open_and_writable(instance.ag, what="modification des présences")
        serializer.save()

    def perform_destroy(self, instance):
        _require_copro_id(self.request)
        _assert_same_copro(self.request, instance.ag)
        _assert_ag_open_and_writable(instance.ag, what="suppression des présences")
        super().perform_destroy(instance)


class AGProcurationViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, IsSyndicOrAdmin]
    serializer_class = AGProcurationSerializer
    queryset = (
        AGProcuration.objects.select_related(
            "ag",
            "coproprietaire",
            "lot",
            "document",
            "created_by",
            "validated_by",
            "rejected_by",
        )
        .all()
        .order_by("-created_at", "-id")
    )

    def get_queryset(self):
        copro_id = _require_copro_id(self.request)

        qs = super().get_queryset().filter(ag__copropriete_id=copro_id)

        include_archives = str(
            self.request.query_params.get("include_archives", "")
        ).lower() in {"1", "true", "yes", "on"}

        if not include_archives:
            qs = qs.exclude(ag__titre__startswith="[ARCHIVE TEST]")

        ag_id = self.request.query_params.get("ag")

        if ag_id:
            qs = qs.filter(ag_id=ag_id)

        statut = self.request.query_params.get("statut")

        if statut:
            qs = qs.filter(statut=str(statut).strip().upper())

        lot_id = self.request.query_params.get("lot")

        if lot_id:
            qs = qs.filter(lot_id=lot_id)

        coproprietaire_id = self.request.query_params.get("coproprietaire")

        if coproprietaire_id:
            qs = qs.filter(coproprietaire_id=coproprietaire_id)

        return qs

    def perform_create(self, serializer):
        copro_id = _require_copro_id(self.request)

        ag = serializer.validated_data.get("ag")
        lot = serializer.validated_data.get("lot")
        coproprietaire = serializer.validated_data.get("coproprietaire")

        if not ag:
            raise ValidationError({"ag": "L’assemblée générale est obligatoire."})

        if str(ag.copropriete_id) != str(copro_id):
            raise ValidationError({"ag": "AG hors périmètre de la copropriété courante."})

        if lot and str(lot.copropriete_id) != str(copro_id):
            raise ValidationError({"lot": "Lot hors périmètre de la copropriété courante."})

        if coproprietaire and str(coproprietaire.copropriete_id) != str(copro_id):
            raise ValidationError(
                {
                    "coproprietaire": (
                        "Copropriétaire hors périmètre de la copropriété courante."
                    )
                }
            )

        try:
            serializer.save(
                created_by=self.request.user,
                ip_address=_client_ip(self.request),
                user_agent=(self.request.META.get("HTTP_USER_AGENT") or "")[:255],
            )
        except DjangoValidationError as exc:
            _raise_drf_validation(exc)

    def perform_update(self, serializer):
        instance = self.get_object()
        _assert_same_copro(self.request, instance.ag)

        if instance.statut != AGProcuration.Statut.EN_ATTENTE:
            raise ValidationError(
                {"detail": "Seule une procuration en attente peut être modifiée."}
            )

        try:
            serializer.save()
        except DjangoValidationError as exc:
            _raise_drf_validation(exc)

    def perform_destroy(self, instance):
        raise ValidationError(
            {
                "detail": (
                    "La suppression d’une procuration est désactivée. "
                    "Utilisez l’annulation ou le rejet pour conserver la traçabilité."
                )
            }
        )

    @action(detail=True, methods=["post"], url_path="valider")
    def valider(self, request, pk=None):
        procuration = self.get_object()
        _assert_same_copro(request, procuration.ag)

        try:
            procuration = procuration.valider(user=request.user)
        except DjangoValidationError as exc:
            _raise_drf_validation(exc)

        serializer = self.get_serializer(procuration)

        return Response(
            {
                "detail": "Procuration validée avec succès.",
                "procuration": serializer.data,
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=["post"], url_path="rejeter")
    def rejeter(self, request, pk=None):
        procuration = self.get_object()
        _assert_same_copro(request, procuration.ag)

        motif = str(
            request.data.get("motif_rejet") or request.data.get("motif") or ""
        ).strip()

        try:
            procuration = procuration.rejeter(user=request.user, motif=motif)
        except DjangoValidationError as exc:
            _raise_drf_validation(exc)

        serializer = self.get_serializer(procuration)

        return Response(
            {
                "detail": "Procuration rejetée avec succès.",
                "procuration": serializer.data,
            },
            status=status.HTTP_200_OK,
        )


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


class AgConvocationViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, IsSyndicOrAdmin]
    serializer_class = AgConvocationSerializer
    queryset = (
        AgConvocation.objects.select_related(
            "ag",
            "copropriete",
            "coproprietaire",
            "lot",
            "document",
            "parent_convocation",
            "generated_by",
            "sent_by",
            "cancelled_by",
        )
        .all()
        .order_by("-created_at", "-id")
    )

    def get_queryset(self):
        copro_id = _require_copro_id(self.request)

        qs = super().get_queryset().filter(copropriete_id=copro_id)

        include_archives = str(
            self.request.query_params.get("include_archives", "")
        ).lower() in {"1", "true", "yes", "on"}

        if not include_archives:
            qs = qs.exclude(ag__titre__startswith="[ARCHIVE TEST]")

        ag_id = self.request.query_params.get("ag")

        if ag_id:
            qs = qs.filter(ag_id=ag_id)

        statut = self.request.query_params.get("statut")

        if statut:
            qs = qs.filter(statut=str(statut).strip().upper())

        canal = self.request.query_params.get("canal")

        if canal:
            qs = qs.filter(canal=str(canal).strip().upper())

        lot_id = self.request.query_params.get("lot")

        if lot_id:
            qs = qs.filter(lot_id=lot_id)

        coproprietaire_id = self.request.query_params.get("coproprietaire")

        if coproprietaire_id:
            qs = qs.filter(coproprietaire_id=coproprietaire_id)

        return qs

    def perform_create(self, serializer):
        copro_id = _require_copro_id(self.request)

        ag = serializer.validated_data.get("ag")
        lot = serializer.validated_data.get("lot")
        coproprietaire = serializer.validated_data.get("coproprietaire")

        if not ag:
            raise ValidationError({"ag": "L’assemblée générale est obligatoire."})

        if str(ag.copropriete_id) != str(copro_id):
            raise ValidationError({"ag": "AG hors périmètre de la copropriété courante."})

        if lot and str(lot.copropriete_id) != str(copro_id):
            raise ValidationError({"lot": "Lot hors périmètre de la copropriété courante."})

        if coproprietaire and str(coproprietaire.copropriete_id) != str(copro_id):
            raise ValidationError(
                {
                    "coproprietaire": (
                        "Copropriétaire hors périmètre de la copropriété courante."
                    )
                }
            )

        _assert_ag_writable(ag)

        try:
            convocation = serializer.save(copropriete_id=copro_id)
            convocation.mark_generated(user=self.request.user)
        except DjangoValidationError as exc:
            _raise_drf_validation(exc)

    def perform_update(self, serializer):
        instance = self.get_object()
        _assert_same_copro(self.request, instance.ag)

        if instance.statut in {"ENVOYEE", "CONSULTEE", "ANNULEE"}:
            raise ValidationError(
                {
                    "detail": (
                        "Convocation déjà envoyée, consultée ou annulée : "
                        "modification interdite."
                    )
                }
            )

        _assert_ag_writable(instance.ag)

        try:
            serializer.save()
        except DjangoValidationError as exc:
            _raise_drf_validation(exc)

    def perform_destroy(self, instance):
        _assert_same_copro(self.request, instance.ag)

        if instance.statut in {"ENVOYEE", "CONSULTEE"}:
            raise ValidationError(
                {
                    "detail": (
                        "Convocation déjà envoyée ou consultée : suppression interdite. "
                        "Annulez-la plutôt."
                    )
                }
            )

        instance.delete()

    @action(detail=True, methods=["post"], url_path="creer-rectificative")
    def creer_rectificative(self, request, pk=None):
        original = self.get_object()
        _assert_same_copro(request, original.ag)
        _assert_ag_writable(original.ag)
        _assert_ag_has_ordre_du_jour(original.ag)

        if original.statut == "ANNULEE":
            raise ValidationError(
                {"detail": "Convocation annulée : rectificative interdite."}
            )

        if not original.is_active_version:
            replacement_ref = original.replaced_by_reference
            raise ValidationError(
                {
                    "detail": (
                        "Cette convocation n’est plus la version officielle actuelle. "
                        + (
                            f"Créez la rectificative depuis {replacement_ref}."
                            if replacement_ref
                            else "Créez la rectificative depuis la dernière version non annulée."
                        )
                    )
                }
            )

        if not _convocation_is_traced(original):
            raise ValidationError(
                {
                    "detail": (
                        "Cette convocation n’a pas encore été envoyée ou consultée. "
                        "Régénérez simplement son PDF au lieu de créer une rectificative."
                    )
                }
            )

        current_hash, _ = _ordre_du_jour_hash(original.ag)
        existing_hash = _convocation_document_ordre_du_jour_hash(original)

        if existing_hash == current_hash:
            raise ValidationError(
                {
                    "detail": (
                        "Le PDF de cette convocation est déjà cohérent avec l’ordre du jour actuel. "
                        "Aucune convocation rectificative n’est nécessaire."
                    )
                }
            )

        motif = ""

        if request.data:
            motif = str(
                request.data.get("motif")
                or request.data.get("motif_rectification")
                or ""
            ).strip()

        if not motif:
            motif = (
                "Ordre du jour modifié après envoi ou consultation de la convocation originale."
            )

        with transaction.atomic():
            original = (
                AgConvocation.objects.select_for_update()
                .get(pk=original.pk, copropriete_id=original.copropriete_id)
            )

            _assert_ag_writable(original.ag)
            _assert_ag_has_ordre_du_jour(original.ag)

            if original.statut == "ANNULEE":
                raise ValidationError(
                    {"detail": "Convocation annulée : rectificative interdite."}
                )

            if not original.is_active_version:
                replacement_ref = original.replaced_by_reference
                raise ValidationError(
                    {
                        "detail": (
                            "Cette convocation n’est plus la version officielle actuelle. "
                            + (
                                f"Créez la rectificative depuis {replacement_ref}."
                                if replacement_ref
                                else "Créez la rectificative depuis la dernière version non annulée."
                            )
                        )
                    }
                )

            current_hash, _ = _ordre_du_jour_hash(original.ag)
            existing_hash = _convocation_document_ordre_du_jour_hash(original)

            if existing_hash == current_hash:
                raise ValidationError(
                    {
                        "detail": (
                            "Le PDF de cette convocation est déjà cohérent avec l’ordre du jour actuel. "
                            "Aucune convocation rectificative n’est nécessaire."
                        )
                    }
                )

            if not _convocation_is_traced(original):
                raise ValidationError(
                    {
                        "detail": (
                            "Cette convocation n’a pas encore été envoyée ou consultée. "
                            "Régénérez simplement son PDF au lieu de créer une rectificative."
                        )
                    }
                )

            existing_rectificative = (
                AgConvocation.objects.select_for_update()
                .filter(
                    ag_id=original.ag_id,
                    lot_id=original.lot_id,
                    is_rectificative=True,
                )
                .exclude(statut="ANNULEE")
                .order_by("-version", "-id")
                .first()
            )

            if (
                existing_rectificative
                and _convocation_document_ordre_du_jour_hash(existing_rectificative)
                == current_hash
            ):
                serializer = self.get_serializer(existing_rectificative)

                return Response(
                    {
                        "detail": "Une convocation rectificative à jour existe déjà.",
                        "convocation": serializer.data,
                    },
                    status=status.HTTP_200_OK,
                )

            max_version = (
                AgConvocation.objects.select_for_update()
                .filter(ag_id=original.ag_id, lot_id=original.lot_id)
                .aggregate(max_version=Max("version"))
                .get("max_version")
                or 1
            )

            rectificative = AgConvocation.objects.create(
                ag=original.ag,
                copropriete=original.copropriete,
                coproprietaire=original.coproprietaire,
                lot=original.lot,
                parent_convocation=original,
                version=int(max_version) + 1,
                is_rectificative=True,
                canal=original.canal,
                objet=f"Convocation rectificative - {original.ag.titre}",
                message=(
                    original.message
                    or "Convocation rectificative liée à la mise à jour de l’ordre du jour."
                ),
                motif_rectification=motif,
                metadata={
                    "source": "ag_convocation_rectificative",
                    "parent_convocation_id": original.id,
                    "parent_reference": original.reference,
                    "reason": motif,
                },
            )

            rectificative.mark_generated(user=request.user)

            document, _ = _generate_convocation_pdf_document(
                convocation=rectificative,
                request=request,
                force=True,
            )

            rectificative.mark_generated(user=request.user, document=document)
            rectificative.refresh_from_db()

        serializer = self.get_serializer(rectificative)

        _log_ag_event(
            request,
            rectificative.ag,
            event="AG_CONVOCATION_RECTIFICATIVE_CREATED",
            meta={
                "original_convocation_id": original.id,
                "rectificative_convocation_id": rectificative.id,
                "version": rectificative.version,
                "motif": motif,
            },
        )

        return Response(
            {
                "detail": "Convocation rectificative créée avec succès.",
                "convocation": serializer.data,
            },
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["post"], url_path="generer-pdf")
    def generer_pdf(self, request, pk=None):
        convocation = self.get_object()
        _assert_same_copro(request, convocation.ag)
        _assert_ag_has_ordre_du_jour(convocation.ag)

        if convocation.statut == "ANNULEE":
            raise ValidationError(
                {"detail": "Convocation annulée : génération PDF interdite."}
            )

        _generate_convocation_pdf_document(
            convocation=convocation,
            request=request,
            force=True,
        )

        convocation.refresh_from_db()

        serializer = self.get_serializer(convocation)

        return Response(
            {
                "detail": "PDF de convocation généré avec succès.",
                "convocation": serializer.data,
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=["post"], url_path="marquer-envoyee")
    def marquer_envoyee(self, request, pk=None):
        convocation = self.get_object()
        _assert_same_copro(request, convocation.ag)

        if convocation.statut == "ANNULEE":
            raise ValidationError({"detail": "Convocation annulée : envoi interdit."})

        canal = None

        if request.data and request.data.get("canal"):
            canal = str(request.data.get("canal") or "").strip().upper()

            allowed_canaux = {choice[0] for choice in AgConvocation.CANAL_CHOICES}

            if canal not in allowed_canaux:
                raise ValidationError(
                    {
                        "canal": (
                            "Canal invalide. Valeurs autorisées : "
                            f"{', '.join(sorted(allowed_canaux))}."
                        )
                    }
                )

        try:
            convocation.mark_sent(user=request.user, canal=canal)
        except DjangoValidationError as exc:
            _raise_drf_validation(exc)

        convocation.refresh_from_db()

        pdf_refreshed = _refresh_convocation_pdf_after_trace(
            convocation=convocation,
            request=request,
        )

        serializer = self.get_serializer(convocation)
        return Response(
            {
                "detail": "Convocation marquée comme envoyée.",
                "pdf_refreshed": pdf_refreshed,
                "convocation": serializer.data,
            },
            status=status.HTTP_200_OK,
        )


    @action(detail=True, methods=["post"], url_path="notifier")
    def notifier(self, request, pk=None):
        convocation = self.get_object()
        _assert_same_copro(request, convocation.ag)

        if convocation.statut == "ANNULEE":
            raise ValidationError(
                {"detail": "Convocation annulée : notification interdite."}
            )

        if not convocation.is_active_version:
            raise ValidationError(
                {
                    "detail": (
                        "Seule la version officielle actuelle peut être notifiée. "
                        "Cette convocation est une ancienne version."
                    )
                }
            )

        canal = str(
            (request.data or {}).get("canal")
            or convocation.canal
            or "PLATEFORME"
        ).strip().upper()

        allowed_canaux = {choice[0] for choice in AgConvocation.CANAL_CHOICES}

        if canal not in allowed_canaux:
            raise ValidationError(
                {
                    "canal": (
                        "Canal invalide. Valeurs autorisées : "
                        f"{', '.join(sorted(allowed_canaux))}."
                    )
                }
            )

        document_generated = False
        document_refreshed = False

        if not getattr(convocation, "document_id", None):
            _assert_ag_has_ordre_du_jour(convocation.ag)

            _generate_convocation_pdf_document(
                convocation=convocation,
                request=request,
                force=False,
            )

            convocation.refresh_from_db()
            document_generated = True

        already_sent = convocation.statut in {"ENVOYEE", "CONSULTEE"}

        if not already_sent:
            try:
                convocation.mark_sent(user=request.user, canal=canal)
            except DjangoValidationError as exc:
                _raise_drf_validation(exc)

            convocation.refresh_from_db()

        document_refreshed = _refresh_convocation_pdf_after_trace(
            convocation=convocation,
            request=request,
        )

        now = timezone.now()

        metadata = convocation.metadata or {}

        if not isinstance(metadata, dict):
            metadata = {}

        notification_payload = {
            "type": "RECTIFICATIVE" if convocation.is_rectificative else "INITIALE",
            "canal": canal,
            "notified_at": now.isoformat(),
            "notified_by_id": getattr(request.user, "id", None),
            "notified_by_label": (
                request.user.get_full_name()
                if getattr(request.user, "is_authenticated", False)
                and hasattr(request.user, "get_full_name")
                else ""
            )
            or getattr(request.user, "username", "")
            or getattr(request.user, "email", "")
            or "",
            "document_id": convocation.document_id,
            "document_generated": document_generated,
            "already_sent": already_sent,
            "is_rectificative": bool(convocation.is_rectificative),
            "version": convocation.version,
            "parent_convocation_id": convocation.parent_convocation_id,
            "motif_rectification": convocation.motif_rectification or "",
        }

        history = metadata.get("notifications_history")

        if not isinstance(history, list):
            history = []

        history.append(notification_payload)

        metadata["last_notification"] = notification_payload
        metadata["notifications_history"] = history[-20:]
        metadata["notification_count"] = len(history)

        if convocation.is_rectificative:
            metadata["rectificative_notified_at"] = now.isoformat()
            metadata["rectificative_notified_by_id"] = getattr(request.user, "id", None)

        convocation.metadata = metadata
        convocation.save(update_fields=["metadata"])

        notification_proof = AgConvocationPreuve.objects.create(
            convocation=convocation,
            ag=convocation.ag,
            copropriete=convocation.copropriete,
            coproprietaire=convocation.coproprietaire,
            lot=convocation.lot,
            utilisateur=request.user if request.user.is_authenticated else None,
            type_evenement=AgConvocationPreuve.TYPE_NOTIFICATION,
            canal=canal,
            statut=AgConvocationPreuve.STATUT_SUCCES,
            destinataire_email=_convocation_destinataire_email(convocation),
            destinataire_telephone=_convocation_destinataire_telephone(convocation),
            objet=convocation.objet or f"Convocation - {convocation.ag.titre}",
            commentaire=(
                "Notification de la convocation officielle actuelle "
                "depuis l’espace syndic/admin."
            ),
            ip_address=_request_ip_address(request),
            user_agent=_request_user_agent(request),
            metadata={
                **notification_payload,
                "convocation_reference": convocation.reference,
                "ag_id": convocation.ag_id,
                "lot_id": convocation.lot_id,
                "coproprietaire_id": convocation.coproprietaire_id,
            },
        )

        convocation.refresh_from_db()
        serializer = self.get_serializer(convocation)

        label = (
            "Convocation rectificative"
            if convocation.is_rectificative
            else "Convocation"
        )

        if already_sent:
            detail = f"{label} déjà envoyée ; notification retracée."
        else:
            detail = f"{label} notifiée avec succès."

        return Response(
            {
                "detail": detail,
                "document_generated": document_generated,
                "document_refreshed": document_refreshed,
                "already_sent": already_sent,
                "proof_reference": notification_proof.reference,
                "convocation": serializer.data,
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=["post"], url_path="marquer-consultee")
    def marquer_consultee(self, request, pk=None):
        convocation = self.get_object()
        _assert_same_copro(request, convocation.ag)

        if convocation.statut == "ANNULEE":
            raise ValidationError(
                {"detail": "Convocation annulée : consultation interdite."}
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
                _raise_drf_validation(exc)

            convocation.refresh_from_db()

        pdf_refreshed = _refresh_convocation_pdf_after_trace(
            convocation=convocation,
            request=request,
        )

        consultation_proof = (
            AgConvocationPreuve.objects.filter(
                convocation=convocation,
                type_evenement=AgConvocationPreuve.TYPE_CONSULTATION,
                statut=AgConvocationPreuve.STATUT_SUCCES,
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
                    "Accusé de consultation de la convocation officielle actuelle."
                ),
                ip_address=_request_ip_address(request),
                user_agent=_request_user_agent(request),
                metadata={
                    "convocation_reference": convocation.reference,
                    "ag_id": convocation.ag_id,
                    "lot_id": convocation.lot_id,
                    "coproprietaire_id": convocation.coproprietaire_id,
                    "version": convocation.version,
                    "is_rectificative": bool(convocation.is_rectificative),
                    "statut_initial": statut_initial,
                    "statut_final": convocation.statut,
                    "already_consulted": already_consulted,
                    "pdf_refreshed": pdf_refreshed,
                },
            )

        serializer = self.get_serializer(convocation)

        return Response(
            {
                "detail": (
                    "Convocation déjà consultée ; accusé existant conservé."
                    if already_consulted
                    else "Consultation de la convocation enregistrée avec succès."
                ),
                "already_consulted": already_consulted,
                "pdf_refreshed": pdf_refreshed,
                "proof_reference": consultation_proof.reference,
                "convocation": serializer.data,
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=["post"], url_path="annuler")
    def annuler(self, request, pk=None):
        convocation = self.get_object()
        _assert_same_copro(request, convocation.ag)

        if convocation.statut == "CONSULTEE":
            raise ValidationError(
                {"detail": "Convocation déjà consultée : annulation interdite."}
            )

        reason = ""

        if request.data:
            reason = str(
                request.data.get("reason") or request.data.get("motif") or ""
            ).strip()

        try:
            convocation.cancel(user=request.user, reason=reason)
        except DjangoValidationError as exc:
            _raise_drf_validation(exc)

        serializer = self.get_serializer(convocation)
        return Response(serializer.data, status=status.HTTP_200_OK)


class ResolutionViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, IsSyndicOrAdmin]
    serializer_class = ResolutionSerializer
    queryset = Resolution.objects.select_related("ag").all()

    def get_queryset(self):
        copro_id = _require_copro_id(self.request)
        qs = super().get_queryset().filter(ag__copropriete_id=copro_id)

        ag_id = self.request.query_params.get("ag")

        if ag_id:
            qs = qs.filter(ag_id=ag_id)

        return qs

    @action(detail=True, methods=["get"], url_path="resultat")
    def resultat(self, request, pk=None):
        _require_copro_id(request)
        res = self.get_object()
        _assert_same_copro(request, res.ag)

        return Response(compute_resolution_result(res), status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"], url_path="cloturer")
    def cloturer(self, request, pk=None):
        _require_copro_id(request)
        res = self.get_object()
        _assert_same_copro(request, res.ag)
        _assert_ag_open_and_writable(res.ag, what="clôture de résolution")

        budget_vote: Optional[Decimal] = None

        if request.data and request.data.get("budget_vote") is not None:
            budget_vote = _parse_decimal(request.data.get("budget_vote"), "budget_vote")

            if budget_vote < 0:
                raise ValidationError({"budget_vote": "Doit être >= 0."})

        try:
            with transaction.atomic():
                res = (
                    Resolution.objects.select_for_update()
                    .select_related("ag")
                    .get(pk=res.pk, ag__copropriete_id=res.ag.copropriete_id)
                )

                if res.cloturee:
                    result = compute_resolution_result(res)

                    return Response(
                        {
                            "resolution_id": res.id,
                            "cloturee": True,
                            "decision": result["decision"],
                            "tantiemes": result["tantiemes"],
                            "detail": "Déjà clôturée.",
                            "dossier_travaux": None,
                        },
                        status=status.HTTP_200_OK,
                    )

                result, dossier_payload = _close_resolution_and_apply_travaux(
                    request=request,
                    res=res,
                    budget_vote=budget_vote,
                )

        except ValidationError:
            raise
        except Exception as e:
            raise ValidationError({"detail": f"Erreur clôture résolution: {str(e)}"})

        return Response(
            {
                "resolution_id": res.id,
                "cloturee": True,
                "decision": result["decision"],
                "tantiemes": result["tantiemes"],
                "dossier_travaux": dossier_payload,
            },
            status=status.HTTP_200_OK,
        )

    def perform_create(self, serializer):
        _require_copro_id(self.request)
        ag = serializer.validated_data.get("ag")

        if ag:
            _assert_same_copro(self.request, ag)
            _assert_resolution_writable(ag, what="création des résolutions")

        serializer.save()

    def perform_update(self, serializer):
        _require_copro_id(self.request)
        instance = self.get_object()
        _assert_same_copro(self.request, instance.ag)
        _assert_resolution_writable(instance.ag, what="modification des résolutions")
        serializer.save()

    def perform_destroy(self, instance):
        _require_copro_id(self.request)
        _assert_same_copro(self.request, instance.ag)
        _assert_resolution_writable(instance.ag, what="suppression des résolutions")
        super().perform_destroy(instance)


class VoteViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, IsSyndicOrAdmin]
    serializer_class = VoteSerializer
    queryset = Vote.objects.select_related("resolution", "lot", "resolution__ag").all()

    def get_queryset(self):
        copro_id = _require_copro_id(self.request)
        qs = super().get_queryset().filter(resolution__ag__copropriete_id=copro_id)

        ag_id = (
            self.request.query_params.get("ag")
            or self.request.query_params.get("assemblee")
            or self.request.query_params.get("assemblee_generale")
            or self.request.query_params.get("ag_id")
        )

        if ag_id:
            qs = qs.filter(resolution__ag_id=ag_id)

        resolution_id = self.request.query_params.get("resolution")

        if resolution_id:
            qs = qs.filter(resolution_id=resolution_id)

        return qs

    def perform_create(self, serializer):
        _require_copro_id(self.request)
        resolution = serializer.validated_data.get("resolution")

        if resolution:
            _assert_same_copro(self.request, resolution.ag)
            _assert_ag_open_and_writable(resolution.ag, what="création des votes")

        try:
            serializer.save()
        except DjangoValidationError as e:
            if hasattr(e, "message_dict"):
                raise ValidationError(e.message_dict)

            if hasattr(e, "messages"):
                raise ValidationError({"detail": e.messages})

            raise ValidationError({"detail": str(e)})

    def perform_update(self, serializer):
        raise ValidationError(
            {
                "detail": (
                    "La modification d’un vote est désactivée. "
                    "Supprimez et recréez si nécessaire."
                )
            }
        )

    def perform_destroy(self, instance):
        raise ValidationError(
            {"detail": "La suppression d’un vote est désactivée. Contactez un administrateur."}
        )