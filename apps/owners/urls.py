# apps/owners/urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import CoproprietaireViewSet, ProprietaireLotViewSet


app_name = "owners"

router = DefaultRouter()
router.register(r"coproprietaires", CoproprietaireViewSet, basename="coproprietaires")
router.register(r"proprietaires-lots", ProprietaireLotViewSet, basename="proprietaires-lots")

urlpatterns = [
    path("", include(router.urls)),
]