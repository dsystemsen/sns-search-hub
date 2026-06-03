from django.db import models


class Tenant(models.Model):
    PLAN_FREE = "free"
    PLAN_STARTER = "starter"
    PLAN_PRO = "pro"
    PLAN_ENTERPRISE = "enterprise"
    PLAN_CHOICES = [
        (PLAN_FREE, "Free Trial"),
        (PLAN_STARTER, "Starter"),
        (PLAN_PRO, "Pro"),
        (PLAN_ENTERPRISE, "Enterprise"),
    ]

    name = models.CharField(max_length=255)
    slug = models.SlugField(max_length=64, unique=True)
    plan = models.CharField(max_length=32, choices=PLAN_CHOICES, default=PLAN_FREE)
    trial_ends_at = models.DateTimeField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    slack_webhook_url = models.URLField(blank=True, max_length=500)
    discord_webhook_url = models.URLField(blank=True, max_length=500)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return self.name


class TenantScopedModel(models.Model):
    """Base model for any record that belongs to one tenant."""

    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name="+")

    class Meta:
        abstract = True
