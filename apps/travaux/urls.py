# apps/travaux/urls.py
from __future__ import annotations

from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import FournisseurViewSet, DossierTravauxViewSet, PaiementTravauxViewSet

app_name = "travaux"

router = DefaultRouter()
router.register(r"fournisseurs", FournisseurViewSet, basename="travaux-fournisseur")
router.register(r"dossiers", DossierTravauxViewSet, basename="travaux-dossier")
router.register(r"paiements", PaiementTravauxViewSet, basename="travaux-paiement")

urlpatterns = [
    path("", include(router.urls)),
]