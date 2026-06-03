from django.db import models


class VideoDailyMetric(models.Model):
    video = models.ForeignKey(
        "channels.Video", on_delete=models.CASCADE, related_name="daily_metrics"
    )
    date = models.DateField()
    views = models.PositiveIntegerField(default=0)
    watch_time_minutes = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    average_view_duration_seconds = models.PositiveIntegerField(default=0)
    impressions = models.PositiveIntegerField(default=0)
    click_through_rate = models.DecimalField(max_digits=6, decimal_places=4, default=0)
    likes = models.PositiveIntegerField(default=0)
    comments = models.PositiveIntegerField(default=0)
    shares = models.PositiveIntegerField(default=0)
    subscribers_gained = models.IntegerField(default=0)
    subscribers_lost = models.IntegerField(default=0)
    estimated_revenue_usd = models.DecimalField(max_digits=12, decimal_places=4, default=0)

    class Meta:
        ordering = ["-date"]
        constraints = [
            models.UniqueConstraint(
                fields=["video", "date"], name="uniq_video_metric_per_day"
            ),
        ]
        indexes = [
            models.Index(fields=["video", "date"]),
        ]


class ChannelDailyMetric(models.Model):
    channel = models.ForeignKey(
        "channels.Channel", on_delete=models.CASCADE, related_name="daily_metrics"
    )
    date = models.DateField()
    subscribers_total = models.IntegerField(default=0)
    subscribers_gained = models.IntegerField(default=0)
    subscribers_lost = models.IntegerField(default=0)
    views = models.PositiveIntegerField(default=0)
    watch_time_minutes = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    impressions = models.PositiveIntegerField(default=0)
    estimated_revenue_usd = models.DecimalField(max_digits=12, decimal_places=4, default=0)

    class Meta:
        ordering = ["-date"]
        constraints = [
            models.UniqueConstraint(
                fields=["channel", "date"], name="uniq_channel_metric_per_day"
            ),
        ]
        indexes = [
            models.Index(fields=["channel", "date"]),
        ]


class CompetitorDailyMetric(models.Model):
    """Snapshot of a competitor channel's public stats on a given day.

    Stored as absolute totals (subscribers, videos, lifetime views); daily deltas
    are derived at query time. Sourced from user CSV uploads or, later, the
    YouTube Data API in Phase 4.
    """

    competitor = models.ForeignKey(
        "channels.Competitor", on_delete=models.CASCADE, related_name="daily_metrics"
    )
    date = models.DateField()
    subscribers_total = models.IntegerField(default=0)
    videos_total = models.IntegerField(default=0)
    views_total = models.BigIntegerField(default=0)

    class Meta:
        ordering = ["-date"]
        constraints = [
            models.UniqueConstraint(
                fields=["competitor", "date"], name="uniq_competitor_metric_per_day"
            ),
        ]
        indexes = [
            models.Index(fields=["competitor", "date"]),
        ]


class Report(models.Model):
    STATUS_PENDING = "pending"
    STATUS_RUNNING = "running"
    STATUS_DONE = "done"
    STATUS_FAILED = "failed"
    STATUS_CHOICES = [
        (STATUS_PENDING, "Pending"),
        (STATUS_RUNNING, "Running"),
        (STATUS_DONE, "Done"),
        (STATUS_FAILED, "Failed"),
    ]

    tenant = models.ForeignKey("tenants.Tenant", on_delete=models.CASCADE, related_name="reports")
    channel = models.ForeignKey(
        "channels.Channel", on_delete=models.SET_NULL, null=True, blank=True
    )
    period_start = models.DateField()
    period_end = models.DateField()
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default=STATUS_PENDING)
    file = models.FileField(upload_to="reports/%Y/%m/", null=True, blank=True)
    requested_by = models.ForeignKey(
        "accounts.User", on_delete=models.SET_NULL, null=True, blank=True
    )
    error_message = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
