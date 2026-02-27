# apps/travaux/views.py
from __future__ import annotations

from decimal import Decimal, InvalidOperation

from django.db import transaction
from django.utils import timezone

from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.ag.models import Resolution
from .models import Fournisseur, DossierTravaux
from .serializers import FournisseurSerializer, DossierTravauxSerializer


# =========================================================
# Helpers
# =========================================================

def _require_copro_id(request) -> int:
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
    - sinon fallback + update_fields corrects
    """
    if hasattr(dossier, "lock") and callable(getattr(dossier, "lock")):
        dossier.lock(user=user, save=True)
        return

    changed_fields = []
    if not dossier.locked_at:
        dossier.locked_at = timezone.now()
        changed_fields.append("locked_at")

    if user and not dossier.locked_by_id:
        dossier.locked_by = user
        changed_fields.append("locked_by")

    if changed_fields:
        dossier.save(update_fields=list(dict.fromkeys(changed_fields)))

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
    """
    Empêche qu'une résolution serve de validation à 2 dossiers (OneToOne vérité métier).
    """
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
    """
    Empêche que la FK miroir pointe vers un autre dossier.
    (Ton modèle Resolution a bien travaux_dossier, donc on l'applique.)
    """
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
    # vérité métier: OneToOne
    if d.resolution_validation_id != res.id:
        DossierTravaux.objects.filter(pk=d.pk).update(resolution_validation_id=res.id)
        d.resolution_validation_id = res.id

    # FK miroir
    if getattr(res, "travaux_dossier_id", None) != d.id:
        Resolution.objects.filter(pk=res.pk).update(travaux_dossier_id=d.id)
        res.travaux_dossier_id = d.id


# =========================================================
# ViewSets
# =========================================================

class FournisseurViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
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
    permission_classes = [IsAuthenticated]
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

    # -----------------------------------------------------
    # Workflow
    # -----------------------------------------------------

    @action(detail=True, methods=["post"], url_path="submit-ag")
    def submit_ag(self, request, pk=None):
        copro_id = _require_copro_id(request)
        dossier = self.get_object()
        _ensure_same_copro(dossier.copropriete_id, copro_id)

        if dossier.is_locked:
            raise ValidationError({"detail": "Dossier verrouillé : opération interdite."})

        with transaction.atomic():
            d = DossierTravaux.objects.select_for_update().get(pk=dossier.pk)
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
            d = DossierTravaux.objects.select_for_update().get(pk=dossier.pk)
            d.start()
            d.save(update_fields=["statut"])

        return Response({"dossier_id": d.id, "statut": d.statut, "detail": "Travaux démarrés."})

    @action(detail=True, methods=["post"], url_path="finish")
    def finish(self, request, pk=None):
        copro_id = _require_copro_id(request)
        dossier = self.get_object()
        _ensure_same_copro(dossier.copropriete_id, copro_id)

        with transaction.atomic():
            d = DossierTravaux.objects.select_for_update().get(pk=dossier.pk)
            d.finish()
            d.save(update_fields=["statut"])

        return Response({"dossier_id": d.id, "statut": d.statut, "detail": "Travaux terminés."})

    @action(detail=True, methods=["post"], url_path="archive")
    def archive(self, request, pk=None):
        copro_id = _require_copro_id(request)
        dossier = self.get_object()
        _ensure_same_copro(dossier.copropriete_id, copro_id)

        with transaction.atomic():
            d = DossierTravaux.objects.select_for_update().get(pk=dossier.pk)
            d.archive()
            d.save(update_fields=["statut"])

        return Response({"dossier_id": d.id, "statut": d.statut, "detail": "Dossier archivé."})

    # -----------------------------------------------------
    # Liaison résolution (OneToOne + miroir Resolution.travaux_dossier)
    # -----------------------------------------------------

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
            d = DossierTravaux.objects.select_for_update().get(pk=dossier.pk)
            if d.is_locked:
                raise ValidationError({"detail": "Dossier verrouillé : liaison interdite."})

            res = _fetch_resolution_for_link(resolution_id=resolution_id, copro_id=copro_id)
            _ensure_resolution_not_linked_elsewhere(resolution_id=resolution_id, dossier_id=d.id)
            _ensure_resolution_fk_not_linked_elsewhere(res=res, dossier_id=d.id)

            # ✅ idempotence totale
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

            # conflit dossier déjà lié à une autre résolution
            if d.resolution_validation_id and d.resolution_validation_id != res.id:
                raise ValidationError({"detail": "Dossier déjà lié à une autre résolution (utilise relink)."})
            # sync cohérent
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
            d = DossierTravaux.objects.select_for_update().get(pk=dossier.pk)
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

            # OneToOne vérité
            DossierTravaux.objects.filter(pk=d.pk).update(resolution_validation=None)
            d.resolution_validation_id = None

            # FK miroir
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
            d = DossierTravaux.objects.select_for_update().get(pk=dossier.pk)
            if d.is_locked:
                raise ValidationError({"detail": "Dossier verrouillé : opération interdite."})

            res = _fetch_resolution_for_link(resolution_id=resolution_id, copro_id=copro_id)
            _ensure_resolution_not_linked_elsewhere(resolution_id=resolution_id, dossier_id=d.id)
            _ensure_resolution_fk_not_linked_elsewhere(res=res, dossier_id=d.id)

            previous = d.resolution_validation_id

            # idempotent
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

            # nettoie ancien miroir FK si besoin
            if previous and previous != res.id:
                _clear_resolution_fk_if_points_to_dossier(resolution_id=previous, dossier_id=d.id)

            # sync nouveau lien
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

        with transaction.atomic():
            d = DossierTravaux.objects.select_for_update().get(pk=dossier.pk)
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

            # sync liens
            _sync_links(d=d, res=res)

            # statut + budget_vote
            d.budget_vote = budget_vote_dec
            d.validate_ag()
            d.save(update_fields=["budget_vote", "statut"])

            # miroir budget_vote côté résolution
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