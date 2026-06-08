# apps/billing/urls.py
from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .dashboard import BillingDashboardAPIView
from .public_views import (
    PublicRelanceVerifyAPIView,
    PublicRelanceVerifyByTokenAPIView,
)
from .views import (
    AppelDeFondsViewSet,
    CoproprietaireSituationFinanciereAPIView,
    PaiementAppelViewSet,
    RelanceLotViewSet,
)
from .views_coproprietaire import (
    CoproprietaireAppelsAPIView,
    CoproprietairePaiementsAPIView,
)

app_name = "billing"

router = DefaultRouter()
router.register(r"relances", RelanceLotViewSet, basename="relance")
router.register(r"appels", AppelDeFondsViewSet, basename="appel")
router.register(r"paiements", PaiementAppelViewSet, basename="paiement")

urlpatterns = [
    # Espace copropriétaire — appels de charges
    path(
        "coproprietaire/appels/",
        CoproprietaireAppelsAPIView.as_view(),
        name="coproprietaire-appels",
    ),

    # Espace copropriétaire — paiements
    path(
        "coproprietaire/paiements/",
        CoproprietairePaiementsAPIView.as_view(),
        name="coproprietaire-paiements",
    ),

    # Espace copropriétaire — situation financière globale de la copropriété
    path(
        "coproprietaire/situation-financiere/",
        CoproprietaireSituationFinanciereAPIView.as_view(),
        name="coproprietaire-situation-financiere",
    ),

    # Dashboard facturation admin/syndic
    path(
        "dashboard/",
        BillingDashboardAPIView.as_view(),
        name="billing-dashboard",
    ),

    # Route publique par PK
    path(
        "public/relances/<int:pk>/verify/",
        PublicRelanceVerifyAPIView.as_view(),
        name="public-relance-verify",
    ),

    # Route publique par QR token UUID
    path(
        "public/qr/<uuid:token>/",
        PublicRelanceVerifyByTokenAPIView.as_view(),
        name="public-relance-verify-by-token",
    ),

    # Routes ViewSet DRF
    path("", include(router.urls)),
]