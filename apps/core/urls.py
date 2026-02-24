from django.urls import path
from .views import MesCoproprietesAPIView

urlpatterns = [
    path("coproprietes/", MesCoproprietesAPIView.as_view(), name="mes-coproprietes"),
]