# apps/travaux/views.py
from __future__ import annotations

from decimal import Decimal, InvalidOperation

from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.db.models import Sum, Count
from django.utils import timezone

from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError, PermissionDenied
from rest_framework.response import Response

from apps.compta.permissions import IsAdminOrSyndicWriteReadOnly
from apps.ag.models import Resolution, Vote
from .models import Fournisseur, DossierTravaux, PaiementTravaux
from .serializers import (
    FournisseurSerializer,
    DossierTravauxSerializer,
    PaiementTravauxSerializer,
    DossierUnlockSerializer,
)


# =========================================================
# Helpers
# =========================================================

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


def _parse_int(value, field: str) -> int:
    if value is None or value == "":
        raise ValidationError({field: "Champ requis."})
    try:
        return int(str(value))
    except ValueError:
        raise ValidationError({field: "Doit être un entier."})


def _parse_decimal(value, field: str) -> Decimal:
    if value is None or value == "":
        raise ValidationError({field: "Champ requis."})
    try:
        return Decimal(str(value))
    except (InvalidOperation, TypeError):
        raise ValidationError({field: "Format invalide. Exemple: 1400000.00"})


def _ensure_same_copro(obj_copro_id: int, copro_id: int):
    if int(obj_copro_id) != int(copro_id):
        raise ValidationError({"detail": "Ressource hors copropriété."})


def _lock_dossier(dossier: DossierTravaux, user):
    """
    Verrouille le dossier de façon robuste.
    - utilise dossier.lock() si disponible
    - convertit les erreurs modèle Django en ValidationError DRF
    - sinon fallback sans hypothèses fragiles
    """
    if hasattr(dossier, "lock") and callable(getattr(dossier, "lock")):
        try:
            try:
                dossier.lock(user=user, save=True)
            except TypeError:
                try:
                    dossier.lock(user=user)
                except TypeError:
                    dossier.lock()
            return
        except DjangoValidationError as e:
            message_dict = getattr(e, "message_dict", None)
            if message_dict:
                raise ValidationError(message_dict)

            messages = getattr(e, "messages", None)
            if messages:
                raise ValidationError({"detail": messages})

            raise ValidationError({"detail": [str(e)]})

    changed_fields = []

    if hasattr(dossier, "locked_at") and not getattr(dossier, "locked_at", None):
        dossier.locked_at = timezone.now()
        changed_fields.append("locked_at")

    if hasattr(dossier, "locked_by"):
        current_locked_by_id = getattr(dossier, "locked_by_id", None)
        if user and not current_locked_by_id:
            dossier.locked_by = user
            changed_fields.append("locked_by")

    if changed_fields:
        dossier.save(update_fields=list(dict.fromkeys(changed_fields)))


def _unlock_dossier(dossier: DossierTravaux, *, user=None, raison: str | None = None):
    """
    Déverrouille de façon robuste + audit si possible.
    - utilise dossier.unlock(user=..., raison=...) si disponible
    - sinon fallback DB update
    """
    if hasattr(dossier, "unlock") and callable(getattr(dossier, "unlock")):
        try:
            dossier.unlock(user=user, raison=raison, save=True)
        except TypeError:
            dossier.unlock(save=True)
        dossier.refresh_from_db(fields=["locked_at", "locked_by"])
        return

    DossierTravaux.objects.filter(pk=dossier.pk).update(locked_at=None, locked_by=None)
    dossier.locked_at = None
    dossier.locked_by = None


def _fetch_resolution_for_link(*, resolution_id: int, copro_id: int) -> Resolution:
    """
    Récupère et LOCK la résolution (select_for_update) et valide le périmètre.
    Doit être appelée DANS transaction.atomic().
    """
    try:
        res = (
            Resolution.objects.select_related("ag")
            .select_for_update()
            .get(pk=resolution_id)
        )
    except Resolution.DoesNotExist:
        raise ValidationError({"resolution_id": "Résolution introuvable."})

    if int(res.ag.copropriete_id) != int(copro_id):
        raise ValidationError({"detail": "La résolution appartient à une autre copropriété."})

    if getattr(res, "cloturee", False):
        raise ValidationError({"detail": "Impossible de lier une résolution déjà clôturée."})

    return res


