from rest_framework.routers import DefaultRouter
from django.urls import include, path

from .views import CompteBancaireViewSet, MouvementBancaireViewSet

app_name = "compta"

router = DefaultRouter()
router.register(r"comptes", CompteBancaireViewSet, basename="compta-compte")
router.register(r"mouvements", MouvementBancaireViewSet, basename="compta-mouvement")

urlpatterns = [
    path("", include(router.urls)),
]