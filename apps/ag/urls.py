# apps/ag/urls.py
from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .coproprietaire_views import (
    CoproprietaireAssembleesAPIView,
    CoproprietairePresenceAPIView,
    CoproprietaireProcurationAnnulerAPIView,
    CoproprietaireProcurationsAPIView,
    CoproprietaireVoteAPIView,
)
from .views import (
    AGProcurationViewSet,
    AgConvocationViewSet,
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
# Procurations AG
# =========================
router.register(r"procurations", AGProcurationViewSet, basename="ag-procuration")

# =========================
# Convocations AG
# =========================
router.register(r"convocations", AgConvocationViewSet, basename="ag-convocation")

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
    path(
        "coproprietaire/procurations/",
        CoproprietaireProcurationsAPIView.as_view(),
        name="coproprietaire-procurations",
    ),
    path(
        "coproprietaire/procurations/<int:procuration_id>/annuler/",
        CoproprietaireProcurationAnnulerAPIView.as_view(),
        name="coproprietaire-procuration-annuler",
    ),
    path(
        "coproprietaire/resolutions/<int:resolution_id>/vote/",
        CoproprietaireVoteAPIView.as_view(),
        name="coproprietaire-resolution-vote",
    ),
]