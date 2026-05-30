# apps/lots/urls.py
from __future__ import annotations

from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import LotTantiemeViewSet, LotViewSet, TantiemeCategorieViewSet


app_name = "lots"

router = DefaultRouter()

# Lots
router.register(r"lots", LotViewSet, basename="lots")

# Catégories de tantièmes
router.register(
    r"tantieme-categories",
    TantiemeCategorieViewSet,
    basename="tantieme-categories",
)

# Route historique conservée pour compatibilité
router.register(
    r"lot-tantiemes",
    LotTantiemeViewSet,
    basename="lot-tantiemes",
)

# Route alias plus simple pour React / Super Admin
router.register(
    r"tantiemes",
    LotTantiemeViewSet,
    basename="tantiemes",
)

urlpatterns = [
    path("", include(router.urls)),
]