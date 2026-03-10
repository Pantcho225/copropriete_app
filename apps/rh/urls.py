# apps/rh/urls.py
from rest_framework.routers import DefaultRouter

from .views import ContratEmployeViewSet, EmployeViewSet

router = DefaultRouter()
router.register(r"employes", EmployeViewSet, basename="rh-employe")
router.register(r"contrats", ContratEmployeViewSet, basename="rh-contrat")

urlpatterns = router.urls