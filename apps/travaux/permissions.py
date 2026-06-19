# apps/travaux/permissions.py
from __future__ import annotations

from typing import Optional

from rest_framework.exceptions import ValidationError
from rest_framework.permissions import BasePermission

from apps.core.models import CoproMembre
from apps.core.permissions.copro import BaseCoproPermission, CoproWriteReadOnly


def _role_values(*names: str) -> list[str]:
    """
    Retourne uniquement les rôles réellement disponibles sur CoproMembre.Role.
    """
    values: list[str] = []
    for name in names:
        if hasattr(CoproMembre.Role, name):
            values.append(getattr(CoproMembre.Role, name))
    return values


TRAVAUX_WRITE_ROLES = tuple(_role_values("ADMIN", "SYNDIC", "GESTIONNAIRE"))
TRAVAUX_UNLOCK_ROLES = tuple(_role_values("ADMIN"))


def _get_copro_id_from_request(request) -> Optional[int]:
    copro_id = getattr(request, "copropriete_id", None)
    if copro_id:
        return int(copro_id)

    copro_id = request.headers.get("X-Copropriete-Id")
    if not copro_id:
        return None

    try:
        return int(str(copro_id))
    except ValueError:
        raise ValidationError({"detail": "X-Copropriete-Id invalide (entier requis)."})


def user_can_unlock_dossier(request) -> bool:
    """
    Déverrouillage travaux :
    - superuser technique autorisé ;
    - sinon ADMIN actif de la copropriété courante.
    """
    user = getattr(request, "user", None)
    if not user or not getattr(user, "is_authenticated", False):
        return False

    if getattr(user, "is_superuser", False):
        return True

    copro_id = _get_copro_id_from_request(request)
    if not copro_id:
        return False

    return CoproMembre.objects.filter(
        user_id=user.id,
        copropriete_id=copro_id,
        is_active=True,
        role__in=TRAVAUX_UNLOCK_ROLES,
    ).exists()


class IsSyndicOrAdmin(BaseCoproPermission):
    """
    Permission forte travaux basée sur CoproMembre.
    """
    message = "Accès réservé au syndic ou administrateur de la copropriété courante."

    allowed_roles = TRAVAUX_WRITE_ROLES

    allow_superuser = True
    allow_staff = False


class TravauxWritePermission(CoproWriteReadOnly):
    """
    Lecture : membre actif de la copropriété courante.
    Écriture : ADMIN / SYNDIC / GESTIONNAIRE actif.
    """
    message = "Vous n'avez pas la permission d'effectuer cette action sur les travaux."

    read_roles = None
    write_roles = TRAVAUX_WRITE_ROLES

    allow_superuser = True
    allow_staff = False


class TravauxObjectCoproPermission(BasePermission):
    """
    Vérifie que l'objet appartient à la copropriété courante.
    Utile en complément de get_queryset().
    """
    message = "Ressource hors périmètre de la copropriété courante."

    def has_object_permission(self, request, view, obj) -> bool:
        copro_id = _get_copro_id_from_request(request)
        if copro_id is None:
            raise ValidationError({"detail": "En-tête X-Copropriete-Id requis."})

        obj_copro_id = getattr(obj, "copropriete_id", None)
        if obj_copro_id is None:
            return True

        return int(obj_copro_id) == int(copro_id)
