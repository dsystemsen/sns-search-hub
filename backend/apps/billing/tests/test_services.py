"""Test the billing service layer in demo mode (no real Stripe calls)."""

import pytest
from django.test import override_settings

from apps.billing.models import Plan, Subscription
from apps.billing.services import (
    cancel_subscription,
    get_or_create_subscription,
    start_checkout,
)


@pytest.fixture
def plans(db):
    starter = Plan.objects.create(code="starter", name="Starter", monthly_price_jpy=30000)
    pro = Plan.objects.create(code="pro", name="Pro", monthly_price_jpy=50000)
    return starter, pro


@override_settings(STRIPE_DEMO_MODE=True, STRIPE_SECRET_KEY="")
def test_get_or_create_subscription_creates_default(tenant, plans):
    sub = get_or_create_subscription(tenant)
    assert sub.plan_id == plans[0].id  # starter (cheapest)
    assert sub.status == Subscription.STATUS_TRIALING


@override_settings(STRIPE_DEMO_MODE=True, STRIPE_SECRET_KEY="")
def test_demo_checkout_upgrades_immediately(tenant, plans):
    _, pro = plans
    result = start_checkout(tenant, pro, interval="month")
    assert result["demo"] is True
    sub = Subscription.objects.get(tenant=tenant)
    assert sub.plan_id == pro.id
    assert sub.status == Subscription.STATUS_ACTIVE


@override_settings(STRIPE_DEMO_MODE=True, STRIPE_SECRET_KEY="")
def test_demo_cancel_marks_canceled(tenant, plans):
    sub = get_or_create_subscription(tenant)
    sub.status = Subscription.STATUS_ACTIVE
    sub.save()
    cancelled = cancel_subscription(tenant)
    assert cancelled.status == Subscription.STATUS_CANCELED
    assert cancelled.cancel_at_period_end is True


@override_settings(STRIPE_DEMO_MODE=True, STRIPE_SECRET_KEY="")
def test_annual_interval_extends_period(tenant, plans):
    _, pro = plans
    start_checkout(tenant, pro, interval="year")
    sub = Subscription.objects.get(tenant=tenant)
    from django.utils import timezone

    delta = sub.current_period_end - timezone.now()
    assert delta.days >= 360
