# apps/core/middleware.py
from __future__ import annotations

from django.http import JsonResponse


class CoproContextMiddleware:
    """
    Middleware de contexte copropriété.

    Rôle :
    - imposer X-Copropriete-Id sur les modules métier qui travaillent
      dans une copropriété active ;
    - laisser passer les routes publiques ;
    - laisser passer les routes Plateforme / Super Admin qui servent à
      créer ou préparer une copropriété avant qu'elle ne soit active ;
    - laisser passer les routes de l'espace copropriétaire, car elles doivent
      déduire la copropriété depuis request.user et non depuis un header modifiable.

    Important :
    La sécurité utilisateur ne doit pas dépendre uniquement de ce middleware.
    Les ViewSets doivent continuer à utiliser leurs permissions DRF :
    IsAuthenticated, rôles Super Admin, Admin copropriété, Syndic, etc.
    """

    EXEMPT_PREFIXES = (
        "/api/auth/",

        # Routes publiques
        "/api/billing/public/",
        "/api/public/",

        # Espace copropriétaire
        # Ces routes doivent utiliser request.user pour retrouver les données.
        "/api/owners/coproprietaire/",
        "/api/billing/coproprietaire/",
        "/api/relances/coproprietaire/",
        "/api/documents/coproprietaire/",
        "/api/ag/coproprietaire/",

        # Django / fichiers / documentation
        "/admin/",
        "/static/",
        "/media/",
        "/health/",
        "/api/schema/",
        "/api/docs/",
        "/api/redoc/",
    )

    PLATFORM_PREFIXES = (
        # Plateforme / Super Admin / Référentiel
        # Ici X-Copropriete-Id est optionnel :
        # si présent, on le valide et on l'attache.
        "/api/core/coproprietes/",
        "/api/core/mes-coproprietes/",
        "/api/owners/coproprietaires/",
        "/api/lots/",
        "/api/tantieme-categories/",
        "/api/lot-tantiemes/",
        "/api/tantiemes/",
    )

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        path = request.path or "/"

        if request.method == "OPTIONS":
            return self.get_response(request)

        if not path.startswith("/api/"):
            return self.get_response(request)

        if self._matches_prefix(path, self.EXEMPT_PREFIXES):
            return self.get_response(request)

        if self._matches_prefix(path, self.PLATFORM_PREFIXES):
            copro_id = self._extract_copro_id(request)

            if copro_id:
                if not copro_id.isdigit():
                    return JsonResponse(
                        {
                            "detail": (
                                "En-tête X-Copropriete-Id invalide "
                                "(doit être un entier)."
                            )
                        },
                        status=400,
                    )

                request.copropriete_id = copro_id

            return self.get_response(request)

        copro_id = self._extract_copro_id(request)

        if copro_id is None:
            return JsonResponse(
                {"detail": "En-tête X-Copropriete-Id requis."},
                status=400,
            )

        if not copro_id:
            return JsonResponse(
                {"detail": "En-tête X-Copropriete-Id requis."},
                status=400,
            )

        if not copro_id.isdigit():
            return JsonResponse(
                {
                    "detail": (
                        "En-tête X-Copropriete-Id invalide "
                        "(doit être un entier)."
                    )
                },
                status=400,
            )

        request.copropriete_id = copro_id

        return self.get_response(request)

    @staticmethod
    def _matches_prefix(path: str, prefixes: tuple[str, ...]) -> bool:
        return any(path.startswith(prefix) for prefix in prefixes)

    @staticmethod
    def _extract_copro_id(request) -> str | None:
        copro_id = (
            request.headers.get("X-Copropriete-Id")
            or request.META.get("HTTP_X_COPROPRIETE_ID")
        )

        if copro_id is None:
            return None

        return str(copro_id).strip()