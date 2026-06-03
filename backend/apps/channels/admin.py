from django.contrib import admin

from .models import Channel, Competitor, Video


@admin.register(Channel)
class ChannelAdmin(admin.ModelAdmin):
    list_display = ("name", "tenant", "handle", "is_active", "created_at")
    list_filter = ("tenant", "is_active")
    search_fields = ("name", "handle", "youtube_channel_id")


@admin.register(Video)
class VideoAdmin(admin.ModelAdmin):
    list_display = ("title", "channel", "published_at", "duration_seconds")
    list_filter = ("channel",)
    search_fields = ("title", "youtube_video_id")


@admin.register(Competitor)
class CompetitorAdmin(admin.ModelAdmin):
    list_display = ("name", "tenant", "handle", "created_at")
    list_filter = ("tenant",)
    search_fields = ("name", "handle", "youtube_channel_id")
