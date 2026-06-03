"""Celery tasks for asynchronous CSV processing.

When Celery is configured with CELERY_TASK_ALWAYS_EAGER=True (DEBUG mode),
these run synchronously inside the request, which keeps local development simple.
"""

from __future__ import annotations

from celery import shared_task
from django.db import transaction

from apps.channels.models import Video
from apps.analytics.models import ChannelDailyMetric, CompetitorDailyMetric, VideoDailyMetric
from apps.comments.models import Comment

from .models import ImportJob
from .parsers import CsvParseError, parse_csv


@shared_task
def process_import_job(job_id: int) -> None:
    try:
        job = ImportJob.objects.get(pk=job_id)
    except ImportJob.DoesNotExist:
        return

    job.status = ImportJob.STATUS_RUNNING
    job.save(update_fields=["status", "updated_at"])

    handlers = {
        ImportJob.SOURCE_VIDEO: _import_videos,
        ImportJob.SOURCE_VIDEO_DAILY: _import_video_daily,
        ImportJob.SOURCE_CHANNEL_DAILY: _import_channel_daily,
        ImportJob.SOURCE_COMPETITOR_DAILY: _import_competitor_daily,
        ImportJob.SOURCE_COMMENTS: _import_comments,
    }
    handler = handlers.get(job.source_type)
    if handler is None:
        job.status = ImportJob.STATUS_FAILED
        job.error_message = f"未対応のソース種別です: {job.source_type}"
        job.save(update_fields=["status", "error_message", "updated_at"])
        return

    try:
        with transaction.atomic():
            total, imported, skipped = handler(job)
        job.rows_total = total
        job.rows_imported = imported
        job.rows_skipped = skipped
        job.status = ImportJob.STATUS_DONE
        job.save(update_fields=["rows_total", "rows_imported", "rows_skipped", "status", "updated_at"])
    except CsvParseError as exc:
        job.status = ImportJob.STATUS_FAILED
        job.error_message = str(exc)
        job.save(update_fields=["status", "error_message", "updated_at"])
    except Exception as exc:  # noqa: BLE001 - record for the user
        job.status = ImportJob.STATUS_FAILED
        job.error_message = f"{type(exc).__name__}: {exc}"
        job.save(update_fields=["status", "error_message", "updated_at"])


def _import_videos(job: ImportJob) -> tuple[int, int, int]:
    if job.channel is None:
        raise CsvParseError("動画CSVのインポートにはチャンネル指定が必要です。")
    total = imported = skipped = 0
    with job.file.open("rb") as fh:
        for row in parse_csv(fh):
            total += 1
            yt_id = (row.normalized.get("video_id") or "").strip()
            title = row.normalized.get("title") or ""
            if not yt_id:
                skipped += 1
                continue
            Video.objects.update_or_create(
                channel=job.channel,
                youtube_video_id=yt_id,
                defaults={
                    "title": title or yt_id,
                    "published_at": row.normalized.get("published_at"),
                },
            )
            imported += 1
    return total, imported, skipped


def _import_video_daily(job: ImportJob) -> tuple[int, int, int]:
    if job.channel is None:
        raise CsvParseError("動画日次CSVのインポートにはチャンネル指定が必要です。")
    total = imported = skipped = 0
    with job.file.open("rb") as fh:
        for row in parse_csv(fh):
            total += 1
            yt_id = (row.normalized.get("video_id") or "").strip()
            d = row.normalized.get("date")
            if not yt_id or d is None:
                skipped += 1
                continue
            video, _ = Video.objects.get_or_create(
                channel=job.channel,
                youtube_video_id=yt_id,
                defaults={"title": row.normalized.get("title") or yt_id},
            )
            VideoDailyMetric.objects.update_or_create(
                video=video,
                date=d,
                defaults={
                    "views": row.normalized.get("views", 0),
                    "watch_time_minutes": row.normalized.get("watch_time_minutes", 0),
                    "impressions": row.normalized.get("impressions", 0),
                    "click_through_rate": row.normalized.get("click_through_rate", 0),
                    "likes": row.normalized.get("likes", 0),
                    "comments": row.normalized.get("comments", 0),
                    "shares": row.normalized.get("shares", 0),
                    "subscribers_gained": row.normalized.get("subscribers_gained", 0),
                    "subscribers_lost": row.normalized.get("subscribers_lost", 0),
                    "estimated_revenue_usd": row.normalized.get("estimated_revenue", 0),
                    "average_view_duration_seconds": row.normalized.get("average_view_duration_seconds", 0),
                },
            )
            imported += 1
    return total, imported, skipped


