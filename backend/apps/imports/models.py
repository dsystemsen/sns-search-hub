from django.db import models


class ImportJob(models.Model):
    SOURCE_VIDEO = "video"
    SOURCE_CHANNEL = "channel"
    SOURCE_VIDEO_DAILY = "video_daily"
    SOURCE_CHANNEL_DAILY = "channel_daily"
    SOURCE_COMPETITOR_DAILY = "competitor_daily"
    SOURCE_COMMENTS = "comments"
    SOURCE_CHOICES = [
        (SOURCE_VIDEO, "動画一覧（YouTube Studio）"),
        (SOURCE_CHANNEL, "チャンネルサマリー"),
        (SOURCE_VIDEO_DAILY, "動画 × 日次"),
        (SOURCE_CHANNEL_DAILY, "チャンネル × 日次"),
        (SOURCE_COMPETITOR_DAILY, "競合チャンネル × 日次"),
        (SOURCE_COMMENTS, "コメント一覧"),
    ]

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

    tenant = models.ForeignKey("tenants.Tenant", on_delete=models.CASCADE, related_name="import_jobs")
    channel = models.ForeignKey(
        "channels.Channel", on_delete=models.SET_NULL, null=True, blank=True
    )
    competitor = models.ForeignKey(
        "channels.Competitor", on_delete=models.SET_NULL, null=True, blank=True
    )
    source_type = models.CharField(max_length=32, choices=SOURCE_CHOICES)
    file = models.FileField(upload_to="imports/%Y/%m/")
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default=STATUS_PENDING)
    rows_total = models.PositiveIntegerField(default=0)
    rows_imported = models.PositiveIntegerField(default=0)
    rows_skipped = models.PositiveIntegerField(default=0)
    error_message = models.TextField(blank=True)
    uploaded_by = models.ForeignKey(
        "accounts.User", on_delete=models.SET_NULL, null=True, blank=True
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"{self.get_source_type_display()} ({self.created_at:%Y-%m-%d %H:%M})"
