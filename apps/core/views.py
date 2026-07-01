# apps/core/views.py
from __future__ import annotations

from django.db import transaction
from django.db.models import Q
from rest_framework import filters, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import CoproMembre, Copropriete
from .serializers import (
    CoproMembreCreateUpdateSerializer,
    CoproMembreSerializer,
    CoproprieteListSerializer,
    CoproprieteSerializer,
    MesCoproprietesSerializer,
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

    Pour cette première version professionnelle :
    - is_superuser=True
    - ou is_staff=True

    Plus tard, on pourra remplacer/compléter cela par un vrai rôle SaaS :
    PLATFORM_OWNER, SUPPORT, ADMIN_PLATEFORME, etc.
    """
    return bool(
        user
        and user.is_authenticated
        and (
            getattr(user, "is_superuser", False)
            or getattr(user, "is_staff", False)
        )
    )


def _require_platform_admin(user):
    if not _is_platform_admin(user):
        raise PermissionDenied(
            "Action réservée au Super Admin de la plateforme."
        )


def _get_active_membership(user, copropriete):
    if not user or not user.is_authenticated:
        return None

    return (
        CoproMembre.objects.filter(
            user=user,
            copropriete=copropriete,
            is_active=True,
        )
        .select_related("copropriete", "user")
        .first()
    )


def _can_manage_copropriete(user, copropriete) -> bool:
    """
    Droit de gestion générale d'une copropriété.

    Super Admin plateforme : accès complet.
    Admin/Syndic local : accès sur sa copropriété.
    """
    if _is_platform_admin(user):
        return True

    membership = _get_active_membership(user, copropriete)

    if not membership:
        return False

    return membership.can_manage_copropriete


def _can_manage_users(user, copropriete) -> bool:
    """
    Droit de gestion des membres/rôles d'une copropriété.
    """
    if _is_platform_admin(user):
        return True

    membership = _get_active_membership(user, copropriete)

    if not membership:
        return False

    return membership.can_manage_users


def _require_manage_copropriete(user, copropriete):
    if not _can_manage_copropriete(user, copropriete):
        raise PermissionDenied(
            "Vous n'avez pas le droit de gérer cette copropriété."
        )


def _require_manage_users(user, copropriete):
    if not _can_manage_users(user, copropriete):
        raise PermissionDenied(
            "Vous n'avez pas le droit de gérer les utilisateurs de cette copropriété."
        )


class MesCoproprietesAPIView(APIView):
    """
    Copropriétés accessibles à l'utilisateur connecté.

    Utilisé par le frontend pour :
    - remplir le sélecteur de copropriété active ;
    - savoir quels droits l'utilisateur possède ;
    - définir le X-Copropriete-Id côté axios.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = (
            CoproMembre.objects.filter(
                user=request.user,
                is_active=True,
                copropriete__is_active=True,
            )
            .select_related("copropriete", "user")
            .order_by("copropriete__nom", "id")
        )

        serializer = MesCoproprietesSerializer(qs, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


class CoproprieteViewSet(viewsets.ModelViewSet):
    """
    API principale des copropriétés.

    Routes prévues :
    - GET    /api/core/coproprietes/
    - POST   /api/core/coproprietes/
    - GET    /api/core/coproprietes/<id>/
    - PUT    /api/core/coproprietes/<id>/
    - PATCH  /api/core/coproprietes/<id>/
    - DELETE /api/core/coproprietes/<id>/   -> archivage logique

    Actions :
    - POST /api/core/coproprietes/<id>/suspendre/
    - POST /api/core/coproprietes/<id>/reactiver/
    - POST /api/core/coproprietes/<id>/archiver/
    - GET  /api/core/coproprietes/<id>/membres/
    """

    permission_classes = [IsAuthenticated]
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    filter_backends = [
        filters.SearchFilter,
        filters.OrderingFilter,
    ]

    search_fields = [
        "nom",
        "slug",
        "ville",
        "pays",
        "adresse",
        "email_contact",
        "telephone",
    ]

    ordering_fields = [
        "id",
        "nom",
        "ville",
        "pays",
        "statut",
        "is_active",
        "created_at",
        "updated_at",
    ]

    ordering = ["nom", "id"]

    def get_queryset(self):
        user = self.request.user

        qs = (
            Copropriete.objects.all()
            .prefetch_related("membres")
            .order_by("nom", "id")
        )

        if not _is_platform_admin(user):
            qs = qs.filter(
                membres__user=user,
                membres__is_active=True,
            ).distinct()

        statut = self.request.query_params.get("statut")
        if statut:
            qs = qs.filter(statut=statut)

        is_active = _parse_bool_param(self.request.query_params.get("is_active"))
        if is_active is not None:
            qs = qs.filter(is_active=is_active)

        ville = self.request.query_params.get("ville")
        if ville:
            qs = qs.filter(ville__icontains=ville.strip())

        pays = self.request.query_params.get("pays")
        if pays:
            qs = qs.filter(pays__icontains=pays.strip())

        q = self.request.query_params.get("q")
        if q:
            q = q.strip()
            qs = qs.filter(
                Q(nom__icontains=q)
                | Q(slug__icontains=q)
                | Q(ville__icontains=q)
                | Q(pays__icontains=q)
                | Q(adresse__icontains=q)
                | Q(email_contact__icontains=q)
                | Q(telephone__icontains=q)
            )

        return qs

    def get_serializer_class(self):
        if self.action == "list":
            return CoproprieteListSerializer

        return CoproprieteSerializer

    def perform_create(self, serializer):
        _require_platform_admin(self.request.user)

        with transaction.atomic():
            copropriete = serializer.save()

            CoproMembre.objects.update_or_create(
                copropriete=copropriete,
                user=self.request.user,
                defaults={
                    "role": CoproMembre.Role.ADMIN,
                    "is_active": True,
                },
            )

        return copropriete

    def perform_update(self, serializer):
        copropriete = self.get_object()
        _require_manage_copropriete(self.request.user, copropriete)
        serializer.save()

    def destroy(self, request, *args, **kwargs):
        """
        Pas de suppression physique depuis React.

        Pour un SaaS sérieux, on archive logiquement afin de conserver :
        - historique comptable ;
        - lots ;
        - copropriétaires ;
        - AG ;
        - relances ;
        - audit futur.
        """
        copropriete = self.get_object()
        _require_platform_admin(request.user)

        copropriete.statut = Copropriete.Statut.ARCHIVEE
        copropriete.is_active = False
        copropriete.save(update_fields=["statut", "is_active", "updated_at"])

        serializer = CoproprieteSerializer(copropriete)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"])
    def suspendre(self, request, pk=None):
        copropriete = self.get_object()
        _require_platform_admin(request.user)

        copropriete.statut = Copropriete.Statut.SUSPENDUE
        copropriete.is_active = False
        copropriete.save(update_fields=["statut", "is_active", "updated_at"])

        serializer = CoproprieteSerializer(copropriete)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"])
    def reactiver(self, request, pk=None):
        copropriete = self.get_object()
        _require_platform_admin(request.user)

        copropriete.statut = Copropriete.Statut.ACTIVE
        copropriete.is_active = True
        copropriete.save(update_fields=["statut", "is_active", "updated_at"])

        serializer = CoproprieteSerializer(copropriete)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"])
    def archiver(self, request, pk=None):
        copropriete = self.get_object()
        _require_platform_admin(request.user)

        copropriete.statut = Copropriete.Statut.ARCHIVEE
        copropriete.is_active = False
        copropriete.save(update_fields=["statut", "is_active", "updated_at"])

        serializer = CoproprieteSerializer(copropriete)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["get"])
    def membres(self, request, pk=None):
        copropriete = self.get_object()
        _require_manage_users(request.user, copropriete)

        qs = (
            CoproMembre.objects.filter(copropriete=copropriete)
            .select_related("user", "copropriete")
            .order_by("-is_active", "role", "user__username", "id")
        )

        serializer = CoproMembreSerializer(qs, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


class CoproMembreViewSet(viewsets.ModelViewSet):
    """
    API de gestion des utilisateurs/rôles par copropriété.

    Routes prévues :
    - GET    /api/core/membres/
    - POST   /api/core/membres/
    - GET    /api/core/membres/<id>/
    - PUT    /api/core/membres/<id>/
    - PATCH  /api/core/membres/<id>/
    - DELETE /api/core/membres/<id>/       -> désactivation logique

    Actions :
    - POST /api/core/membres/<id>/activer/
    - POST /api/core/membres/<id>/desactiver/
    """

    permission_classes = [IsAuthenticated]

    filter_backends = [
        filters.SearchFilter,
        filters.OrderingFilter,
    ]

    search_fields = [
        "user__username",
        "user__email",
        "user__first_name",
        "user__last_name",
        "copropriete__nom",
        "copropriete__ville",
        "role",
    ]

    ordering_fields = [
        "id",
        "role",
        "is_active",
        "created_at",
        "updated_at",
        "copropriete__nom",
        "user__username",
        "user__email",
    ]

    ordering = ["-id"]

    def get_queryset(self):
        user = self.request.user

        qs = (
            CoproMembre.objects.all()
            .select_related("user", "copropriete")
            .order_by("-id")
        )

        if not _is_platform_admin(user):
            manageable_copro_ids = CoproMembre.objects.filter(
                user=user,
                is_active=True,
                role__in=[
                    CoproMembre.Role.ADMIN,
                    CoproMembre.Role.SYNDIC,
                ],
            ).values_list("copropriete_id", flat=True)

            qs = qs.filter(copropriete_id__in=manageable_copro_ids)

        copropriete_id = self.request.query_params.get("copropriete")
        if copropriete_id:
            qs = qs.filter(copropriete_id=copropriete_id)

        role = self.request.query_params.get("role")
        if role:
            qs = qs.filter(role=role)

        is_active = _parse_bool_param(self.request.query_params.get("is_active"))
        if is_active is not None:
            qs = qs.filter(is_active=is_active)

        q = self.request.query_params.get("q")
        if q:
            q = q.strip()
            qs = qs.filter(
                Q(user__username__icontains=q)
                | Q(user__email__icontains=q)
                | Q(user__first_name__icontains=q)
                | Q(user__last_name__icontains=q)
                | Q(copropriete__nom__icontains=q)
                | Q(copropriete__ville__icontains=q)
                | Q(role__icontains=q)
            )

        return qs

    def get_serializer_class(self):
        if self.action in {"create", "update", "partial_update"}:
            return CoproMembreCreateUpdateSerializer

        return CoproMembreSerializer

    def create(self, request, *args, **kwargs):
        serializer = CoproMembreCreateUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        copropriete = serializer.validated_data["copropriete"]
        _require_manage_users(request.user, copropriete)

        membre = serializer.save()

        output = CoproMembreSerializer(membre)
        return Response(output.data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        membre = self.get_object()

        _require_manage_users(request.user, membre.copropriete)

        serializer = CoproMembreCreateUpdateSerializer(
            membre,
            data=request.data,
            partial=partial,
        )
        serializer.is_valid(raise_exception=True)

        copropriete = serializer.validated_data.get(
            "copropriete",
            membre.copropriete,
        )
        _require_manage_users(request.user, copropriete)

        membre = serializer.save()

        output = CoproMembreSerializer(membre)
        return Response(output.data, status=status.HTTP_200_OK)

    def destroy(self, request, *args, **kwargs):
        """
        Pas de suppression physique d'un membre.

        On désactive le rattachement pour garder une trace historique.
        """
        membre = self.get_object()
        _require_manage_users(request.user, membre.copropriete)

        membre.is_active = False
        membre.save(update_fields=["is_active", "updated_at"])

        output = CoproMembreSerializer(membre)
        return Response(output.data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"])
    def activer(self, request, pk=None):
        membre = self.get_object()
        _require_manage_users(request.user, membre.copropriete)

        membre.is_active = True
        membre.save(update_fields=["is_active", "updated_at"])

        output = CoproMembreSerializer(membre)
        return Response(output.data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"])
    def desactiver(self, request, pk=None):
        membre = self.get_object()
        _require_manage_users(request.user, membre.copropriete)

        membre.is_active = False
        membre.save(update_fields=["is_active", "updated_at"])

        output = CoproMembreSerializer(membre)
        return Response(output.data, status=status.HTTP_200_OK)