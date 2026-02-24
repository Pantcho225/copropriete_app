from rest_framework.routers import DefaultRouter
from .views import LotViewSet, TantiemeCategorieViewSet, LotTantiemeViewSet

router = DefaultRouter()
router.register("lots", LotViewSet, basename="lots")
router.register("tantieme-categories", TantiemeCategorieViewSet, basename="tantieme-categories")
router.register("lot-tantiemes", LotTantiemeViewSet, basename="lot-tantiemes")

urlpatterns = router.urls