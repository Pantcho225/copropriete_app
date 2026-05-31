# apps/owners/views.py
from __future__ import annotations

import secrets
import string

from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from django.utils.text import slugify
from rest_framework import filters, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.models import CoproMembre, UserSecurityProfile

from .models import Coproprietaire, ProprietaireLot
from .serializers import (
    CoproprietaireListSerializer,
    CoproprietaireSerializer,
    ProprietaireLotListSerializer,
    ProprietaireLotSerializer,
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
    - is_superuser=True ;
    - ou is_staff=True.

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


def _referentiel_admin_roles():
    """
    Rôles autorisés à gérer le référentiel copropriété depuis l'Admin React.

    Important :
    - COPROPRIETAIRE n'est volontairement pas inclus ici ;
    - l'espace copropriétaire devra être séparé du back-office Admin React.
    """
    roles = {
        CoproMembre.Role.ADMIN,
        CoproMembre.Role.SYNDIC,
    }

    if hasattr(CoproMembre.Role, "GESTIONNAIRE"):
        roles.add(CoproMembre.Role.GESTIONNAIRE)

    return roles


def _get_requested_copropriete_id(request):
    """
    Récupère la copropriété ciblée depuis :
    - query param ?copropriete=<id>
    - header X-Copropriete-Id
    - body copropriete
    """
    return (
        request.query_params.get("copropriete")
        or request.headers.get("X-Copropriete-Id")
        or request.data.get("copropriete")
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
    """
    Lecture du référentiel owners.

    On bloque ici les simples copropriétaires pour éviter qu'ils accèdent
    au back-office Admin React. Ils auront plus tard des endpoints dédiés
    à leur espace personnel.
    """
    if _is_platform_admin(user):
        return True

    membership = _get_active_membership(user, copropriete_id)

    if not membership:
        return False

    return membership.role in _referentiel_admin_roles()


def _can_manage_referentiel(user, copropriete_id) -> bool:
    """
    Gestion du référentiel :
    - Super Admin plateforme ;
    - Admin local ;
    - Syndic ;
    - Gestionnaire.
    """
    if _is_platform_admin(user):
        return True

    membership = _get_active_membership(user, copropriete_id)

    if not membership:
        return False

    return membership.role in _referentiel_admin_roles()


def _require_read_copropriete(user, copropriete_id):
    if not _can_read_copropriete(user, copropriete_id):
        raise PermissionDenied("Vous n'avez pas accès à cette copropriété.")


def _require_manage_referentiel(user, copropriete_id):
    if not _can_manage_referentiel(user, copropriete_id):
        raise PermissionDenied(
            "Vous n'avez pas le droit de gérer le référentiel de cette copropriété."
        )


def _inject_copropriete_from_scope(request):
    """
    Prépare les données d'écriture.

    Si le frontend n'envoie pas copropriete dans le body mais envoie
    X-Copropriete-Id, on injecte automatiquement la copropriété dans le payload.
    """
    data = request.data.copy()

    if not data.get("copropriete"):
        copropriete_id = request.headers.get("X-Copropriete-Id")
        if copropriete_id:
            data["copropriete"] = copropriete_id

    return data


def _generate_temporary_password(length: int = 12) -> str:
    """
    Génère un mot de passe temporaire lisible mais suffisamment robuste
    pour un premier accès.

    Le mot de passe est retourné une seule fois par l'endpoint.
    """
    alphabet = string.ascii_letters + string.digits
    random_part = "".join(secrets.choice(alphabet) for _ in range(max(length - 3, 8)))
    return f"Cp{random_part}!"


def _build_username_from_owner(owner: Coproprietaire) -> str:
    """
    Construit un username unique depuis l'email ou le nom du copropriétaire.
    """
    UserModel = get_user_model()

    if owner.email:
        base = owner.email.split("@")[0]
    else:
        base = owner.display_name or f"coproprietaire-{owner.id}"

    base = slugify(base).replace("-", "_") or f"coproprietaire_{owner.id}"
    base = base[:140]

    username = base
    counter = 2

    while UserModel.objects.filter(username=username).exists():
        suffix = f"_{counter}"
        username = f"{base[: 150 - len(suffix)]}{suffix}"
        counter += 1

    return username


class CoproprietaireMesLotsAPIView(APIView):
    """
    Espace copropriétaire — lots du copropriétaire connecté.

    Important :
    - cet endpoint est séparé du back-office référentiel ;
    - il retourne uniquement les lots liés au compte utilisateur connecté ;
    - la quote-part vient de ProprietaireLot.quote_part, pas du modèle Lot.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        coproprietaire = (
            Coproprietaire.objects.filter(
                user_account=request.user,
                actif=True,
            )
            .select_related("copropriete", "user_account")
            .order_by("id")
            .first()
        )

        if not coproprietaire:
            return Response(
                {
                    "count": 0,
                    "coproprietaire": None,
                    "lots": [],
                },
                status=status.HTTP_200_OK,
            )

        liens = (
            ProprietaireLot.objects.filter(
                coproprietaire=coproprietaire,
                copropriete=coproprietaire.copropriete,
                date_fin__isnull=True,
            )
            .select_related("copropriete", "lot", "coproprietaire")
            .order_by("-principal", "lot__reference", "lot__numero", "id")
        )

        lots = []

        for lien in liens:
            lot = lien.lot

            reference = (
                getattr(lot, "reference", None)
                or getattr(lot, "numero", None)
                or f"Lot #{lot.id}"
            )

            numero = getattr(lot, "numero", None) or reference
            type_lot = getattr(lot, "type_lot", "") or ""
            etage = getattr(lot, "etage", "") or ""
            surface = getattr(lot, "surface", None)
            description = getattr(lot, "description", "") or ""

            lots.append(
                {
                    "id": lien.id,
                    "lot_id": lot.id,
                    "label": reference,
                    "numero": numero,
                    "reference": reference,
                    "type_lot": type_lot,
                    "etage": etage,
                    "surface": str(surface) if surface is not None else None,
                    "description": description,
                    "type_droit": (
                        "Propriétaire principal"
                        if lien.principal
                        else "Copropriétaire"
                    ),
                    "quote_part": str(lien.quote_part or "0.00"),
                    "copropriete": {
                        "id": coproprietaire.copropriete_id,
                        "nom": coproprietaire.copropriete.nom,
                    },
                }
            )

        return Response(
            {
                "count": len(lots),
                "coproprietaire": {
                    "id": coproprietaire.id,
                    "nom": coproprietaire.nom,
                    "prenoms": coproprietaire.prenom,
                    "email": coproprietaire.email,
                },
                "lots": lots,
            },
            status=status.HTTP_200_OK,
        )


class CoproprietaireViewSet(viewsets.ModelViewSet):
    """
    API des copropriétaires.

    Routes prévues :
    - GET    /api/owners/coproprietaires/
    - POST   /api/owners/coproprietaires/
    - GET    /api/owners/coproprietaires/<id>/
    - PUT    /api/owners/coproprietaires/<id>/
    - PATCH  /api/owners/coproprietaires/<id>/
    - DELETE /api/owners/coproprietaires/<id>/    -> désactivation logique

    Actions :
    - POST /api/owners/coproprietaires/<id>/activer/
    - POST /api/owners/coproprietaires/<id>/desactiver/
    - GET  /api/owners/coproprietaires/<id>/lots/
    - POST /api/owners/coproprietaires/<id>/create-user-access/
    """

    permission_classes = [IsAuthenticated]

    filter_backends = [
        filters.SearchFilter,
        filters.OrderingFilter,
    ]

    search_fields = [
        "nom",
        "prenom",
        "raison_sociale",
        "email",
        "telephone",
        "ville",
        "pays",
        "copropriete__nom",
    ]

    ordering_fields = [
        "id",
        "nom",
        "prenom",
        "raison_sociale",
        "email",
        "telephone",
        "ville",
        "pays",
        "actif",
        "created_at",
        "updated_at",
        "date_creation",
    ]

    ordering = ["nom", "prenom", "id"]

    def get_queryset(self):
        user = self.request.user

        qs = (
            Coproprietaire.objects.all()
            .select_related("copropriete", "user_account")
            .prefetch_related("lots_possedes")
            .order_by("nom", "prenom", "id")
        )

        if not _is_platform_admin(user):
            allowed_copro_ids = CoproMembre.objects.filter(
                user=user,
                is_active=True,
                role__in=_referentiel_admin_roles(),
            ).values_list("copropriete_id", flat=True)

            qs = qs.filter(copropriete_id__in=allowed_copro_ids)

        copropriete_id = self.request.query_params.get("copropriete")
        if copropriete_id:
            qs = qs.filter(copropriete_id=copropriete_id)

        actif = _parse_bool_param(self.request.query_params.get("actif"))
        if actif is not None:
            qs = qs.filter(actif=actif)

        type_personne = self.request.query_params.get("type_personne")
        if type_personne:
            qs = qs.filter(type_personne=type_personne)

        ville = self.request.query_params.get("ville")
        if ville:
            qs = qs.filter(ville__icontains=ville.strip())

        q = self.request.query_params.get("q")
        if q:
            q = q.strip()
            qs = qs.filter(
                Q(nom__icontains=q)
                | Q(prenom__icontains=q)
                | Q(raison_sociale__icontains=q)
                | Q(email__icontains=q)
                | Q(telephone__icontains=q)
                | Q(ville__icontains=q)
                | Q(pays__icontains=q)
                | Q(copropriete__nom__icontains=q)
            )

        return qs

    def get_serializer_class(self):
        if self.action == "list":
            return CoproprietaireListSerializer

        return CoproprietaireSerializer

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        _require_read_copropriete(request.user, instance.copropriete_id)

        serializer = CoproprietaireSerializer(instance)
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

        serializer = CoproprietaireSerializer(data=data)
        serializer.is_valid(raise_exception=True)
        instance = serializer.save()

        output = CoproprietaireSerializer(instance)
        return Response(output.data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        instance = self.get_object()

        _require_manage_referentiel(request.user, instance.copropriete_id)

        data = _inject_copropriete_from_scope(request)

        serializer = CoproprietaireSerializer(
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

        instance = serializer.save()

        output = CoproprietaireSerializer(instance)
        return Response(output.data, status=status.HTTP_200_OK)

    def destroy(self, request, *args, **kwargs):
        """
        Pas de suppression physique depuis React.

        On désactive le copropriétaire afin de conserver :
        - l'historique des lots ;
        - les paiements ;
        - les appels ;
        - les relances ;
        - les présences AG.
        """
        instance = self.get_object()

        _require_manage_referentiel(request.user, instance.copropriete_id)

        instance.actif = False
        instance.save(update_fields=["actif", "updated_at"])

        output = CoproprietaireSerializer(instance)
        return Response(output.data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"])
    def activer(self, request, pk=None):
        instance = self.get_object()

        _require_manage_referentiel(request.user, instance.copropriete_id)

        instance.actif = True
        instance.save(update_fields=["actif", "updated_at"])

        output = CoproprietaireSerializer(instance)
        return Response(output.data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"])
    def desactiver(self, request, pk=None):
        instance = self.get_object()

        _require_manage_referentiel(request.user, instance.copropriete_id)

        instance.actif = False
        instance.save(update_fields=["actif", "updated_at"])

        output = CoproprietaireSerializer(instance)
        return Response(output.data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["get"])
    def lots(self, request, pk=None):
        """
        Historique des lots rattachés à ce copropriétaire.
        """
        instance = self.get_object()

        _require_read_copropriete(request.user, instance.copropriete_id)

        qs = (
            ProprietaireLot.objects.filter(coproprietaire=instance)
            .select_related("copropriete", "lot", "coproprietaire")
            .order_by("-date_debut", "-id")
        )

        serializer = ProprietaireLotListSerializer(qs, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(
        detail=True,
        methods=["post"],
        url_path="create-user-access",
    )
    @transaction.atomic
    def create_user_access(self, request, pk=None):
        """
        Crée ou réactive l'accès utilisateur d'un copropriétaire.

        Objectif métier :
        - créer un compte utilisateur depuis la fiche copropriétaire ;
        - rattacher ce compte à la copropriété ;
        - donner le rôle local COPROPRIETAIRE ;
        - générer un mot de passe temporaire ;
        - forcer le changement du mot de passe à la prochaine connexion.
        """
        instance = self.get_object()

        _require_manage_referentiel(request.user, instance.copropriete_id)

        if not instance.actif:
            raise ValidationError(
                {
                    "coproprietaire": (
                        "Impossible de créer un accès pour un copropriétaire inactif."
                    )
                }
            )

        email = (instance.email or "").strip().lower()

        if not email:
            raise ValidationError(
                {
                    "email": (
                        "Le copropriétaire doit avoir une adresse email avant "
                        "la création de son accès utilisateur."
                    )
                }
            )

        UserModel = get_user_model()

        existing_user = UserModel.objects.filter(email__iexact=email).first()

        created_user = False
        reused_user = False

        if existing_user:
            if (
                getattr(existing_user, "is_staff", False)
                or getattr(existing_user, "is_superuser", False)
            ) and instance.user_account_id != existing_user.id:
                raise ValidationError(
                    {
                        "email": (
                            "Cette adresse email appartient déjà à un compte "
                            "d'administration. Utilisez une autre adresse."
                        )
                    }
                )

            existing_membership = CoproMembre.objects.filter(
                copropriete=instance.copropriete,
                user=existing_user,
                is_active=True,
            ).first()

            if (
                existing_membership
                and existing_membership.role != CoproMembre.Role.COPROPRIETAIRE
            ):
                raise ValidationError(
                    {
                        "user": (
                            "Cet utilisateur possède déjà un rôle administratif "
                            "dans cette copropriété. Il ne sera pas converti en "
                            "simple copropriétaire."
                        )
                    }
                )

            user = existing_user
            reused_user = True

        else:
            username = _build_username_from_owner(instance)

            user = UserModel(
                username=username,
                email=email,
                first_name=(instance.prenom or "")[:150],
                last_name=(instance.nom or instance.raison_sociale or "")[:150],
                is_active=True,
            )
            created_user = True

        temporary_password = _generate_temporary_password()

        user.email = email

        if hasattr(user, "first_name"):
            user.first_name = (instance.prenom or "")[:150]

        if hasattr(user, "last_name"):
            user.last_name = (instance.nom or instance.raison_sociale or "")[:150]

        user.is_active = True
        user.set_password(temporary_password)
        user.save()

        if instance.user_account_id != user.id:
            instance.user_account = user
            instance.save(update_fields=["user_account", "updated_at"])

        membership, membership_created = CoproMembre.objects.get_or_create(
            copropriete=instance.copropriete,
            user=user,
            defaults={
                "role": CoproMembre.Role.COPROPRIETAIRE,
                "is_active": True,
            },
        )

        membership_changed = False

        if membership.role != CoproMembre.Role.COPROPRIETAIRE:
            membership.role = CoproMembre.Role.COPROPRIETAIRE
            membership_changed = True

        if not membership.is_active:
            membership.is_active = True
            membership_changed = True

        if membership_changed:
            membership.save(update_fields=["role", "is_active", "updated_at"])

        security_profile, _ = UserSecurityProfile.objects.get_or_create(user=user)
        security_profile.must_change_password = True
        security_profile.temporary_password_created_at = timezone.now()
        security_profile.save(
            update_fields=[
                "must_change_password",
                "temporary_password_created_at",
                "updated_at",
            ]
        )

        output = CoproprietaireSerializer(instance)

        return Response(
            {
                "message": "Accès utilisateur copropriétaire créé avec succès.",
                "created_user": created_user,
                "reused_user": reused_user,
                "membership_created": membership_created,
                "coproprietaire": output.data,
                "user": {
                    "id": user.id,
                    "username": getattr(user, "username", ""),
                    "email": getattr(user, "email", ""),
                    "is_active": user.is_active,
                },
                "membership": {
                    "id": membership.id,
                    "copropriete": membership.copropriete_id,
                    "role": membership.role,
                    "is_active": membership.is_active,
                },
                "must_change_password": True,
                "temporary_password": temporary_password,
                "warning": (
                    "Ce mot de passe temporaire est retourné une seule fois. "
                    "Copiez-le avant de fermer cette réponse."
                ),
            },
            status=status.HTTP_201_CREATED if created_user else status.HTTP_200_OK,
        )


class ProprietaireLotViewSet(viewsets.ModelViewSet):
    """
    API d'affectation des lots aux copropriétaires.

    Routes prévues :
    - GET    /api/owners/proprietaires-lots/
    - POST   /api/owners/proprietaires-lots/
    - GET    /api/owners/proprietaires-lots/<id>/
    - PUT    /api/owners/proprietaires-lots/<id>/
    - PATCH  /api/owners/proprietaires-lots/<id>/
    - DELETE /api/owners/proprietaires-lots/<id>/    -> clôture logique

    Actions :
    - POST /api/owners/proprietaires-lots/<id>/cloturer/
    - POST /api/owners/proprietaires-lots/<id>/rouvrir/
    """

    permission_classes = [IsAuthenticated]

    filter_backends = [
        filters.SearchFilter,
        filters.OrderingFilter,
    ]

    search_fields = [
        "coproprietaire__nom",
        "coproprietaire__prenom",
        "coproprietaire__raison_sociale",
        "coproprietaire__email",
        "lot__reference",
        "lot__numero",
        "lot__batiment",
        "lot__porte",
        "copropriete__nom",
    ]

    ordering_fields = [
        "id",
        "date_debut",
        "date_fin",
        "principal",
        "quote_part",
        "created_at",
        "updated_at",
    ]

    ordering = ["-date_debut", "-id"]

    def get_queryset(self):
        user = self.request.user

        qs = (
            ProprietaireLot.objects.all()
            .select_related(
                "copropriete",
                "lot",
                "coproprietaire",
                "coproprietaire__user_account",
            )
            .order_by("-date_debut", "-id")
        )

        if not _is_platform_admin(user):
            allowed_copro_ids = CoproMembre.objects.filter(
                user=user,
                is_active=True,
                role__in=_referentiel_admin_roles(),
            ).values_list("copropriete_id", flat=True)

            qs = qs.filter(copropriete_id__in=allowed_copro_ids)

        copropriete_id = self.request.query_params.get("copropriete")
        if copropriete_id:
            qs = qs.filter(copropriete_id=copropriete_id)

        lot_id = self.request.query_params.get("lot")
        if lot_id:
            qs = qs.filter(lot_id=lot_id)

        coproprietaire_id = self.request.query_params.get("coproprietaire")
        if coproprietaire_id:
            qs = qs.filter(coproprietaire_id=coproprietaire_id)

        principal = _parse_bool_param(self.request.query_params.get("principal"))
        if principal is not None:
            qs = qs.filter(principal=principal)

        actif = _parse_bool_param(self.request.query_params.get("actif"))
        if actif is not None:
            if actif:
                qs = qs.filter(date_fin__isnull=True)
            else:
                qs = qs.filter(date_fin__isnull=False)

        q = self.request.query_params.get("q")
        if q:
            q = q.strip()
            qs = qs.filter(
                Q(coproprietaire__nom__icontains=q)
                | Q(coproprietaire__prenom__icontains=q)
                | Q(coproprietaire__raison_sociale__icontains=q)
                | Q(coproprietaire__email__icontains=q)
                | Q(lot__reference__icontains=q)
                | Q(lot__numero__icontains=q)
                | Q(lot__batiment__icontains=q)
                | Q(lot__porte__icontains=q)
                | Q(copropriete__nom__icontains=q)
            )

        return qs

    def get_serializer_class(self):
        if self.action == "list":
            return ProprietaireLotListSerializer

        return ProprietaireLotSerializer

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()

        _require_read_copropriete(request.user, instance.copropriete_id)

        serializer = ProprietaireLotSerializer(instance)
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

        serializer = ProprietaireLotSerializer(data=data)
        serializer.is_valid(raise_exception=True)

        target_copropriete = serializer.validated_data["copropriete"]
        _require_manage_referentiel(request.user, target_copropriete.id)

        instance = serializer.save()

        output = ProprietaireLotSerializer(instance)
        return Response(output.data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        instance = self.get_object()

        _require_manage_referentiel(request.user, instance.copropriete_id)

        data = _inject_copropriete_from_scope(request)

        serializer = ProprietaireLotSerializer(
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

        instance = serializer.save()

        output = ProprietaireLotSerializer(instance)
        return Response(output.data, status=status.HTTP_200_OK)

    def destroy(self, request, *args, **kwargs):
        """
        Pas de suppression physique.

        On clôture l'affectation de propriété à la date du jour.
        """
        instance = self.get_object()

        _require_manage_referentiel(request.user, instance.copropriete_id)

        if instance.date_fin is None:
            instance.date_fin = timezone.now().date()
            instance.save(update_fields=["date_fin", "updated_at"])

        output = ProprietaireLotSerializer(instance)
        return Response(output.data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"])
    def cloturer(self, request, pk=None):
        instance = self.get_object()

        _require_manage_referentiel(request.user, instance.copropriete_id)

        date_fin = request.data.get("date_fin") or timezone.now().date()

        instance.date_fin = date_fin
        instance.save(update_fields=["date_fin", "updated_at"])

        output = ProprietaireLotSerializer(instance)
        return Response(output.data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"])
    def rouvrir(self, request, pk=None):
        instance = self.get_object()

        _require_manage_referentiel(request.user, instance.copropriete_id)

        instance.date_fin = None
        instance.save(update_fields=["date_fin", "updated_at"])

        output = ProprietaireLotSerializer(instance)
        return Response(output.data, status=status.HTTP_200_OK)