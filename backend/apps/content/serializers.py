from django.contrib.auth import get_user_model
from rest_framework import serializers

from .models import ContentPlan, ContentPlanApproval, ContentPlanComment

User = get_user_model()


class ApproverBriefSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ("id", "email", "username")


class ContentPlanApprovalSerializer(serializers.ModelSerializer):
    approver_detail = ApproverBriefSerializer(source="approver", read_only=True)

    class Meta:
        model = ContentPlanApproval
        fields = (
            "id",
            "order",
            "approver",
            "approver_detail",
            "status",
            "comment",
            "decided_at",
            "created_at",
        )
        read_only_fields = ("status", "decided_at", "created_at", "approver_detail")


class ContentPlanCommentSerializer(serializers.ModelSerializer):
    author_detail = ApproverBriefSerializer(source="author", read_only=True)

    class Meta:
        model = ContentPlanComment
        fields = ("id", "author", "author_detail", "body", "created_at")
        read_only_fields = ("author", "author_detail", "created_at")


class ContentPlanSerializer(serializers.ModelSerializer):
    approvals = ContentPlanApprovalSerializer(many=True, read_only=True)
    comments = ContentPlanCommentSerializer(many=True, read_only=True)
    created_by_detail = ApproverBriefSerializer(source="created_by", read_only=True)
    approver_ids = serializers.ListField(
        child=serializers.IntegerField(),
        required=False,
        write_only=True,
        help_text="承認者のユーザーIDリスト（順序が3段階承認の順番）",
    )

    class Meta:
        model = ContentPlan
        fields = (
            "id",
            "channel",
            "title",
            "description",
            "thumbnail_url",
            "planned_publish_at",
            "status",
            "created_by",
            "created_by_detail",
            "approvals",
            "comments",
            "approver_ids",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("status", "created_by", "created_at", "updated_at")

    def create(self, validated_data):
        approver_ids = validated_data.pop("approver_ids", [])
        plan = ContentPlan.objects.create(**validated_data)
        for i, uid in enumerate(approver_ids):
            ContentPlanApproval.objects.create(content_plan=plan, approver_id=uid, order=i)
        return plan

    def update(self, instance, validated_data):
        validated_data.pop("approver_ids", None)
        return super().update(instance, validated_data)
