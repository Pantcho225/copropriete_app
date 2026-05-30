# apps/documents/urls.py
from django.urls import path

from .views_coproprietaire import (
    CoproprietaireDocumentsAPIView,
    CoproprietaireMasquerDocumentAPIView,
    CoproprietaireRestaurerDocumentAPIView,
)

app_name = "documents"

urlpatterns = [
    path(
        "coproprietaire/documents/",
        CoproprietaireDocumentsAPIView.as_view(),
        name="coproprietaire-documents",
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
]