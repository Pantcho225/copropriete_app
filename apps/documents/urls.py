# apps/documents/urls.py
from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    CoproprietaireGenerateAgMandatAPIView,
    CoproprietaireGeneratedDocumentsAPIView,
    CoproprietaireReglementTexteApplicableViewSet,
    GenerateAgMandatAPIView,
    GenerateRelanceLetterAPIView,
    GeneratedDocumentViewSet,
    ReglementTexteApplicableViewSet,
)
from .views_coproprietaire import (
    CoproprietaireDocumentsAPIView,
    CoproprietaireMasquerDocumentAPIView,
    CoproprietaireRestaurerDocumentAPIView,
)

app_name = "documents"

router = DefaultRouter()

# Registre documentaire généré admin/syndic
router.register(
    r"generated",
    GeneratedDocumentViewSet,
    basename="generated-document",
)

# Règlements / textes applicables côté admin-syndic
router.register(
    r"reglement-textes",
    ReglementTexteApplicableViewSet,
    basename="reglement-texte-applicable",
)

# Règlements / textes applicables côté copropriétaire
router.register(
    r"coproprietaire/reglement-textes",
    CoproprietaireReglementTexteApplicableViewSet,
    basename="coproprietaire-reglement-texte-applicable",
)

urlpatterns = [
    # Documents visibles côté copropriétaire
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

    # Mandat AG généré depuis l’espace copropriétaire
    path(
        "coproprietaire/ag/<int:ag_id>/mandat/",
        CoproprietaireGenerateAgMandatAPIView.as_view(),
        name="coproprietaire-generate-ag-mandat",
    ),

    # Génération documentaire admin/syndic
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

    # Routes ViewSets DRF
    path("", include(router.urls)),
]