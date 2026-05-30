from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path
from rest_framework_simplejwt.views import TokenRefreshView

from apps.core.auth_views import (
    AuthMeAPIView,
    ChangePasswordAPIView,
    CustomTokenObtainPairView,
)

urlpatterns = [
    path("admin/", admin.site.urls),

    # Auth
    path("api/auth/login/", CustomTokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("api/auth/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("api/auth/change-password/", ChangePasswordAPIView.as_view(), name="change_password"),
    path("api/auth/me/", AuthMeAPIView.as_view(), name="auth_me"),

    # Core / référentiel
    path("api/core/", include("apps.core.urls")),
    path("api/owners/", include("apps.owners.urls")),
    path("api/", include("apps.lots.urls")),

    # Modules métier
    path("api/billing/", include("apps.billing.urls")),
    path("api/ag/", include("apps.ag.urls")),
    path("api/travaux/", include("apps.travaux.urls")),
    path("api/compta/", include("apps.compta.urls")),
    path("api/rh/", include("apps.rh.urls")),
    path("api/relances/", include("apps.relances.urls")),
    path("api/documents/", include("apps.documents.urls")),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)