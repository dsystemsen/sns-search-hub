from django.db import models


class ContentPlan(models.Model):
    STATUS_DRAFT = "draft"
    STATUS_IN_REVIEW = "in_review"
    STATUS_APPROVED = "approved"
    STATUS_REJECTED = "rejected"
    STATUS_PUBLISHED = "published"
    STATUS_CANCELLED = "cancelled"
    STATUS_CHOICES = [
        (STATUS_DRAFT, "下書き"),
        (STATUS_IN_REVIEW, "レビュー中"),
        (STATUS_APPROVED, "承認済み"),
        (STATUS_REJECTED, "差し戻し"),
        (STATUS_PUBLISHED, "公開済み"),
        (STATUS_CANCELLED, "キャンセル"),
    ]

    tenant = models.ForeignKey(
        "tenants.Tenant", on_delete=models.CASCADE, related_name="content_plans"
    )
    channel = models.ForeignKey(
        "channels.Channel", on_delete=models.SET_NULL, null=True, blank=True
    )
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    thumbnail_url = models.URLField(blank=True)
    planned_publish_at = models.DateTimeField()
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default=STATUS_DRAFT)
    created_by = models.ForeignKey(
        "accounts.User", on_delete=models.SET_NULL, null=True, blank=True, related_name="created_plans"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["planned_publish_at"]
        indexes = [
            models.Index(fields=["tenant", "planned_publish_at"]),
            models.Index(fields=["tenant", "status"]),
        ]

    def __str__(self) -> str:
        return self.title


class ContentPlanApproval(models.Model):
    STATUS_PENDING = "pending"
    STATUS_APPROVED = "approved"
    STATUS_REJECTED = "rejected"
    STATUS_CHOICES = [
        (STATUS_PENDING, "承認待ち"),
        (STATUS_APPROVED, "承認"),
        (STATUS_REJECTED, "差し戻し"),
    ]

    content_plan = models.ForeignKey(
        ContentPlan, on_delete=models.CASCADE, related_name="approvals"
    )
    order = models.PositiveIntegerField(default=0)
    approver = models.ForeignKey(
        "accounts.User", on_delete=models.CASCADE, related_name="content_approvals"
    )
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default=STATUS_PENDING)
    comment = models.TextField(blank=True)
    decided_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["order", "created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["content_plan", "approver"], name="uniq_approver_per_plan"
            ),
        ]


class ContentPlanComment(models.Model):
    content_plan = models.ForeignKey(
        ContentPlan, on_delete=models.CASCADE, related_name="comments"
    )
    author = models.ForeignKey(
        "accounts.User", on_delete=models.SET_NULL, null=True, related_name="plan_comments"
    )
    body = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]
