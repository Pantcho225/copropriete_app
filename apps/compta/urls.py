# apps/compta/urls.py
from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    CompteBancaireViewSet,
    MouvementBancaireViewSet,
    ReleveImportViewSet,
    ReleveLigneViewSet,
    RapprochementBancaireViewSet,
)

app_name = "compta"

router = DefaultRouter()
router.register(r"comptes", CompteBancaireViewSet, basename="compta-compte")
router.register(r"mouvements", MouvementBancaireViewSet, basename="compta-mouvement")
router.register(r"releves/imports", ReleveImportViewSet, basename="compta-releve-import")
router.register(r"releves/lignes", ReleveLigneViewSet, basename="compta-releve-ligne")

# ✅ Phase 5 — audit rapprochements
router.register(r"rapprochements", RapprochementBancaireViewSet, basename="compta-rapprochement")

urlpatterns = [
    path("", include(router.urls)),
]