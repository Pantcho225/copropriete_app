# apps/core/auth_serializers.py

from django.contrib.auth import password_validation
from django.utils import timezone
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer


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
                {"confirm_password": "Les deux nouveaux mots de passe ne correspondent pas."}
            )

        if current_password == new_password:
            raise serializers.ValidationError(
                {"new_password": "Le nouveau mot de passe doit être différent du mot de passe temporaire."}
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

            update_fields = ["must_change_password"]

            if hasattr(security_profile, "password_changed_at"):
                security_profile.password_changed_at = timezone.now()
                update_fields.append("password_changed_at")

            security_profile.save(update_fields=update_fields)

        return user