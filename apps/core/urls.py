# apps/core/urls.py  (ou l'app concernée)

from django.urls import path
from .views import MesCoproprietesAPIView

app_name = "core"

urlpatterns = [
    path("coproprietes/", MesCoproprietesAPIView.as_view(), name="mes-coproprietes"),
]