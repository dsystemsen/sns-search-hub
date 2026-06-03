from rest_framework import serializers

from .models import ChannelDailyMetric, Report, VideoDailyMetric


class VideoDailyMetricSerializer(serializers.ModelSerializer):
    class Meta:
        model = VideoDailyMetric
        fields = "__all__"


class ChannelDailyMetricSerializer(serializers.ModelSerializer):
    class Meta:
        model = ChannelDailyMetric
        fields = "__all__"


class ReportSerializer(serializers.ModelSerializer):
    class Meta:
        model = Report
        fields = (
            "id",
            "channel",
            "period_start",
            "period_end",
            "status",
            "file",
            "error_message",
            "created_at",
        )
        read_only_fields = ("status", "file", "error_message", "created_at")
