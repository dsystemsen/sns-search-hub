from datetime import date, timedelta

from django.db.models import F, Sum
from rest_framework import status, viewsets
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.channels.models import Channel, Competitor

from .csv_export import stream_csv
from .models import ChannelDailyMetric, CompetitorDailyMetric, Report, VideoDailyMetric
from .serializers import ReportSerializer
from .tasks import generate_report


def _parse_range(request):
    end_str = request.query_params.get("end")
    start_str = request.query_params.get("start")
    end = date.fromisoformat(end_str) if end_str else date.today()
    start = date.fromisoformat(start_str) if start_str else end - timedelta(days=29)
    return start, end


def _require_tenant_channel(request, channel_id: int) -> Channel:
    if not request.tenant:
        raise PermissionDenied("テナント情報がありません。")
    try:
        return Channel.objects.get(pk=channel_id, tenant=request.tenant)
    except Channel.DoesNotExist as exc:
        raise PermissionDenied("チャンネルが見つかりません。") from exc


class ChannelDashboardView(APIView):
    """KPI summary for a single channel over a date range."""

    def get(self, request, channel_id: int):
        channel = _require_tenant_channel(request, channel_id)
        start, end = _parse_range(request)

        video_agg = VideoDailyMetric.objects.filter(
            video__channel=channel, date__range=(start, end)
        ).aggregate(
            views=Sum("views"),
            watch_time_minutes=Sum("watch_time_minutes"),
            likes=Sum("likes"),
            comments=Sum("comments"),
            shares=Sum("shares"),
            estimated_revenue_usd=Sum("estimated_revenue_usd"),
        )

        # Daily series aggregated across all videos
        daily_qs = (
            VideoDailyMetric.objects.filter(video__channel=channel, date__range=(start, end))
            .values("date")
            .annotate(
                views=Sum("views"),
                watch_time_minutes=Sum("watch_time_minutes"),
                likes=Sum("likes"),
                comments=Sum("comments"),
                shares=Sum("shares"),
            )
            .order_by("date")
        )

        channel_metrics = ChannelDailyMetric.objects.filter(
            channel=channel, date__range=(start, end)
        ).order_by("date")
        subs_gained = sum(m.subscribers_gained for m in channel_metrics)
        subs_lost = sum(m.subscribers_lost for m in channel_metrics)
        latest = channel_metrics.last()
        channel_daily = {m.date: m for m in channel_metrics}

        def _row(d: dict):
            cm = channel_daily.get(d["date"])
            return {
                "date": d["date"].isoformat(),
                "views": d["views"] or 0,
                "watch_time_minutes": float(d["watch_time_minutes"] or 0),
                "likes": d["likes"] or 0,
                "comments": d["comments"] or 0,
                "shares": d["shares"] or 0,
                "subscribers_total": cm.subscribers_total if cm else None,
            }

        # Top videos by views in the period
        top_videos_qs = (
            VideoDailyMetric.objects.filter(video__channel=channel, date__range=(start, end))
            .values("video__id", "video__title", "video__youtube_video_id")
            .annotate(
                views=Sum("views"),
                watch_time_minutes=Sum("watch_time_minutes"),
                likes=Sum("likes"),
                comments=Sum("comments"),
            )
            .order_by("-views")[:10]
        )
        top_videos = [
            {
                "video_id": v["video__id"],
                "title": v["video__title"],
                "youtube_video_id": v["video__youtube_video_id"],
                "views": v["views"] or 0,
                "watch_time_minutes": float(v["watch_time_minutes"] or 0),
                "likes": v["likes"] or 0,
                "comments": v["comments"] or 0,
            }
            for v in top_videos_qs
        ]

        return Response(
            {
                "channel_id": channel.id,
                "channel_name": channel.name,
                "period": {"start": start.isoformat(), "end": end.isoformat()},
                "totals": {k: float(v or 0) for k, v in video_agg.items()},
                "subscribers": {
                    "total": latest.subscribers_total if latest else None,
                    "gained": subs_gained,
                    "lost": subs_lost,
                    "net": subs_gained - subs_lost,
                },
                "daily": [_row(d) for d in daily_qs],
                "top_videos": top_videos,
            }
        )


