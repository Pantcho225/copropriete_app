# apps/ag/urls.py
from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .coproprietaire_views import (
    CoproprietaireAssembleesAPIView,
    CoproprietairePresenceAPIView,
)
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
    path(
        "coproprietaire/assemblees/",
        CoproprietaireAssembleesAPIView.as_view(),
        name="coproprietaire-assemblees",
    ),
    path(
        "coproprietaire/assemblees/<int:ag_id>/presence/",
        CoproprietairePresenceAPIView.as_view(),
        name="coproprietaire-assemblee-presence",
    ),
]