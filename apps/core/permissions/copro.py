# apps/core/permissions/copro.py
from __future__ import annotations

from typing import Iterable, Optional, Sequence

from rest_framework.permissions import BasePermission, SAFE_METHODS

from apps.core.models import CoproMembre


class BaseCoproPermission(BasePermission):
    """
    Permission de base (multi-copro) :
    - user authentifié
    - request.copropriete_id présent (ou fallback header X-Copropriete-Id)
    - utilisateur membre actif de la copropriété
    - si allowed_roles est défini (liste non vide) => rôle doit appartenir à la liste

    Convention allowed_roles:
      - None => tous les rôles acceptés (membre actif suffit)
      - []   => aucun rôle (refuse tout)
      - [..] => liste blanche des rôles autorisés
    """

    allowed_roles: Optional[Iterable[str]] = None

    allow_superuser: bool = True
    allow_staff: bool = True

    def _get_copro_id(self, request):
        copro_id = getattr(request, "copropriete_id", None)
        if copro_id:
            return copro_id

        header_value = request.headers.get("X-Copropriete-Id")
        if header_value:
            try:
                return int(str(header_value))
            except (TypeError, ValueError):
                return None

        return None

    def _get_membership_qs(self, request):
        user = getattr(request, "user", None)
        copro_id = self._get_copro_id(request)
        if not user or not getattr(user, "is_authenticated", False) or not copro_id:
            return CoproMembre.objects.none()

        return CoproMembre.objects.filter(
            user_id=user.id,
            copropriete_id=copro_id,
            is_active=True,
        )

    def _is_admin_override(self, request) -> bool:
        user = getattr(request, "user", None)
        if not user or not getattr(user, "is_authenticated", False):
            return False

        if self.allow_superuser and getattr(user, "is_superuser", False):
            return True
        if self.allow_staff and getattr(user, "is_staff", False):
            return True
        return False

    def has_permission(self, request, view) -> bool:
        user = getattr(request, "user", None)
        if not user or not user.is_authenticated:
            return False

        if self._is_admin_override(request):
            return True

        copro_id = self._get_copro_id(request)
        if not copro_id:
            return False

        if self.allowed_roles == []:
            return False

        qs = self._get_membership_qs(request)

        if self.allowed_roles is None:
            return qs.exists()

        return qs.filter(role__in=list(self.allowed_roles)).exists()

    def has_object_permission(self, request, view, obj) -> bool:
        if not self.has_permission(request, view):
            return False

        if self._is_admin_override(request):
            return True

        copro_id = self._get_copro_id(request)
        if not copro_id:
            return False

        obj_copro_id = getattr(obj, "copropriete_id", None)

        if obj_copro_id is None:
            releve_import = getattr(obj, "releve_import", None)
            if releve_import is not None:
                obj_copro_id = getattr(releve_import, "copropriete_id", None)

        if obj_copro_id is None:
            ligne = getattr(obj, "ligne", None)
            if ligne is not None:
                obj_copro_id = getattr(ligne, "copropriete_id", None)
                if obj_copro_id is None:
                    appel = getattr(ligne, "appel", None)
                    if appel is not None:
                        obj_copro_id = getattr(appel, "copropriete_id", None)

        if obj_copro_id is None:
            dossier = getattr(obj, "dossier", None)
            if dossier is not None:
                obj_copro_id = getattr(dossier, "copropriete_id", None)

        if obj_copro_id is None:
            return True

        try:
            return int(obj_copro_id) == int(copro_id)
        except (TypeError, ValueError):
            return False


class IsCoproMember(BaseCoproPermission):
    """Simple membre actif, peu importe le rôle."""
    allowed_roles = None


class IsCoproAdminOrSyndic(BaseCoproPermission):
    allowed_roles = [CoproMembre.Role.ADMIN, CoproMembre.Role.SYNDIC]


class IsCoproComptableOrAbove(BaseCoproPermission):
    """ADMIN / SYNDIC / COMPTABLE."""
    allowed_roles = [
        CoproMembre.Role.ADMIN,
        CoproMembre.Role.SYNDIC,
        CoproMembre.Role.COMPTABLE,
    ]


class CoproWriteReadOnly(BasePermission):
    """
    Lecture: membre actif (par défaut).
    Écriture: rôles dans write_roles.
    """

    message = "Vous n'avez pas la permission d'effectuer cette action."

    read_roles: Optional[Sequence[str]] = None
    write_roles: Sequence[str] = (CoproMembre.Role.ADMIN, CoproMembre.Role.SYNDIC)

    allow_superuser: bool = True
    allow_staff: bool = True

    def _get_copro_id(self, request):
        copro_id = getattr(request, "copropriete_id", None)
        if copro_id:
            return copro_id

        header_value = request.headers.get("X-Copropriete-Id")
        if header_value:
            try:
                return int(str(header_value))
            except (TypeError, ValueError):
                return None

        return None

    def _is_admin_override(self, request) -> bool:
        user = getattr(request, "user", None)
        if not user or not getattr(user, "is_authenticated", False):
            return False

        if self.allow_superuser and getattr(user, "is_superuser", False):
            return True
        if self.allow_staff and getattr(user, "is_staff", False):
            return True
        return False

    def _get_membership_qs(self, request):
        user = getattr(request, "user", None)
        copro_id = self._get_copro_id(request)
        if not user or not getattr(user, "is_authenticated", False) or not copro_id:
            return CoproMembre.objects.none()

        return CoproMembre.objects.filter(
            user_id=user.id,
            copropriete_id=copro_id,
            is_active=True,
        )

    def has_permission(self, request, view) -> bool:
        user = getattr(request, "user", None)
        if not user or not user.is_authenticated:
            return False

        if self._is_admin_override(request):
            return True

        copro_id = self._get_copro_id(request)
        if not copro_id:
            return False

        qs = self._get_membership_qs(request)

        if request.method in SAFE_METHODS:
            if self.read_roles == []:
                return False
            if self.read_roles is None:
                return qs.exists()
            return qs.filter(role__in=list(self.read_roles)).exists()

        if not self.write_roles:
            return False
        return qs.filter(role__in=list(self.write_roles)).exists()

    def has_object_permission(self, request, view, obj) -> bool:
        if not self.has_permission(request, view):
            return False

        if self._is_admin_override(request):
            return True

        copro_id = self._get_copro_id(request)
        if not copro_id:
            return False

        obj_copro_id = getattr(obj, "copropriete_id", None)

        if obj_copro_id is None:
            releve_import = getattr(obj, "releve_import", None)
            if releve_import is not None:
                obj_copro_id = getattr(releve_import, "copropriete_id", None)

        if obj_copro_id is None:
            ligne = getattr(obj, "ligne", None)
            if ligne is not None:
                obj_copro_id = getattr(ligne, "copropriete_id", None)
                if obj_copro_id is None:
                    appel = getattr(ligne, "appel", None)
                    if appel is not None:
                        obj_copro_id = getattr(appel, "copropriete_id", None)

        if obj_copro_id is None:
            dossier = getattr(obj, "dossier", None)
            if dossier is not None:
                obj_copro_id = getattr(dossier, "copropriete_id", None)

        if obj_copro_id is None:
            return True

        try:
            return int(obj_copro_id) == int(copro_id)
        except (TypeError, ValueError):
            return False


class IsAdminOrSyndicWriteReadOnly(CoproWriteReadOnly):
    """Lecture: membre actif ; Écriture: ADMIN/SYNDIC."""
    write_roles = (CoproMembre.Role.ADMIN, CoproMembre.Role.SYNDIC)