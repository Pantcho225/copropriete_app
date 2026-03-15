from __future__ import annotations

from rest_framework.permissions import SAFE_METHODS, BasePermission


class IsAdminOrSyndicWriteReadOnly(BasePermission):
    """
    Lecture pour les utilisateurs authentifiés.
    Écriture réservée aux profils élevés.
    Adapte les noms de rôles selon ton modèle utilisateur si besoin.
    """

    allowed_write_roles = {"SUPER_ADMIN", "ADMIN", "SYNDIC", "GESTIONNAIRE"}

    def has_permission(self, request, view):
        user = request.user

        if not user or not user.is_authenticated:
            return False

        if request.method in SAFE_METHODS:
            return True

        if user.is_superuser:
            return True

        role = getattr(user, "role", None)
        if role in self.allowed_write_roles:
            return True

        return False