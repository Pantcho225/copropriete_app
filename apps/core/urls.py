# apps/core/urls.py
from __future__ import annotations

from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    CoproMembreViewSet,
    CoproprieteViewSet,
    MesCoproprietesAPIView,
)


app_name = "core"

router = DefaultRouter()
router.register(r"coproprietes", CoproprieteViewSet, basename="coproprietes")
router.register(r"membres", CoproMembreViewSet, basename="membres")


urlpatterns = [
    path("", include(router.urls)),

    # Copropriétés accessibles à l'utilisateur connecté
    # Utilisé par le sélecteur de copropriété active côté React.
    path(
        "mes-coproprietes/",
        MesCoproprietesAPIView.as_view(),
        name="mes-coproprietes",
    ),
]