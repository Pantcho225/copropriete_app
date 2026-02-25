# apps/ag/permissions.py
from rest_framework.permissions import BasePermission


class IsSyndicOrAdmin(BasePermission):
    """
    Autorise uniquement:
    - superuser
    - staff
    - ou users ayant un rôle 'ADMIN' / 'SYNDIC' (selon ton modèle User)

    Supporte:
    - user.role = "SYNDIC"/"ADMIN"
    - user.roles = iterable de strings
    - user.roles = ManyToMany/RelatedManager (Role avec champ code/name)
    - user.is_syndic / user.is_admin
    """
    message = "Accès réservé au syndic / administrateur."

    ALLOWED = {"SYNDIC", "ADMIN"}

    def has_permission(self, request, view):
        user = getattr(request, "user", None)
        if not user or not getattr(user, "is_authenticated", False):
            return False

        # ✅ Django admin flags
        if getattr(user, "is_superuser", False) or getattr(user, "is_staff", False):
            return True

        # ✅ Rôle simple: user.role
        role = getattr(user, "role", None)
        if isinstance(role, str) and role.upper() in self.ALLOWED:
            return True

        # ✅ Booléens directs
        if getattr(user, "is_syndic", False) or getattr(user, "is_admin", False):
            return True

        # ✅ Variante: user.roles (liste / queryset / many-to-many)
        roles = getattr(user, "roles", None)
        if not roles:
            return False

        # ManyToMany/Manager -> roles.all()
        if hasattr(roles, "all"):
            qs = roles.all()
            # essaie d'abord champ 'code' puis 'name' puis fallback str(obj)
            for attr in ("code", "name", "libelle", "slug"):
                try:
                    values = list(qs.values_list(attr, flat=True))
                    if any((v or "").upper() in self.ALLOWED for v in values):
                        return True
                except Exception:
                    pass
            # fallback: stringification
            for obj in qs:
                if str(obj).upper() in self.ALLOWED:
                    return True
            return False

        # Iterable simple (liste/tuple/set)
        try:
            for r in roles:
                if isinstance(r, str) and r.upper() in self.ALLOWED:
                    return True
                # si r est un objet Role
                for attr in ("code", "name", "libelle", "slug"):
                    v = getattr(r, attr, None)
                    if isinstance(v, str) and v.upper() in self.ALLOWED:
                        return True
                if str(r).upper() in self.ALLOWED:
                    return True
        except TypeError:
            return False

        return False