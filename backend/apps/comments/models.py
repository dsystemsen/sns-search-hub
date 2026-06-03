from django.db import models


class Comment(models.Model):
    TAG_UNTAGGED = "untagged"
    TAG_GOOD = "good"
    TAG_QUESTION = "question"
    TAG_COMPLAINT = "complaint"
    TAG_SPAM = "spam"
    TAG_OTHER = "other"
    TAG_CHOICES = [
        (TAG_UNTAGGED, "未分類"),
        (TAG_GOOD, "好意的"),
        (TAG_QUESTION, "質問"),
        (TAG_COMPLAINT, "クレーム"),
        (TAG_SPAM, "スパム"),
        (TAG_OTHER, "その他"),
    ]

    tenant = models.ForeignKey("tenants.Tenant", on_delete=models.CASCADE, related_name="comments")
    video = models.ForeignKey(
        "channels.Video", on_delete=models.CASCADE, related_name="comments"
    )
    youtube_comment_id = models.CharField(max_length=64, blank=True)
    author_name = models.CharField(max_length=255)
    text = models.TextField()
    published_at = models.DateTimeField(null=True, blank=True)
    likes = models.PositiveIntegerField(default=0)
    is_handled = models.BooleanField(default=False)
    is_pinned = models.BooleanField(default=False)
    tag = models.CharField(max_length=16, choices=TAG_CHOICES, default=TAG_UNTAGGED)
    internal_note = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-is_pinned", "-published_at", "-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["video", "youtube_comment_id"],
                name="uniq_yt_comment_per_video",
                condition=~models.Q(youtube_comment_id=""),
            ),
        ]
        indexes = [
            models.Index(fields=["tenant", "tag"]),
            models.Index(fields=["tenant", "is_handled"]),
            models.Index(fields=["tenant", "is_pinned"]),
        ]

    def __str__(self) -> str:
        return f"{self.author_name}: {self.text[:30]}"
