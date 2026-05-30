# apps/relances/urls.py
from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import AvisRegularisationViewSet, DossierImpayeViewSet, RelanceViewSet
from .views_coproprietaire import CoproprietaireRelancesAPIView

app_name = "relances"

router = DefaultRouter()
router.register(r"dossiers", DossierImpayeViewSet, basename="dossier-impaye")
router.register(r"relances", RelanceViewSet, basename="relance")
router.register(r"avis", AvisRegularisationViewSet, basename="avis-regularisation")

urlpatterns = [
    path(
        "coproprietaire/relances/",
        CoproprietaireRelancesAPIView.as_view(),
        name="coproprietaire-relances",
    ),
    path("", include(router.urls)),
]