# apps/core/serializers.py
from __future__ import annotations

from django.contrib.auth import get_user_model
from rest_framework import serializers

from .models import CoproMembre, Copropriete


User = get_user_model()


class UserLiteSerializer(serializers.ModelSerializer):
    """
    Représentation minimale d'un utilisateur pour l'Admin React.
    """

    full_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = (
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "full_name",
            "is_active",
        )
        read_only_fields = fields

    def get_full_name(self, obj):
        full_name = ""
        if hasattr(obj, "get_full_name"):
            full_name = obj.get_full_name()

        return full_name or obj.get_username()


class CoproprieteSerializer(serializers.ModelSerializer):
    """
    Serializer principal pour créer, modifier et afficher une copropriété.

    Utilisé par :
    - l'Admin React ;
    - la liste des copropriétés ;
    - le détail d'une copropriété ;
    - le choix de copropriété active.
    """

    display_name = serializers.CharField(read_only=True)
    is_available = serializers.BooleanField(read_only=True)
    logo_url = serializers.SerializerMethodField()

    membres_count = serializers.SerializerMethodField()
    membres_actifs_count = serializers.SerializerMethodField()

    class Meta:
        model = Copropriete
        fields = (
            "id",
            "nom",
            "slug",
            "adresse",
            "ville",
            "pays",
            "description",
            "telephone",
            "email_contact",
            "logo",
            "logo_url",
            "statut",
            "is_active",
            "display_name",
            "is_available",
            "membres_count",
            "membres_actifs_count",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "slug",
            "display_name",
            "is_available",
            "logo_url",
            "membres_count",
            "membres_actifs_count",
            "created_at",
            "updated_at",
        )

    def get_logo_url(self, obj):
        if not obj.logo:
            return ""

        request = self.context.get("request")
        url = obj.logo.url

        if request:
            return request.build_absolute_uri(url)

        return url

    def get_membres_count(self, obj):
        return obj.membres.count()

    def get_membres_actifs_count(self, obj):
        return obj.membres.filter(is_active=True).count()

    def validate_nom(self, value):
        value = (value or "").strip()

        if not value:
            raise serializers.ValidationError(
                "Le nom de la copropriété est obligatoire."
            )

        return value

    def validate_email_contact(self, value):
        return (value or "").strip().lower()

    def validate(self, attrs):
        statut = attrs.get("statut", getattr(self.instance, "statut", None))
        is_active = attrs.get("is_active", getattr(self.instance, "is_active", True))

        if statut == Copropriete.Statut.ACTIVE and is_active is False:
            raise serializers.ValidationError(
                {
                    "is_active": (
                        "Une copropriété active doit aussi avoir "
                        "is_active=True."
                    )
                }
            )

        return attrs


