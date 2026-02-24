# apps/core/middleware.py
from django.http import JsonResponse


class CoproContextMiddleware:
    """
    Middleware qui impose X-Copropriete-Id sur les endpoints API privés,
    mais laisse passer certains endpoints publics (QR verify, auth, etc.).

    ✅ Exemptés (pas de header requis) :
    - /api/auth/ (login/refresh JWT)
    - /api/billing/public/
    - /api/public/
    - /admin/
    - /static/, /media/
    - /health/
    - endpoints docs (schema/swagger/redoc) si activés
    """

    EXEMPT_PREFIXES = (
        "/api/auth/",            # ✅ IMPORTANT: login/refresh ne dépend pas d'une copropriété
        "/api/billing/public/",  # QR verify & endpoints publics billing
        "/api/public/",          # namespace public global (si tu l'utilises)
        "/admin/",
        "/static/",
        "/media/",
        "/health/",
        # Docs / schema (si présents)
        "/api/schema/",
        "/api/docs/",
        "/api/redoc/",
    )

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        path = request.path or "/"

        # ✅ Toujours laisser passer les préflight CORS
        if request.method == "OPTIONS":
            return self.get_response(request)

        # ✅ Bypass routes exemptées
        for prefix in self.EXEMPT_PREFIXES:
            if path.startswith(prefix):
                return self.get_response(request)

        # ✅ ignorer les requêtes non-API
        if not path.startswith("/api/"):
            return self.get_response(request)

        # ✅ header requis pour API privées
        copro_id = (
            request.headers.get("X-Copropriete-Id")
            or request.META.get("HTTP_X_COPROPRIETE_ID")
        )

        if copro_id is None:
            return JsonResponse({"detail": "En-tête X-Copropriete-Id requis."}, status=400)

        copro_id = str(copro_id).strip()
        if not copro_id:
            return JsonResponse({"detail": "En-tête X-Copropriete-Id requis."}, status=400)

        # ✅ validation simple : entier attendu (si UUID chez toi, on adaptera)
        if not copro_id.isdigit():
            return JsonResponse(
                {"detail": "En-tête X-Copropriete-Id invalide (doit être un entier)."},
                status=400,
            )

        # ✅ pratique pour d'autres couches (permissions, queryset, etc.)
        request.copropriete_id = copro_id

        return self.get_response(request)