class ChannelTopVideosExportView(APIView):
    """Export the top-videos table from the dashboard as a CSV."""

    def get(self, request, channel_id: int):
        channel = _require_tenant_channel(request, channel_id)
        start, end = _parse_range(request)
        rows = (
            VideoDailyMetric.objects.filter(
                video__channel=channel, date__range=(start, end)
            )
            .values("video__title", "video__youtube_video_id")
            .annotate(
                views=Sum("views"),
                watch_time_minutes=Sum("watch_time_minutes"),
                likes=Sum("likes"),
                comments=Sum("comments"),
                shares=Sum("shares"),
            )
            .order_by("-views")
        )
        return stream_csv(
            filename=f"videos_{channel.id}_{start}_{end}.csv",
            headers=["順位", "動画タイトル", "Video ID", "再生回数", "視聴時間(分)", "高評価", "コメント", "共有"],
            rows=enumerate(rows, start=1),
            serialize=lambda pair: [
                pair[0],
                pair[1]["video__title"],
                pair[1]["video__youtube_video_id"],
                pair[1]["views"] or 0,
                float(pair[1]["watch_time_minutes"] or 0),
                pair[1]["likes"] or 0,
                pair[1]["comments"] or 0,
                pair[1]["shares"] or 0,
            ],
        )


class CompetitorsExportView(APIView):
    """Export the tenant's competitor list with their latest snapshot."""

    def get(self, request):
        if not request.tenant:
            raise PermissionDenied("テナント情報がありません。")

        def latest_for(c):
            return c.daily_metrics.order_by("-date").first()

        competitors = list(Competitor.objects.filter(tenant=request.tenant))
        snapshots = {c.id: latest_for(c) for c in competitors}

        return stream_csv(
            filename=f"competitors_{date.today()}.csv",
            headers=["名前", "ハンドル", "YouTube Channel ID", "最新登録者数", "最新動画数", "最新累計視聴", "スナップショット日付"],
            rows=competitors,
            serialize=lambda c: [
                c.name,
                c.handle,
                c.youtube_channel_id,
                (snapshots[c.id].subscribers_total if snapshots[c.id] else ""),
                (snapshots[c.id].videos_total if snapshots[c.id] else ""),
                (snapshots[c.id].views_total if snapshots[c.id] else ""),
                (snapshots[c.id].date.isoformat() if snapshots[c.id] else ""),
            ],
        )


class ChannelDateBreakdownView(APIView):
    """Per-video performance for a single day. Used for dashboard drill-down."""

    def get(self, request, channel_id: int):
        channel = _require_tenant_channel(request, channel_id)
        date_str = request.query_params.get("date")
        if not date_str:
            from rest_framework.exceptions import ValidationError

            raise ValidationError("?date=YYYY-MM-DD を指定してください。")
        target_date = date.fromisoformat(date_str)

        rows = (
            VideoDailyMetric.objects.filter(
                video__channel=channel, date=target_date
            )
            .values("video__id", "video__title", "video__youtube_video_id")
            .annotate(
                views=Sum("views"),
                watch_time_minutes=Sum("watch_time_minutes"),
                likes=Sum("likes"),
                comments=Sum("comments"),
                shares=Sum("shares"),
            )
            .order_by("-views")
        )
        return Response(
            {
                "channel_id": channel.id,
                "date": target_date.isoformat(),
                "videos": [
                    {
                        "video_id": r["video__id"],
                        "title": r["video__title"],
                        "youtube_video_id": r["video__youtube_video_id"],
                        "views": r["views"] or 0,
                        "watch_time_minutes": float(r["watch_time_minutes"] or 0),
                        "likes": r["likes"] or 0,
                        "comments": r["comments"] or 0,
                        "shares": r["shares"] or 0,
                    }
                    for r in rows
                ],
            }
        )


