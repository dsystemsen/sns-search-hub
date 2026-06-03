"""Billing service layer.

Wraps Stripe API calls so the rest of the codebase doesn't import `stripe`
directly, and so we can run in a "demo mode" without real Stripe credentials.
In demo mode, plan upgrades take effect immediately and skip checkout.
"""

from __future__ import annotations

from datetime import timedelta
from typing import Any

import stripe
from django.conf import settings
from django.utils import timezone

from apps.tenants.models import Tenant

from .models import Plan, Subscription


def _stripe_enabled() -> bool:
    return bool(settings.STRIPE_SECRET_KEY) and not settings.STRIPE_DEMO_MODE


def _stripe_init():
    if settings.STRIPE_SECRET_KEY:
        stripe.api_key = settings.STRIPE_SECRET_KEY


def get_or_create_subscription(tenant: Tenant) -> Subscription:
    """Ensure the tenant has a Subscription row attached to a default plan."""
    try:
        return tenant.subscription
    except Subscription.DoesNotExist:
        default_plan = Plan.objects.filter(is_active=True).order_by("monthly_price_jpy").first()
        if default_plan is None:
            raise RuntimeError("プランが定義されていません。`seed_plans` を実行してください。")
        return Subscription.objects.create(
            tenant=tenant,
            plan=default_plan,
            status=Subscription.STATUS_TRIALING,
            current_period_end=timezone.now() + timedelta(days=14),
        )


def start_checkout(tenant: Tenant, plan: Plan, interval: str = "month") -> dict[str, Any]:
    """Begin a checkout flow. Returns either a real Stripe URL or, in demo mode,
    a `demo=true` flag the frontend can pop a confirmation for."""
    sub = get_or_create_subscription(tenant)

    if not _stripe_enabled():
        # Demo mode: apply immediately, no Stripe call.
        sub.plan = plan
        sub.status = Subscription.STATUS_ACTIVE
        sub.current_period_end = timezone.now() + timedelta(
            days=365 if interval == "year" else 30
        )
        sub.cancel_at_period_end = False
        sub.save()
        return {"demo": True, "plan_code": plan.code, "interval": interval}

    _stripe_init()
    price_id = plan.stripe_price_id_annual if interval == "year" else plan.stripe_price_id_monthly
    if not price_id:
        raise ValueError(f"プラン '{plan.code}' に Stripe price ID が設定されていません。")

    customer_id = sub.stripe_customer_id or None
    if not customer_id:
        owner = tenant.users.filter(role="owner").first()
        customer = stripe.Customer.create(
            email=owner.email if owner else None, metadata={"tenant_id": tenant.id}
        )
        customer_id = customer.id
        sub.stripe_customer_id = customer_id
        sub.save(update_fields=["stripe_customer_id", "updated_at"])

    session = stripe.checkout.Session.create(
        customer=customer_id,
        mode="subscription",
        line_items=[{"price": price_id, "quantity": 1}],
        success_url=f"{settings.APP_BASE_URL}/app/billing?ok=1",
        cancel_url=f"{settings.APP_BASE_URL}/app/billing?cancelled=1",
        metadata={"tenant_id": tenant.id, "plan_code": plan.code},
    )
    return {"demo": False, "checkout_url": session.url}


def cancel_subscription(tenant: Tenant) -> Subscription:
    sub = get_or_create_subscription(tenant)
    if not _stripe_enabled() or not sub.stripe_subscription_id:
        sub.status = Subscription.STATUS_CANCELED
        sub.cancel_at_period_end = True
        sub.save()
        return sub

    _stripe_init()
    stripe.Subscription.modify(sub.stripe_subscription_id, cancel_at_period_end=True)
    sub.cancel_at_period_end = True
    sub.save()
    return sub


def handle_stripe_event(event: dict[str, Any]) -> None:
    """Apply a Stripe webhook event to our local Subscription state."""
    event_type = event.get("type", "")
    data = event.get("data", {}).get("object", {})

    if event_type == "checkout.session.completed":
        tenant_id = (data.get("metadata") or {}).get("tenant_id")
        plan_code = (data.get("metadata") or {}).get("plan_code")
        if not tenant_id or not plan_code:
            return
        try:
            tenant = Tenant.objects.get(pk=tenant_id)
            plan = Plan.objects.get(code=plan_code)
        except (Tenant.DoesNotExist, Plan.DoesNotExist):
            return
        sub = get_or_create_subscription(tenant)
        sub.plan = plan
        sub.status = Subscription.STATUS_ACTIVE
        sub.stripe_subscription_id = data.get("subscription") or sub.stripe_subscription_id
        sub.save()

    elif event_type in ("customer.subscription.updated", "customer.subscription.deleted"):
        stripe_sub_id = data.get("id")
        if not stripe_sub_id:
            return
        try:
            sub = Subscription.objects.get(stripe_subscription_id=stripe_sub_id)
        except Subscription.DoesNotExist:
            return
        stripe_status = data.get("status")
        if stripe_status == "active":
            sub.status = Subscription.STATUS_ACTIVE
        elif stripe_status == "trialing":
            sub.status = Subscription.STATUS_TRIALING
        elif stripe_status == "past_due":
            sub.status = Subscription.STATUS_PAST_DUE
        elif stripe_status in ("canceled", "incomplete_expired"):
            sub.status = Subscription.STATUS_CANCELED
        sub.cancel_at_period_end = bool(data.get("cancel_at_period_end"))
        period_end = data.get("current_period_end")
        if period_end:
            from datetime import datetime, timezone as tz

            sub.current_period_end = datetime.fromtimestamp(period_end, tz=tz.utc)
        sub.save()
