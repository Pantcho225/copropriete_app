# apps/lots/views.py
from __future__ import annotations

from decimal import Decimal

from django.db import IntegrityError
from django.db.models import Count, Q, Sum
from rest_framework import filters, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.core.models import CoproMembre

from .models import Lot, LotTantieme, TantiemeCategorie
from .serializers import (
    LotListSerializer,
    LotSerializer,
    LotTantiemeListSerializer,
    LotTantiemeSerializer,
    TantiemeCategorieListSerializer,
    TantiemeCategorieSerializer,
)


TRUE_VALUES = {"1", "true", "yes", "y", "oui", "on"}
FALSE_VALUES = {"0", "false", "no", "n", "non", "off"}


def _parse_bool_param(value):
    if value is None or value == "":
        return None

    normalized = str(value).strip().lower()

    if normalized in TRUE_VALUES:
        return True

    if normalized in FALSE_VALUES:
        return False

    return None


def _is_platform_admin(user) -> bool:
    """
    Super Admin plateforme.

    Pour cette version :
    - is_superuser=True
    - ou is_staff=True

    Plus tard, on pourra brancher un vrai rôle plateforme :
    PLATFORM_OWNER, PLATFORM_ADMIN, SUPPORT, etc.
    """
    return bool(
        user
        and user.is_authenticated
        and (
            getattr(user, "is_superuser", False)
            or getattr(user, "is_staff", False)
        )
    )


def _get_active_membership(user, copropriete_id):
    if not user or not user.is_authenticated or not copropriete_id:
        return None

    return (
        CoproMembre.objects.filter(
            user=user,
            copropriete_id=copropriete_id,
            is_active=True,
        )
        .select_related("copropriete", "user")
        .first()
    )


def _can_read_copropriete(user, copropriete_id) -> bool:
    if _is_platform_admin(user):
        return True

    return _get_active_membership(user, copropriete_id) is not None


def _can_manage_referentiel(user, copropriete_id) -> bool:
    """
    Droit de gestion du référentiel :
    - Super Admin plateforme ;
    - Admin local ;
    - Syndic ;
    - Gestionnaire si le rôle existe dans le modèle.
    """
    if _is_platform_admin(user):
        return True

    membership = _get_active_membership(user, copropriete_id)

    if not membership:
        return False

    allowed_roles = {
        CoproMembre.Role.ADMIN,
        CoproMembre.Role.SYNDIC,
    }

    if hasattr(CoproMembre.Role, "GESTIONNAIRE"):
        allowed_roles.add(CoproMembre.Role.GESTIONNAIRE)

    return membership.role in allowed_roles


def _require_read_copropriete(user, copropriete_id):
    if not _can_read_copropriete(user, copropriete_id):
        raise PermissionDenied(
            "Vous n'avez pas accès à cette copropriété."
        )


def _require_manage_referentiel(user, copropriete_id):
    if not _can_manage_referentiel(user, copropriete_id):
        raise PermissionDenied(
            "Vous n'avez pas le droit de gérer le référentiel de cette copropriété."
        )


def _inject_copropriete_from_scope(request):
    """
    Si le frontend n'envoie pas copropriete dans le body mais envoie
    X-Copropriete-Id, on injecte automatiquement la copropriété dans le payload.
    """
    data = request.data.copy()

    if not data.get("copropriete"):
        copropriete_id = request.headers.get("X-Copropriete-Id")
        if copropriete_id:
            data["copropriete"] = copropriete_id

    return data


def _decimal_to_string(value) -> str:
    return str(value or Decimal("0"))


