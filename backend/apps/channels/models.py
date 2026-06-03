from django.db import models

from apps.tenants.models import TenantScopedModel


class Channel(TenantScopedModel):
    youtube_channel_id = models.CharField(max_length=64, blank=True)
    name = models.CharField(max_length=255)
    handle = models.CharField(max_length=64, blank=True)
    description = models.TextField(blank=True)
    thumbnail_url = models.URLField(blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]
        constraints = [
            models.UniqueConstraint(
                fields=["tenant", "youtube_channel_id"],
                name="uniq_channel_per_tenant",
                condition=~models.Q(youtube_channel_id=""),
            ),
        ]

    def __str__(self) -> str:
        return self.name


class Video(models.Model):
    channel = models.ForeignKey(Channel, on_delete=models.CASCADE, related_name="videos")
    youtube_video_id = models.CharField(max_length=32)
    title = models.CharField(max_length=512)
    description = models.TextField(blank=True)
    published_at = models.DateTimeField(null=True, blank=True)
    duration_seconds = models.PositiveIntegerField(default=0)
    thumbnail_url = models.URLField(blank=True)
    tags = models.JSONField(default=list, blank=True)
    category = models.CharField(max_length=64, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-published_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["channel", "youtube_video_id"],
                name="uniq_video_per_channel",
            ),
        ]

    def __str__(self) -> str:
        return self.title


class Competitor(TenantScopedModel):
    """Benchmark channel (not owned by the tenant) tracked for competitive analysis."""

    youtube_channel_id = models.CharField(max_length=64, blank=True)
    name = models.CharField(max_length=255)
    handle = models.CharField(max_length=64, blank=True)
    note = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name