class CompetitorDashboardView(APIView):
    """Time series for one competitor over a date range."""

    def get(self, request, competitor_id: int):
        if not request.tenant:
            raise PermissionDenied("テナント情報がありません。")
        try:
            competitor = Competitor.objects.get(pk=competitor_id, tenant=request.tenant)
        except Competitor.DoesNotExist as exc:
            raise PermissionDenied("競合チャンネルが見つかりません。") from exc

        start, end = _parse_range(request)
        metrics = list(
            CompetitorDailyMetric.objects.filter(
                competitor=competitor, date__range=(start, end)
            ).order_by("date")
        )

        # Compute deltas across consecutive snapshots
        daily = []
        prev = None
        for m in metrics:
            sub_delta = (m.subscribers_total - prev.subscribers_total) if prev else 0
            view_delta = (m.views_total - prev.views_total) if prev else 0
            video_delta = (m.videos_total - prev.videos_total) if prev else 0
            daily.append(
                {
                    "date": m.date.isoformat(),
                    "subscribers_total": m.subscribers_total,
                    "videos_total": m.videos_total,
                    "views_total": m.views_total,
                    "subscribers_delta": sub_delta,
                    "views_delta": view_delta,
                    "videos_delta": video_delta,
                }
            )
            prev = m

        latest = metrics[-1] if metrics else None
        first = metrics[0] if metrics else None

        return Response(
            {
                "competitor_id": competitor.id,
                "competitor_name": competitor.name,
                "period": {"start": start.isoformat(), "end": end.isoformat()},
                "latest": {
                    "subscribers_total": latest.subscribers_total if latest else None,
                    "videos_total": latest.videos_total if latest else None,
                    "views_total": latest.views_total if latest else None,
                }
                if latest
                else None,
                "growth": {
                    "subscribers": (latest.subscribers_total - first.subscribers_total)
                    if latest and first
                    else 0,
                    "views": (latest.views_total - first.views_total) if latest and first else 0,
                    "videos": (latest.videos_total - first.videos_total) if latest and first else 0,
                },
                "daily": daily,
            }
        )


class CompetitorCompareView(APIView):
    """Compare subscribers timeline across competitors (+ optional own channel)."""

    def get(self, request):
        if not request.tenant:
            raise PermissionDenied("テナント情報がありません。")
        start, end = _parse_range(request)

        # Own channel subscriber series (optional)
        own_series = []
        own_id = request.query_params.get("channel_id")
        if own_id:
            try:
                channel = Channel.objects.get(pk=int(own_id), tenant=request.tenant)
            except (Channel.DoesNotExist, ValueError):
                channel = None
            if channel:
                own_metrics = ChannelDailyMetric.objects.filter(
                    channel=channel, date__range=(start, end)
                ).order_by("date")
                own_series = [
                    {"date": m.date.isoformat(), "subscribers": m.subscribers_total}
                    for m in own_metrics
                ]

        competitors = list(Competitor.objects.filter(tenant=request.tenant))
        series = []
        for c in competitors:
            metrics = CompetitorDailyMetric.objects.filter(
                competitor=c, date__range=(start, end)
            ).order_by("date")
            series.append(
                {
                    "competitor_id": c.id,
                    "name": c.name,
                    "points": [
                        {"date": m.date.isoformat(), "subscribers": m.subscribers_total}
                        for m in metrics
                    ],
                }
            )

        return Response(
            {
                "period": {"start": start.isoformat(), "end": end.isoformat()},
                "own": {"points": own_series} if own_id else None,
                "competitors": series,
            }
        )


class ReportViewSet(viewsets.ModelViewSet):
    serializer_class = ReportSerializer
    http_method_names = ["get", "post", "delete", "head", "options"]

    def get_queryset(self):
        if not self.request.tenant:
            return Report.objects.none()
        return Report.objects.filter(tenant=self.request.tenant)

    def create(self, request, *args, **kwargs):
        if not request.tenant:
            raise PermissionDenied("テナント情報がありません。")
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        channel_id = serializer.validated_data.get("channel")
        if channel_id:
            _require_tenant_channel(request, channel_id.id if hasattr(channel_id, "id") else channel_id)
        report = serializer.save(tenant=request.tenant, requested_by=request.user)
        generate_report.delay(report.id)
        report.refresh_from_db()
        return Response(self.get_serializer(report).data, status=status.HTTP_201_CREATED)
