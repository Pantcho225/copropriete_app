# apps/owners/urls.py
from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import CoproprietaireViewSet, ProprietaireLotViewSet
from .coproprietaire_space_views import CoproprietaireMesLotsAPIView


app_name = "owners"

router = DefaultRouter()
router.register(
    r"coproprietaires",
    CoproprietaireViewSet,
    basename="coproprietaires",
)
router.register(
    "proprietaires-lots",
    ProprietaireLotViewSet,
    basename="proprietaires-lots",
)

urlpatterns = [
    path("", include(router.urls)),
    path(
    "coproprietaire/mes-lots/",
    CoproprietaireMesLotsAPIView.as_view(),
    name="coproprietaire_mes_lots",
),
]