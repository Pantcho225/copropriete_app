from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    CoproprietaireReunionDocumentViewSet,
    CoproprietaireReunionRencontreViewSet,
    ReunionActionViewSet,
    ReunionDocumentViewSet,
    ReunionParticipantViewSet,
    ReunionRencontreViewSet,
)

app_name = "reunions"

router = DefaultRouter()

router.register(
    r"rencontres",
    ReunionRencontreViewSet,
    basename="reunion-rencontre",
)
router.register(
    r"participants",
    ReunionParticipantViewSet,
    basename="reunion-participant",
)
router.register(
    r"documents",
    ReunionDocumentViewSet,
    basename="reunion-document",
)
router.register(
    r"actions",
    ReunionActionViewSet,
    basename="reunion-action",
)
router.register(
    r"coproprietaire/rencontres",
    CoproprietaireReunionRencontreViewSet,
    basename="coproprietaire-reunion-rencontre",
)
router.register(
    r"coproprietaire/documents",
    CoproprietaireReunionDocumentViewSet,
    basename="coproprietaire-reunion-document",
)

urlpatterns = [
    path("", include(router.urls)),
]
