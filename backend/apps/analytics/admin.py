from django.contrib import admin

from .models import ChannelDailyMetric, CompetitorDailyMetric, Report, VideoDailyMetric


@admin.register(VideoDailyMetric)
class VideoDailyMetricAdmin(admin.ModelAdmin):
    list_display = ("video", "date", "views", "watch_time_minutes", "likes", "comments")
    list_filter = ("date",)
    date_hierarchy = "date"


@admin.register(ChannelDailyMetric)
class ChannelDailyMetricAdmin(admin.ModelAdmin):
    list_display = ("channel", "date", "subscribers_total", "views", "watch_time_minutes")
    list_filter = ("channel",)
    date_hierarchy = "date"


@admin.register(CompetitorDailyMetric)
class CompetitorDailyMetricAdmin(admin.ModelAdmin):
    list_display = ("competitor", "date", "subscribers_total", "videos_total", "views_total")
    list_filter = ("competitor",)
    date_hierarchy = "date"


@admin.register(Report)
class ReportAdmin(admin.ModelAdmin):
    list_display = ("tenant", "channel", "period_start", "period_end", "status", "created_at")
    list_filter = ("status", "tenant")
    date_hierarchy = "created_at"
