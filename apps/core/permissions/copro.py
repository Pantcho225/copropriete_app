# apps/core/permissions/copro.py
from __future__ import annotations

from typing import Iterable, Optional, Sequence

from rest_framework.permissions import BasePermission, SAFE_METHODS

from apps.core.models import CoproMembre


class BaseCoproPermission(BasePermission):
    """
    Permission de base (multi-copro) :
    - user authentifié
    - request.copropriete_id présent (posé par middleware X-Copropriete-Id)
    - utilisateur membre actif de la copropriété
    - si allowed_roles est défini (liste non vide) => rôle doit appartenir à la liste

    Convention allowed_roles:
      - None => tous les rôles acceptés (membre actif suffit)
      - []   => aucun rôle (refuse tout)
      - [..] => liste blanche des rôles autorisés
    """

    allowed_roles: Optional[Iterable[str]] = None

    # pratique pour dev/admin Django
    allow_superuser: bool = True
    allow_staff: bool = True

    def has_permission(self, request, view) -> bool:
        user = getattr(request, "user", None)
        if not user or not user.is_authenticated:
            return False

        if self.allow_superuser and getattr(user, "is_superuser", False):
            return True
        if self.allow_staff and getattr(user, "is_staff", False):
            return True

        copro_id = getattr(request, "copropriete_id", None)
        if not copro_id:
            return False

        # Liste vide => personne n'a le droit
        if self.allowed_roles == []:
            return False

        qs = CoproMembre.objects.filter(
            user_id=user.id,
            copropriete_id=copro_id,
            is_active=True,
        )

        # Tous rôles acceptés (membre actif suffit)
        if self.allowed_roles is None:
            return qs.exists()

        # Filtre rôle
        return qs.filter(role__in=list(self.allowed_roles)).exists()


class IsCoproMember(BaseCoproPermission):
    """Simple membre actif, peu importe le rôle."""
    allowed_roles = None


class IsCoproAdminOrSyndic(BaseCoproPermission):
    allowed_roles = [CoproMembre.Role.ADMIN, CoproMembre.Role.SYNDIC]


class IsCoproComptableOrAbove(BaseCoproPermission):
    """ADMIN / SYNDIC / COMPTABLE."""
    allowed_roles = [CoproMembre.Role.ADMIN, CoproMembre.Role.SYNDIC, CoproMembre.Role.COMPTABLE]


class CoproWriteReadOnly(BasePermission):
    """
    Lecture: membre actif (par défaut).
    Écriture: rôles dans write_roles.
    """

    message = "Vous n'avez pas la permission d'effectuer cette action."

    # Lecture
    read_roles: Optional[Sequence[str]] = None  # None => membre actif, [] => personne, [..] => whitelist

    # Écriture
    write_roles: Sequence[str] = (CoproMembre.Role.ADMIN, CoproMembre.Role.SYNDIC)

    allow_superuser: bool = True
    allow_staff: bool = True

    def has_permission(self, request, view) -> bool:
        user = getattr(request, "user", None)
        if not user or not user.is_authenticated:
            return False

        if self.allow_superuser and getattr(user, "is_superuser", False):
            return True
        if self.allow_staff and getattr(user, "is_staff", False):
            return True

        copro_id = getattr(request, "copropriete_id", None)
        if not copro_id:
            return False

        qs = CoproMembre.objects.filter(
            user_id=user.id,
            copropriete_id=copro_id,
            is_active=True,
        )

        # Lecture
        if request.method in SAFE_METHODS:
            if self.read_roles == []:
                return False
            if self.read_roles is None:
                return qs.exists()
            return qs.filter(role__in=list(self.read_roles)).exists()

        # Écriture
        if not self.write_roles:
            return False
        return qs.filter(role__in=list(self.write_roles)).exists()


class IsAdminOrSyndicWriteReadOnly(CoproWriteReadOnly):
    """Lecture: membre actif ; Écriture: ADMIN/SYNDIC."""
    write_roles = (CoproMembre.Role.ADMIN, CoproMembre.Role.SYNDIC)