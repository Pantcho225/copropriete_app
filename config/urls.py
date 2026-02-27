# config/urls.py
from django.contrib import admin
from django.urls import include, path
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

urlpatterns = [
    path("admin/", admin.site.urls),

    # =========================
    # Auth JWT
    # =========================
    path("api/auth/login/", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("api/auth/refresh/", TokenRefreshView.as_view(), name="token_refresh"),

    # =========================
    # Apps API
    # =========================
    path("api/", include("apps.core.urls")),     # ex: /api/coproprietes/
    path("api/", include("apps.owners.urls")),
      path("api/", include("apps.lots.urls")),  # ex: /api/owners/... (selon tes routes)
    path("api/billing/", include("apps.billing.urls")),
    path("api/ag/", include("apps.ag.urls")),
    path("api/travaux/", include("apps.travaux.urls")),
    
]