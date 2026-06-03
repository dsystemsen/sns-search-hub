from rest_framework import status
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.channels.models import Channel, Competitor, Video

from .client import YouTubeAPIError, YouTubeNotConfigured
from .services import sync_channel, sync_competitor, sync_video_comments


def _require_tenant(request):
    if not request.tenant:
        raise PermissionDenied("テナント情報がありません。")
    return request.tenant


def _handle_api_errors(fn):
    try:
        return fn()
    except YouTubeNotConfigured as exc:
        return Response({"detail": str(exc), "code": "not_configured"}, status=503)
    except YouTubeAPIError as exc:
        return Response({"detail": str(exc), "code": "api_error"}, status=502)


class ConfigStatusView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from django.conf import settings

        configured = bool(getattr(settings, "YOUTUBE_API_KEY", ""))
        return Response({"configured": configured})


class SyncCompetitorView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, competitor_id: int):
        tenant = _require_tenant(request)
        try:
            competitor = Competitor.objects.get(pk=competitor_id, tenant=tenant)
        except Competitor.DoesNotExist as exc:
            raise PermissionDenied("競合チャンネルが見つかりません。") from exc

        def _run():
            metric = sync_competitor(competitor)
            return Response(
                {
                    "competitor_id": competitor.id,
                    "name": competitor.name,
                    "synced_at": metric.date.isoformat(),
                    "subscribers": metric.subscribers_total,
                    "videos": metric.videos_total,
                    "views": metric.views_total,
                },
                status=status.HTTP_200_OK,
            )

        return _handle_api_errors(_run)


class SyncChannelView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, channel_id: int):
        tenant = _require_tenant(request)
        try:
            channel = Channel.objects.get(pk=channel_id, tenant=tenant)
        except Channel.DoesNotExist as exc:
            raise PermissionDenied("チャンネルが見つかりません。") from exc

        def _run():
            stats = sync_channel(channel)
            return Response(stats)

        return _handle_api_errors(_run)


class SyncVideoCommentsView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, video_id: int):
        tenant = _require_tenant(request)
        try:
            video = Video.objects.select_related("channel").get(
                pk=video_id, channel__tenant=tenant
            )
        except Video.DoesNotExist as exc:
            raise PermissionDenied("動画が見つかりません。") from exc
        if not video.youtube_video_id:
            return Response(
                {"detail": "YouTube Video ID が設定されていません。"}, status=400
            )

        max_results = int(request.data.get("max_results", 100))

        def _run():
            result = sync_video_comments(video, max_results=max_results)
            return Response(result)

        return _handle_api_errors(_run)
