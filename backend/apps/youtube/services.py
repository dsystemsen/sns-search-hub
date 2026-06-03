"""High-level synchronization between YouTube Data API and our models."""

from __future__ import annotations

from datetime import datetime, timezone as tz

from django.utils import timezone

from apps.analytics.models import CompetitorDailyMetric
from apps.channels.models import Channel, Competitor, Video
from apps.comments.models import Comment

from .client import YouTubeAPIError, YouTubeClient


def _parse_iso(ts: str | None) -> datetime | None:
    if not ts:
        return None
    try:
        return datetime.fromisoformat(ts.replace("Z", "+00:00"))
    except ValueError:
        return None


def sync_competitor(competitor: Competitor) -> CompetitorDailyMetric:
    """Fetch the competitor's public stats and store a snapshot for today."""
    client = YouTubeClient()
    channel_id = competitor.youtube_channel_id
    if not channel_id and competitor.handle:
        channel_id = client.resolve_handle(competitor.handle)
        competitor.youtube_channel_id = channel_id
    if not channel_id:
        raise YouTubeAPIError("チャンネルIDまたはハンドルを設定してください。")

    stats = client.get_channel_stats(channel_id)
    if competitor.youtube_channel_id != stats["id"]:
        competitor.youtube_channel_id = stats["id"]
    if not competitor.name or competitor.name == competitor.handle:
        competitor.name = stats["title"]
    competitor.save()

    metric, _ = CompetitorDailyMetric.objects.update_or_create(
        competitor=competitor,
        date=timezone.localdate(),
        defaults={
            "subscribers_total": stats["subscriber_count"],
            "videos_total": stats["video_count"],
            "views_total": stats["view_count"],
        },
    )
    return metric


def sync_channel(channel: Channel) -> dict:
    """Fetch the owned channel's public stats (basic metadata only)."""
    client = YouTubeClient()
    channel_id = channel.youtube_channel_id
    if not channel_id and channel.handle:
        channel_id = client.resolve_handle(channel.handle)
        channel.youtube_channel_id = channel_id
    if not channel_id:
        raise YouTubeAPIError("チャンネルIDまたはハンドルを設定してください。")

    stats = client.get_channel_stats(channel_id)
    channel.youtube_channel_id = stats["id"]
    if not channel.thumbnail_url:
        channel.thumbnail_url = stats["thumbnail_url"]
    if not channel.name or channel.name == channel.handle:
        channel.name = stats["title"]
    channel.save()
    return stats


def sync_video_comments(video: Video, max_results: int = 100) -> dict:
    """Fetch top-level comments for one video and upsert them."""
    client = YouTubeClient()
    items = client.list_top_level_comments(video.youtube_video_id, max_results=max_results)
    created = 0
    updated = 0
    for c in items:
        defaults = {
            "tenant": video.channel.tenant,
            "author_name": c["author_name"],
            "text": c["text"],
            "likes": c["like_count"],
            "published_at": _parse_iso(c["published_at"]),
        }
        obj, was_created = Comment.objects.update_or_create(
            video=video,
            youtube_comment_id=c["id"],
            defaults=defaults,
        )
        if was_created:
            created += 1
        else:
            updated += 1
    return {"fetched": len(items), "created": created, "updated": updated}