class CoproprieteListSerializer(serializers.ModelSerializer):
    """
    Version compacte pour les listes React.
    """

    display_name = serializers.CharField(read_only=True)
    is_available = serializers.BooleanField(read_only=True)
    logo_url = serializers.SerializerMethodField()
    membres_actifs_count = serializers.SerializerMethodField()

    class Meta:
        model = Copropriete
        fields = (
            "id",
            "nom",
            "slug",
            "ville",
            "pays",
            "statut",
            "is_active",
            "display_name",
            "is_available",
            "logo_url",
            "membres_actifs_count",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields

    def get_logo_url(self, obj):
        if not obj.logo:
            return ""

        request = self.context.get("request")
        url = obj.logo.url

        if request:
            return request.build_absolute_uri(url)

        return url

    def get_membres_actifs_count(self, obj):
        return obj.membres.filter(is_active=True).count()


class CoproMembreSerializer(serializers.ModelSerializer):
    """
    Serializer complet d'un membre rattaché à une copropriété.
    """

    user_detail = UserLiteSerializer(source="user", read_only=True)
    copropriete_detail = CoproprieteListSerializer(
        source="copropriete",
        read_only=True,
    )

    user_display = serializers.SerializerMethodField()
    role_label = serializers.CharField(source="get_role_display", read_only=True)

    permissions = serializers.SerializerMethodField()

    class Meta:
        model = CoproMembre
        fields = (
            "id",
            "copropriete",
            "copropriete_detail",
            "user",
            "user_detail",
            "user_display",
            "role",
            "role_label",
            "is_active",
            "permissions",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "copropriete_detail",
            "user_detail",
            "user_display",
            "role_label",
            "permissions",
            "created_at",
            "updated_at",
        )

    def get_user_display(self, obj):
        user = obj.user

        if hasattr(user, "get_full_name"):
            full_name = user.get_full_name()
            if full_name:
                return full_name

        return (
            getattr(user, "email", None)
            or getattr(user, "username", None)
            or f"Utilisateur #{user.pk}"
        )

    def get_permissions(self, obj):
        return {
            "can_manage_copropriete": obj.can_manage_copropriete,
            "can_manage_referentiel": obj.can_manage_referentiel,
            "can_manage_users": obj.can_manage_users,
            "can_write_compta": obj.can_write_compta,
            "can_read_reports": obj.can_read_reports,
        }

    def validate(self, attrs):
        copropriete = attrs.get(
            "copropriete",
            getattr(self.instance, "copropriete", None),
        )
        is_active = attrs.get(
            "is_active",
            getattr(self.instance, "is_active", True),
        )

        if copropriete and is_active and not copropriete.is_available:
            raise serializers.ValidationError(
                {
                    "copropriete": (
                        "Impossible d'activer un membre sur une copropriété "
                        "inactive, suspendue ou archivée."
                    )
                }
            )

        return attrs


class CoproMembreCreateUpdateSerializer(serializers.ModelSerializer):
    """
    Serializer dédié à la création/modification d'un membre.

    Séparé volontairement du serializer d'affichage pour garder les payloads React
    simples et éviter les champs imbriqués inutiles en écriture.
    """

    class Meta:
        model = CoproMembre
        fields = (
            "id",
            "copropriete",
            "user",
            "role",
            "is_active",
        )
        read_only_fields = ("id",)

    def validate(self, attrs):
        copropriete = attrs.get(
            "copropriete",
            getattr(self.instance, "copropriete", None),
        )
        user = attrs.get(
            "user",
            getattr(self.instance, "user", None),
        )
        is_active = attrs.get(
            "is_active",
            getattr(self.instance, "is_active", True),
        )

        if copropriete and is_active and not copropriete.is_available:
            raise serializers.ValidationError(
                {
                    "copropriete": (
                        "Impossible d'activer un membre sur une copropriété "
                        "inactive, suspendue ou archivée."
                    )
                }
            )

        if copropriete and user:
            qs = CoproMembre.objects.filter(
                copropriete=copropriete,
                user=user,
            )

            if self.instance:
                qs = qs.exclude(pk=self.instance.pk)

            if qs.exists():
                raise serializers.ValidationError(
                    {
                        "user": (
                            "Cet utilisateur est déjà rattaché à cette "
                            "copropriété."
                        )
                    }
                )

        return attrs


class MesCoproprietesSerializer(serializers.ModelSerializer):
    """
    Serializer utilisé pour afficher les copropriétés accessibles à
    l'utilisateur connecté.
    """

    copropriete = CoproprieteListSerializer(read_only=True)
    role_label = serializers.CharField(source="get_role_display", read_only=True)
    permissions = serializers.SerializerMethodField()

    class Meta:
        model = CoproMembre
        fields = (
            "id",
            "copropriete",
            "role",
            "role_label",
            "is_active",
            "permissions",
        )
        read_only_fields = fields

    def get_permissions(self, obj):
        return {
            "can_manage_copropriete": obj.can_manage_copropriete,
            "can_manage_referentiel": obj.can_manage_referentiel,
            "can_manage_users": obj.can_manage_users,
            "can_write_compta": obj.can_write_compta,
            "can_read_reports": obj.can_read_reports,
        }