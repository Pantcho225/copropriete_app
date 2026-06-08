# apps/core/auth_views.py

from django.apps import apps
from django.conf import settings
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView

from .auth_serializers import (
    ChangePasswordSerializer,
    CustomTokenObtainPairSerializer,
    PasswordResetConfirmSerializer,
    PasswordResetRequestSerializer,
)


class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer


class ChangePasswordAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ChangePasswordSerializer(
            data=request.data,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()

        return Response(
            {
                "detail": "Votre mot de passe a été modifié avec succès.",
                "must_change_password": False,
            },
            status=status.HTTP_200_OK,
        )


class PasswordResetRequestAPIView(APIView):
    """
    Demande de récupération d'accès.

    Important :
    - la réponse reste neutre pour ne pas révéler si un compte existe ;
    - en DEBUG seulement, on renvoie le token brut pour faciliter les tests locaux ;
    - en production, ce token devra être envoyé par email/SMS/lien sécurisé.
    """

    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        serializer = PasswordResetRequestSerializer(
            data=request.data,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        result = serializer.save()

        response_data = {
            "detail": (
                "Si un compte actif correspond à ces informations, "
                "un lien de récupération va être préparé."
            )
        }

        reset_token = result.get("reset_token")
        throttled = bool(result.get("throttled"))

        if settings.DEBUG and reset_token and not throttled:
            response_data["debug_reset_token"] = reset_token
            response_data["debug_reset_url"] = f"/reset-password?token={reset_token}"

        if settings.DEBUG and throttled:
            response_data["debug_throttled"] = True
            response_data["debug_message"] = (
                "Trop de demandes récentes pour ce compte. Réessayez plus tard."
            )

        return Response(response_data, status=status.HTTP_200_OK)


class PasswordResetConfirmAPIView(APIView):
    """
    Confirmation de réinitialisation du mot de passe.

    Le token est reçu depuis le lien de récupération.
    Après succès :
    - le mot de passe est remplacé ;
    - le token est consommé ;
    - must_change_password repasse à False.
    """

    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        serializer = PasswordResetConfirmSerializer(
            data=request.data,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()

        return Response(
            {
                "detail": "Votre mot de passe a été réinitialisé avec succès.",
                "must_change_password": False,
            },
            status=status.HTTP_200_OK,
        )


class AuthMeAPIView(APIView):
    """
    Retourne l'utilisateur connecté, son statut sécurité,
    ses rôles métier et ses copropriétés actives.

    Cet endpoint sert au frontend pour :
    - protéger /coproprietaire ;
    - distinguer Admin / Super Admin / Copropriétaire ;
    - rediriger proprement selon le profil connecté.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user

        UserSecurityProfile = apps.get_model("core", "UserSecurityProfile")
        CoproMembre = apps.get_model("core", "CoproMembre")

        security_profile, _ = UserSecurityProfile.objects.get_or_create(user=user)

        memberships = (
            CoproMembre.objects.filter(
                user=user,
                is_active=True,
            )
            .select_related("copropriete")
            .order_by("copropriete__nom", "role")
        )

        membership_rows = []
        roles = set()

        for membership in memberships:
            role = membership.role
            roles.add(role)

            copropriete = membership.copropriete

            membership_rows.append(
                {
                    "id": membership.id,
                    "role": role,
                    "is_active": membership.is_active,
                    "copropriete": {
                        "id": copropriete.id,
                        "nom": getattr(copropriete, "nom", str(copropriete)),
                    },
                }
            )

        roles_list = sorted(list(roles))

        return Response(
            {
                "user": {
                    "id": user.id,
                    "username": user.username,
                    "email": user.email,
                    "first_name": user.first_name,
                    "last_name": user.last_name,
                    "is_superuser": user.is_superuser,
                    "is_staff": user.is_staff,
                },
                "must_change_password": bool(security_profile.must_change_password),
                "roles": roles_list,
                "memberships": membership_rows,
                "is_admin": bool(user.is_staff or user.is_superuser),
                "is_superuser": bool(user.is_superuser),
                "is_coproprietaire": "COPROPRIETAIRE" in roles_list,
            },
            status=status.HTTP_200_OK,
        )