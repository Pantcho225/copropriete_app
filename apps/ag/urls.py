# apps/ag/urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import (
    AssembleeGeneraleViewSet,
    PresenceLotViewSet,
    ResolutionViewSet,
    VoteViewSet,
)

app_name = "ag"

router = DefaultRouter()

# =========================
# Assemblées Générales
# =========================
router.register(r"ags", AssembleeGeneraleViewSet, basename="ag")

# =========================
# Présences
# =========================
router.register(r"presences", PresenceLotViewSet, basename="presence")

# =========================
# Résolutions
# =========================
router.register(r"resolutions", ResolutionViewSet, basename="resolution")

# =========================
# Votes
# =========================
router.register(r"votes", VoteViewSet, basename="vote")

urlpatterns = [
    path("", include(router.urls)),
]