# apps/documents/urls.py
from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    CoproprietaireGenerateAgMandatAPIView,
    CoproprietaireGeneratedDocumentsAPIView,
    GenerateAgMandatAPIView,
    GenerateRelanceLetterAPIView,
    GeneratedDocumentViewSet,
)
from .views_coproprietaire import (
    CoproprietaireDocumentsAPIView,
    CoproprietaireMasquerDocumentAPIView,
    CoproprietaireRestaurerDocumentAPIView,
)

app_name = "documents"

router = DefaultRouter()
router.register(r"generated", GeneratedDocumentViewSet, basename="generated-document")

urlpatterns = [
    path(
        "coproprietaire/documents/",
        CoproprietaireDocumentsAPIView.as_view(),
        name="coproprietaire-documents",
    ),
    path(
        "coproprietaire/generated/",
        CoproprietaireGeneratedDocumentsAPIView.as_view(),
        name="coproprietaire-generated-documents",
    ),
    path(
        "coproprietaire/documents/masquer/",
        CoproprietaireMasquerDocumentAPIView.as_view(),
        name="coproprietaire-documents-masquer",
    ),
    path(
        "coproprietaire/documents/restaurer/",
        CoproprietaireRestaurerDocumentAPIView.as_view(),
        name="coproprietaire-documents-restaurer",
    ),
    path(
        "coproprietaire/ag/<int:ag_id>/mandat/",
        CoproprietaireGenerateAgMandatAPIView.as_view(),
        name="coproprietaire-generate-ag-mandat",
    ),
    path(
        "generate/relance/<int:dossier_id>/",
        GenerateRelanceLetterAPIView.as_view(),
        name="generate-relance-letter",
    ),
    path(
        "generate/ag/<int:ag_id>/mandat/",
        GenerateAgMandatAPIView.as_view(),
        name="generate-ag-mandat",
    ),
    path("", include(router.urls)),
]