"""Project-wide pytest fixtures."""

from datetime import timedelta
import pytest
from django.utils import timezone

from apps.channels.models import Channel, Competitor
from apps.tenants.models import Tenant


@pytest.fixture
def tenant(db):
    return Tenant.objects.create(
        name="Test Tenant",
        slug="test-tenant",
        plan=Tenant.PLAN_FREE,
        trial_ends_at=timezone.now() + timedelta(days=14),
    )


@pytest.fixture
def other_tenant(db):
    return Tenant.objects.create(
        name="Other Tenant",
        slug="other-tenant",
        plan=Tenant.PLAN_FREE,
    )


@pytest.fixture
def user(db, tenant, django_user_model):
    return django_user_model.objects.create_user(
        username="owner@test.local",
        email="owner@test.local",
        password="testpass1234",
        tenant=tenant,
        role="owner",
    )


@pytest.fixture
def other_user(db, other_tenant, django_user_model):
    return django_user_model.objects.create_user(
        username="other@test.local",
        email="other@test.local",
        password="testpass1234",
        tenant=other_tenant,
        role="owner",
    )


@pytest.fixture
def channel(db, tenant):
    return Channel.objects.create(tenant=tenant, name="My Channel", handle="mychannel")


@pytest.fixture
def competitor(db, tenant):
    return Competitor.objects.create(tenant=tenant, name="Rival", handle="rival")