def _import_comments(job: ImportJob) -> tuple[int, int, int]:
    if job.channel is None:
        raise CsvParseError("コメントCSVのインポートにはチャンネル指定が必要です。")
    total = imported = skipped = 0
    with job.file.open("rb") as fh:
        for row in parse_csv(fh):
            total += 1
            yt_video_id = (row.normalized.get("video_id") or "").strip()
            text = (row.normalized.get("text") or "").strip()
            author = (row.normalized.get("author_name") or "").strip()
            if not yt_video_id or not text:
                skipped += 1
                continue
            video, _ = Video.objects.get_or_create(
                channel=job.channel,
                youtube_video_id=yt_video_id,
                defaults={"title": row.normalized.get("title") or yt_video_id},
            )
            yt_comment_id = (row.normalized.get("comment_id") or "").strip()
            defaults = {
                "tenant": job.tenant,
                "author_name": author or "(unknown)",
                "text": text,
                "published_at": row.normalized.get("published_at"),
                "likes": row.normalized.get("likes", 0),
            }
            if yt_comment_id:
                Comment.objects.update_or_create(
                    video=video,
                    youtube_comment_id=yt_comment_id,
                    defaults=defaults,
                )
            else:
                Comment.objects.create(video=video, **defaults)
            imported += 1
    return total, imported, skipped


def _import_competitor_daily(job: ImportJob) -> tuple[int, int, int]:
    if job.competitor is None:
        raise CsvParseError("競合日次CSVのインポートには競合チャンネル指定が必要です。")
    total = imported = skipped = 0
    with job.file.open("rb") as fh:
        for row in parse_csv(fh):
            total += 1
            d = row.normalized.get("date")
            if d is None:
                skipped += 1
                continue
            CompetitorDailyMetric.objects.update_or_create(
                competitor=job.competitor,
                date=d,
                defaults={
                    "subscribers_total": row.normalized.get("subscribers_total", 0),
                    "videos_total": row.normalized.get("videos_total", 0),
                    "views_total": row.normalized.get("views_total", 0),
                },
            )
            imported += 1
    return total, imported, skipped


def _import_channel_daily(job: ImportJob) -> tuple[int, int, int]:
    if job.channel is None:
        raise CsvParseError("チャンネル日次CSVのインポートにはチャンネル指定が必要です。")
    total = imported = skipped = 0
    with job.file.open("rb") as fh:
        for row in parse_csv(fh):
            total += 1
            d = row.normalized.get("date")
            if d is None:
                skipped += 1
                continue
            ChannelDailyMetric.objects.update_or_create(
                channel=job.channel,
                date=d,
                defaults={
                    "subscribers_total": row.normalized.get("subscribers_total", 0),
                    "subscribers_gained": row.normalized.get("subscribers_gained", 0),
                    "subscribers_lost": row.normalized.get("subscribers_lost", 0),
                    "views": row.normalized.get("views", 0),
                    "watch_time_minutes": row.normalized.get("watch_time_minutes", 0),
                    "impressions": row.normalized.get("impressions", 0),
                    "estimated_revenue_usd": row.normalized.get("estimated_revenue", 0),
                },
            )
            imported += 1
    return total, imported, skipped
