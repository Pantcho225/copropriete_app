# apps/ag/views.py
from __future__ import annotations

from decimal import Decimal, InvalidOperation
import hashlib
import os
import tempfile
from typing import Any, Optional, Iterable, List

from django.core.files.base import ContentFile
from django.db import transaction
from django.db.models import Sum
from django.utils import timezone

from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.lots.models import Lot

from .models import AssembleeGenerale, PresenceLot, Resolution, Vote
from .permissions import IsSyndicOrAdmin
from .serializers import (
    AssembleeGeneraleSerializer,
    PresenceLotSerializer,
    ResolutionSerializer,
    VoteSerializer,
)


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


# =========================
# Helpers sécurité / headers
# =========================
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
        raise ValidationError({"detail": "AG hors périmètre de la copropriété courante."})


def _assert_ag_writable(ag: AssembleeGenerale):
    if getattr(ag, "statut", None) == "CLOTUREE":
        raise ValidationError({"detail": "AG clôturée : modification interdite."})
    if getattr(ag, "pv_locked", False):
        raise ValidationError({"detail": "PV verrouillé : modification interdite."})


def _assert_ag_closable(ag: AssembleeGenerale):
    if getattr(ag, "statut", None) == "ANNULEE":
        raise ValidationError({"detail": "AG annulée : clôture interdite."})

    if (
        not getattr(ag, "pv_signed_pdf", None)
        or not getattr(ag, "pv_signed_hash", "")
        or not getattr(ag, "pv_signed_at", None)
    ):
        raise ValidationError({"detail": "PV signé obligatoire avant clôture (faites pv/sign)."})

    if not getattr(ag, "pv_locked", False):
        raise ValidationError({"detail": "PV doit être verrouillé avant clôture."})


def _sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _parse_decimal(value: Any, field_name: str) -> Decimal:
    try:
        d = Decimal(str(value))
    except (InvalidOperation, TypeError):
        raise ValidationError({field_name: "Format invalide. Exemple: 1400000.00"})
    return d


def _compute_resolution_result(res: Resolution) -> dict:
    agg = (
        Vote.objects.filter(resolution_id=res.id)
        .values("choix")
        .annotate(t=Sum("tantiemes"))
    )
    by = {row["choix"]: Decimal(str(row["t"] or 0)) for row in agg}

    pour = by.get("POUR", Decimal("0"))
    contre = by.get("CONTRE", Decimal("0"))
    abst = by.get("ABSTENTION", Decimal("0"))
    exprimes = pour + contre

    def ratio(x: Decimal, denom: Decimal) -> float:
        return float(x / denom) if denom and denom > 0 else 0.0

    decision = "REJETEE"
    maj = res.type_majorite

    if maj == "SIMPLE":
        if pour > contre:
            decision = "ADOPTEE"
    elif maj == "ABSOLUE":
        if exprimes > 0 and pour > (exprimes * Decimal("0.50")):
            decision = "ADOPTEE"
    elif maj == "QUALIFIEE_2_3":
        if exprimes > 0 and pour >= (exprimes * Decimal("0.6667")):
            decision = "ADOPTEE"
    elif maj == "UNANIMITE":
        if exprimes > 0 and contre == 0 and pour == exprimes:
            decision = "ADOPTEE"

    return {
        "resolution_id": res.id,
        "type_majorite": maj,
        "tantiemes": {
            "pour": float(pour),
            "contre": float(contre),
            "abstention": float(abst),
            "exprimes": float(exprimes),
            "ratio_pour_exprimes": ratio(pour, exprimes),
        },
        "decision": decision,
    }


def _safe_uploaded_filename(name: str) -> str:
    if not name:
        return ""
    return os.path.basename(name)


# =========================
# Helpers robustesse (anti-500)
# =========================
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


# =========================
# Helpers Travaux
# =========================
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

    if dossier is None and _has_model_field(res, "travaux_dossier") and getattr(res, "travaux_dossier_id", None):
        dossier = (
            DossierTravaux.objects.select_for_update()
            .filter(pk=res.travaux_dossier_id, copropriete_id=res.ag.copropriete_id)
            .first()
        )

    return dossier, DossierTravaux


