# apps/travaux/permissions.py
from __future__ import annotations

from typing import Optional

from rest_framework.permissions import BasePermission, SAFE_METHODS
from rest_framework.exceptions import ValidationError


def _get_copro_id_from_request(request) -> Optional[int]:
    copro_id = request.headers.get("X-Copropriete-Id")
    if not copro_id:
        return None
    try:
        return int(str(copro_id))
    except ValueError:
        raise ValidationError({"detail": "X-Copropriete-Id invalide (entier requis)."})  # 400 propre


def _is_syndic_or_admin(user) -> bool:
    if not user or not getattr(user, "is_authenticated", False):
        return False

    # admin Django
    if getattr(user, "is_superuser", False) or getattr(user, "is_staff", False):
        return True

    # rôle custom (plusieurs variantes possibles)
    role = getattr(user, "role", None) or getattr(user, "type", None) or getattr(user, "profil", None)
    if isinstance(role, str) and role.upper() in {"SYNDIC", "ADMIN"}:
        return True

    # bool custom
    if getattr(user, "is_syndic", False) is True:
        return True

    return False


class IsSyndicOrAdmin(BasePermission):
    """
    Permission "forte" pour actions sensibles.
    """
    message = "Accès réservé au syndic ou administrateur."

    def has_permission(self, request, view) -> bool:
        return _is_syndic_or_admin(getattr(request, "user", None))


class TravauxWritePermission(BasePermission):
    """
    - Lecture: tout utilisateur authentifié
    - Écriture CRUD: syndic/admin uniquement
    - Actions sensibles (link/relink/unlink/validate/start/finish/archive): syndic/admin uniquement
    """

    def has_permission(self, request, view) -> bool:
        user = getattr(request, "user", None)
        if not user or not getattr(user, "is_authenticated", False):
            return False

        # GET/HEAD/OPTIONS => OK
        if request.method in SAFE_METHODS:
            return True

        # Certaines actions peuvent être tolérées aux users (ex: create brouillon) => ici: NON (prod strict)
        return _is_syndic_or_admin(user)


class TravauxObjectCoproPermission(BasePermission):
    """
    Vérifie que l'objet (Fournisseur/Dossier) appartient à la copro du header.
    Utile en complément de get_queryset().

    Comportement:
    - Si pas de header copro -> refus (400 clair)
    - Si mismatch -> refus (403/400). Ici: 403 logique permission.
    """
    message = "Ressource hors périmètre de la copropriété courante."

    def has_object_permission(self, request, view, obj) -> bool:
        copro_id = _get_copro_id_from_request(request)
        if copro_id is None:
            raise ValidationError({"detail": "En-tête X-Copropriete-Id requis."})

        obj_copro_id = getattr(obj, "copropriete_id", None)
        if obj_copro_id is None:
            # si obj n'a pas copropriete_id, on laisse passer (rare)
            return True

        return int(obj_copro_id) == int(copro_id)