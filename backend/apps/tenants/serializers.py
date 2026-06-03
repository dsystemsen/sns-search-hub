from rest_framework import serializers

from .models import Tenant


class TenantSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tenant
        fields = (
            "id",
            "name",
            "slug",
            "plan",
            "trial_ends_at",
            "is_active",
            "slack_webhook_url",
            "discord_webhook_url",
            "created_at",
        )
        read_only_fields = ("slug", "plan", "trial_ends_at", "is_active", "created_at")
