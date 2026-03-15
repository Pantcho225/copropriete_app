from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

urlpatterns = [
    path("admin/", admin.site.urls),

    path("api/auth/login/", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("api/auth/refresh/", TokenRefreshView.as_view(), name="token_refresh"),

    path("api/", include("apps.core.urls")),
    path("api/", include("apps.owners.urls")),
    path("api/", include("apps.lots.urls")),
    path("api/billing/", include("apps.billing.urls")),
    path("api/ag/", include("apps.ag.urls")),
    path("api/travaux/", include("apps.travaux.urls")),
    path("api/compta/", include("apps.compta.urls")),
    path("api/rh/", include("apps.rh.urls")),
    path("api/relances/", include("apps.relances.urls")),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)