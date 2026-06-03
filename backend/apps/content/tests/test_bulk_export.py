"""Bulk submit / cancel and CSV export for content plans."""

import pytest
from datetime import timedelta
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken


def _auth(u):
    refresh = RefreshToken.for_user(u)
    c = APIClient()
    c.credentials(HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}")
    return c


@pytest.fixture
def plans(db, user, channel):
    from apps.content.models import ContentPlan, ContentPlanApproval

    result = []
    for i in range(3):
        plan = ContentPlan.objects.create(
            tenant=user.tenant,
            channel=channel,
            title=f"Plan {i}",
            planned_publish_at=timezone.now() + timedelta(days=i + 1),
            status=ContentPlan.STATUS_DRAFT,
            created_by=user,
        )
        ContentPlanApproval.objects.create(content_plan=plan, approver=user, order=0)
        result.append(plan)
    return result


def test_bulk_submit_moves_drafts_to_in_review(user, plans):
    client = _auth(user)
    ids = [p.id for p in plans]
    resp = client.post("/api/content/plans/bulk-submit/", {"ids": ids}, format="json")
    assert resp.status_code == 200
    assert resp.json()["submitted"] == 3


def test_bulk_cancel_skips_published(user, plans):
    from apps.content.models import ContentPlan

    plans[0].status = ContentPlan.STATUS_PUBLISHED
    plans[0].save()
    client = _auth(user)
    resp = client.post(
        "/api/content/plans/bulk-cancel/",
        {"ids": [p.id for p in plans]},
        format="json",
    )
    assert resp.status_code == 200
    # Published plan is skipped, the other 2 are cancelled
    assert resp.json()["cancelled"] == 2


def test_plans_export_csv(user, plans):
    client = _auth(user)
    resp = client.get("/api/content/plans/export/")
    assert resp.status_code == 200
    body = b"".join(resp.streaming_content).decode("utf-8-sig")
    assert "Plan 0" in body
    assert "公開予定" in body  # header
