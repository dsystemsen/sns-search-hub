"""Verify the content plan approval state machine."""

import pytest
from datetime import timedelta
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken


def _auth(user):
    refresh = RefreshToken.for_user(user)
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}")
    return client


@pytest.fixture
def plan_factory(user, channel):
    def _make(approver_ids=None, status="draft"):
        from apps.content.models import ContentPlan, ContentPlanApproval

        plan = ContentPlan.objects.create(
            tenant=user.tenant,
            channel=channel,
            title="Test plan",
            planned_publish_at=timezone.now() + timedelta(days=7),
            status=status,
            created_by=user,
        )
        for i, uid in enumerate(approver_ids or [user.id]):
            ContentPlanApproval.objects.create(content_plan=plan, approver_id=uid, order=i)
        return plan

    return _make


def test_submit_moves_draft_to_in_review(user, plan_factory):
    plan = plan_factory()
    client = _auth(user)
    resp = client.post(f"/api/content/plans/{plan.id}/submit/")
    assert resp.status_code == 200
    assert resp.json()["status"] == "in_review"


def test_submit_without_approvers_rejected(user, channel):
    from apps.content.models import ContentPlan

    plan = ContentPlan.objects.create(
        tenant=user.tenant,
        channel=channel,
        title="No approvers",
        planned_publish_at=timezone.now() + timedelta(days=7),
        created_by=user,
    )
    client = _auth(user)
    resp = client.post(f"/api/content/plans/{plan.id}/submit/")
    assert resp.status_code == 400


def test_approve_marks_plan_approved(user, plan_factory):
    plan = plan_factory(status="in_review")
    client = _auth(user)
    resp = client.post(
        f"/api/content/plans/{plan.id}/decide/",
        {"decision": "approve", "comment": "LGTM"},
        format="json",
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "approved"
    assert data["approvals"][0]["status"] == "approved"
    assert data["approvals"][0]["comment"] == "LGTM"


def test_reject_moves_to_rejected(user, plan_factory):
    plan = plan_factory(status="in_review")
    client = _auth(user)
    resp = client.post(
        f"/api/content/plans/{plan.id}/decide/",
        {"decision": "reject", "comment": "needs work"},
        format="json",
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "rejected"


def test_resubmit_after_reject_clears_approvals(user, plan_factory):
    plan = plan_factory(status="in_review")
    client = _auth(user)
    client.post(
        f"/api/content/plans/{plan.id}/decide/",
        {"decision": "reject", "comment": "fix"},
        format="json",
    )
    # Resubmit
    resp = client.post(f"/api/content/plans/{plan.id}/submit/")
    assert resp.status_code == 200
    assert resp.json()["status"] == "in_review"
    assert all(a["status"] == "pending" for a in resp.json()["approvals"])


def test_non_approver_cannot_decide(other_user, plan_factory):
    plan = plan_factory(status="in_review")
    client = _auth(other_user)
    resp = client.post(
        f"/api/content/plans/{plan.id}/decide/",
        {"decision": "approve"},
        format="json",
    )
    # Either 404 (different tenant) or 403 — both are acceptable
    assert resp.status_code in (403, 404)


def test_publish_requires_approved(user, plan_factory):
    plan = plan_factory(status="draft")
    client = _auth(user)
    resp = client.post(f"/api/content/plans/{plan.id}/mark-published/")
    assert resp.status_code == 400
