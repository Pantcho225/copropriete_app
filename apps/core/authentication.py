# apps/core/authentication.py

from rest_framework.exceptions import PermissionDenied
from rest_framework_simplejwt.authentication import JWTAuthentication


class MustChangePasswordJWTAuthentication(JWTAuthentication):
    """
    Bloque l'accès aux API métier si l'utilisateur doit changer son mot de passe.

    Objectif :
    - autoriser login ;
    - autoriser refresh ;
    - autoriser change-password ;
    - autoriser récupération d'accès ;
    - bloquer le reste tant que must_change_password=True.
    """

    ALLOWED_PATHS = {
        "/api/auth/login/",
        "/api/auth/login",
        "/api/auth/refresh/",
        "/api/auth/refresh",
        "/api/auth/change-password/",
        "/api/auth/change-password",
        "/api/auth/password-reset/request/",
        "/api/auth/password-reset/request",
        "/api/auth/password-reset/confirm/",
        "/api/auth/password-reset/confirm",
    }

    def authenticate(self, request):
        result = super().authenticate(request)

        if result is None:
            return None

        user, validated_token = result

        security_profile = getattr(user, "security_profile", None)
        must_change_password = bool(
            getattr(security_profile, "must_change_password", False)
        )

        if must_change_password and request.path not in self.ALLOWED_PATHS:
            raise PermissionDenied(
                "Vous devez changer votre mot de passe temporaire avant de continuer."
            )

        return user, validated_token