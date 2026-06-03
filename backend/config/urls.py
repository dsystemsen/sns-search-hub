from django.contrib import admin
from django.urls import include, path
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)


def health(_request):
    from django.http import JsonResponse
    return JsonResponse({"status": "ok"})


urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/health/", health),
    path("api/auth/token/", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("api/auth/token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("api/accounts/", include("apps.accounts.urls")),
    path("api/tenants/", include("apps.tenants.urls")),
    path("api/channels/", include("apps.channels.urls")),
    path("api/analytics/", include("apps.analytics.urls")),
    path("api/imports/", include("apps.imports.urls")),
    path("api/billing/", include("apps.billing.urls")),
    path("api/content/", include("apps.content.urls")),
    path("api/comments/", include("apps.comments.urls")),
    path("api/youtube/", include("apps.youtube.urls")),
    path("api/ai/", include("apps.ai.urls")),
    path("api/notifications/", include("apps.notifications.urls")),
]
