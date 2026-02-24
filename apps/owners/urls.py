from rest_framework.routers import DefaultRouter
from .views import CoproprietaireViewSet, ProprietaireLotViewSet

router = DefaultRouter()
router.register("coproprietaires", CoproprietaireViewSet)
router.register("proprietaires-lots", ProprietaireLotViewSet)

urlpatterns = router.urls