# apps/core/auth_serializers.py

from datetime import timedelta

from django.contrib.auth import get_user_model, password_validation
from django.db.models import Q
from django.utils import timezone
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .models import PasswordResetToken


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """
    Login JWT enrichi avec l'information must_change_password.
    """

    def validate(self, attrs):
        data = super().validate(attrs)

        user = self.user
        security_profile = getattr(user, "security_profile", None)

        data["user"] = {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "is_superuser": user.is_superuser,
            "is_staff": user.is_staff,
        }

        data["must_change_password"] = bool(
            getattr(security_profile, "must_change_password", False)
        )

        return data


class ChangePasswordSerializer(serializers.Serializer):
    current_password = serializers.CharField(
        write_only=True,
        required=True,
        trim_whitespace=False,
    )
    new_password = serializers.CharField(
        write_only=True,
        required=True,
        trim_whitespace=False,
    )
    confirm_password = serializers.CharField(
        write_only=True,
        required=True,
        trim_whitespace=False,
    )

    def validate_current_password(self, value):
        user = self.context["request"].user

        if not user.check_password(value):
            raise serializers.ValidationError(
                "Le mot de passe actuel est incorrect."
            )

        return value

    def validate(self, attrs):
        user = self.context["request"].user

        current_password = attrs.get("current_password")
        new_password = attrs.get("new_password")
        confirm_password = attrs.get("confirm_password")

        if new_password != confirm_password:
            raise serializers.ValidationError(
                {
                    "confirm_password": (
                        "Les deux nouveaux mots de passe ne correspondent pas."
                    )
                }
            )

        if current_password == new_password:
            raise serializers.ValidationError(
                {
                    "new_password": (
                        "Le nouveau mot de passe doit être différent du mot de passe temporaire."
                    )
                }
            )

        password_validation.validate_password(new_password, user=user)

        return attrs

    def save(self, **kwargs):
        request = self.context["request"]
        user = request.user
        new_password = self.validated_data["new_password"]

        user.set_password(new_password)
        user.save(update_fields=["password"])

        security_profile = getattr(user, "security_profile", None)

        if security_profile:
            security_profile.must_change_password = False
            security_profile.password_changed_at = timezone.now()
            security_profile.save(
                update_fields=[
                    "must_change_password",
                    "password_changed_at",
                ]
            )

        return user


class PasswordResetRequestSerializer(serializers.Serializer):
    """
    Demande de récupération d'accès.

    Sécurité :
    - réponse neutre côté API ;
    - ne révèle jamais si l'identifiant existe ;
    - accepte email ou username ;
    - limite les demandes répétées ;
    - génère un token temporaire hashé côté base.
    """

    identifier = serializers.CharField(
        required=True,
        allow_blank=False,
        trim_whitespace=True,
        max_length=254,
    )

    def _get_client_ip(self):
        request = self.context.get("request")
        if not request:
            return None

        forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR")
        if forwarded_for:
            return forwarded_for.split(",")[0].strip()

        return request.META.get("REMOTE_ADDR")

    def _get_user_agent(self):
        request = self.context.get("request")
        if not request:
            return ""

        return request.META.get("HTTP_USER_AGENT", "")

    def save(self, **kwargs):
        User = get_user_model()
        identifier = self.validated_data["identifier"].strip()

        user = (
            User.objects.filter(
                Q(email__iexact=identifier) | Q(username__iexact=identifier),
                is_active=True,
            )
            .order_by("id")
            .first()
        )

        if not user:
            return {
                "user": None,
                "reset_token": None,
                "token_object": None,
                "throttled": False,
            }

        now = timezone.now()
        recent_requests_count = PasswordResetToken.objects.filter(
            user=user,
            created_at__gte=now - timedelta(minutes=10),
        ).count()

        if recent_requests_count >= 5:
            return {
                "user": user,
                "reset_token": None,
                "token_object": None,
                "throttled": True,
            }

        raw_token, reset_token = PasswordResetToken.generate_for_user(
            user=user,
            requested_ip=self._get_client_ip(),
            requested_user_agent=self._get_user_agent(),
            ttl_minutes=30,
        )

        return {
            "user": user,
            "reset_token": raw_token,
            "token_object": reset_token,
            "throttled": False,
        }


class PasswordResetConfirmSerializer(serializers.Serializer):
    """
    Confirmation de récupération d'accès.

    Le token reçu est brut côté client.
    On le hash puis on compare au token_hash stocké.
    """

    token = serializers.CharField(
        required=True,
        allow_blank=False,
        trim_whitespace=True,
    )
    new_password = serializers.CharField(
        write_only=True,
        required=True,
        trim_whitespace=False,
    )
    confirm_password = serializers.CharField(
        write_only=True,
        required=True,
        trim_whitespace=False,
    )

    def _get_client_ip(self):
        request = self.context.get("request")
        if not request:
            return None

        forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR")
        if forwarded_for:
            return forwarded_for.split(",")[0].strip()

        return request.META.get("REMOTE_ADDR")

    def _get_user_agent(self):
        request = self.context.get("request")
        if not request:
            return ""

        return request.META.get("HTTP_USER_AGENT", "")

    def validate(self, attrs):
        token = attrs.get("token")
        new_password = attrs.get("new_password")
        confirm_password = attrs.get("confirm_password")

        if new_password != confirm_password:
            raise serializers.ValidationError(
                {
                    "confirm_password": (
                        "Les deux nouveaux mots de passe ne correspondent pas."
                    )
                }
            )

        token_hash = PasswordResetToken.hash_token(token)

        reset_token = (
            PasswordResetToken.objects.select_related("user")
            .filter(
                token_hash=token_hash,
                used_at__isnull=True,
            )
            .first()
        )

        if not reset_token:
            raise serializers.ValidationError(
                {
                    "token": (
                        "Le lien de récupération est invalide ou a déjà été utilisé."
                    )
                }
            )

        if reset_token.is_expired:
            raise serializers.ValidationError(
                {
                    "token": (
                        "Le lien de récupération a expiré. Veuillez demander un nouveau lien."
                    )
                }
            )

        user = reset_token.user

        if not user.is_active:
            raise serializers.ValidationError(
                {
                    "token": (
                        "Ce compte utilisateur est désactivé. Veuillez contacter l'administrateur."
                    )
                }
            )

        password_validation.validate_password(new_password, user=user)

        attrs["reset_token"] = reset_token
        attrs["user"] = user

        return attrs

    def save(self, **kwargs):
        user = self.validated_data["user"]
        reset_token = self.validated_data["reset_token"]
        new_password = self.validated_data["new_password"]

        user.set_password(new_password)
        user.save(update_fields=["password"])

        reset_token.consume(
            consumed_ip=self._get_client_ip(),
            consumed_user_agent=self._get_user_agent(),
        )

        security_profile = getattr(user, "security_profile", None)

        if security_profile:
            security_profile.must_change_password = False
            security_profile.password_changed_at = timezone.now()
            security_profile.save(
                update_fields=[
                    "must_change_password",
                    "password_changed_at",
                ]
            )

        return user