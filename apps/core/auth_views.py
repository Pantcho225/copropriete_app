# apps/core/auth_views.py

import logging
from urllib.parse import quote

from django.apps import apps
from django.conf import settings
from django.core.mail import send_mail
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



logger = logging.getLogger(__name__)


def _build_password_reset_url(request, raw_token: str) -> str:
    """
    Construit l'URL frontend de réinitialisation.
    Priorité :
    - settings.FRONTEND_BASE_URL si défini ;
    - Origin HTTP du frontend ;
    - fallback absolute URI backend.
    """
    token = quote(str(raw_token or ""), safe="")
    frontend_base_url = str(getattr(settings, "FRONTEND_BASE_URL", "") or "").strip().rstrip("/")

    if frontend_base_url:
        return f"{frontend_base_url}/reset-password?token={token}"

    origin = str(request.headers.get("Origin", "") or "").strip().rstrip("/")
    if origin:
        return f"{origin}/reset-password?token={token}"

    return request.build_absolute_uri(f"/reset-password?token={token}")


def _send_password_reset_email(*, user, reset_url: str) -> bool:
    """
    Envoie le lien de réinitialisation à l'email du compte.
    Retourne False si aucun email n'est disponible.
    """
    email = str(getattr(user, "email", "") or "").strip()

    if not email:
        return False

    subject = "Réinitialisation de votre mot de passe"
    body = (
        "Bonjour,\n\n"
        "Une demande de réinitialisation de mot de passe a été effectuée pour votre compte.\n\n"
        f"Pour définir un nouveau mot de passe, ouvrez ce lien :\n{reset_url}\n\n"
        "Ce lien est temporaire. Si vous n'êtes pas à l'origine de cette demande, "
        "vous pouvez ignorer ce message.\n\n"
        "Cordialement,\n"
        "Plateforme de gestion de copropriété"
    )

    send_mail(
        subject,
        body,
        getattr(settings, "DEFAULT_FROM_EMAIL", "no-reply@localhost"),
        [email],
        fail_silently=False,
    )

    return True


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
                "un lien de réinitialisation a été envoyé à l’adresse email associée."
            )
        }

        user = result.get("user")
        reset_token = result.get("reset_token")
        throttled = bool(result.get("throttled"))
        reset_url = ""

        if user and reset_token and not throttled:
            reset_url = _build_password_reset_url(request, reset_token)

            try:
                email_sent = _send_password_reset_email(user=user, reset_url=reset_url)
            except Exception:
                logger.exception("Erreur lors de l'envoi du lien de réinitialisation.")
                email_sent = False

            if settings.DEBUG:
                response_data["debug_email_sent"] = email_sent

        if settings.DEBUG and reset_token and not throttled:
            response_data["debug_reset_token"] = reset_token
            response_data["debug_reset_url"] = reset_url or f"/reset-password?token={quote(str(reset_token), safe='')}"

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
                    "role_label": membership.get_role_display(),
                    "is_active": membership.is_active,
                    "permissions": {
                        "can_manage_copropriete": membership.can_manage_copropriete,
                        "can_manage_referentiel": membership.can_manage_referentiel,
                        "can_manage_users": membership.can_manage_users,
                        "can_write_compta": membership.can_write_compta,
                        "can_read_reports": membership.can_read_reports,
                    },
                    "copropriete": {
                        "id": copropriete.id,
                        "nom": getattr(copropriete, "nom", str(copropriete)),
                    },
                }
            )

        roles_list = sorted(list(roles))
        is_platform_admin = bool(user.is_staff or user.is_superuser)

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
                "is_admin": is_platform_admin,
                "is_platform_admin": is_platform_admin,
                "is_superuser": bool(user.is_superuser),
                "is_coproprietaire": "COPROPRIETAIRE" in roles_list,
            },
            status=status.HTTP_200_OK,
        )