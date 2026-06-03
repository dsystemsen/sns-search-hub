"""Verify that one tenant cannot see or modify another tenant's records via the API."""

from rest_framework.test import APIClient


def _auth(user):
    from rest_framework_simplejwt.tokens import RefreshToken

    refresh = RefreshToken.for_user(user)
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}")
    return client


def test_user_sees_only_own_channels(user, other_user, channel):
    from apps.channels.models import Channel

    Channel.objects.create(tenant=other_user.tenant, name="Other Channel")

    client = _auth(user)
    resp = client.get("/api/channels/channels/")
    assert resp.status_code == 200
    names = [c["name"] for c in resp.json()["results"]]
    assert names == [channel.name]


def test_user_cannot_access_other_tenants_channel(user, other_user):
    from apps.channels.models import Channel

    other_channel = Channel.objects.create(tenant=other_user.tenant, name="Other")
    client = _auth(user)
    resp = client.get(f"/api/channels/channels/{other_channel.id}/")
    assert resp.status_code == 404


def test_creating_channel_attaches_own_tenant(user):
    client = _auth(user)
    resp = client.post(
        "/api/channels/channels/",
        {"name": "Created", "handle": "newch"},
        format="json",
    )
    assert resp.status_code == 201
    from apps.channels.models import Channel

    obj = Channel.objects.get(name="Created")
    assert obj.tenant == user.tenant


def test_dashboard_blocked_for_other_tenant_channel(user, other_user):
    from apps.channels.models import Channel

    other_channel = Channel.objects.create(tenant=other_user.tenant, name="Other")
    client = _auth(user)
    resp = client.get(f"/api/analytics/channels/{other_channel.id}/dashboard/")
    assert resp.status_code == 403