def _ensure_resolution_not_linked_elsewhere(*, resolution_id: int, dossier_id: int):
    conflict_id = (
        DossierTravaux.objects
        .filter(resolution_validation_id=resolution_id)
        .exclude(pk=dossier_id)
        .values_list("id", flat=True)
        .first()
    )
    if conflict_id:
        raise ValidationError({"detail": f"Cette résolution est déjà liée au dossier #{conflict_id}."})


def _ensure_resolution_fk_not_linked_elsewhere(*, res: Resolution, dossier_id: int):
    current = getattr(res, "travaux_dossier_id", None)
    if current and int(current) != int(dossier_id):
        raise ValidationError(
            {"detail": f"Cette résolution est déjà liée au dossier #{current} (Resolution.travaux_dossier)."}
        )


def _clear_resolution_fk_if_points_to_dossier(*, resolution_id: int, dossier_id: int):
    Resolution.objects.filter(pk=resolution_id, travaux_dossier_id=dossier_id).update(travaux_dossier=None)


def _sync_links(*, d: DossierTravaux, res: Resolution):
    """
    Synchronise les 2 liens de façon cohérente et idempotente :
    - OneToOne : d.resolution_validation = res
    - FK miroir : res.travaux_dossier = d
    Appel à faire sous transaction.atomic() avec d/res lockés.
    """
    if d.resolution_validation_id != res.id:
        DossierTravaux.objects.filter(pk=d.pk).update(resolution_validation_id=res.id)
        d.resolution_validation_id = res.id

    if getattr(res, "travaux_dossier_id", None) != d.id:
        Resolution.objects.filter(pk=res.pk).update(travaux_dossier_id=d.id)
        res.travaux_dossier_id = d.id


def _compute_resolution_decision(resolution_id: int, copro_id: int) -> str:
    """
    Calcule ADOPTEE/REJETEE en se basant sur la logique majorités.
    Vérifie aussi le périmètre copropriété.
    """
    res = Resolution.objects.select_related("ag").get(pk=resolution_id)

    if int(res.ag.copropriete_id) != int(copro_id):
        raise ValidationError({"detail": "Résolution hors copropriété."})

    agg = (
        Vote.objects.filter(resolution_id=res.id)
        .values("choix")
        .annotate(t=Sum("tantiemes"))
    )
    by = {row["choix"]: Decimal(str(row["t"] or 0)) for row in agg}

    pour = by.get("POUR", Decimal("0"))
    contre = by.get("CONTRE", Decimal("0"))
    exprimes = pour + contre

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

    return decision


# =========================================================
# ViewSets
# =========================================================

class FournisseurViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAdminOrSyndicWriteReadOnly]
    serializer_class = FournisseurSerializer
    queryset = Fournisseur.objects.all().order_by("-id")

    def get_queryset(self):
        copro_id = _require_copro_id(self.request)
        return super().get_queryset().filter(copropriete_id=copro_id)

    def perform_create(self, serializer):
        copro_id = _require_copro_id(self.request)
        serializer.save(copropriete_id=copro_id)

    def perform_update(self, serializer):
        copro_id = _require_copro_id(self.request)
        inst = serializer.instance
        _ensure_same_copro(inst.copropriete_id, copro_id)
        serializer.save()

    def perform_destroy(self, instance):
        copro_id = _require_copro_id(self.request)
        _ensure_same_copro(instance.copropriete_id, copro_id)
        super().perform_destroy(instance)


class DossierTravauxViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAdminOrSyndicWriteReadOnly]
    serializer_class = DossierTravauxSerializer
    queryset = DossierTravaux.objects.all().order_by("-id")

    def get_queryset(self):
        copro_id = _require_copro_id(self.request)
        return super().get_queryset().filter(copropriete_id=copro_id)

    def perform_create(self, serializer):
        copro_id = _require_copro_id(self.request)
        serializer.save(copropriete_id=copro_id)

    def perform_update(self, serializer):
        copro_id = _require_copro_id(self.request)
        inst = serializer.instance
        _ensure_same_copro(inst.copropriete_id, copro_id)
        if inst.is_locked:
            raise ValidationError({"detail": "Dossier verrouillé : modification interdite."})
        serializer.save()

    def perform_destroy(self, instance):
        copro_id = _require_copro_id(self.request)
        _ensure_same_copro(instance.copropriete_id, copro_id)
        if instance.is_locked:
            raise ValidationError({"detail": "Dossier verrouillé : suppression interdite."})
        super().perform_destroy(instance)

    @action(detail=False, methods=["get"], url_path="stats")
    def stats(self, request):
        copro_id = _require_copro_id(request)

        qs = DossierTravaux.objects.filter(copropriete_id=copro_id)
        total_dossiers = qs.count()

        by_statut_rows = (
            qs.values("statut")
            .annotate(count=Count("id"))
            .order_by()
        )
        by_statut = {row["statut"]: int(row["count"]) for row in by_statut_rows}

        budgets = qs.aggregate(
            budget_estime_total=Sum("budget_estime"),
            budget_vote_total=Sum("budget_vote"),
            dossiers_avec_budget_vote=Count("budget_vote"),
        )

        budget_estime_total = Decimal(str(budgets.get("budget_estime_total") or "0"))
        budget_vote_total = Decimal(str(budgets.get("budget_vote_total") or "0"))
        dossiers_avec_budget_vote = int(budgets.get("dossiers_avec_budget_vote") or 0)

        locked_count = qs.filter(locked_at__isnull=False).count()
        unlocked_count = total_dossiers - locked_count

        ratio_vote_estime = (
            float(budget_vote_total / budget_estime_total)
            if budget_estime_total > 0
            else 0.0
        )

        return Response(
            {
                "copropriete_id": int(copro_id),
                "total_dossiers": int(total_dossiers),
                "by_statut": by_statut,
                "budgets": {
                    "budget_estime_total": float(budget_estime_total),
                    "budget_vote_total": float(budget_vote_total),
                    "ratio_vote_estime": ratio_vote_estime,
                    "dossiers_avec_budget_vote": dossiers_avec_budget_vote,
                },
                "locks": {
                    "locked_count": int(locked_count),
                    "unlocked_count": int(unlocked_count),
                },
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=["post"], url_path="lock")
    def lock(self, request, pk=None):
        copro_id = _require_copro_id(request)
        dossier = self.get_object()
        _ensure_same_copro(dossier.copropriete_id, copro_id)

        with transaction.atomic():
            d = DossierTravaux.objects.select_for_update().get(pk=dossier.pk, copropriete_id=copro_id)
            if d.is_locked:
                return Response(
                    {"dossier_id": d.id, "locked": True, "detail": "Déjà verrouillé."},
                    status=status.HTTP_200_OK
                )

            user = request.user if getattr(request.user, "is_authenticated", False) else None
            _lock_dossier(d, user)

        return Response(
            {
                "dossier_id": d.id,
                "locked": True,
                "locked_at": d.locked_at.isoformat() if d.locked_at else None,
                "locked_by": d.locked_by_id
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=["post"], url_path="unlock")
    def unlock(self, request, pk=None):
        if not request.user.is_superuser:
            raise PermissionDenied("Action réservée à l'ADMIN.")

        copro_id = _require_copro_id(request)
        dossier = self.get_object()
        _ensure_same_copro(dossier.copropriete_id, copro_id)

        ser = DossierUnlockSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        raison = ser.validated_data["raison"]

        with transaction.atomic():
            d = DossierTravaux.objects.select_for_update().get(pk=dossier.pk, copropriete_id=copro_id)
            if not d.is_locked:
                return Response(
                    {"dossier_id": d.id, "locked": False, "detail": "Déjà déverrouillé."},
                    status=status.HTTP_200_OK
                )

            _unlock_dossier(d, user=request.user, raison=raison)

        return Response(
            {"dossier_id": d.id, "locked": False, "detail": "Dossier déverrouillé (audit enregistré)."},
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=["post"], url_path="submit-ag")
    def submit_ag(self, request, pk=None):
        copro_id = _require_copro_id(request)
        dossier = self.get_object()
        _ensure_same_copro(dossier.copropriete_id, copro_id)

        if dossier.is_locked:
            raise ValidationError({"detail": "Dossier verrouillé : opération interdite."})

        with transaction.atomic():
            d = DossierTravaux.objects.select_for_update().get(pk=dossier.pk, copropriete_id=copro_id)
            if d.is_locked:
                raise ValidationError({"detail": "Dossier verrouillé : opération interdite."})

            if d.statut != DossierTravaux.Statut.BROUILLON:
                return Response(
                    {"dossier_id": d.id, "statut": d.statut, "detail": "Déjà soumis ou déjà traité."},
                    status=status.HTTP_200_OK,
                )

            d.submit_ag()
            d.save(update_fields=["statut"])

        return Response({"dossier_id": d.id, "statut": d.statut, "detail": "Dossier soumis à l'AG."})

    @action(detail=True, methods=["post"], url_path="start")
    def start(self, request, pk=None):
        copro_id = _require_copro_id(request)
        dossier = self.get_object()
        _ensure_same_copro(dossier.copropriete_id, copro_id)

        if not dossier.is_locked:
            raise ValidationError({"detail": "Le dossier doit être verrouillé/validé avant démarrage."})

        with transaction.atomic():
            d = DossierTravaux.objects.select_for_update().get(pk=dossier.pk, copropriete_id=copro_id)
            if not d.is_locked:
                raise ValidationError({"detail": "Le dossier doit être verrouillé/validé avant démarrage."})

            d.start()
            d.save(update_fields=["statut"])

        return Response({"dossier_id": d.id, "statut": d.statut, "detail": "Travaux démarrés."})

    @action(detail=True, methods=["post"], url_path="finish")
    def finish(self, request, pk=None):
        copro_id = _require_copro_id(request)
        dossier = self.get_object()
        _ensure_same_copro(dossier.copropriete_id, copro_id)

        if not dossier.is_locked:
            raise ValidationError({"detail": "Le dossier doit être verrouillé/validé avant clôture des travaux."})

        with transaction.atomic():
            d = DossierTravaux.objects.select_for_update().get(pk=dossier.pk, copropriete_id=copro_id)
            if not d.is_locked:
                raise ValidationError({"detail": "Le dossier doit être verrouillé/validé avant clôture des travaux."})

            d.finish()
            d.save(update_fields=["statut"])

        return Response({"dossier_id": d.id, "statut": d.statut, "detail": "Travaux terminés."})

    @action(detail=True, methods=["post"], url_path="archive")
    def archive(self, request, pk=None):
        copro_id = _require_copro_id(request)
        dossier = self.get_object()
        _ensure_same_copro(dossier.copropriete_id, copro_id)

        if not dossier.is_locked:
            raise ValidationError({"detail": "Le dossier doit être verrouillé avant archivage."})

        with transaction.atomic():
            d = DossierTravaux.objects.select_for_update().get(pk=dossier.pk, copropriete_id=copro_id)
            if not d.is_locked:
                raise ValidationError({"detail": "Le dossier doit être verrouillé avant archivage."})

            d.archive()
            d.save(update_fields=["statut"])

        return Response({"dossier_id": d.id, "statut": d.statut, "detail": "Dossier archivé."})

    @action(detail=True, methods=["post"], url_path="link-resolution")
    def link_resolution(self, request, pk=None):
        copro_id = _require_copro_id(request)
        dossier = self.get_object()
        _ensure_same_copro(dossier.copropriete_id, copro_id)

        if dossier.is_locked:
            raise ValidationError({"detail": "Dossier verrouillé : liaison interdite."})

        if dossier.statut not in {DossierTravaux.Statut.SOUMIS_AG, DossierTravaux.Statut.VALIDE}:
            raise ValidationError({"detail": "Le dossier doit être SOUMIS_AG (ou VALIDE) pour lier une résolution."})

        resolution_id = _parse_int(request.data.get("resolution_id"), "resolution_id")

        with transaction.atomic():
            d = DossierTravaux.objects.select_for_update().get(pk=dossier.pk, copropriete_id=copro_id)
            if d.is_locked:
                raise ValidationError({"detail": "Dossier verrouillé : liaison interdite."})

            res = _fetch_resolution_for_link(resolution_id=resolution_id, copro_id=copro_id)
            _ensure_resolution_not_linked_elsewhere(resolution_id=resolution_id, dossier_id=d.id)
            _ensure_resolution_fk_not_linked_elsewhere(res=res, dossier_id=d.id)

            if d.resolution_validation_id == res.id and getattr(res, "travaux_dossier_id", None) == d.id:
                return Response(
                    {
                        "dossier_id": d.id,
                        "statut": d.statut,
                        "resolution_validation_id": d.resolution_validation_id,
                        "resolution_id": res.id,
                        "detail": "Déjà lié (idempotent).",
                    },
                    status=status.HTTP_200_OK,
                )

            if d.resolution_validation_id and d.resolution_validation_id != res.id:
                raise ValidationError({"detail": "Dossier déjà lié à une autre résolution (utilise relink)."})

            _sync_links(d=d, res=res)

        return Response(
            {
                "dossier_id": d.id,
                "statut": d.statut,
                "resolution_validation_id": d.resolution_validation_id,
                "resolution_id": res.id,
                "detail": "Résolution liée au dossier.",
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=["post"], url_path="unlink-resolution")
    def unlink_resolution(self, request, pk=None):
        copro_id = _require_copro_id(request)
        dossier = self.get_object()
        _ensure_same_copro(dossier.copropriete_id, copro_id)

        if dossier.is_locked:
            raise ValidationError({"detail": "Dossier verrouillé : opération interdite."})

        with transaction.atomic():
            d = DossierTravaux.objects.select_for_update().get(pk=dossier.pk, copropriete_id=copro_id)
            if d.is_locked:
                raise ValidationError({"detail": "Dossier verrouillé : opération interdite."})

            old_res_id = d.resolution_validation_id

            if not old_res_id:
                return Response(
                    {
                        "dossier_id": d.id,
                        "statut": d.statut,
                        "resolution_validation_id": None,
                        "detail": "Aucune liaison à supprimer (idempotent).",
                    },
                    status=status.HTTP_200_OK,
                )

            DossierTravaux.objects.filter(pk=d.pk, copropriete_id=copro_id).update(resolution_validation=None)
            d.resolution_validation_id = None

            _clear_resolution_fk_if_points_to_dossier(resolution_id=old_res_id, dossier_id=d.id)

        return Response(
            {
                "dossier_id": d.id,
                "statut": d.statut,
                "resolution_validation_id": d.resolution_validation_id,
                "detail": "Liaison supprimée.",
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=["post"], url_path="relink-resolution")
    def relink_resolution(self, request, pk=None):
        copro_id = _require_copro_id(request)
        dossier = self.get_object()
        _ensure_same_copro(dossier.copropriete_id, copro_id)

        if dossier.is_locked:
            raise ValidationError({"detail": "Dossier verrouillé : opération interdite."})

        if dossier.statut not in {DossierTravaux.Statut.SOUMIS_AG, DossierTravaux.Statut.VALIDE}:
            raise ValidationError({"detail": "Le dossier doit être SOUMIS_AG (ou VALIDE) pour relier une résolution."})

        resolution_id = _parse_int(request.data.get("resolution_id"), "resolution_id")

        with transaction.atomic():
            d = DossierTravaux.objects.select_for_update().get(pk=dossier.pk, copropriete_id=copro_id)
            if d.is_locked:
                raise ValidationError({"detail": "Dossier verrouillé : opération interdite."})

            res = _fetch_resolution_for_link(resolution_id=resolution_id, copro_id=copro_id)
            _ensure_resolution_not_linked_elsewhere(resolution_id=resolution_id, dossier_id=d.id)
            _ensure_resolution_fk_not_linked_elsewhere(res=res, dossier_id=d.id)

            previous = d.resolution_validation_id

            if previous == res.id and getattr(res, "travaux_dossier_id", None) == d.id:
                return Response(
                    {
                        "dossier_id": d.id,
                        "statut": d.statut,
                        "previous_resolution_validation_id": previous,
                        "resolution_validation_id": d.resolution_validation_id,
                        "resolution_id": res.id,
                        "detail": "Déjà lié (idempotent).",
                    },
                    status=status.HTTP_200_OK,
                )

            if previous and previous != res.id:
                _clear_resolution_fk_if_points_to_dossier(resolution_id=previous, dossier_id=d.id)

            _sync_links(d=d, res=res)

        return Response(
            {
                "dossier_id": d.id,
                "statut": d.statut,
                "previous_resolution_validation_id": previous,
                "resolution_validation_id": d.resolution_validation_id,
                "resolution_id": res.id,
                "detail": "Résolution remplacée (relink).",
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=["post"], url_path="validate-ag")
    def validate_ag(self, request, pk=None):
        copro_id = _require_copro_id(request)
        dossier = self.get_object()
        _ensure_same_copro(dossier.copropriete_id, copro_id)

        if dossier.is_locked:
            return Response({"dossier_id": dossier.id, "statut": dossier.statut, "detail": "Déjà verrouillé."})

        if dossier.statut != DossierTravaux.Statut.SOUMIS_AG:
            raise ValidationError({"detail": "Le dossier doit être SOUMIS_AG avant validation."})

        resolution_id = _parse_int(request.data.get("resolution_id"), "resolution_id")
        budget_vote_dec = _parse_decimal(request.data.get("budget_vote"), "budget_vote")

        if budget_vote_dec < 0:
            raise ValidationError({"budget_vote": "Doit être >= 0."})
        if dossier.budget_estime is not None and budget_vote_dec > dossier.budget_estime:
            raise ValidationError({"budget_vote": "Ne peut pas dépasser budget_estime."})

        decision = _compute_resolution_decision(resolution_id, copro_id)
        if decision != "ADOPTEE":
            raise ValidationError({"detail": "Validation impossible : la résolution n'est pas ADOPTEE."})

        with transaction.atomic():
            d = DossierTravaux.objects.select_for_update().get(pk=dossier.pk, copropriete_id=copro_id)
            if d.is_locked:
                return Response({"dossier_id": d.id, "statut": d.statut, "detail": "Déjà verrouillé."})

            if d.statut != DossierTravaux.Statut.SOUMIS_AG:
                raise ValidationError({"detail": "Le dossier doit être SOUMIS_AG avant validation."})

            res = _fetch_resolution_for_link(resolution_id=resolution_id, copro_id=copro_id)
            _ensure_resolution_not_linked_elsewhere(resolution_id=resolution_id, dossier_id=d.id)
            _ensure_resolution_fk_not_linked_elsewhere(res=res, dossier_id=d.id)

            previous = d.resolution_validation_id
            if previous and previous != res.id:
                _clear_resolution_fk_if_points_to_dossier(resolution_id=previous, dossier_id=d.id)

            _sync_links(d=d, res=res)

            d.budget_vote = budget_vote_dec
            d.validate_ag()
            d.save(update_fields=["budget_vote", "statut"])

            if hasattr(res, "budget_vote"):
                Resolution.objects.filter(pk=res.pk).update(budget_vote=budget_vote_dec)
                res.budget_vote = budget_vote_dec

            _lock_dossier(d, request.user if request.user.is_authenticated else None)

        return Response(
            {
                "dossier_id": d.id,
                "statut": d.statut,
                "resolution_validation_id": d.resolution_validation_id,
                "resolution_id": res.id,
                "budget_vote": str(d.budget_vote) if d.budget_vote is not None else None,
                "locked_at": d.locked_at.isoformat() if d.locked_at else None,
                "locked_by": d.locked_by_id,
            },
            status=status.HTTP_200_OK,
        )


class PaiementTravauxViewSet(viewsets.ModelViewSet):
    """
    - GET/POST /api/travaux/paiements/
    - GET/PUT/PATCH/DELETE /api/travaux/paiements/<id>/
    - GET /api/travaux/paiements/stats/
    """
    permission_classes = [IsAdminOrSyndicWriteReadOnly]
    serializer_class = PaiementTravauxSerializer
    queryset = PaiementTravaux.objects.all().order_by("-date_paiement", "-id")

    def get_queryset(self):
        copro_id = _require_copro_id(self.request)
        qs = super().get_queryset().filter(dossier__copropriete_id=copro_id).select_related(
            "dossier", "fournisseur"
        )

        dossier_id = self.request.query_params.get("dossier")
        fournisseur_id = self.request.query_params.get("fournisseur")

        if dossier_id:
            try:
                qs = qs.filter(dossier_id=int(dossier_id))
            except ValueError:
                raise ValidationError({"dossier": "Doit être un entier."})

        if fournisseur_id:
            try:
                qs = qs.filter(fournisseur_id=int(fournisseur_id))
            except ValueError:
                raise ValidationError({"fournisseur": "Doit être un entier."})

        return qs

    def perform_create(self, serializer):
        copro_id = _require_copro_id(self.request)

        dossier = serializer.validated_data["dossier"]
        if int(dossier.copropriete_id) != int(copro_id):
            raise ValidationError({"detail": "Dossier hors copropriété."})

        fournisseur = serializer.validated_data.get("fournisseur")
        if fournisseur and int(fournisseur.copropriete_id) != int(copro_id):
            raise ValidationError({"detail": "Fournisseur hors copropriété."})

        serializer.save()

    def perform_update(self, serializer):
        copro_id = _require_copro_id(self.request)
        inst: PaiementTravaux = serializer.instance

        if int(inst.dossier.copropriete_id) != int(copro_id):
            raise ValidationError({"detail": "Ressource hors copropriété."})

        dossier = serializer.validated_data.get("dossier", inst.dossier)
        if int(dossier.copropriete_id) != int(copro_id):
            raise ValidationError({"detail": "Dossier hors copropriété."})

        fournisseur = serializer.validated_data.get("fournisseur", inst.fournisseur)
        if fournisseur and int(fournisseur.copropriete_id) != int(copro_id):
            raise ValidationError({"detail": "Fournisseur hors copropriété."})

        serializer.save()

    def perform_destroy(self, instance):
        copro_id = _require_copro_id(self.request)
        if int(instance.dossier.copropriete_id) != int(copro_id):
            raise ValidationError({"detail": "Ressource hors copropriété."})
        super().perform_destroy(instance)

    @action(detail=False, methods=["get"], url_path="stats")
    def stats(self, request):
        """
        GET /api/travaux/paiements/stats/
        Header: X-Copropriete-Id
        """
        copro_id = _require_copro_id(request)

        pqs = PaiementTravaux.objects.filter(dossier__copropriete_id=copro_id)
        total_paye = Decimal(str(pqs.aggregate(t=Sum("montant")).get("t") or "0"))

        dqs = DossierTravaux.objects.filter(copropriete_id=copro_id)
        total_budget_vote = Decimal(str(dqs.aggregate(t=Sum("budget_vote")).get("t") or "0"))

        reste_global = total_budget_vote - total_paye

        by_f_rows = (
            pqs.values("fournisseur_id")
            .annotate(total=Sum("montant"), count=Count("id"))
            .order_by("-total")
        )
        by_fournisseur = [
            {
                "fournisseur_id": int(r["fournisseur_id"]),
                "total_paye": float(Decimal(str(r["total"] or 0))),
                "nb_paiements": int(r["count"]),
            }
            for r in by_f_rows
            if r["fournisseur_id"] is not None
        ]

        by_d_rows = (
            pqs.values("dossier_id")
            .annotate(total_paye=Sum("montant"), nb=Count("id"))
            .order_by("-total_paye")
        )
        budgets_map = {
            row["id"]: Decimal(str(row["budget_vote"] or "0"))
            for row in dqs.values("id", "budget_vote")
        }

        by_dossier = []
        for r in by_d_rows:
            dossier_id = int(r["dossier_id"])
            paye = Decimal(str(r["total_paye"] or "0"))
            budget = budgets_map.get(dossier_id, Decimal("0"))
            by_dossier.append(
                {
                    "dossier_id": dossier_id,
                    "total_paye": float(paye),
                    "budget_vote": float(budget),
                    "reste": float(budget - paye),
                    "nb_paiements": int(r["nb"]),
                }
            )

        return Response(
            {
                "copropriete_id": int(copro_id),
                "totaux": {
                    "total_paye": float(total_paye),
                    "total_budget_vote": float(total_budget_vote),
                    "reste_global": float(reste_global),
                },
                "by_fournisseur": by_fournisseur,
                "by_dossier": by_dossier,
            },
            status=status.HTTP_200_OK,
        )