def _sync_resolution_dossier_links(*, res: Resolution, dossier):
    if getattr(dossier, "resolution_validation_id", None) not in (None, res.id):
        raise ValidationError(
            {"detail": "Incohérence: le dossier est déjà lié (resolution_validation) à une autre résolution."}
        )

    if getattr(dossier, "resolution_validation_id", None) != res.id:
        dossier.resolution_validation_id = res.id
        _safe_save(dossier, update_fields=["resolution_validation"])

    if not _has_model_field(res, "travaux_dossier"):
        return

    if getattr(res, "travaux_dossier_id", None) not in (None, dossier.id):
        raise ValidationError(
            {"detail": "Incohérence: cette résolution est déjà liée à un autre dossier (travaux_dossier)."}
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
            "budget_vote": str(getattr(dossier, "budget_vote", None))
            if getattr(dossier, "budget_vote", None) is not None
            else None,
            "locked_at": dossier.locked_at.isoformat() if getattr(dossier, "locked_at", None) else None,
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
            "detail": "Décision ADOPTEE mais dossier non en statut SOUMIS_AG : non validé (politique production).",
        }

    if hasattr(dossier, "statut"):
        dossier.statut = VALIDE
    elif hasattr(dossier, "status"):
        dossier.status = VALIDE

    if hasattr(dossier, "budget_vote"):
        if budget_vote is not None:
            dossier.budget_vote = budget_vote
        elif getattr(dossier, "budget_vote", None) is None and hasattr(dossier, "budget_estime"):
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
        if hasattr(dossier, "locked_by") and user and not getattr(dossier, "locked_by_id", None):
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
        "budget_vote": str(getattr(dossier, "budget_vote", None))
        if getattr(dossier, "budget_vote", None) is not None
        else None,
        "locked_at": dossier.locked_at.isoformat() if getattr(dossier, "locked_at", None) else None,
        "locked_by": getattr(dossier, "locked_by_id", None),
    }


def _close_resolution_and_apply_travaux(
    *,
    request,
    res: Resolution,
    budget_vote: Optional[Decimal],
) -> tuple[dict, Optional[dict]]:
    """
    Service interne réutilisable :
    - calcule résultat
    - clôture la résolution (idempotent)
    - applique Travaux si dossier lié et décision ADOPTEE
    Retourne (resultat_resolution_dict, dossier_payload)

    IMPORTANT:
    - pendant close_ag, le PV peut déjà être verrouillé
    - le modèle Resolution.save() peut refuser toute modif si AG.pv_locked == True
    - on bypass donc save/full_clean pour le champ technique "cloturee"
    """
    result = _compute_resolution_result(res)
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


# =========================
# Audit log
# =========================
try:
    from .models_audit import AGAuditLog  # type: ignore
except Exception:
    AGAuditLog = None


def _client_ip(request) -> str | None:
    xff = request.META.get("HTTP_X_FORWARDED_FOR")
    if xff:
        return xff.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR")


def _log_ag_event(request, ag: AssembleeGenerale, event: str, meta: dict | None = None):
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


class AssembleeGeneraleViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, IsSyndicOrAdmin]
    serializer_class = AssembleeGeneraleSerializer
    queryset = AssembleeGenerale.objects.all().order_by("-date_ag", "-id")

    def get_queryset(self):
        copro_id = _require_copro_id(self.request)
        return super().get_queryset().filter(copropriete_id=copro_id)

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
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=["post"], url_path="init-presences")
    def init_presences(self, request, pk=None):
        ag = self.get_object()
        _assert_same_copro(request, ag)
        _assert_ag_writable(ag)

        lots = Lot.objects.filter(copropriete_id=ag.copropriete_id).order_by("id")
        if not lots.exists():
            return Response({"detail": "Aucun lot dans cette copropriété."}, status=status.HTTP_400_BAD_REQUEST)

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
            {"ag_id": ag.id, "lots_total": lots.count(), "created": created, "skipped_existing": skipped},
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
            raise ValidationError({"detail": "PV verrouillé : archivage interdit."})

        with transaction.atomic():
            ag = AssembleeGenerale.objects.select_for_update().get(pk=ag.pk, copropriete_id=ag.copropriete_id)

            pdf_bytes = generate_ag_pv_pdf_bytes(ag, request=request)
            if not pdf_bytes:
                raise ValidationError({"detail": "Impossible de générer le PV PDF (bytes vides)."})

            sha = _sha256_bytes(pdf_bytes)

            filename = f"PV-AG-{ag.id:05d}.pdf"
            ag.pv_pdf.save(filename, ContentFile(pdf_bytes), save=False)

            ag.pv_pdf_hash = sha
            ag.pv_generated_at = timezone.now()
            ag.save(update_fields=["pv_pdf", "pv_pdf_hash", "pv_generated_at"])

        _log_ag_event(
            request,
            ag,
            event="PV_ARCHIVED",
            meta={"pv_pdf": getattr(ag.pv_pdf, "name", ""), "pv_pdf_hash": ag.pv_pdf_hash},
        )

        return Response(
            {
                "ag_id": ag.id,
                "archived": True,
                "pv_pdf": getattr(ag.pv_pdf, "name", None),
                "pv_pdf_hash": ag.pv_pdf_hash,
                "pv_generated_at": ag.pv_generated_at.isoformat() if ag.pv_generated_at else None,
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
            raise ValidationError({"detail": "PV non archivé. Faites d'abord pv/archive."})

        pfx_file = request.FILES.get("pfx")
        pfx_password = (request.data.get("password") or "")
        if not pfx_file or not pfx_password:
            raise ValidationError({"detail": "Fournir pfx (.p12/.pfx) et password (form-data)."})

        pfx_password = str(pfx_password).strip().replace("\x00", "")
        if not pfx_password:
            raise ValidationError({"detail": "Mot de passe PKCS#12 invalide (vide après nettoyage)."})

        original_pdf_bytes = ag.pv_pdf.read()
        if not original_pdf_bytes:
            raise ValidationError({"detail": "PV archivé illisible (bytes vides)."})

        original_hash = _sha256_bytes(original_pdf_bytes)

        if ag.pv_pdf_hash and ag.pv_pdf_hash != original_hash:
            raise ValidationError({"detail": "Incohérence hash PV. Réarchivez le PV (pv/archive)."})

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
            raise ValidationError({"detail": "Signature PAdES impossible (bytes signés vides)."})

        signed_hash = _sha256_bytes(signed_bytes)

        with transaction.atomic():
            ag = AssembleeGenerale.objects.select_for_update().get(pk=ag.pk, copropriete_id=ag.copropriete_id)

            if ag.pv_locked:
                raise ValidationError({"detail": "PV déjà verrouillé (concurrence). Signature refusée."})
            if getattr(ag, "pv_signed_pdf", None):
                raise ValidationError({"detail": "PV déjà signé (concurrence). Signature refusée."})
            if ag.statut == "CLOTUREE":
                raise ValidationError({"detail": "AG clôturée (concurrence). Signature refusée."})

            if not ag.pv_pdf_hash:
                ag.pv_pdf_hash = original_hash

            filename = f"PV-AG-{ag.id:05d}-SIGNE.pdf"
            ag.pv_signed_pdf.save(filename, ContentFile(signed_bytes), save=False)

            ag.pv_signed_hash = signed_hash
            ag.pv_signed_at = timezone.now()
            ag.pv_signer_subject = sign_result.signer_subject or ""
            ag.pv_locked = True

            ag.save(
                update_fields=[
                    "pv_pdf_hash",
                    "pv_signed_pdf",
                    "pv_signed_hash",
                    "pv_signed_at",
                    "pv_signer_subject",
                    "pv_locked",
                ]
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
                "pfx_uploaded_name": _safe_uploaded_filename(getattr(pfx_file, "name", "")),
            },
        )

        return Response(
            {
                "ag_id": ag.id,
                "signed": True,
                "pv_pdf_hash": ag.pv_pdf_hash,
                "pv_signed_pdf": getattr(ag.pv_signed_pdf, "name", None),
                "pv_signed_hash": ag.pv_signed_hash,
                "pv_signed_at": ag.pv_signed_at.isoformat() if ag.pv_signed_at else None,
                "pv_signer_subject": ag.pv_signer_subject,
                "pv_locked": ag.pv_locked,
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
                {"ag_id": ag.id, "pv_locked": True, "detail": "AG clôturée : PV déjà gelé."},
                status=status.HTTP_200_OK,
            )

        if ag.pv_locked:
            return Response(
                {"ag_id": ag.id, "pv_locked": True, "detail": "Déjà verrouillé."},
                status=status.HTTP_200_OK,
            )

        if not ag.pv_pdf:
            raise ValidationError({"detail": "Impossible de verrouiller: PV non archivé (pv_pdf manquant)."})
        if not getattr(ag, "pv_signed_pdf", None):
            raise ValidationError({"detail": "Impossible de verrouiller: PV non signé (faites pv/sign)."})

        ag.pv_locked = True
        ag.save(update_fields=["pv_locked"])

        _log_ag_event(request, ag, event="PV_LOCKED", meta={"pv_locked": True})

        return Response({"ag_id": ag.id, "pv_locked": True}, status=status.HTTP_200_OK)

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
                {"ag_id": ag.id, "statut": ag.statut, "detail": "AG déjà clôturée."},
                status=status.HTTP_200_OK,
            )

        _assert_ag_closable(ag)

        if not ag.quorum_atteint():
            raise ValidationError({"detail": "Quorum non atteint. Impossible de clôturer l’AG."})

        closed_resolutions = 0
        dossiers_valides = 0
        dossiers = []

        with transaction.atomic():
            ag = AssembleeGenerale.objects.select_for_update().get(pk=ag.pk, copropriete_id=ag.copropriete_id)

            if ag.statut == "CLOTUREE":
                return Response(
                    {"ag_id": ag.id, "statut": ag.statut, "detail": "AG déjà clôturée."},
                    status=status.HTTP_200_OK,
                )

            _assert_ag_closable(ag)

            qs = Resolution.objects.select_for_update().filter(ag_id=ag.id, cloturee=False).order_by("ordre", "id")
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
            ag.closed_by = request.user if getattr(request.user, "is_authenticated", False) else None
            ag.pv_locked = True
            ag.save(update_fields=["statut", "closed_at", "closed_by", "pv_locked"])

        _log_ag_event(
            request,
            ag,
            event="AG_CLOSED",
            meta={"statut": ag.statut, "closed_resolutions": closed_resolutions, "dossiers_count": len(dossiers)},
        )

        return Response(
            {
                "ag_id": ag.id,
                "statut": ag.statut,
                "detail": "AG clôturée (Phase 2.4).",
                "resolutions_cloturees": closed_resolutions,
                "dossiers_travaux": dossiers,
                "dossiers_travaux_valides": dossiers_valides,
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
            _assert_ag_writable(ag)
        serializer.save()

    def perform_update(self, serializer):
        _require_copro_id(self.request)
        instance = self.get_object()
        _assert_same_copro(self.request, instance.ag)
        _assert_ag_writable(instance.ag)
        serializer.save()

    def perform_destroy(self, instance):
        _require_copro_id(self.request)
        _assert_same_copro(self.request, instance.ag)
        _assert_ag_writable(instance.ag)
        super().perform_destroy(instance)


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

        return Response(_compute_resolution_result(res), status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"], url_path="cloturer")
    def cloturer(self, request, pk=None):
        _require_copro_id(request)
        res = self.get_object()
        _assert_same_copro(request, res.ag)
        _assert_ag_writable(res.ag)

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
                    result = _compute_resolution_result(res)
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
            _assert_ag_writable(ag)
        serializer.save()

    def perform_update(self, serializer):
        _require_copro_id(self.request)
        instance = self.get_object()
        _assert_same_copro(self.request, instance.ag)
        _assert_ag_writable(instance.ag)
        serializer.save()

    def perform_destroy(self, instance):
        _require_copro_id(self.request)
        _assert_same_copro(self.request, instance.ag)
        _assert_ag_writable(instance.ag)
        super().perform_destroy(instance)


class VoteViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, IsSyndicOrAdmin]
    serializer_class = VoteSerializer
    queryset = Vote.objects.select_related("resolution", "lot", "resolution__ag").all()

    def get_queryset(self):
        copro_id = _require_copro_id(self.request)
        qs = super().get_queryset().filter(resolution__ag__copropriete_id=copro_id)

        resolution_id = self.request.query_params.get("resolution")
        if resolution_id:
            qs = qs.filter(resolution_id=resolution_id)

        return qs

    def perform_create(self, serializer):
        _require_copro_id(self.request)
        resolution = serializer.validated_data.get("resolution")
        if resolution:
            _assert_same_copro(self.request, resolution.ag)
            _assert_ag_writable(resolution.ag)
        serializer.save()

    def perform_update(self, serializer):
        raise ValidationError({"detail": "La modification d’un vote est désactivée. Supprimez et recréez si nécessaire."})

    def perform_destroy(self, instance):
        raise ValidationError({"detail": "La suppression d’un vote est désactivée. Contactez un administrateur."})