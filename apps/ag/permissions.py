# apps/ag/permissions.py
from __future__ import annotations

from apps.core.models import CoproMembre
from apps.core.permissions.copro import BaseCoproPermission


def _role_values(*names: str) -> list[str]:
    """
    Retourne uniquement les rôles réellement disponibles sur CoproMembre.Role.
    Cela évite de casser si un rôle métier optionnel n'existe pas encore.
    """
    values: list[str] = []
    for name in names:
        if hasattr(CoproMembre.Role, name):
            values.append(getattr(CoproMembre.Role, name))
    return values


class IsSyndicOrAdmin(BaseCoproPermission):
    """
    Permission AG basée sur CoproMembre, source de vérité métier.

    Autorise :
    - superuser technique ;
    - membre actif de la copropriété courante avec rôle ADMIN / SYNDIC / GESTIONNAIRE.

    Refuse volontairement les anciens passe-droits déclaratifs portés par User :
    la décision métier doit venir du membership actif sur la copropriété courante.
    """

    message = "Accès réservé au syndic / administrateur de la copropriété courante."

    allowed_roles = _role_values("ADMIN", "SYNDIC", "GESTIONNAIRE")

    allow_superuser = True
    allow_staff = False
