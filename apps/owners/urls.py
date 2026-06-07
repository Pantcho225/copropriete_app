# apps/owners/urls.py
from __future__ import annotations

from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    CoproprietaireMesLotsAPIView,
    CoproprietaireViewSet,
    LotOccupantViewSet,
    ProprietaireLotViewSet,
)

router = DefaultRouter()
router.register(
    r"coproprietaires",
    CoproprietaireViewSet,
    basename="coproprietaire",
)
router.register(
    r"proprietaires-lots",
    ProprietaireLotViewSet,
    basename="proprietaire-lot",
)
router.register(
    r"occupants-lots",
    LotOccupantViewSet,
    basename="occupant-lot",
)

urlpatterns = [
    path(
        "coproprietaire/mes-lots/",
        CoproprietaireMesLotsAPIView.as_view(),
        name="coproprietaire-mes-lots",
    ),
    path("", include(router.urls)),
]