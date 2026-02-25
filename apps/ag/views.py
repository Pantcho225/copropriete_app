# apps/ag/views.py
from __future__ import annotations

from decimal import Decimal
import hashlib
import tempfile
from typing import Any

from django.core.files.base import ContentFile
from django.db import transaction
from django.db.models import Sum
from django.utils import timezone

from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.lots.models import Lot  # ✅ pour init-presences

from .models import AssembleeGenerale, PresenceLot, Resolution, Vote
from .permissions import IsSyndicOrAdmin
from .serializers import (
    AssembleeGeneraleSerializer,
    PresenceLotSerializer,
    ResolutionSerializer,
    VoteSerializer,
)

# =========================
# Helpers sécurité / headers
# =========================
def _require_copro_id(request) -> str:
    copro_id = request.headers.get("X-Copropriete-Id")
    if not copro_id:
        raise ValidationError({"detail": "En-tête X-Copropriete-Id requis."})
    return str(copro_id)


def _assert_same_copro(request, ag: AssembleeGenerale):
    copro_id = _require_copro_id(request)
    if str(ag.copropriete_id) != str(copro_id):
        raise ValidationError({"detail": "AG hors périmètre de la copropriété courante."})


def _assert_ag_writable(ag: AssembleeGenerale):
    """
    Phase 2.2/2.3/2.4:
    - si AG clôturée => gel total
    - si PV verrouillé => gel des écritures métier (présences/résolutions/votes/update AG)
    """
    if getattr(ag, "statut", None) == "CLOTUREE":
        raise ValidationError({"detail": "AG clôturée : modification interdite."})
    if getattr(ag, "pv_locked", False):
        raise ValidationError({"detail": "PV verrouillé : modification interdite."})


def _assert_ag_closable(ag: AssembleeGenerale):
    """
    Phase 2.4:
    Pour clôturer, on EXIGE un PV signé + verrouillé (source juridique),
    et on refuse déjà clôturée/annulée.
    NOTE: ici on ne rejette PAS "déjà clôturée" (idempotence gérée dans close_ag).
    """
    if getattr(ag, "statut", None) == "ANNULEE":
        raise ValidationError({"detail": "AG annulée : clôture interdite."})

    # Exige signature réelle (PAdES) + lock
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


