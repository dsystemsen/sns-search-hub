from django.db import models


class Plan(models.Model):
    code = models.CharField(max_length=32, unique=True)
    name = models.CharField(max_length=100)
    monthly_price_jpy = models.PositiveIntegerField(default=0)
    annual_price_jpy = models.PositiveIntegerField(default=0)
    included_channels = models.PositiveIntegerField(default=1)
    extra_channel_price_jpy = models.PositiveIntegerField(default=0)
    stripe_price_id_monthly = models.CharField(max_length=128, blank=True)
    stripe_price_id_annual = models.CharField(max_length=128, blank=True)
    is_active = models.BooleanField(default=True)

    def __str__(self) -> str:
        return self.name


class Subscription(models.Model):
    STATUS_TRIALING = "trialing"
    STATUS_ACTIVE = "active"
    STATUS_PAST_DUE = "past_due"
    STATUS_CANCELED = "canceled"
    STATUS_CHOICES = [
        (STATUS_TRIALING, "Trialing"),
        (STATUS_ACTIVE, "Active"),
        (STATUS_PAST_DUE, "Past Due"),
        (STATUS_CANCELED, "Canceled"),
    ]

    tenant = models.OneToOneField(
        "tenants.Tenant", on_delete=models.CASCADE, related_name="subscription"
    )
    plan = models.ForeignKey(Plan, on_delete=models.PROTECT)
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default=STATUS_TRIALING)
    stripe_customer_id = models.CharField(max_length=128, blank=True)
    stripe_subscription_id = models.CharField(max_length=128, blank=True)
    current_period_end = models.DateTimeField(null=True, blank=True)
    cancel_at_period_end = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