class LotViewSet(viewsets.ModelViewSet):
    """
    API des lots.

    Routes prévues :
    - GET    /api/lots/
    - POST   /api/lots/
    - GET    /api/lots/<id>/
    - PUT    /api/lots/<id>/
    - PATCH  /api/lots/<id>/
    - DELETE /api/lots/<id>/       -> désactivation logique

    Actions :
    - POST /api/lots/<id>/activer/
    - POST /api/lots/<id>/desactiver/
    - GET  /api/lots/<id>/tantiemes/
    - GET  /api/lots/<id>/proprietaires/
    - GET  /api/lots/stats/
    """

    permission_classes = [IsAuthenticated]

    filter_backends = [
        filters.SearchFilter,
        filters.OrderingFilter,
    ]

    search_fields = [
        "reference",
        "numero",
        "batiment",
        "escalier",
        "etage",
        "porte",
        "description",
        "copropriete__nom",
    ]

    ordering_fields = [
        "id",
        "reference",
        "numero",
        "type_lot",
        "statut",
        "batiment",
        "etage",
        "porte",
        "surface",
        "actif",
        "created_at",
        "updated_at",
    ]

    ordering = ["reference", "id"]

    def get_queryset(self):
        user = self.request.user

        qs = (
            Lot.objects.all()
            .select_related("copropriete")
            .prefetch_related(
                "tantiemes",
                "tantiemes__categorie",
                "proprietaires",
                "proprietaires__coproprietaire",
            )
            .order_by("reference", "id")
        )

        if not _is_platform_admin(user):
            allowed_copro_ids = CoproMembre.objects.filter(
                user=user,
                is_active=True,
            ).values_list("copropriete_id", flat=True)

            qs = qs.filter(copropriete_id__in=allowed_copro_ids)

        copropriete_id = self.request.query_params.get("copropriete")
        if copropriete_id:
            qs = qs.filter(copropriete_id=copropriete_id)

        actif = _parse_bool_param(self.request.query_params.get("actif"))
        if actif is not None:
            qs = qs.filter(actif=actif)

        type_lot = self.request.query_params.get("type_lot")
        if type_lot:
            qs = qs.filter(type_lot=type_lot)

        statut = self.request.query_params.get("statut")
        if statut:
            qs = qs.filter(statut=statut)

        batiment = self.request.query_params.get("batiment")
        if batiment:
            qs = qs.filter(batiment__icontains=batiment.strip())

        q = self.request.query_params.get("q")
        if q:
            q = q.strip()
            qs = qs.filter(
                Q(reference__icontains=q)
                | Q(numero__icontains=q)
                | Q(batiment__icontains=q)
                | Q(escalier__icontains=q)
                | Q(etage__icontains=q)
                | Q(porte__icontains=q)
                | Q(description__icontains=q)
                | Q(copropriete__nom__icontains=q)
            )

        return qs

    def get_serializer_class(self):
        if self.action == "list":
            return LotListSerializer

        return LotSerializer

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()

        _require_read_copropriete(request.user, instance.copropriete_id)

        serializer = LotSerializer(instance)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def create(self, request, *args, **kwargs):
        data = _inject_copropriete_from_scope(request)
        copropriete_id = data.get("copropriete")

        if not copropriete_id:
            raise ValidationError(
                {
                    "copropriete": (
                        "La copropriété est obligatoire. Envoyez copropriete "
                        "dans le payload ou le header X-Copropriete-Id."
                    )
                }
            )

        _require_manage_referentiel(request.user, copropriete_id)

        serializer = LotSerializer(data=data)
        serializer.is_valid(raise_exception=True)

        try:
            instance = serializer.save()
        except IntegrityError:
            raise ValidationError(
                {
                    "reference": (
                        "Un lot avec cette référence existe déjà dans cette copropriété."
                    )
                }
            )

        output = LotSerializer(instance)
        return Response(output.data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        instance = self.get_object()

        _require_manage_referentiel(request.user, instance.copropriete_id)

        data = _inject_copropriete_from_scope(request)

        serializer = LotSerializer(
            instance,
            data=data,
            partial=partial,
        )
        serializer.is_valid(raise_exception=True)

        target_copropriete = serializer.validated_data.get(
            "copropriete",
            instance.copropriete,
        )

        _require_manage_referentiel(request.user, target_copropriete.id)

        try:
            instance = serializer.save()
        except IntegrityError:
            raise ValidationError(
                {
                    "reference": (
                        "Un lot avec cette référence existe déjà dans cette copropriété."
                    )
                }
            )

        output = LotSerializer(instance)
        return Response(output.data, status=status.HTTP_200_OK)

    def destroy(self, request, *args, **kwargs):
        """
        Pas de suppression physique depuis React.

        On désactive le lot pour préserver :
        - appels de fonds ;
        - tantièmes ;
        - propriétaires ;
        - votes AG ;
        - relances ;
        - historique comptable.
        """
        instance = self.get_object()

        _require_manage_referentiel(request.user, instance.copropriete_id)

        instance.actif = False
        instance.statut = Lot.Statut.INACTIF
        instance.save(update_fields=["actif", "statut", "updated_at"])

        output = LotSerializer(instance)
        return Response(output.data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"])
    def activer(self, request, pk=None):
        instance = self.get_object()

        _require_manage_referentiel(request.user, instance.copropriete_id)

        instance.actif = True

        if instance.statut == Lot.Statut.INACTIF:
            instance.statut = Lot.Statut.OCCUPE

        instance.save(update_fields=["actif", "statut", "updated_at"])

        output = LotSerializer(instance)
        return Response(output.data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"])
    def desactiver(self, request, pk=None):
        instance = self.get_object()

        _require_manage_referentiel(request.user, instance.copropriete_id)

        instance.actif = False
        instance.statut = Lot.Statut.INACTIF
        instance.save(update_fields=["actif", "statut", "updated_at"])

        output = LotSerializer(instance)
        return Response(output.data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["get"])
    def tantiemes(self, request, pk=None):
        instance = self.get_object()

        _require_read_copropriete(request.user, instance.copropriete_id)

        qs = (
            LotTantieme.objects.filter(lot=instance)
            .select_related("lot", "categorie", "lot__copropriete")
            .order_by("categorie__code", "id")
        )

        serializer = LotTantiemeListSerializer(qs, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["get"])
    def proprietaires(self, request, pk=None):
        """
        Historique des copropriétaires rattachés au lot.

        Import local pour éviter les imports circulaires lots <-> owners.
        """
        instance = self.get_object()

        _require_read_copropriete(request.user, instance.copropriete_id)

        from apps.owners.models import ProprietaireLot
        from apps.owners.serializers import ProprietaireLotListSerializer

        qs = (
            ProprietaireLot.objects.filter(lot=instance)
            .select_related("copropriete", "lot", "coproprietaire")
            .order_by("-date_debut", "-id")
        )

        serializer = ProprietaireLotListSerializer(qs, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=False, methods=["get"])
    def stats(self, request):
        """
        Statistiques rapides pour PlatformLots.tsx.
        """
        qs = self.get_queryset()

        copropriete_id = request.query_params.get("copropriete")
        if copropriete_id:
            _require_read_copropriete(request.user, copropriete_id)

        total = qs.count()
        actifs = qs.filter(actif=True).count()
        inactifs = qs.filter(actif=False).count()

        by_type = (
            qs.values("type_lot")
            .annotate(total=Count("id"))
            .order_by("type_lot")
        )

        by_statut = (
            qs.values("statut")
            .annotate(total=Count("id"))
            .order_by("statut")
        )

        surface_total = qs.aggregate(total=Sum("surface"))["total"] or Decimal("0.00")

        return Response(
            {
                "total": total,
                "actifs": actifs,
                "inactifs": inactifs,
                "surface_total": _decimal_to_string(surface_total),
                "par_type": list(by_type),
                "par_statut": list(by_statut),
            },
            status=status.HTTP_200_OK,
        )


class TantiemeCategorieViewSet(viewsets.ModelViewSet):
    """
    API des catégories de tantièmes.

    Routes prévues :
    - GET    /api/tantieme-categories/
    - POST   /api/tantieme-categories/
    - GET    /api/tantieme-categories/<id>/
    - PUT    /api/tantieme-categories/<id>/
    - PATCH  /api/tantieme-categories/<id>/
    - DELETE /api/tantieme-categories/<id>/       -> désactivation logique

    Actions :
    - POST /api/tantieme-categories/<id>/activer/
    - POST /api/tantieme-categories/<id>/desactiver/
    - GET  /api/tantieme-categories/<id>/lots/
    """

    permission_classes = [IsAuthenticated]

    filter_backends = [
        filters.SearchFilter,
        filters.OrderingFilter,
    ]

    search_fields = [
        "code",
        "libelle",
        "description",
        "copropriete__nom",
    ]

    ordering_fields = [
        "id",
        "code",
        "libelle",
        "actif",
        "created_at",
        "updated_at",
    ]

    ordering = ["code", "id"]

    def get_queryset(self):
        user = self.request.user

        qs = (
            TantiemeCategorie.objects.all()
            .select_related("copropriete")
            .prefetch_related("lots_tantiemes")
            .order_by("code", "id")
        )

        if not _is_platform_admin(user):
            allowed_copro_ids = CoproMembre.objects.filter(
                user=user,
                is_active=True,
            ).values_list("copropriete_id", flat=True)

            qs = qs.filter(copropriete_id__in=allowed_copro_ids)

        copropriete_id = self.request.query_params.get("copropriete")
        if copropriete_id:
            qs = qs.filter(copropriete_id=copropriete_id)

        actif = _parse_bool_param(self.request.query_params.get("actif"))
        if actif is not None:
            qs = qs.filter(actif=actif)

        q = self.request.query_params.get("q")
        if q:
            q = q.strip()
            qs = qs.filter(
                Q(code__icontains=q)
                | Q(libelle__icontains=q)
                | Q(description__icontains=q)
                | Q(copropriete__nom__icontains=q)
            )

        return qs

    def get_serializer_class(self):
        if self.action == "list":
            return TantiemeCategorieListSerializer

        return TantiemeCategorieSerializer

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()

        _require_read_copropriete(request.user, instance.copropriete_id)

        serializer = TantiemeCategorieSerializer(instance)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def create(self, request, *args, **kwargs):
        data = _inject_copropriete_from_scope(request)
        copropriete_id = data.get("copropriete")

        if not copropriete_id:
            raise ValidationError(
                {
                    "copropriete": (
                        "La copropriété est obligatoire. Envoyez copropriete "
                        "dans le payload ou le header X-Copropriete-Id."
                    )
                }
            )

        _require_manage_referentiel(request.user, copropriete_id)

        serializer = TantiemeCategorieSerializer(data=data)
        serializer.is_valid(raise_exception=True)

        try:
            instance = serializer.save()
        except IntegrityError:
            raise ValidationError(
                {
                    "code": (
                        "Une catégorie de tantième avec ce code existe déjà "
                        "dans cette copropriété."
                    )
                }
            )

        output = TantiemeCategorieSerializer(instance)
        return Response(output.data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        instance = self.get_object()

        _require_manage_referentiel(request.user, instance.copropriete_id)

        data = _inject_copropriete_from_scope(request)

        serializer = TantiemeCategorieSerializer(
            instance,
            data=data,
            partial=partial,
        )
        serializer.is_valid(raise_exception=True)

        target_copropriete = serializer.validated_data.get(
            "copropriete",
            instance.copropriete,
        )

        _require_manage_referentiel(request.user, target_copropriete.id)

        try:
            instance = serializer.save()
        except IntegrityError:
            raise ValidationError(
                {
                    "code": (
                        "Une catégorie de tantième avec ce code existe déjà "
                        "dans cette copropriété."
                    )
                }
            )

        output = TantiemeCategorieSerializer(instance)
        return Response(output.data, status=status.HTTP_200_OK)

    def destroy(self, request, *args, **kwargs):
        """
        Pas de suppression physique depuis React.

        Une catégorie peut déjà être utilisée dans des appels de fonds,
        tantièmes, calculs ou historiques. On la désactive donc logiquement.
        """
        instance = self.get_object()

        _require_manage_referentiel(request.user, instance.copropriete_id)

        instance.actif = False
        instance.save(update_fields=["actif", "updated_at"])

        output = TantiemeCategorieSerializer(instance)
        return Response(output.data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"])
    def activer(self, request, pk=None):
        instance = self.get_object()

        _require_manage_referentiel(request.user, instance.copropriete_id)

        instance.actif = True
        instance.save(update_fields=["actif", "updated_at"])

        output = TantiemeCategorieSerializer(instance)
        return Response(output.data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"])
    def desactiver(self, request, pk=None):
        instance = self.get_object()

        _require_manage_referentiel(request.user, instance.copropriete_id)

        instance.actif = False
        instance.save(update_fields=["actif", "updated_at"])

        output = TantiemeCategorieSerializer(instance)
        return Response(output.data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["get"])
    def lots(self, request, pk=None):
        instance = self.get_object()

        _require_read_copropriete(request.user, instance.copropriete_id)

        qs = (
            LotTantieme.objects.filter(categorie=instance)
            .select_related("lot", "categorie", "lot__copropriete")
            .order_by("lot__reference", "id")
        )

        serializer = LotTantiemeListSerializer(qs, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


class LotTantiemeViewSet(viewsets.ModelViewSet):
    """
    API des tantièmes par lot.

    Routes prévues :
    - GET    /api/lot-tantiemes/
    - POST   /api/lot-tantiemes/
    - GET    /api/lot-tantiemes/<id>/
    - PUT    /api/lot-tantiemes/<id>/
    - PATCH  /api/lot-tantiemes/<id>/
    - DELETE /api/lot-tantiemes/<id>/       -> suppression contrôlée

    Actions :
    - GET /api/lot-tantiemes/stats/
    """

    permission_classes = [IsAuthenticated]

    filter_backends = [
        filters.SearchFilter,
        filters.OrderingFilter,
    ]

    search_fields = [
        "lot__reference",
        "lot__numero",
        "lot__batiment",
        "lot__porte",
        "categorie__code",
        "categorie__libelle",
        "lot__copropriete__nom",
    ]

    ordering_fields = [
        "id",
        "valeur",
        "created_at",
        "updated_at",
        "lot__reference",
        "categorie__code",
    ]

    ordering = ["lot__reference", "categorie__code", "id"]

    def get_queryset(self):
        user = self.request.user

        qs = (
            LotTantieme.objects.all()
            .select_related("lot", "categorie", "lot__copropriete")
            .order_by("lot__reference", "categorie__code", "id")
        )

        if not _is_platform_admin(user):
            allowed_copro_ids = CoproMembre.objects.filter(
                user=user,
                is_active=True,
            ).values_list("copropriete_id", flat=True)

            qs = qs.filter(lot__copropriete_id__in=allowed_copro_ids)

        copropriete_id = self.request.query_params.get("copropriete")
        if copropriete_id:
            qs = qs.filter(lot__copropriete_id=copropriete_id)

        lot_id = self.request.query_params.get("lot")
        if lot_id:
            qs = qs.filter(lot_id=lot_id)

        categorie_id = self.request.query_params.get("categorie")
        if categorie_id:
            qs = qs.filter(categorie_id=categorie_id)

        q = self.request.query_params.get("q")
        if q:
            q = q.strip()
            qs = qs.filter(
                Q(lot__reference__icontains=q)
                | Q(lot__numero__icontains=q)
                | Q(lot__batiment__icontains=q)
                | Q(lot__porte__icontains=q)
                | Q(categorie__code__icontains=q)
                | Q(categorie__libelle__icontains=q)
                | Q(lot__copropriete__nom__icontains=q)
            )

        return qs

    def get_serializer_class(self):
        if self.action == "list":
            return LotTantiemeListSerializer

        return LotTantiemeSerializer

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()

        _require_read_copropriete(request.user, instance.lot.copropriete_id)

        serializer = LotTantiemeSerializer(instance)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def create(self, request, *args, **kwargs):
        serializer = LotTantiemeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        lot = serializer.validated_data["lot"]
        categorie = serializer.validated_data["categorie"]

        if lot.copropriete_id != categorie.copropriete_id:
            raise ValidationError(
                {
                    "categorie": (
                        "La catégorie de tantième doit appartenir à la même "
                        "copropriété que le lot."
                    )
                }
            )

        _require_manage_referentiel(request.user, lot.copropriete_id)

        try:
            instance = serializer.save()
        except IntegrityError:
            raise ValidationError(
                {
                    "categorie": (
                        "Une valeur de tantième existe déjà pour ce lot "
                        "et cette catégorie."
                    )
                }
            )

        output = LotTantiemeSerializer(instance)
        return Response(output.data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        instance = self.get_object()

        _require_manage_referentiel(request.user, instance.lot.copropriete_id)

        serializer = LotTantiemeSerializer(
            instance,
            data=request.data,
            partial=partial,
        )
        serializer.is_valid(raise_exception=True)

        lot = serializer.validated_data.get("lot", instance.lot)
        categorie = serializer.validated_data.get("categorie", instance.categorie)

        if lot.copropriete_id != categorie.copropriete_id:
            raise ValidationError(
                {
                    "categorie": (
                        "La catégorie de tantième doit appartenir à la même "
                        "copropriété que le lot."
                    )
                }
            )

        _require_manage_referentiel(request.user, lot.copropriete_id)

        try:
            instance = serializer.save()
        except IntegrityError:
            raise ValidationError(
                {
                    "categorie": (
                        "Une valeur de tantième existe déjà pour ce lot "
                        "et cette catégorie."
                    )
                }
            )

        output = LotTantiemeSerializer(instance)
        return Response(output.data, status=status.HTTP_200_OK)

    def destroy(self, request, *args, **kwargs):
        """
        Suppression contrôlée d'une valeur de tantième.

        Ici on autorise la suppression, car LotTantieme représente une valeur
        de référentiel corrigeable. Si plus tard des appels de fonds validés
        dépendent de cette valeur, on pourra remplacer cette suppression par
        une logique d'archivage/versioning.
        """
        instance = self.get_object()

        _require_manage_referentiel(request.user, instance.lot.copropriete_id)

        instance.delete()

        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=False, methods=["get"])
    def stats(self, request):
        """
        Statistiques rapides pour PlatformTantiemes.tsx.
        """
        qs = self.get_queryset()

        copropriete_id = request.query_params.get("copropriete")
        if copropriete_id:
            _require_read_copropriete(request.user, copropriete_id)

        total_lignes = qs.count()
        total_valeur = qs.aggregate(total=Sum("valeur"))["total"] or Decimal("0.0000")

        par_categorie = (
            qs.values(
                "categorie_id",
                "categorie__code",
                "categorie__libelle",
            )
            .annotate(
                total_lots=Count("lot_id"),
                total_valeur=Sum("valeur"),
            )
            .order_by("categorie__code")
        )

        return Response(
            {
                "total_lignes": total_lignes,
                "total_valeur": _decimal_to_string(total_valeur),
                "par_categorie": [
                    {
                        "categorie_id": row["categorie_id"],
                        "code": row["categorie__code"],
                        "libelle": row["categorie__libelle"],
                        "total_lots": row["total_lots"],
                        "total_valeur": _decimal_to_string(row["total_valeur"]),
                    }
                    for row in par_categorie
                ],
            },
            status=status.HTTP_200_OK,
        )