from rest_framework import serializers

from .models import Channel, Competitor, Video


class ChannelSerializer(serializers.ModelSerializer):
    class Meta:
        model = Channel
        fields = (
            "id",
            "youtube_channel_id",
            "name",
            "handle",
            "description",
            "thumbnail_url",
            "is_active",
            "created_at",
        )
        read_only_fields = ("created_at",)


class VideoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Video
        fields = (
            "id",
            "channel",
            "youtube_video_id",
            "title",
            "description",
            "published_at",
            "duration_seconds",
            "thumbnail_url",
            "tags",
            "category",
        )


class CompetitorSerializer(serializers.ModelSerializer):
    class Meta:
        model = Competitor
        fields = (
            "id",
            "youtube_channel_id",
            "name",
            "handle",
            "note",
            "created_at",
        )
        read_only_fields = ("created_at",)
