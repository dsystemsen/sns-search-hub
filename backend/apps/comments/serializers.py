from rest_framework import serializers

from .models import Comment


class CommentSerializer(serializers.ModelSerializer):
    video_title = serializers.CharField(source="video.title", read_only=True)
    channel_id = serializers.IntegerField(source="video.channel_id", read_only=True)

    class Meta:
        model = Comment
        fields = (
            "id",
            "video",
            "video_title",
            "channel_id",
            "youtube_comment_id",
            "author_name",
            "text",
            "published_at",
            "likes",
            "is_handled",
            "is_pinned",
            "tag",
            "internal_note",
            "created_at",
        )
        read_only_fields = ("video_title", "channel_id", "created_at")
