from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone
from datetime import timedelta
from rest_framework import serializers

from apps.tenants.models import Tenant

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ("id", "email", "username", "role", "tenant", "date_joined")
        read_only_fields = ("role", "tenant", "date_joined")


class SignupSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=8)
    company_name = serializers.CharField(max_length=255)

    def validate_email(self, value: str) -> str:
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError("このメールアドレスは既に使用されています。")
        return value

    @transaction.atomic
    def create(self, validated_data):
        from django.utils.text import slugify
        import uuid

        slug = slugify(validated_data["company_name"]) or uuid.uuid4().hex[:8]
        base_slug = slug
        i = 1
        while Tenant.objects.filter(slug=slug).exists():
            i += 1
            slug = f"{base_slug}-{i}"

        tenant = Tenant.objects.create(
            name=validated_data["company_name"],
            slug=slug,
            plan=Tenant.PLAN_FREE,
            trial_ends_at=timezone.now() + timedelta(days=14),
        )
        user = User.objects.create_user(
            username=validated_data["email"],
            email=validated_data["email"],
            password=validated_data["password"],
            tenant=tenant,
            role=User.ROLE_OWNER,
        )
        return user