# =========================
# Audit log (robuste)
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
    """
    Event examples: INIT_PRESENCES, PV_ARCHIVED, PV_SIGNED, PV_LOCKED, AG_CLOSED
    """
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
    serializer_class = AssembleeGeneraleSerializer
    queryset = AssembleeGenerale.objects.all().order_by("-date_ag", "-id")

    def get_queryset(self):
        copro_id = self.request.headers.get("X-Copropriete-Id")
        qs = super().get_queryset()
        if copro_id:
            qs = qs.filter(copropriete_id=copro_id)
        return qs

    def perform_update(self, serializer):
        ag = self.get_object()
        _assert_same_copro(self.request, ag)
        _assert_ag_writable(ag)
        serializer.save()

    def perform_destroy(self, instance):
        _assert_same_copro(self.request, instance)
        _assert_ag_writable(instance)
        super().perform_destroy(instance)

    # =========================
    # Quorum
    # =========================
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

    # =========================
    # Init-presences
    # =========================
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

    # =========================
    # PV PDF (visualisation)
    # =========================
    @action(detail=True, methods=["get"], url_path="pv/pdf")
    def pv_pdf(self, request, pk=None):
        ag = self.get_object()
        _assert_same_copro(request, ag)

        from .services.pdf import generate_ag_pv_pdf
        return generate_ag_pv_pdf(ag, request=request)

    # =========================
    # PV Archive (non signé)
    # =========================
    @action(detail=True, methods=["post"], url_path="pv/archive")
    def pv_archive(self, request, pk=None):
        ag = self.get_object()
        _assert_same_copro(request, ag)

        # Archivage interdit si clôturée ou lockée
        if ag.statut == "CLOTUREE":
            raise ValidationError({"detail": "AG clôturée : archivage interdit."})
        if ag.pv_locked:
            raise ValidationError({"detail": "PV verrouillé : archivage interdit."})

        from .services.pdf import generate_ag_pv_pdf_bytes

        with transaction.atomic():
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

    # =========================
    # Signature PAdES réelle + Lock
    # ✅ Permission admin/syndic uniquement
    # =========================
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

        # Anti re-signature
        if ag.pv_locked:
            raise ValidationError({"detail": "PV déjà verrouillé. Signature refusée."})
        if getattr(ag, "pv_signed_pdf", None):
            raise ValidationError({"detail": "PV déjà signé. Re-signature refusée."})

        if not ag.pv_pdf:
            raise ValidationError({"detail": "PV non archivé. Faites d'abord pv/archive."})

        pfx_file = request.FILES.get("pfx")
        pfx_password = (request.data.get("password") or "").strip()
        if not pfx_file or not pfx_password:
            raise ValidationError({"detail": "Fournir pfx (.p12/.pfx) et password (form-data)."})

        original_pdf_bytes = ag.pv_pdf.read()
        if not original_pdf_bytes:
            raise ValidationError({"detail": "PV archivé illisible (bytes vides)."})

        original_hash = _sha256_bytes(original_pdf_bytes)

        if ag.pv_pdf_hash and ag.pv_pdf_hash != original_hash:
            raise ValidationError({"detail": "Incohérence hash PV. Réarchivez le PV (pv/archive)."})

        from .services.pades import sign_pdf_pades

        with tempfile.NamedTemporaryFile(suffix=".p12", delete=True) as tmp:
            tmp.write(pfx_file.read())
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
            ag = AssembleeGenerale.objects.select_for_update().get(pk=ag.pk)

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

    # =========================
    # Télécharger PV signé
    # =========================
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

    # =========================
    # PV LOCK (optionnel)
    # =========================
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
            return Response({"ag_id": ag.id, "pv_locked": True, "detail": "Déjà verrouillé."}, status=status.HTTP_200_OK)

        if not ag.pv_pdf:
            raise ValidationError({"detail": "Impossible de verrouiller: PV non archivé (pv_pdf manquant)."})
        if not getattr(ag, "pv_signed_pdf", None):
            raise ValidationError({"detail": "Impossible de verrouiller: PV non signé (faites pv/sign)."})

        ag.pv_locked = True
        ag.save(update_fields=["pv_locked"])

        _log_ag_event(request, ag, event="PV_LOCKED", meta={"pv_locked": True})

        return Response({"ag_id": ag.id, "pv_locked": True}, status=status.HTTP_200_OK)

    # =========================
    # Phase 2.4 — Clôture AG (IDEMPOTENTE + TRANSACTION)
    # ✅ Permission admin/syndic uniquement
    # =========================
    @action(
        detail=True,
        methods=["post"],
        url_path="close",
        permission_classes=[IsAuthenticated, IsSyndicOrAdmin],
    )
    def close_ag(self, request, pk=None):
        """
        POST /api/ag/ags/{id}/close/
        Phase 2.4:
        - exige PV signé + pv_locked
        - exige quorum atteint
        - clôture les résolutions restantes
        - met statut=CLOTUREE
        ✅ idempotent: si déjà clôturée => 200 OK
        """
        ag = self.get_object()
        _assert_same_copro(request, ag)

        # ✅ idempotence
        if ag.statut == "CLOTUREE":
            return Response(
                {"ag_id": ag.id, "statut": ag.statut, "detail": "AG déjà clôturée."},
                status=status.HTTP_200_OK,
            )

        _assert_ag_closable(ag)

        if not ag.quorum_atteint():
            raise ValidationError({"detail": "Quorum non atteint. Impossible de clôturer l’AG."})

        with transaction.atomic():
            ag = AssembleeGenerale.objects.select_for_update().get(pk=ag.pk)

            # re-check idempotence sous lock DB
            if ag.statut == "CLOTUREE":
                return Response(
                    {"ag_id": ag.id, "statut": ag.statut, "detail": "AG déjà clôturée."},
                    status=status.HTTP_200_OK,
                )

            _assert_ag_closable(ag)

            Resolution.objects.filter(ag_id=ag.id, cloturee=False).update(cloturee=True)

            ag.statut = "CLOTUREE"
            ag.closed_at = timezone.now()
            ag.closed_by = request.user if getattr(request.user, "is_authenticated", False) else None

            # sécurité: clôture => lock
            ag.pv_locked = True

            ag.save(update_fields=["statut", "closed_at", "closed_by", "pv_locked"])

        _log_ag_event(request, ag, event="AG_CLOSED", meta={"statut": ag.statut})

        return Response(
            {"ag_id": ag.id, "statut": ag.statut, "detail": "AG clôturée (Phase 2.4)."},
            status=status.HTTP_200_OK,
        )


class PresenceLotViewSet(viewsets.ModelViewSet):
    serializer_class = PresenceLotSerializer
    queryset = PresenceLot.objects.select_related("ag", "lot").all()

    def get_queryset(self):
        copro_id = self.request.headers.get("X-Copropriete-Id")
        qs = super().get_queryset()
        if copro_id:
            qs = qs.filter(ag__copropriete_id=copro_id)

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
    serializer_class = ResolutionSerializer
    queryset = Resolution.objects.select_related("ag").all()

    def get_queryset(self):
        copro_id = self.request.headers.get("X-Copropriete-Id")
        qs = super().get_queryset()
        if copro_id:
            qs = qs.filter(ag__copropriete_id=copro_id)

        ag_id = self.request.query_params.get("ag")
        if ag_id:
            qs = qs.filter(ag_id=ag_id)

        return qs

    @action(detail=True, methods=["get"], url_path="resultat")
    def resultat(self, request, pk=None):
        _require_copro_id(request)
        res = self.get_object()
        _assert_same_copro(request, res.ag)

        agg = (
            Vote.objects
            .filter(resolution_id=res.id)
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

        return Response(
            {
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
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=["post"], url_path="cloturer")
    def cloturer(self, request, pk=None):
        _require_copro_id(request)
        res = self.get_object()
        _assert_same_copro(request, res.ag)
        _assert_ag_writable(res.ag)

        if res.cloturee:
            return Response(
                {"resolution_id": res.id, "cloturee": True, "detail": "Déjà clôturée."},
                status=status.HTTP_200_OK,
            )

        res.cloturee = True
        res.save(update_fields=["cloturee"])

        return Response({"resolution_id": res.id, "cloturee": True}, status=status.HTTP_200_OK)

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
    serializer_class = VoteSerializer
    queryset = Vote.objects.select_related("resolution", "lot", "resolution__ag").all()

    def get_queryset(self):
        copro_id = self.request.headers.get("X-Copropriete-Id")
        qs = super().get_queryset()
        if copro_id:
            qs = qs.filter(resolution__ag__copropriete_id=copro_id)

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