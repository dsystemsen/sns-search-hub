from django.urls import path

from .views import (
    AutoTagCommentsView,
    ConfigStatusView,
    DraftReplyView,
    SuggestTitlesView,
    SummarizeCommentsView,
)

urlpatterns = [
    path("config/", ConfigStatusView.as_view(), name="ai-config"),
    path("comments/summary/", SummarizeCommentsView.as_view(), name="ai-summarize-comments"),
    path("comments/auto-tag/", AutoTagCommentsView.as_view(), name="ai-auto-tag"),
    path("comments/<int:comment_id>/draft-reply/", DraftReplyView.as_view(), name="ai-draft-reply"),
    path("titles/", SuggestTitlesView.as_view(), name="ai-suggest-titles"),
]
