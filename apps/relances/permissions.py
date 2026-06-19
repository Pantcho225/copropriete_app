# apps/relances/permissions.py
from __future__ import annotations

from apps.core.models import CoproMembre
from apps.core.permissions.copro import CoproWriteReadOnly


def _role_values(*names: str) -> list[str]:
    """
    Retourne uniquement les rôles réellement disponibles sur CoproMembre.Role.
    """
    values: list[str] = []
    for name in names:
        if hasattr(CoproMembre.Role, name):
            values.append(getattr(CoproMembre.Role, name))
    return values


class IsAdminOrSyndicWriteReadOnly(CoproWriteReadOnly):
    """
    Relances basées sur CoproMembre.

    Lecture : membre actif de la copropriété courante.
    Écriture : ADMIN / SYNDIC / GESTIONNAIRE / COMPTABLE actif.
    """
    message = "Vous n'avez pas la permission de gérer les relances de cette copropriété."

    read_roles = None
    write_roles = tuple(_role_values("ADMIN", "SYNDIC", "GESTIONNAIRE", "COMPTABLE"))

    allow_superuser = True
    allow_staff = False
