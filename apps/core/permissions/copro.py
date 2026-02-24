from rest_framework.permissions import BasePermission
from apps.core.models import CoproMembre


class BaseCoproPermission(BasePermission):
    """
    Permission de base :
    - Vérifie que l'utilisateur est authentifié
    - Vérifie qu'un X-Copropriete-Id a été posé par le middleware (request.copropriete_id)
    - Vérifie que l'utilisateur est membre actif de la copropriété
    - Si allowed_roles est non vide : vérifie que le rôle est autorisé
    """

    allowed_roles = None  # None ou [] => tous les rôles acceptés

    def has_permission(self, request, view):
        user = request.user
        copro_id = getattr(request, "copropriete_id", None)

        if not user or not user.is_authenticated:
            return False

        if not copro_id:
            return False

        membership = (
            CoproMembre.objects.filter(
                user=user,
                copropriete_id=copro_id,
                is_active=True,
            )
            .only("role")
            .first()
        )

        if not membership:
            return False

        # Tous les rôles acceptés
        if not self.allowed_roles:
            return True

        return membership.role in self.allowed_roles


class IsCoproAdminOrSyndic(BaseCoproPermission):
    allowed_roles = [CoproMembre.Role.ADMIN, CoproMembre.Role.SYNDIC]


class IsCoproMember(BaseCoproPermission):
    """
    Simple membre actif, peu importe le rôle.
    """
    allowed_roles = None