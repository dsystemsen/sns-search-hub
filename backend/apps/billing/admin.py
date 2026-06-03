from django.contrib import admin

from .models import Plan, Subscription


@admin.register(Plan)
class PlanAdmin(admin.ModelAdmin):
    list_display = ("code", "name", "monthly_price_jpy", "annual_price_jpy", "is_active")
    list_filter = ("is_active",)


@admin.register(Subscription)
class SubscriptionAdmin(admin.ModelAdmin):
    list_display = ("tenant", "plan", "status", "current_period_end", "cancel_at_period_end")
    list_filter = ("status", "plan")
    search_fields = ("tenant__name", "stripe_customer_id")
