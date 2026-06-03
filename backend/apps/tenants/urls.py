from django.urls import path

from .views import CurrentTenantView

urlpatterns = [
    path("me/", CurrentTenantView.as_view(), name="tenant-me"),
]
