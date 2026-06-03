from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (
    ChannelDashboardView,
    ChannelDateBreakdownView,
    ChannelTopVideosExportView,
    CompetitorCompareView,
    CompetitorDashboardView,
    CompetitorsExportView,
    ReportViewSet,
)

router = DefaultRouter()
router.register("reports", ReportViewSet, basename="report")

urlpatterns = [
    path("channels/<int:channel_id>/dashboard/", ChannelDashboardView.as_view(), name="channel-dashboard"),
    path(
        "channels/<int:channel_id>/breakdown/",
        ChannelDateBreakdownView.as_view(),
        name="channel-date-breakdown",
    ),
    path("competitors/<int:competitor_id>/dashboard/", CompetitorDashboardView.as_view(), name="competitor-dashboard"),
    path("competitors/compare/", CompetitorCompareView.as_view(), name="competitor-compare"),
    path("channels/<int:channel_id>/videos/export/", ChannelTopVideosExportView.as_view(), name="channel-top-videos-export"),
    path("competitors/export/", CompetitorsExportView.as_view(), name="competitors-export"),
    *router.urls,
]
