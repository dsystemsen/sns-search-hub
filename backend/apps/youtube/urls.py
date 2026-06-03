from django.urls import path

from .views import (
    ConfigStatusView,
    SyncChannelView,
    SyncCompetitorView,
    SyncVideoCommentsView,
)

urlpatterns = [
    path("config/", ConfigStatusView.as_view(), name="youtube-config"),
    path(
        "competitors/<int:competitor_id>/sync/",
        SyncCompetitorView.as_view(),
        name="youtube-sync-competitor",
    ),
    path(
        "channels/<int:channel_id>/sync/",
        SyncChannelView.as_view(),
        name="youtube-sync-channel",
    ),
    path(
        "videos/<int:video_id>/sync-comments/",
        SyncVideoCommentsView.as_view(),
        name="youtube-sync-video-comments",
    ),
]
