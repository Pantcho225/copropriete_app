# apps/billing/urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import RelanceLotViewSet, AppelDeFondsViewSet, PaiementAppelViewSet
from .dashboard import BillingDashboardAPIView
from .public_views import PublicRelanceVerifyAPIView

app_name = "billing"  # ✅ utile pour reverse() / namespaces

router = DefaultRouter()
router.register(r"relances", RelanceLotViewSet, basename="relance")
router.register(r"appels", AppelDeFondsViewSet, basename="appel")
router.register(r"paiements", PaiementAppelViewSet, basename="paiement")

urlpatterns = [
    # ✅ Routes "non-router" d'abord (plus sûr)
    path("dashboard/", BillingDashboardAPIView.as_view(), name="billing-dashboard"),

    # ✅ ROUTE PUBLIQUE QR (exemptée par le middleware)
    path(
        "public/relances/<int:pk>/verify/",
        PublicRelanceVerifyAPIView.as_view(),
        name="public-relance-verify",
    ),

    # ✅ Routes DRF (ViewSets)
    path("", include(router.urls)),
]